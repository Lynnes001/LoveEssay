from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class StudentCreate(BaseModel):
    name: str
    email: str | None = None
    profile_json: Any | None = None


class StudentPatch(BaseModel):
    name: str | None = None
    email: str | None = None
    profile_json: Any | None = None


class StudentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str | None
    profile_json: Any | None
    created_at: datetime


class StudentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str | None
    created_at: datetime
