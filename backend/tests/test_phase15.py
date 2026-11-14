"""Phase 15: final AI benchmark guard (incl. questions opened from the Explorer) and investigation-acronym detection."""
from __future__ import annotations

from .conftest import requires_db

pytestmark = requires_db


def test_bre_and_same_acronyms_are_detected_only_in_capitals():
    from app.services.assistant import _detect_investigations as det
    assert "PSI-20" in det("Above which oxygen level did the BRE observe quasi-steady flames?", None)
    assert "PSI-102" in det("What did SAME measure for Kapton?", None)
    assert "PSI-20" not in det("Did the flame break apart in the BASS-II tests?", None)
    assert "PSI-102" not in det("Is the burning rate the same in both fuels?", None)


def test_phase15_benchmark_with_explorer_opened_questions():
    from app.eval import phase14_eval
    rep = phase14_eval.run(phase14_eval.PHASE15)
    m = rep["metrics"]
    assert rep["n_questions"] == 16
    assert m["abstain_ok"]["rate"] == 1.0                    # unsupported abstain (also when opened from the Explorer)
    assert m["type_ok"]["rate"] >= 0.9
    assert m["inv_hit"]["rate"] >= 0.9 and m["structured_hit"]["rate"] >= 0.9
    assert m["source_type_hit"]["rate"] == 1.0               # the Explorer context item is present when handed off
    assert m["data_ok"]["rate"] >= 0.85
