from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from models.document import Document
from models.fact_check_report import FactCheckReport
from models.outline import Outline
from models.session import WritingSession
from models.task import GenerationTask
from schemas.generation import GenerateRequest, GenerateResponse
from services.event_store import EventStore
from services.session_reset import reset_from
from tasks.fact_check_generation import enqueue_fact_check_task, enqueue_repair_task
from tasks.outline_generation import enqueue_draft_task, enqueue_finetune_task, enqueue_outline_task

router = APIRouter(prefix="/api", tags=["generation"])

_COMPLETABLE_STATUSES = {"finetuned_ready", "fact_check_done", "repaired"}


# ---------------------------------------------------------------------------
# Phase 1: Outline (extraction + outline_draft)
# ---------------------------------------------------------------------------

@router.post("/generate/outline", response_model=GenerateResponse, status_code=202)
def create_outline_task(payload: GenerateRequest, db: Session = Depends(get_db)) -> GenerateResponse:
    """Start or restart Phase 1. Creates a new session or resets an existing one."""
    session = WritingSession(
        name=payload.name,
        prompt_payload_json=payload.model_dump(),
        workflow_status="start",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    task = GenerationTask(session_id=session.id, status="pending", phase="outline")
    db.add(task)
    db.commit()
    db.refresh(task)

    enqueue_outline_task(task.id)
    return GenerateResponse(task_id=task.id, session_id=session.id)


@router.post("/generate/outline/{session_id}/regenerate", response_model=GenerateResponse, status_code=202)
def regenerate_outline_task(session_id: int, payload: GenerateRequest, db: Session = Depends(get_db)) -> GenerateResponse:
    """Regenerate outline for an existing session (truncates all downstream artifacts)."""
    session = _require_session(session_id, db)
    reset_from(db, session, "outline")

    # Update input payload in case the user edited it
    session.prompt_payload_json = payload.model_dump()
    db.commit()

    task = GenerationTask(session_id=session.id, status="pending", phase="outline")
    db.add(task)
    db.commit()
    db.refresh(task)

    enqueue_outline_task(task.id)
    return GenerateResponse(task_id=task.id, session_id=session.id)


# ---------------------------------------------------------------------------
# Phase 2a: Draft
# ---------------------------------------------------------------------------

@router.post("/generate/draft", response_model=GenerateResponse, status_code=202)
def create_draft_task(session_id: int, db: Session = Depends(get_db)) -> GenerateResponse:
    """Run Phase 2a. Requires a confirmed outline. Truncates draft and all downstream."""
    session = _require_session(session_id, db)

    if not _has_confirmed_outline(db, session_id):
        raise HTTPException(status_code=400, detail="Confirmed outline required before generating draft")

    reset_from(db, session, "draft")

    task = GenerationTask(session_id=session.id, status="pending", phase="draft")
    db.add(task)
    db.commit()
    db.refresh(task)

    enqueue_draft_task(task.id)
    return GenerateResponse(task_id=task.id, session_id=session.id)


# ---------------------------------------------------------------------------
# Phase 2b: Finetune
# ---------------------------------------------------------------------------

@router.post("/generate/finetune", response_model=GenerateResponse, status_code=202)
def create_finetune_task(session_id: int, db: Session = Depends(get_db)) -> GenerateResponse:
    """Run Phase 2b. Requires a draft document. Truncates finetuned and all downstream."""
    session = _require_session(session_id, db)

    if not _has_document(db, session_id, "draft"):
        raise HTTPException(status_code=400, detail="Draft document required before running finetune")

    reset_from(db, session, "finetune")

    task = GenerationTask(session_id=session.id, status="pending", phase="finetune")
    db.add(task)
    db.commit()
    db.refresh(task)

    enqueue_finetune_task(task.id)
    return GenerateResponse(task_id=task.id, session_id=session.id)


# ---------------------------------------------------------------------------
# Phase 3: Fact Check
# ---------------------------------------------------------------------------

@router.post("/generate/fact-check", response_model=GenerateResponse, status_code=202)
def create_fact_check_task(session_id: int, db: Session = Depends(get_db)) -> GenerateResponse:
    """Run Phase 3. Requires a finetuned document. Truncates fact_check report and repair."""
    session = _require_session(session_id, db)

    if not _has_document(db, session_id, "finetuned"):
        raise HTTPException(status_code=400, detail="Finetuned document required before fact check")

    reset_from(db, session, "fact_check")

    task = GenerationTask(session_id=session.id, status="pending", phase="fact_check")
    db.add(task)
    db.commit()
    db.refresh(task)

    enqueue_fact_check_task(task.id)
    return GenerateResponse(task_id=task.id, session_id=session.id)


# ---------------------------------------------------------------------------
# Phase 4: Repair (optional)
# ---------------------------------------------------------------------------

@router.post("/generate/repair", response_model=GenerateResponse, status_code=202)
def create_repair_task(session_id: int, db: Session = Depends(get_db)) -> GenerateResponse:
    """Run Phase 4. Requires a failed fact_check report. Truncates any previous repair doc."""
    session = _require_session(session_id, db)

    stmt = (
        select(FactCheckReport)
        .where(FactCheckReport.session_id == session_id)
        .order_by(FactCheckReport.id.desc())
        .limit(1)
    )
    report = db.execute(stmt).scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=400, detail="No fact_check report found for session")
    if report.pass_:
        raise HTTPException(status_code=400, detail="Fact check already passed; repair not needed")

    reset_from(db, session, "repair")

    task = GenerationTask(session_id=session.id, status="pending", phase="repair")
    db.add(task)
    db.commit()
    db.refresh(task)

    enqueue_repair_task(task.id)
    return GenerateResponse(task_id=task.id, session_id=session.id)


