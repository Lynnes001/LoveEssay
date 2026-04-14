from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


class WritingSession(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    prompt_payload_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    # workflow_status values: start | outline_ready | draft_ready | finetuned_ready
    #                         | fact_check_done | repaired | done
    workflow_status: Mapped[str] = mapped_column(String(30), nullable=False, default="start")
    student_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    documents = relationship("Document", back_populates="session", cascade="all, delete-orphan")
    tasks = relationship("GenerationTask", back_populates="session", cascade="all, delete-orphan")
    outlines = relationship("Outline", back_populates="session", cascade="all, delete-orphan", order_by="Outline.id")
    fact_check_reports = relationship("FactCheckReport", back_populates="session", cascade="all, delete-orphan", order_by="FactCheckReport.id")
    student = relationship("Student", back_populates="sessions")
