from __future__ import annotations

from sqlalchemy.orm.attributes import flag_modified

from config import get_settings
from db import SessionLocal
from models.outline import Outline
from models.session import WritingSession
from models.task import GenerationTask
from services.draft_pipeline import DraftPipeline
from services.event_store import EventStore
from services.finetune_pipeline import FinetunePipeline
from services.finetune_service import FinetuneService
from services.llm_service import LLMService
from services.outline_pipeline import OutlinePipeline
from services.task_helpers import fail_task, find_document, get_confirmed_outline, persist_document
from tasks.celery_app import celery_app


def _outline_pipeline() -> OutlinePipeline:
    return OutlinePipeline(llm_service=LLMService())


def _draft_pipeline() -> DraftPipeline:
    settings = get_settings()
    draft_model = settings.draft_stage_model_name or settings.base_model_name
    return DraftPipeline(llm_service=LLMService(model_name=draft_model))


def _finetune_pipeline() -> FinetunePipeline:
    return FinetunePipeline(finetune_service=FinetuneService())


# ---------------------------------------------------------------------------
# Phase 1: Outline (extraction + outline_draft)
# ---------------------------------------------------------------------------

@celery_app.task(name="generation.run_outline")
def run_outline(task_id: int) -> None:
    event_store = EventStore()
    with SessionLocal() as db:
        task = db.get(GenerationTask, task_id)
        if task is None:
            return
        session = db.get(WritingSession, task.session_id)
        if session is None:
            fail_task(db, task, event_store, "Session not found")
            return

        try:
            task.status = "running"
            task.phase = "outline"
            task.current_stage = "extraction"
            db.commit()
            event_store.append(task.id, "status", {"task_id": task.id, "status": "running", "stage": "extraction"})

            stage_buffers: dict[str, list[str]] = {"extraction": [], "outline_draft": []}
            current_stage = "extraction"
            pipeline = _outline_pipeline()

            for event in pipeline.stream(session.prompt_payload_json):
                if event["stage"] != current_stage:
                    if current_stage == "extraction":
                        doc = persist_document(db, session.id, "extraction", "".join(stage_buffers["extraction"]))
                        event_store.append(task.id, "stage_complete", {"task_id": task.id, "stage": "extraction", "document_id": doc.id})
                    current_stage = event["stage"]
                    task.current_stage = current_stage
                    db.commit()
                    event_store.append(task.id, "status", {"task_id": task.id, "status": "running", "stage": current_stage})

                stage_buffers[event["stage"]].append(event["delta"])
                event_store.append(task.id, "chunk", {"task_id": task.id, "stage": event["stage"], "delta": event["delta"]})

            # Guard: persist extraction doc if pipeline emitted only one stage
            if stage_buffers["extraction"] and not find_document(db, session.id, "extraction"):
                doc = persist_document(db, session.id, "extraction", "".join(stage_buffers["extraction"]))
                event_store.append(task.id, "stage_complete", {"task_id": task.id, "stage": "extraction", "document_id": doc.id})

            outline_data = pipeline.outline_data
            if outline_data is None:
                raise ValueError("Outline pipeline completed but produced no outline data")

            # Persist profile back into session payload
            if pipeline.profile_data is not None:
                payload = dict(session.prompt_payload_json)
                payload["profile"] = pipeline.profile_data
                session.prompt_payload_json = payload
                flag_modified(session, "prompt_payload_json")

            outline = Outline(
                session_id=session.id,
                schema_version="v1",
                status="candidate",
                data=outline_data,
            )
            db.add(outline)
            session.workflow_status = "outline_ready"
            task.status = "done"
            task.current_stage = "outline_draft"
            db.commit()

            event_store.append(task.id, "stage_complete", {"task_id": task.id, "stage": "outline_draft", "outline_id": outline.id})
            event_store.append(task.id, "done", {"task_id": task.id, "status": "done", "outline_id": outline.id})

        except Exception as exc:
            fail_task(db, task, event_store, str(exc))
            raise


