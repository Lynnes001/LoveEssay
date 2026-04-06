import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["REDIS_URL"] = "memory://"
os.environ["CELERY_TASK_ALWAYS_EAGER"] = "true"
os.environ["DRAFT_MODEL_API_KEY"] = ""
os.environ["POLISH_MODEL_API_KEY"] = ""

from config import get_settings  # noqa: E402

get_settings.cache_clear()

from db import Base, SessionLocal, engine, get_db  # noqa: E402
from main import app  # noqa: E402
from models.session import WritingSession  # noqa: E402
from models.task import GenerationTask  # noqa: E402


@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def task_factory(db_session):
    class TaskFactory:
        def __call__(self, status="pending", current_stage=None):
            session = WritingSession(name="demo", prompt_payload_json={"student_background": "bg", "program": "p", "requirements": "r"})
            db_session.add(session)
            db_session.commit()
            db_session.refresh(session)

            task = GenerationTask(session_id=session.id, status=status, current_stage=current_stage)
            db_session.add(task)
            db_session.commit()
            db_session.refresh(task)
            return task

        def get(self, task_id):
            return db_session.get(GenerationTask, task_id)

    return TaskFactory()
