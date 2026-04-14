from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from models.task import GenerationTask
from schemas.document import DocumentRead
from schemas.generation import TaskRead

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: int, db: Session = Depends(get_db)) -> TaskRead:
    task = db.get(GenerationTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    documents = [DocumentRead.model_validate(document) for document in task.session.documents]
    return TaskRead(
        id=task.id,
        session_id=task.session_id,
        phase=task.phase,
        status=task.status,
        current_stage=task.current_stage,
        error_msg=task.error_msg,
        created_at=task.created_at,
        updated_at=task.updated_at,
        documents=documents,
    )
