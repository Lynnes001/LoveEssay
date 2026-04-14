from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class SessionPayload(BaseModel):
    name: str
    student_background: str
    program: str
    requirements: str
    custom_prompt: Optional[str] = None


class SessionCreate(BaseModel):
    name: str
    student_id: int | None = None


class SessionPatch(BaseModel):
    name: str | None = None


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    workflow_status: str
    student_id: int | None
    prompt_payload_json: Any | None
    created_at: datetime
