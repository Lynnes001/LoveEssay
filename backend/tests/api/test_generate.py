def test_post_generate_creates_task_and_session(client):
    response = client.post(
        "/api/generate",
        json={
            "name": "张三-CMU-PS",
            "student_background": "AI research, robotics internship",
            "program": "CMU MSCV",
            "requirements": "900 words, personal statement",
        },
    )

    assert response.status_code == 202
    body = response.json()
    assert "task_id" in body
    assert "session_id" in body


def test_stream_endpoint_returns_sse_content_type(client, task_factory):
    task = task_factory(status="done", current_stage="rewrite")

    with client.stream("GET", f"/api/stream/{task.id}") as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
