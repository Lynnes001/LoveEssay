import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from db import get_db
from models.document import Document
from models.session import WritingSession
from models.task import GenerationTask
from schemas.generation import GenerateRequest, GenerateResponse
from services.event_store import EventStore
from tasks.generation import enqueue_generation_task

router = APIRouter(prefix="/api", tags=["generation"])


@router.post("/generate", response_model=GenerateResponse, status_code=202)
def create_generation_task(payload: GenerateRequest, db: Session = Depends(get_db)) -> GenerateResponse:
    session = WritingSession(name=payload.name, prompt_payload_json=payload.model_dump(), status="pending")
    db.add(session)
    db.commit()
    db.refresh(session)

    task = GenerationTask(session_id=session.id, status="pending")
    db.add(task)
    db.commit()
    db.refresh(task)

    enqueue_generation_task(task.id)
    return GenerateResponse(task_id=task.id, session_id=session.id)


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
                    yield _format_sse("done", {"task_id": task_id, "status": "done"})
                break

            await asyncio.sleep(0.25)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


def _format_sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
