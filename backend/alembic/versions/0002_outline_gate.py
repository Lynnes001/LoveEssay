"""outline gate: outlines table + sessions.workflow_status

Revision ID: 0002_outline_gate
Revises: 0001_phase1_streaming_schema
Create Date: 2026-04-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0002_outline_gate"
down_revision = "0001_phase1_streaming_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("workflow_status", sa.String(length=30), nullable=False, server_default="pending"),
    )

    op.create_table(
        "outlines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("schema_version", sa.String(length=10), nullable=False, server_default="v1"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="candidate"),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("outlines")
    op.drop_column("sessions", "workflow_status")
