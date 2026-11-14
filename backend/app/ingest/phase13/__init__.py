"""Phase 13 scientific processing for the seven newly audited NASA investigations.

`python -m app.ingest.phase13.run` (from backend/) reads the immutable NASA folders (FLEX-2, PSI-117, PSI-62,
SAME, ACME BRE, ACME CFI-G, ACME Flame Design) and writes compact, verified, provenance-carrying derivatives to
processed/curated/phase13/*.json. Those JSON files are committed; the main ingest (`python -m app.ingest.run`)
loads them into the database, so the application does not need the large source folders at run time.
"""
