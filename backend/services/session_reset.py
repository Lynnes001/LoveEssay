from __future__ import annotations

from sqlalchemy import delete
from sqlalchemy.orm import Session

from models.document import Document
from models.fact_check_report import FactCheckReport
from models.outline import Outline
from models.session import WritingSession

# Ordered cascade: resetting phase N also deletes phases N+1, N+2, ...
_PHASE_ORDER = ["outline", "draft", "finetune", "fact_check", "repair"]

# workflow_status to set when a phase is reset (i.e. what was "confirmed" before this phase)
_PHASE_RESET_STATUS: dict[str, str] = {
    "outline":    "start",
    "draft":      "outline_ready",
    "finetune":   "draft_ready",
    "fact_check": "finetuned_ready",
    "repair":     "fact_check_done",
}


def reset_from(db: Session, session: WritingSession, phase: str) -> None:
    """Delete all artifacts for `phase` and every downstream phase, then
    roll workflow_status back to the appropriate upstream value.

    Example: reset_from(db, session, "draft") deletes draft_doc, finetuned_doc,
    fact_check_reports, and repair_docs, then sets workflow_status = "outline_ready".
    """
    if phase not in _PHASE_ORDER:
        raise ValueError(f"Unknown phase: {phase!r}. Valid phases: {_PHASE_ORDER}")

    idx = _PHASE_ORDER.index(phase)
    for p in _PHASE_ORDER[idx:]:
        _delete_phase_artifacts(db, session.id, p)

    session.workflow_status = _PHASE_RESET_STATUS[phase]
    db.commit()


# ---------------------------------------------------------------------------
# Per-phase artifact deleters
# ---------------------------------------------------------------------------

def _delete_phase_artifacts(db: Session, session_id: int, phase: str) -> None:
    if phase == "outline":
        _delete_outlines(db, session_id)
        _delete_documents(db, session_id, "extraction")
    elif phase == "draft":
        _delete_documents(db, session_id, "draft")
    elif phase == "finetune":
        _delete_documents(db, session_id, "finetuned")
    elif phase == "fact_check":
        _delete_fc_reports(db, session_id)
    elif phase == "repair":
        _delete_documents(db, session_id, "repair")


def _delete_outlines(db: Session, session_id: int) -> None:
    db.execute(delete(Outline).where(Outline.session_id == session_id))


def _delete_documents(db: Session, session_id: int, stage: str) -> None:
    db.execute(
        delete(Document).where(Document.session_id == session_id, Document.stage == stage)
    )


def _delete_fc_reports(db: Session, session_id: int) -> None:
    db.execute(delete(FactCheckReport).where(FactCheckReport.session_id == session_id))
