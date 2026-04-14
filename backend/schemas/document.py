from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    stage: str
    content: str
    word_count: int
    version: int = 1
    created_at: Optional[datetime] = None


class DocumentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    stage: str
    word_count: int
    version: int
    created_at: Optional[datetime] = None