# ---------------------------------------------------------------------------
# Phase 2a: Draft
# ---------------------------------------------------------------------------

@celery_app.task(name="generation.run_draft")
def run_draft(task_id: int) -> None:
    event_store = EventStore()
    with SessionLocal() as db:
        task = db.get(GenerationTask, task_id)
        if task is None:
            return
        session = db.get(WritingSession, task.session_id)
        if session is None:
            fail_task(db, task, event_store, "Session not found")
            return

        outline = get_confirmed_outline(db, session.id)
        if outline is None:
            fail_task(db, task, event_store, "No confirmed outline found for session")
            return

        try:
            task.status = "running"
            task.phase = "draft"
            task.current_stage = "draft"
            db.commit()
            event_store.append(task.id, "status", {"task_id": task.id, "status": "running", "stage": "draft"})

            draft_parts: list[str] = []
            for event in _draft_pipeline().stream(session.prompt_payload_json, outline.data):
                draft_parts.append(event["delta"])
                event_store.append(task.id, "chunk", {"task_id": task.id, "stage": "draft", "delta": event["delta"]})

            doc = persist_document(db, session.id, "draft", "".join(draft_parts))
            session.workflow_status = "draft_ready"
            task.status = "done"
            task.current_stage = "draft"
            db.commit()

            event_store.append(task.id, "stage_complete", {"task_id": task.id, "stage": "draft", "document_id": doc.id})
            event_store.append(task.id, "done", {"task_id": task.id, "status": "done"})

        except Exception as exc:
            fail_task(db, task, event_store, str(exc))
            raise


# ---------------------------------------------------------------------------
# Phase 2b: Finetune
# ---------------------------------------------------------------------------

@celery_app.task(name="generation.run_finetune")
def run_finetune(task_id: int) -> None:
    event_store = EventStore()
    with SessionLocal() as db:
        task = db.get(GenerationTask, task_id)
        if task is None:
            return
        session = db.get(WritingSession, task.session_id)
        if session is None:
            fail_task(db, task, event_store, "Session not found")
            return

        draft_doc = find_document(db, session.id, "draft")
        if draft_doc is None:
            fail_task(db, task, event_store, "No draft document found for session")
            return

        outline = get_confirmed_outline(db, session.id)
        if outline is None:
            fail_task(db, task, event_store, "No confirmed outline found for session")
            return

        try:
            task.status = "running"
            task.phase = "finetune"
            task.current_stage = "finetuned"
            db.commit()
            event_store.append(task.id, "status", {"task_id": task.id, "status": "running", "stage": "finetuned"})

            finetuned_parts: list[str] = []
            for event in _finetune_pipeline().stream(draft_doc.content, session.prompt_payload_json, outline.data):
                finetuned_parts.append(event["delta"])
                event_store.append(task.id, "chunk", {"task_id": task.id, "stage": "finetuned", "delta": event["delta"]})

            doc = persist_document(db, session.id, "finetuned", "".join(finetuned_parts))
            session.workflow_status = "finetuned_ready"
            task.status = "done"
            task.current_stage = "finetuned"
            db.commit()

            event_store.append(task.id, "stage_complete", {"task_id": task.id, "stage": "finetuned", "document_id": doc.id})
            event_store.append(task.id, "done", {"task_id": task.id, "status": "done"})

        except Exception as exc:
            fail_task(db, task, event_store, str(exc))
            raise


# ---------------------------------------------------------------------------
# Enqueue helpers
# ---------------------------------------------------------------------------

def enqueue_outline_task(task_id: int) -> None:
    settings = get_settings()
    if settings.celery_task_always_eager:
        run_outline(task_id)
        return
    run_outline.delay(task_id)


def enqueue_draft_task(task_id: int) -> None:
    settings = get_settings()
    if settings.celery_task_always_eager:
        run_draft(task_id)
        return
    run_draft.delay(task_id)


def enqueue_finetune_task(task_id: int) -> None:
    settings = get_settings()
    if settings.celery_task_always_eager:
        run_finetune(task_id)
        return
    run_finetune.delay(task_id)
