"""workflow redesign: simplify workflow_status, add phase to tasks, rename rewrite→finetuned

Revision ID: 0005_workflow_redesign
Revises: 0004_session_management
Create Date: 2026-04-14
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_workflow_redesign"
down_revision = "0004_session_management"
branch_labels = None
depends_on = None


# Mapping from old workflow_status values to new ones
_STATUS_MAP = {
    "pending": "start",
    "outline_drafted": "outline_ready",
    "outline_confirmed": "outline_ready",
    "draft_completed": "finetuned_ready",
    "fact_check_passed": "done",
    "needs_repair": "fact_check_done",
    "needs_repair_manual": "fact_check_done",
    "done": "done",
}


def upgrade() -> None:
    # 1. Migrate workflow_status values before altering the column
    conn = op.get_bind()
    for old, new in _STATUS_MAP.items():
        conn.execute(
            sa.text("UPDATE sessions SET workflow_status = :new WHERE workflow_status = :old"),
            {"new": new, "old": old},
        )

    # 2. Drop sessions.status (redundant with task.status)
    op.drop_column("sessions", "status")

    # 3. Add phase column to generation_tasks
    op.add_column(
        "generation_tasks",
        sa.Column("phase", sa.String(length=20), nullable=True),
    )

    # 4. Rename stage="rewrite" → "finetuned" in documents
    conn.execute(
        sa.text("UPDATE documents SET stage = 'finetuned' WHERE stage = 'rewrite'")
    )


def downgrade() -> None:
    # Reverse document stage rename
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE documents SET stage = 'rewrite' WHERE stage = 'finetuned'")
    )

    # Remove phase column
    op.drop_column("generation_tasks", "phase")

    # Restore sessions.status column
    op.add_column(
        "sessions",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
    )

    # Reverse workflow_status migration (best-effort)
    conn.execute(sa.text("UPDATE sessions SET workflow_status = 'pending' WHERE workflow_status = 'start'"))
    conn.execute(sa.text("UPDATE sessions SET workflow_status = 'outline_drafted' WHERE workflow_status = 'outline_ready'"))
    conn.execute(sa.text("UPDATE sessions SET workflow_status = 'draft_completed' WHERE workflow_status = 'finetuned_ready'"))
    conn.execute(sa.text("UPDATE sessions SET workflow_status = 'needs_repair' WHERE workflow_status = 'fact_check_done'"))
    conn.execute(sa.text("UPDATE sessions SET workflow_status = 'done' WHERE workflow_status = 'repaired'"))
