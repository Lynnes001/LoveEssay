from __future__ import annotations

from config import get_settings
from db import SessionLocal
from models.document import Document
from models.fact_check_report import FactCheckReport
from models.session import WritingSession
from models.task import GenerationTask
from services.event_store import EventStore
from services.fact_check_pipeline import FactCheckPipeline, RepairPipeline
from services.llm_service import LLMService
from services.task_helpers import fail_task, find_document, get_confirmed_outline, get_latest_fc_report
from tasks.celery_app import celery_app


def _fact_check_pipeline() -> FactCheckPipeline:
    return FactCheckPipeline(llm_service=LLMService())


def _repair_pipeline() -> RepairPipeline:
    return RepairPipeline(llm_service=LLMService())


# ---------------------------------------------------------------------------
# Phase 3: Fact Check
# ---------------------------------------------------------------------------

@celery_app.task(name="generation.run_fact_check")
def run_fact_check(task_id: int) -> None:
    event_store = EventStore()
    with SessionLocal() as db:
        task = db.get(GenerationTask, task_id)
        if task is None:
            return
        session = db.get(WritingSession, task.session_id)
        if session is None:
            fail_task(db, task, event_store, "Session not found")
            return

        finetuned_doc = find_document(db, session.id, "finetuned")
        if finetuned_doc is None:
            fail_task(db, task, event_store, "No finetuned document found for session")
            return

        outline = get_confirmed_outline(db, session.id)
        if outline is None:
            fail_task(db, task, event_store, "No confirmed outline found for session")
            return

        try:
            task.status = "running"
            task.phase = "fact_check"
            task.current_stage = "fact_check"
            db.commit()
            event_store.append(task.id, "status", {"task_id": task.id, "status": "running", "stage": "fact_check"})

            pipeline = _fact_check_pipeline()
            for event in pipeline.stream(finetuned_doc.content, session.prompt_payload_json, outline.data):
                event_store.append(task.id, "chunk", {"task_id": task.id, "stage": "fact_check", "delta": event["delta"]})

            report_data = pipeline.report
            passed = bool(report_data.get("pass", False))
            issues = report_data.get("issues", [])

            report = FactCheckReport(
                session_id=session.id,
                document_id=finetuned_doc.id,
                pass_=passed,
                issues=issues,
                repair_attempt=0,
            )
            db.add(report)
            session.workflow_status = "fact_check_done"
            task.status = "done"
            task.current_stage = "fact_check"
            db.commit()

            event_store.append(task.id, "stage_complete", {
                "task_id": task.id, "stage": "fact_check",
                "report_id": report.id, "pass": passed,
            })
            event_store.append(task.id, "done", {"task_id": task.id, "status": "done", "pass": passed})

        except Exception as exc:
            fail_task(db, task, event_store, str(exc))
            raise


# ---------------------------------------------------------------------------
# Phase 4: Repair (no embedded fact_check — user decides next step)
# ---------------------------------------------------------------------------

@celery_app.task(name="generation.run_repair")
def run_repair(task_id: int) -> None:
    event_store = EventStore()
    with SessionLocal() as db:
        task = db.get(GenerationTask, task_id)
        if task is None:
            return
        session = db.get(WritingSession, task.session_id)
        if session is None:
            fail_task(db, task, event_store, "Session not found")
            return

        report = get_latest_fc_report(db, session.id)
        if report is None:
            fail_task(db, task, event_store, "No fact_check_report found for session")
            return
        if report.pass_:
            fail_task(db, task, event_store, "Cannot repair: fact_check report already passed")
            return

        # Use latest repair doc if re-running, otherwise fall back to finetuned
        essay_doc = find_document(db, session.id, "repair") or find_document(db, session.id, "finetuned")
        if essay_doc is None:
            fail_task(db, task, event_store, "No essay document found to repair")
            return

        outline = get_confirmed_outline(db, session.id)
        if outline is None:
            fail_task(db, task, event_store, "No confirmed outline found for session")
            return

        try:
            task.status = "running"
            task.phase = "repair"
            task.current_stage = "repair"
            db.commit()
            event_store.append(task.id, "status", {"task_id": task.id, "status": "running", "stage": "repair"})

            repair_parts: list[str] = []
            for event in _repair_pipeline().stream(essay_doc.content, report.issues, session.prompt_payload_json, outline.data):
                repair_parts.append(event["delta"])
                event_store.append(task.id, "chunk", {"task_id": task.id, "stage": "repair", "delta": event["delta"]})

            repaired_text = "".join(repair_parts)
            repaired_doc = Document(
                session_id=session.id,
                stage="repair",
                content=repaired_text,
                word_count=len(repaired_text.split()),
            )
            db.add(repaired_doc)
            session.workflow_status = "repaired"
            task.status = "done"
            task.current_stage = "repair"
            db.commit()

            event_store.append(task.id, "stage_complete", {
                "task_id": task.id, "stage": "repair", "document_id": repaired_doc.id,
            })
            event_store.append(task.id, "done", {"task_id": task.id, "status": "done"})

        except Exception as exc:
            fail_task(db, task, event_store, str(exc))
            raise


# ---------------------------------------------------------------------------
# Enqueue helpers
# ---------------------------------------------------------------------------

def enqueue_fact_check_task(task_id: int) -> None:
    settings = get_settings()
    if settings.celery_task_always_eager:
        run_fact_check(task_id)
        return
    run_fact_check.delay(task_id)


def enqueue_repair_task(task_id: int) -> None:
    settings = get_settings()
    if settings.celery_task_always_eager:
        run_repair(task_id)
        return
    run_repair.delay(task_id)
