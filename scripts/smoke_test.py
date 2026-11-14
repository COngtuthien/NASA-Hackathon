"""SpaceFire AI smoke test against a running backend (default http://127.0.0.1:8000).

Usage: backend/.venv/Scripts/python scripts/smoke_test.py [base_url]
Checks connectivity, record counts, retrieval, analytics and assistant fallback. Exit code 1 on failure.
"""
from __future__ import annotations

import json
import sys
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
failures: list[str] = []


def call(path: str, body: dict | None = None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body else None,
                                 headers={"Content-Type": "application/json"}, method="POST" if body else "GET")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def check(name: str, cond: bool, detail: str = "") -> None:
    print(("PASS " if cond else "FAIL ") + name + (f"  ({detail})" if detail else ""))
    if not cond:
        failures.append(name)


try:
    h = call("/health")
except Exception as exc:  # noqa: BLE001
    print(f"FAIL backend not reachable at {BASE}: {exc}")
    sys.exit(1)
c = h["database"]["counts"]
check("health ok", h["status"] == "ok", h["retrieval"]["mode"])
check("import counts 274/129/2", (c["flex_burns"], c["bass2_burns"], c["saffire1_burns"]) == (274, 129, 2), str(c))
ev = call("/evidence/search?q=BASS-II%20Table%205.1&limit=5")
check("evidence: Table 5.1 on PDF p.65", any(r["page_pdf"] == 65 for r in ev["results"]))
d2 = call("/analytics/flex/d2")["summary"]
check("FLEX d2 median ratio ~1", 0.9 < d2["median_ratio"] < 1.2, f"median {d2['median_ratio']}, n={d2['n_included']}")
g = call("/analytics/bass/gases")["summary"]
check("BASS-II CO2/O2 slope near 5/6", 0.7 < g["slope_co2_per_o2_above_resolution"] < 0.9, str(g["slope_co2_per_o2_above_resolution"]))
s = call("/analytics/saffire/case")
check("SAFFIRE manifest 12 camera sets", len(s["manifest"]) == 12)
a = call("/assistant/ask", {"question": "Does Disruption mean extinction in FLEX?", "source_scope": "internal"})
check("assistant returns cited evidence", len(a["citations"]) > 0, f"status={a['status']}, llm={a['llm']['mode']}")
print(f"\n{'ALL PASSED' if not failures else str(len(failures)) + ' FAILED'}")
sys.exit(1 if failures else 0)
