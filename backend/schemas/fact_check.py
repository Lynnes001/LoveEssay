from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class FactCheckIssue(BaseModel):
    type: str
    severity: str
    evidence: str
    suggested_fix: str


class FactCheckReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    document_id: int | None
    pass_: bool
    issues: list[Any]
    repair_attempt: int
    created_at: datetime
