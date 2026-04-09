from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class SessionPayload(BaseModel):
    name: str
    student_background: str
    program: str
    requirements: str
    custom_prompt: Optional[str] = None
