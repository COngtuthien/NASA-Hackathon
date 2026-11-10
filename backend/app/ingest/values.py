"""Typed parsing of raw spreadsheet cells.

The raw string is never discarded. Each cell is classified into a `value_kind`
so that blank, dash, `none`, `OR`, `~6`, `21.5 - 21.7` and `250>50>250` are
never treated as interchangeable (spec §1.5).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

EN_DASH = "–"
EM_DASH = "—"

NUM_RE = re.compile(r"^[+-]?(?:\d+\.?\d*|\.\d+)$")
APPROX_RE = re.compile(r"^~\s*([+-]?(?:\d+\.?\d*|\.\d+))$")
RANGE_RE = re.compile(r"^([+-]?(?:\d+\.?\d*|\.\d+))\s*[-" + EN_DASH + r"]\s*([+-]?(?:\d+\.?\d*|\.\d+))$")
LOWER_BOUND_RE = re.compile(r"^>\s*([+-]?(?:\d+\.?\d*|\.\d+))$")
UPPER_BOUND_RE = re.compile(r"^<\s*([+-]?(?:\d+\.?\d*|\.\d+))$")

# Value kinds (stable vocabulary exposed through the API)
PRESENT = "present"          # clean single number
BLANK = "blank"              # empty cell
DASH = "dash"                # en/em dash or '-' used as 'no value'
NONE = "none"                # literal word 'none'
APPROXIMATE = "approximate"  # '~6'
RANGE = "range"              # '21.5 - 21.7'
OVER_RANGE = "over_range"    # 'OR', 'over'  (sensor over range; value unknown)
LOWER_BOUND = "lower_bound"  # '>500'
UPPER_BOUND = "upper_bound"  # '<1'
SEQUENCE = "sequence"        # multi-stage free text e.g. '5  3  2  1'
TEXT = "text"                # non-numeric text / category
INVALID = "invalid"          # parse failure that should have been numeric
NOT_APPLICABLE = "not_applicable"

MISSING_KINDS = {BLANK, DASH, NONE, NOT_APPLICABLE}


@dataclass
class ParsedValue:
    raw: str
    kind: str
    value: float | None = None       # point value when meaningful
    low: float | None = None
    high: float | None = None
    text: str | None = None
    tokens: list[str] = field(default_factory=list)

    @property
    def is_numeric(self) -> bool:
        return self.kind == PRESENT and self.value is not None

    def as_dict(self) -> dict:
        d = {"raw": self.raw, "kind": self.kind, "value": self.value, "low": self.low, "high": self.high}
        if self.text is not None:
            d["text"] = self.text
        if self.tokens:
            d["tokens"] = self.tokens
        return d


def parse_number_cell(raw: str | None) -> ParsedValue:
    """Parse a cell that is *expected* to be numeric."""
    s = "" if raw is None else str(raw)
    t = s.strip()
    if t == "":
        return ParsedValue(s, BLANK)
    if t in (EN_DASH, EM_DASH, "-", "--"):
        return ParsedValue(s, DASH)
    low = t.lower()
    if low == "none":
        return ParsedValue(s, NONE)
    if low in ("or", "over"):
        return ParsedValue(s, OVER_RANGE, text=t)
    if NUM_RE.match(t):
        v = float(t)
        return ParsedValue(s, PRESENT, value=v, low=v, high=v)
    m = APPROX_RE.match(t)
    if m:
        v = float(m.group(1))
        return ParsedValue(s, APPROXIMATE, value=v, low=v, high=v)
    m = RANGE_RE.match(t)
    if m:
        a, b = float(m.group(1)), float(m.group(2))
        lo, hi = min(a, b), max(a, b)
        return ParsedValue(s, RANGE, value=None, low=lo, high=hi)
    m = LOWER_BOUND_RE.match(t)
    if m:
        v = float(m.group(1))
        return ParsedValue(s, LOWER_BOUND, low=v)
    m = UPPER_BOUND_RE.match(t)
    if m:
        v = float(m.group(1))
        return ParsedValue(s, UPPER_BOUND, high=v)
    return ParsedValue(s, INVALID, text=t)


_SPLIT_RE = re.compile(r"\s{2,}|;|\t")


def parse_sequence_cell(raw: str | None) -> ParsedValue:
    """Parse free-text multi-stage cells (BASS-II fan/air/radiometer).

    A single clean number returns PRESENT. Otherwise the original string is
    kept and split into display tokens. No averaging, no reinterpretation.
    """
    s = "" if raw is None else str(raw)
    t = s.strip()
    if t == "":
        return ParsedValue(s, BLANK)
    if NUM_RE.match(t):
        v = float(t)
        return ParsedValue(s, PRESENT, value=v, low=v, high=v)
    tokens = [tok.strip() for tok in _SPLIT_RE.split(t) if tok.strip()]
    if len(tokens) > 1:
        return ParsedValue(s, SEQUENCE, text=t, tokens=tokens)
    return ParsedValue(s, TEXT, text=t, tokens=tokens)


def numeric_tokens(tokens: list[str]) -> list[float]:
    out = []
    for tok in tokens:
        if NUM_RE.match(tok):
            out.append(float(tok))
    return out
