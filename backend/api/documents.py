from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import require_session
from db import get_db
from models.document import Document
from models.session import WritingSession
from schemas.document import DocumentRead, DocumentSummary

router = APIRouter(prefix="/api", tags=["documents"])


@router.get("/sessions/{session_id}/documents", response_model=list[DocumentSummary])
def list_session_documents(db: Session = Depends(get_db), session: WritingSession = Depends(require_session)) -> list[Document]:
    stmt = (
        select(Document)
        .where(Document.session_id == session.id)
        .order_by(Document.version.desc(), Document.id.desc())
    )
    return db.execute(stmt).scalars().all()


@router.get("/documents/{document_id}", response_model=DocumentRead)
def get_document(document_id: int, db: Session = Depends(get_db)) -> Document:
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc
