from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import require_session
from db import get_db
from models.session import WritingSession
from schemas.session import SessionCreate, SessionPatch, SessionRead

router = APIRouter(prefix="/api", tags=["sessions"])


@router.get("/sessions", response_model=list[SessionRead])
def list_sessions(db: Session = Depends(get_db)) -> list[WritingSession]:
    stmt = (
        select(WritingSession)
        .order_by(WritingSession.created_at.desc())
        .limit(50)
    )
    return db.execute(stmt).scalars().all()


@router.post("/sessions", response_model=SessionRead, status_code=201)
def create_session(body: SessionCreate, db: Session = Depends(get_db)) -> WritingSession:
    session = WritingSession(
        name=body.name,
        prompt_payload_json={},
        student_id=body.student_id,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions/{session_id}", response_model=SessionRead)
def get_session(session: WritingSession = Depends(require_session)) -> WritingSession:
    return session


@router.patch("/sessions/{session_id}", response_model=SessionRead)
def update_session(body: SessionPatch, db: Session = Depends(get_db), session: WritingSession = Depends(require_session)) -> WritingSession:
    if body.name is not None:
        session.name = body.name
    db.commit()
    db.refresh(session)
    return session


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(db: Session = Depends(get_db), session: WritingSession = Depends(require_session)) -> None:
    db.delete(session)
    db.commit()
