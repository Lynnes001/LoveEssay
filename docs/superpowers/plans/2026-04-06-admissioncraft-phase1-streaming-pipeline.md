# AdmissionCraft Phase 1 Streaming Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest deployable AdmissionCraft Phase 1 that accepts PS generation input, runs a two-stage asynchronous model pipeline, streams progress and content to the browser over SSE, and persists generation results for later retrieval.

**Architecture:** Because the repository is still greenfield, Phase 1 cannot assume an existing PS tool. The backend will therefore include only the minimum persistence needed for streaming generation: a `sessions` record to hold the request payload, `documents` records for each generation stage, and `generation_tasks` to track async execution. The frontend stays minimal: one static page that can submit a PS request, open an `EventSource`, render streamed chunks, and recover task status after refresh.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic, Celery, Redis, PostgreSQL, vanilla HTML/JS, Nginx, Docker Compose, pytest, httpx

---

## Scope Guardrails

- This plan covers only docs Phase 1: async queue, streaming pipeline, SSE, and task persistence.
- This plan defers student profile management, generic document types, multi-template support, rich text editing, diff view, export, and version timeline UI.
- This Phase 1 plan uses a single PS-oriented session shape instead of a generalized document type system.
- The file `/Users/sid/Repos/LoveEssay/server-access` currently contains plaintext cloud credentials. Rotating and removing those credentials is a prerequisite for any remote deployment.

## Phase 1 Functional Slice

- User opens a simple page and fills in PS generation fields.
- Frontend submits `POST /api/generate`.
- Backend creates a `session` and `generation_task`, enqueues a Celery job, and returns `task_id` immediately.
- Frontend opens `GET /api/stream/{task_id}` using `EventSource`.
- Worker calls the base LLM with streaming enabled, then calls the finetune model with streaming enabled.
- Backend persists stage outputs into `documents` and streams structured SSE events until `[DONE]`.
- User can reload the page and query task state plus the final generated content.

## Deferred To Later Phases

- `students` table and profile reuse
- `document_types` and dynamic form generation
- full session CRUD and session list UI
- Quill editor, manual edits, comments, and diff rendering
- Word/PDF export
- authentication and multi-user isolation

## File Structure

### Repository files

- Create: `README.md` — local setup, service startup order, streaming demo instructions.
- Create: `.gitignore` — Python caches, env files, local DB data if needed.
- Create: `.env.example` — runtime configuration without secrets.
- Modify: `server-access` — remove from version control after key rotation.

### Backend files

- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/config.py`
- Create: `backend/db.py`
- Create: `backend/models/__init__.py`
- Create: `backend/models/session.py`
- Create: `backend/models/document.py`
- Create: `backend/models/task.py`
- Create: `backend/schemas/__init__.py`
- Create: `backend/schemas/session.py`
- Create: `backend/schemas/document.py`
- Create: `backend/schemas/generation.py`
- Create: `backend/api/__init__.py`
- Create: `backend/api/generate.py`
- Create: `backend/api/tasks.py`
- Create: `backend/services/llm_service.py`
- Create: `backend/services/finetune_service.py`
- Create: `backend/services/dashscope_workflow_service.py`
- Create: `backend/services/pipeline.py`
- Create: `backend/tasks/__init__.py`
- Create: `backend/tasks/celery_app.py`
- Create: `backend/tasks/generation.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/0001_phase1_streaming_schema.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_healthcheck.py`
- Create: `backend/tests/services/test_pipeline.py`
- Create: `backend/tests/api/test_generate.py`
- Create: `backend/tests/api/test_tasks.py`
- Create: `backend/tests/tasks/test_generation_task.py`

### Frontend files

- Create: `frontend/index.html`
- Create: `frontend/css/base.css`
- Create: `frontend/js/api.js`
- Create: `frontend/js/stream.js`
- Create: `frontend/js/index.js`

### Infra files

- Create: `docker-compose.yml`
- Create: `nginx/admissioncraft.conf`
- Create: `scripts/dev/up.sh`
- Create: `scripts/dev/test.sh`

## Data Model For Phase 1

### `sessions`

- Purpose: hold one PS generation request payload.
- Fields:
  - `id`
  - `name`
  - `prompt_payload_json`
  - `status`
  - `created_at`

### `documents`

- Purpose: persist stage outputs so streaming events can be reconstructed and final content survives refresh.
- Fields:
  - `id`
  - `session_id`
  - `stage` with values `llm_draft` or `finetune_output`
  - `content`
  - `word_count`
  - `created_at`

### `generation_tasks`

- Purpose: track queue execution and expose status to UI.
- Fields:
  - `id`
  - `session_id`
  - `status` with values `pending`, `running`, `done`, `failed`
  - `current_stage`
  - `error_msg`
  - `created_at`
  - `updated_at`

## API Contract For Phase 1

- `GET /health`
  - Returns service status.
- `POST /api/generate`
  - Accepts PS payload.
  - Creates `session` and `generation_task`.
  - Enqueues Celery job.
  - Returns `202` with `task_id` and `session_id`.
- `GET /api/stream/{task_id}`
  - Opens SSE stream.
  - Emits task status, per-stage chunks, stage completion markers, error event if any, and terminal `[DONE]`.
- `GET /api/tasks/{task_id}`
  - Returns current task status plus final document payload when available.

## SSE Event Shape

- `event: status`
  - `data: {"task_id":1,"status":"running","stage":"llm_draft"}`
- `event: chunk`
  - `data: {"task_id":1,"stage":"llm_draft","delta":"First paragraph..."}`
- `event: stage_complete`
  - `data: {"task_id":1,"stage":"llm_draft","document_id":10}`
- `event: error`
  - `data: {"task_id":1,"message":"provider timeout"}`
- `event: done`
  - `data: {"task_id":1,"status":"done"}`

## Delivery Sequence

1. Bootstrap the repository and local services.
2. Add the minimal Phase 1 schema and settings.
3. Implement provider adapters and streaming pipeline logic.
4. Add Celery worker plus generation and task APIs.
5. Build the simple streaming demo page.
6. Wire Docker Compose and Nginx for local and Aliyun deployment.

### Task 1: Secure Bootstrap And Local Runtime

**Files:**
- Create: `README.md`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `scripts/dev/up.sh`
- Create: `scripts/dev/test.sh`
- Modify: `server-access`
- Test: `backend/tests/test_healthcheck.py`

- [ ] **Step 1: Write the failing healthcheck test**

```python
from fastapi.testclient import TestClient

