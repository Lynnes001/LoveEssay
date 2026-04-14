"""session management: students table, student_id on sessions, version on documents

Revision ID: 0004_session_management
Revises: 0003_fact_check_reports
Create Date: 2026-04-13
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_session_management"
down_revision = "0003_fact_check_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create students table
    op.create_table(
        "students",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=True),
        sa.Column("profile_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Add student_id to sessions (nullable, no FK constraint in SQLite)
    op.add_column("sessions", sa.Column("student_id", sa.Integer(), nullable=True))

    # Add version column to documents (default 1 for existing rows)
    op.add_column("documents", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))


def downgrade() -> None:
    op.drop_column("documents", "version")
    op.drop_column("sessions", "student_id")
    op.drop_table("students")
