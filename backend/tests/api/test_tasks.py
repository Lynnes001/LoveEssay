def test_get_task_returns_pending_status(client, task_factory):
    task = task_factory(status="pending", current_stage=None)

    response = client.get(f"/api/tasks/{task.id}")

    assert response.status_code == 200
    assert response.json()["status"] == "pending"
