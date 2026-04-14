from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, model_validator


class OutlineSection(BaseModel):
    id: str
    claim: str
    evidence_refs: list[str]
    angle: Optional[str] = None
    user_notes: Optional[str] = None


class OutlineIntro(BaseModel):
    direction: str


class OutlineConclusion(BaseModel):
    direction: str


class OutlineControls(BaseModel):
    must_include: list[str] = []
    must_avoid: list[str] = []
    generation_notes: Optional[str] = None
    target_language: Optional[str] = None


class OutlineData(BaseModel):
    thesis: str
    intro: OutlineIntro
    sections: list[OutlineSection]
    conclusion: OutlineConclusion
    controls: OutlineControls


class OutlineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    schema_version: str
    status: str
    data: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class OutlinePatch(BaseModel):
    data: dict[str, Any]


class OutlineConfirm(BaseModel):
    data: dict[str, Any]

    @model_validator(mode="after")
    def check_target_language(self) -> "OutlineConfirm":
        controls = self.data.get("controls", {})
        if not controls.get("target_language"):
            raise ValueError("target_language is required when confirming an outline")
        return self
