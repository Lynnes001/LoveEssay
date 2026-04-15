"""students table, sessions.student_id, fact_check_reports table

Revision ID: 0003_students_and_fact_check
Revises: 0002_outline_gate
Create Date: 2026-04-15
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_students_and_fact_check"
down_revision = "0002_outline_gate"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "students",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=True),
        sa.Column("profile_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.add_column(
        "sessions",
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="SET NULL"), nullable=True),
    )

    op.create_table(
        "fact_check_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("documents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("pass_", sa.Boolean(), nullable=False),
        sa.Column("issues", sa.JSON(), nullable=False),
        sa.Column("repair_attempt", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("fact_check_reports")
    op.drop_column("sessions", "student_id")
    op.drop_table("students")