from main import app


def test_healthcheck_returns_ok():
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: Run the healthcheck test to confirm the app does not exist yet**

Run: `cd backend && pytest tests/test_healthcheck.py -v`
Expected: FAIL with import error or missing route

- [ ] **Step 3: Add the minimal FastAPI app and dependency manifest**

```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 4: Add `.env.example`, `.gitignore`, and dev helper scripts**

Run: `chmod +x scripts/dev/up.sh scripts/dev/test.sh`
Expected: helper scripts are executable and reference `.env` only

- [ ] **Step 5: Remove plaintext cloud credentials from version control after key rotation**

Run: `git rm --cached server-access`
Expected: tracked secret file is removed; if a placeholder is needed, replace it with non-secret setup notes

- [ ] **Step 6: Re-run the healthcheck test**

Run: `cd backend && pytest tests/test_healthcheck.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add README.md .gitignore .env.example backend scripts
git commit -m "chore: bootstrap phase1 runtime"
```

### Task 2: Add Minimal Schema And Persistence For Streaming Generation

**Files:**
- Create: `backend/config.py`
- Create: `backend/db.py`
- Create: `backend/models/__init__.py`
- Create: `backend/models/session.py`
- Create: `backend/models/document.py`
- Create: `backend/models/task.py`
- Create: `backend/schemas/__init__.py`
- Create: `backend/schemas/session.py`
- Create: `backend/schemas/document.py`
- Create: `backend/schemas/generation.py`
- Create: `backend/api/tasks.py`
- Modify: `backend/main.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/0001_phase1_streaming_schema.py`
- Create: `backend/tests/conftest.py`
- Test: `backend/tests/api/test_tasks.py`

- [ ] **Step 1: Write failing task-status persistence tests**

```python
def test_get_task_returns_pending_status(client, task_factory):
    task = task_factory(status="pending", current_stage=None)
    response = client.get(f"/api/tasks/{task.id}")

    assert response.status_code == 200
    assert response.json()["status"] == "pending"
```

- [ ] **Step 2: Run the focused test**

Run: `cd backend && pytest tests/api/test_tasks.py -v`
Expected: FAIL because models, fixtures, and route are missing

- [ ] **Step 3: Implement settings, SQLAlchemy engine, and ORM models**

```python
class Settings(BaseSettings):
    database_url: str
    redis_url: str
    base_model_api_key: str | None = None
    base_model_base_url: str | None = None
    finetune_api_key: str | None = None
    finetune_base_url: str | None = None
    dashscope_api_key: str | None = None
    dashscope_app_id: str | None = None
