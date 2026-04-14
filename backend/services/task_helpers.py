"""Shared helpers used by Celery task modules."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.document import Document
from models.fact_check_report import FactCheckReport
from models.outline import Outline
from models.task import GenerationTask
from services.event_store import EventStore


def persist_document(db: Session, session_id: int, stage: str, content: str) -> Document:
    document = Document(
        session_id=session_id,
        stage=stage,
        content=content,
        word_count=len(content.split()),
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def find_document(db: Session, session_id: int, stage: str) -> Document | None:
    stmt = (
        select(Document)
        .where(Document.session_id == session_id, Document.stage == stage)
        .order_by(Document.id.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def get_confirmed_outline(db: Session, session_id: int) -> Outline | None:
    stmt = (
        select(Outline)
        .where(Outline.session_id == session_id, Outline.status == "confirmed")
        .order_by(Outline.id.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def get_latest_fc_report(db: Session, session_id: int) -> FactCheckReport | None:
    stmt = (
        select(FactCheckReport)
        .where(FactCheckReport.session_id == session_id)
        .order_by(FactCheckReport.id.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def fail_task(db: Session, task: GenerationTask, event_store: EventStore, message: str) -> None:
    task.status = "failed"
    task.error_msg = message
    db.commit()
    event_store.append(task.id, "error", {"task_id": task.id, "message": message})
