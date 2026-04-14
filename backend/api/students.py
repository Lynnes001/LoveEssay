from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from models.student import Student
from schemas.student import StudentCreate, StudentPatch, StudentRead, StudentSummary

router = APIRouter(prefix="/api", tags=["students"])


def _require_student(db: Session, student_id: int) -> Student:
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.get("/students", response_model=list[StudentSummary])
def list_students(db: Session = Depends(get_db)) -> list[Student]:
    return db.query(Student).order_by(Student.name).all()


@router.post("/students", response_model=StudentRead, status_code=201)
def create_student(body: StudentCreate, db: Session = Depends(get_db)) -> Student:
    student = Student(name=body.name, email=body.email, profile_json=body.profile_json)
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.get("/students/{student_id}", response_model=StudentRead)
def get_student(student_id: int, db: Session = Depends(get_db)) -> Student:
    return _require_student(db, student_id)


@router.patch("/students/{student_id}", response_model=StudentRead)
def update_student(student_id: int, body: StudentPatch, db: Session = Depends(get_db)) -> Student:
    student = _require_student(db, student_id)
    if body.name is not None:
        student.name = body.name
    if body.email is not None:
        student.email = body.email
    if body.profile_json is not None:
        student.profile_json = body.profile_json
    db.commit()
    db.refresh(student)
    return student
