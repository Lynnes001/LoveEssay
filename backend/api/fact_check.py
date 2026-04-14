from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from models.fact_check_report import FactCheckReport
from schemas.fact_check import FactCheckReportRead

router = APIRouter(prefix="/api", tags=["fact-check"])


@router.get("/sessions/{session_id}/fact-check-report", response_model=FactCheckReportRead)
def get_fact_check_report(session_id: int, db: Session = Depends(get_db)) -> FactCheckReport:
    stmt = (
        select(FactCheckReport)
        .where(FactCheckReport.session_id == session_id)
        .order_by(FactCheckReport.id.desc())
        .limit(1)
    )
    report = db.execute(stmt).scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="No fact check report found")
    return report
