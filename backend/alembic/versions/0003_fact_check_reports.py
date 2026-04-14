"""fact_check_reports table

Revision ID: 0003_fact_check_reports
Revises: 0002_outline_gate
Create Date: 2026-04-13
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_fact_check_reports"
down_revision = "0002_outline_gate"
branch_labels = None
depends_on = None


def upgrade() -> None:
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
