from __future__ import annotations

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from models.session import WritingSession


def require_session(session_id: int, db: Session = Depends(get_db)) -> WritingSession:
    session = db.get(WritingSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