```

- [ ] **Step 4: Add the initial Alembic migration**

Run: `cd backend && alembic upgrade head`
Expected: `sessions`, `documents`, and `generation_tasks` tables are created

- [ ] **Step 5: Implement `GET /api/tasks/{task_id}` and its response schema**

Run: `cd backend && pytest tests/api/test_tasks.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/config.py backend/db.py backend/models backend/schemas backend/api backend/alembic
git commit -m "feat: add phase1 streaming persistence"
```

### Task 3: Implement Streaming Provider Adapters And Two-Stage Pipeline

**Files:**
- Create: `backend/services/llm_service.py`
- Create: `backend/services/finetune_service.py`
- Create: `backend/services/dashscope_workflow_service.py`
- Create: `backend/services/pipeline.py`
- Create: `backend/tests/services/test_pipeline.py`

- [ ] **Step 1: Write failing pipeline tests with fake streaming providers**

```python
def test_pipeline_streams_llm_then_finetune_output():
    llm = FakeStreamingProvider(["draft-a", "draft-b"])
    finetune = FakeStreamingProvider(["styled-a"])
    pipeline = GenerationPipeline(llm_service=llm, finetune_service=finetune)

    events = list(
        pipeline.stream(
            {
                "student_background": "CS major",
                "program": "CMU MSCS",
                "requirements": "800 words",
            }
        )
    )

    assert [event["stage"] for event in events] == ["llm_draft", "llm_draft", "finetune_output"]
```

- [ ] **Step 2: Run the pipeline test**

Run: `cd backend && pytest tests/services/test_pipeline.py -v`
Expected: FAIL because services and pipeline are missing

- [ ] **Step 3: Implement a shared streaming-provider interface for model calls**

```python
class StreamingProvider(Protocol):
    def stream(self, prompt: str, system_prompt: str | None = None) -> Iterator[str]:
        ...
```

- [ ] **Step 4: Implement `llm_service.py` and `finetune_service.py` using OpenAI-compatible streaming responses**

Run: `cd backend && python -c "from services.llm_service import LLMService; from services.finetune_service import FinetuneService"`
Expected: imports succeed

- [ ] **Step 5: Implement `dashscope_workflow_service.py` as an optional adapter for Aliyun workflow apps**

Run: `cd backend && python -c "from services.dashscope_workflow_service import DashScopeWorkflowService"`
Expected: imports succeed even if DashScope credentials are unset

- [ ] **Step 6: Implement `pipeline.py` to emit ordered stage events and aggregate the first-stage draft for the finetune call**

Run: `cd backend && pytest tests/services/test_pipeline.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/services backend/tests/services/test_pipeline.py
git commit -m "feat: add phase1 streaming model pipeline"
```

### Task 4: Add Celery Worker, Generation API, And SSE Endpoint

**Files:**
- Create: `backend/api/generate.py`
- Modify: `backend/api/tasks.py`
- Create: `backend/tasks/__init__.py`
- Create: `backend/tasks/celery_app.py`
- Create: `backend/tasks/generation.py`
- Modify: `backend/main.py`
- Test: `backend/tests/api/test_generate.py`
- Test: `backend/tests/tasks/test_generation_task.py`

- [ ] **Step 1: Write failing tests for task creation and SSE response**

```python
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
    assert "task_id" in response.json()
    assert "session_id" in response.json()


def test_stream_endpoint_returns_sse_content_type(client, task_factory):
    task = task_factory(status="running", current_stage="llm_draft")
    response = client.get(f"/api/stream/{task.id}")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
```

- [ ] **Step 2: Run the focused tests**

Run: `cd backend && pytest tests/api/test_generate.py tests/tasks/test_generation_task.py -v`
Expected: FAIL because API routes, task worker, and stream handler are missing

- [ ] **Step 3: Implement Celery app wiring and a generation task that updates DB state transitions**

```python
@celery_app.task(name="generation.run")
def run_generation(task_id: int) -> None:
    ...
```

- [ ] **Step 4: Implement `POST /api/generate` to persist the request, create a `generation_task`, and enqueue work**

Run: `curl -X POST http://localhost:8000/api/generate -H 'Content-Type: application/json' -d '{"name":"demo","student_background":"x","program":"y","requirements":"z"}'`
Expected: `202 Accepted` with `task_id` and `session_id`

- [ ] **Step 5: Implement `GET /api/stream/{task_id}` using SSE framing and DB polling/replay**

Run: `curl -N http://localhost:8000/api/stream/1`
Expected: streamed `event:` and `data:` lines appear without waiting for the whole job to finish

- [ ] **Step 6: Persist `llm_draft` and `finetune_output` documents when each stage completes**

Run: `cd backend && pytest tests/api/test_generate.py tests/tasks/test_generation_task.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/main.py backend/api backend/tasks backend/tests/api backend/tests/tasks
git commit -m "feat: add phase1 async generation api"
```

