"""Run all Phase 13 processors: `python -m app.ingest.phase13.run` (from backend/).

Writes one JSON per dataset to processed/curated/phase13/ plus processing_report.json with the executed counts.
Requires the local NASA folders; it never writes to them. Deterministic (no timestamps inside dataset files).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from ...core.config import get_settings
from . import acme_other, cfig, psi117, registry, same
from .common import OUT_SUBDIR, PROCESSOR_VERSION, write_json

REQUIRED_DIRS = ("ACME CFI-G", "ACME Flame Design", "ACME BRE", "SAME", "PSI-117", "FLEX-2", "PSI-62")


def run() -> dict:
    s = get_settings()
    repo = s.repo_root
    missing = [d for d in REQUIRED_DIRS if not (repo / d).is_dir()]
    if "AMCE Flame Design" in {p.name for p in repo.iterdir()} and "ACME Flame Design" in missing:
        raise SystemExit("Found 'AMCE Flame Design': rename it to 'ACME Flame Design' first (see PHASE13 report).")
    if missing:
        raise SystemExit(f"Missing NASA source folders: {missing}")
    out = s.processed_dir / OUT_SUBDIR
    datasets = cfig.build(repo) + acme_other.build(repo) + same.build(repo) + psi117.build(repo)
    reg, env = registry.build(repo)
    datasets += [reg] + ([env] if env else [])
    report = {"processor_version": PROCESSOR_VERSION, "datasets": {}}
    for d in datasets:
        write_json(out / f"{d.dataset_id}.json", d.to_json())
        report["datasets"][d.dataset_id] = {"investigation_id": d.investigation_id, "title": d.title,
                                            "evidence_class": d.evidence_class, **d.counts,
                                            "verification": _verification(d)}
    write_json(out / "processing_report.json", report)
    return report


def _verification(d) -> dict:
    out: dict[str, int] = {}
    for r in d.records:
        out[r["verification"]] = out.get(r["verification"], 0) + 1
    return out


def main() -> None:
    rep = run()
    sys.stdout.write(json.dumps({k: {x: v[x] for x in ("source_records", "processed_records", "excluded_records",
                                                         "flagged_records", "flagged_records_warning", "verification")}
                                 for k, v in rep["datasets"].items()}, indent=1) + "\n")


if __name__ == "__main__":
    main()
