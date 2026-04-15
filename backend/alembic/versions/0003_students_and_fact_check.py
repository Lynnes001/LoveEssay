"""merge duplicate students/fact-check migration into main chain

Revision ID: 0003_students_and_fact_check
Revises: 0005_workflow_redesign
Create Date: 2026-04-15
"""


revision = "0003_students_and_fact_check"
down_revision = "0005_workflow_redesign"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This revision originally duplicated changes already present in
    # 0003_fact_check_reports and 0004_session_management. Keep the revision
    # ID as a no-op so Alembic has a single linear head.
    pass


def downgrade() -> None:
    pass