### Task 5: Build The Minimal Frontend Streaming Demo

**Files:**
- Create: `frontend/index.html`
- Create: `frontend/css/base.css`
- Create: `frontend/js/api.js`
- Create: `frontend/js/stream.js`
- Create: `frontend/js/index.js`

- [ ] **Step 1: Add a simple PS submission form and streaming result container**

```html
<form id="generate-form">
  <textarea name="student_background"></textarea>
  <input name="program" />
  <textarea name="requirements"></textarea>
  <button type="submit">Generate</button>
</form>
<pre id="stream-output"></pre>
```

- [ ] **Step 2: Implement `api.js` wrappers for `POST /api/generate` and `GET /api/tasks/{task_id}`**

Run: `node --check frontend/js/api.js`
Expected: no syntax errors

- [ ] **Step 3: Implement `stream.js` with `EventSource` listeners for `status`, `chunk`, `stage_complete`, `error`, and `done`**

```js
export function openTaskStream(taskId, handlers) {
  const source = new EventSource(`/api/stream/${taskId}`);
  source.addEventListener("chunk", (event) => handlers.onChunk(JSON.parse(event.data)));
  return source;
}
```

- [ ] **Step 4: Implement `index.js` to submit the form, open the stream, and render live text per stage**

Run: `node --check frontend/js/stream.js`
Expected: no syntax errors

Run: `node --check frontend/js/index.js`
Expected: no syntax errors

- [ ] **Step 5: Run a browser smoke test**

Run: serve `frontend/` via Nginx or a local static server while FastAPI is running
Expected: entering PS input starts a task, shows immediate status, streams content chunk by chunk, and finishes with a final done state

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat: add phase1 streaming frontend demo"
```

### Task 6: Package Local Stack And Verify SSE-Friendly Reverse Proxying

**Files:**
- Create: `docker-compose.yml`
- Create: `nginx/admissioncraft.conf`
- Modify: `README.md`
- Test: `scripts/dev/up.sh`
- Test: `scripts/dev/test.sh`

- [ ] **Step 1: Add Docker Compose services for Postgres and Redis**

```yaml
services:
  postgres:
    image: postgres:16
  redis:
    image: redis:7
```

- [ ] **Step 2: Add Nginx proxy config for static files, `/api`, and non-buffered SSE**

Run: `nginx -t -c /Users/sid/Repos/LoveEssay/nginx/admissioncraft.conf`
Expected: config validates successfully

- [ ] **Step 3: Document startup order and verification commands in `README.md`**

Run: `sed -n '1,220p' README.md`
Expected: README includes migrate, run API, run worker, run frontend, and troubleshooting notes for SSE

- [ ] **Step 4: Bring up the local stack and run end-to-end verification**

Run: `scripts/dev/up.sh`
Expected: Postgres, Redis, FastAPI, Celery worker, and Nginx/static frontend start cleanly

- [ ] **Step 5: Run automated tests**

Run: `scripts/dev/test.sh`
Expected: healthcheck, pipeline, task, and generation API tests pass

- [ ] **Step 6: Manually verify non-buffered streaming through Nginx**

Run: open the frontend through Nginx and start generation
Expected: content appears incrementally, not all at once after task completion

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml nginx/admissioncraft.conf README.md scripts
git commit -m "chore: package phase1 local stack"
```

## Acceptance Checklist

- [ ] `/health` returns `200`
- [ ] `POST /api/generate` returns immediately with `task_id`
- [ ] Celery worker transitions tasks through `pending -> running -> done|failed`
- [ ] `GET /api/stream/{task_id}` emits ordered SSE events for status, chunks, stage completion, and done
- [ ] `documents` rows are written for `llm_draft` and `finetune_output`
- [ ] Page refresh can recover task state from `GET /api/tasks/{task_id}`
- [ ] Frontend shows streamed output incrementally for both stages
- [ ] Nginx does not buffer SSE until completion
- [ ] No plaintext credentials remain committed in the repository

## Risks And Decisions

- Since the repo has no existing PS generator, this plan includes minimal session persistence even though Phase 2 later expands the session system.
- If provider APIs differ too much between OpenAI-compatible streaming and DashScope workflow apps, keep the production path behind `pipeline.py` and defer provider switching to a configuration flag.
- If SSE replay from the database becomes too heavy, the fallback is to stream only live data in Phase 1 and let `GET /api/tasks/{task_id}` provide final recovery state after refresh.

## Self-Review Notes

- The `writing-plans` skill recommends a subagent review loop, but no subagent delegation was used here. This plan was self-reviewed for scope isolation, task ordering, and testability.
