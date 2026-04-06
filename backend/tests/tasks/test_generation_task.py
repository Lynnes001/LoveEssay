from tasks.generation import run_generation


def test_run_generation_persists_documents_and_marks_task_done(db_session, task_factory):
    task = task_factory(status="pending")

    run_generation(task.id)
    db_session.expire_all()

    refreshed = task_factory.get(task.id)
    assert refreshed.status == "done"
    stages = [document.stage for document in refreshed.session.documents]
    assert stages == ["extraction", "draft", "rewrite"]