# ---------------------------------------------------------------------------
# Mark session done
# ---------------------------------------------------------------------------

@router.post("/sessions/{session_id}/complete", status_code=200)
def complete_session(session_id: int, db: Session = Depends(get_db)) -> dict:
    session = _require_session(session_id, db)
    allowed = _COMPLETABLE_STATUSES
    if session.workflow_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete session with workflow_status='{session.workflow_status}'",
        )
    session.workflow_status = "done"
    db.commit()
    return {"session_id": session_id, "workflow_status": "done"}


# ---------------------------------------------------------------------------
# SSE stream (shared for all task types)
# ---------------------------------------------------------------------------

@router.get("/stream/{task_id}")
async def stream_generation(task_id: int, request: Request, db: Session = Depends(get_db)) -> StreamingResponse:
    task = db.get(GenerationTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    async def event_generator():
        event_store = EventStore()
        offset = 0
        while True:
            if await request.is_disconnected():
                break

            events = event_store.read(task_id, offset=offset)
            for item in events:
                offset += 1
                yield _format_sse(item["event"], item["payload"])

            db.expire_all()
            current_task = db.get(GenerationTask, task_id)
            if current_task is None:
                break

            if current_task.status in {"done", "failed"} and not event_store.read(task_id, offset=offset):
                if current_task.status == "failed":
                    yield _format_sse(
                        "task_error",
                        {"task_id": task_id, "message": current_task.error_msg or "Unknown error"},
                    )
                elif not events:
                    done_payload: dict = {"task_id": task_id, "status": "done"}
                    session_obj = db.get(WritingSession, current_task.session_id)
                    if session_obj:
                        outline = db.execute(
                            select(Outline)
                            .where(Outline.session_id == session_obj.id)
                            .order_by(Outline.id.desc())
                            .limit(1)
                        ).scalar_one_or_none()
                        if outline:
                            done_payload["outline_id"] = outline.id
                    yield _format_sse("done", done_payload)
                break

            await asyncio.sleep(0.25)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _require_session(session_id: int, db: Session) -> WritingSession:
    session = db.get(WritingSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _has_confirmed_outline(db: Session, session_id: int) -> bool:
    stmt = select(Outline).where(
        Outline.session_id == session_id, Outline.status == "confirmed"
    ).limit(1)
    return db.execute(stmt).scalar_one_or_none() is not None


def _has_document(db: Session, session_id: int, stage: str) -> bool:
    stmt = select(Document).where(
        Document.session_id == session_id, Document.stage == stage
    ).limit(1)
    return db.execute(stmt).scalar_one_or_none() is not None


def _format_sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
