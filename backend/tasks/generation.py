from __future__ import annotations

from typing import Optional

from sqlalchemy import select

from config import get_settings
from db import SessionLocal
from models.document import Document
from models.session import WritingSession
from models.task import GenerationTask
from services.event_store import EventStore
from services.finetune_service import FinetuneService
from services.llm_service import LLMService
from services.pipeline import GenerationPipeline
from tasks.celery_app import celery_app


def _pipeline() -> GenerationPipeline:
    return GenerationPipeline(llm_service=LLMService(), finetune_service=FinetuneService())


@celery_app.task(name="generation.run")
def run_generation(task_id: int) -> None:
    stages = ("extraction", "draft", "rewrite")
    event_store = EventStore()
    with SessionLocal() as db:
        task = db.get(GenerationTask, task_id)
        if task is None:
            return

        session = db.get(WritingSession, task.session_id)
        if session is None:
            task.status = "failed"
            task.error_msg = "Session not found"
            db.commit()
            return

        try:
            task.status = "running"
            task.current_stage = "extraction"
            session.status = "running"
            db.commit()
            event_store.append(task.id, "status", {"task_id": task.id, "status": "running", "stage": "extraction"})

            stage_buffers: dict[str, list[str]] = {stage: [] for stage in stages}
            current_stage = "extraction"
            for event in _pipeline().stream(session.prompt_payload_json):
                if event["stage"] != current_stage:
                    document = _persist_document(db, session.id, current_stage, "".join(stage_buffers[current_stage]))
                    event_store.append(
                        task.id,
                        "stage_complete",
                        {"task_id": task.id, "stage": current_stage, "document_id": document.id},
                    )
                    current_stage = event["stage"]
                    task.current_stage = current_stage
                    db.commit()
                    event_store.append(
                        task.id,
                        "status",
                        {"task_id": task.id, "status": "running", "stage": current_stage},
                    )

                stage_buffers[event["stage"]].append(event["delta"])
                event_store.append(
                    task.id,
                    "chunk",
                    {"task_id": task.id, "stage": event["stage"], "delta": event["delta"]},
                )

            for stage in stages:
                if stage_buffers[stage]:
                    document = _find_document(db, session.id, stage)
                    if document is None:
                        document = _persist_document(db, session.id, stage, "".join(stage_buffers[stage]))
                    event_store.append(
                        task.id,
                        "stage_complete",
                        {"task_id": task.id, "stage": stage, "document_id": document.id},
                    )

            task.status = "done"
            task.current_stage = "rewrite"
            session.status = "done"
            db.commit()
            event_store.append(task.id, "done", {"task_id": task.id, "status": "done"})
        except Exception as exc:
            task.status = "failed"
            task.error_msg = str(exc)
            session.status = "failed"
            db.commit()
            event_store.append(task.id, "error", {"task_id": task.id, "message": str(exc)})
            raise


def enqueue_generation_task(task_id: int) -> None:
    settings = get_settings()
    if settings.celery_task_always_eager:
        run_generation(task_id)
        return
    run_generation.delay(task_id)


def _persist_document(db, session_id: int, stage: str, content: str) -> Document:
    document = Document(session_id=session_id, stage=stage, content=content, word_count=len(content.split()))
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def _find_document(db, session_id: int, stage: str) -> Optional[Document]:
    query = select(Document).where(Document.session_id == session_id, Document.stage == stage)
    return db.execute(query).scalar_one_or_none()
