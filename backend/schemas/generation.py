from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from schemas.document import DocumentRead
from schemas.session import SessionPayload


class GenerateRequest(SessionPayload):
    pass


class GenerateResponse(BaseModel):
    task_id: int
    session_id: int


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    status: str
    current_stage: Optional[str] = None
    error_msg: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    documents: list[DocumentRead] = []
