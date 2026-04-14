from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import require_session
from db import get_db
from models.outline import Outline
from models.session import WritingSession
from schemas.outline import OutlineConfirm, OutlinePatch, OutlineRead

router = APIRouter(prefix="/api", tags=["outline"])


def _get_latest_outline(db: Session, session_id: int) -> Outline | None:
    stmt = (
        select(Outline)
        .where(Outline.session_id == session_id)
        .order_by(Outline.id.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


@router.get("/sessions/{session_id}/outline", response_model=OutlineRead)
def get_outline(db: Session = Depends(get_db), session: WritingSession = Depends(require_session)) -> Outline:
    outline = _get_latest_outline(db, session.id)
    if outline is None:
        raise HTTPException(status_code=404, detail="Outline not found")
    return outline


@router.patch("/sessions/{session_id}/outline", response_model=OutlineRead)
def patch_outline(payload: OutlinePatch, db: Session = Depends(get_db), session: WritingSession = Depends(require_session)) -> Outline:
    outline = _get_latest_outline(db, session.id)
    if outline is None:
        raise HTTPException(status_code=404, detail="Outline not found")
    if outline.status == "confirmed":
        raise HTTPException(status_code=409, detail="Cannot edit a confirmed outline")
    outline.data = payload.data
    outline.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(outline)
    return outline


@router.post("/sessions/{session_id}/outline/confirm", response_model=OutlineRead)
def confirm_outline(payload: OutlineConfirm, db: Session = Depends(get_db), session: WritingSession = Depends(require_session)) -> Outline:
    outline = _get_latest_outline(db, session.id)
    if outline is None:
        raise HTTPException(status_code=404, detail="Outline not found")
    outline.data = payload.data
    outline.status = "confirmed"
    outline.updated_at = datetime.now(timezone.utc)
    # workflow_status stays "outline_ready" — frontend triggers draft via POST /api/generate/draft
    db.commit()
    db.refresh(outline)
    return outline
