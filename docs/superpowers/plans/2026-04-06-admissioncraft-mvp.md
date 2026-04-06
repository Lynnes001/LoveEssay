# AdmissionCraft MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deployable AdmissionCraft MVP that supports student profiles, document-type driven sessions, two-stage asynchronous generation, versioned documents, and a browser editor backed by FastAPI, PostgreSQL, Redis, and Nginx on Aliyun.

**Architecture:** This is a greenfield monorepo. The backend owns CRUD, pipeline orchestration, Celery jobs, and SSE streaming; the frontend stays as static HTML plus modular vanilla JavaScript served behind Nginx. Model access is isolated behind provider services so the generation route can call an OpenAI-compatible model pair now while reserving a DashScope workflow adapter for Aliyun rollout without changing route contracts.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic, Celery, Redis, PostgreSQL, vanilla HTML/JS, Quill.js, Nginx, Docker Compose, pytest, httpx

---

## Scope Guardrails

- This plan covers the MVP from docs Phase 1 to Phase 3.
- This plan intentionally defers authentication, authorization, multi-user tenancy, inline paragraph rewrite actions, comment threads, and advanced observability dashboards.
- The file `/Users/sid/Repos/LoveEssay/server-access` currently contains plaintext cloud credentials. Treat rotation and removal as a release blocker before any remote deployment.

## File Structure

### Repository files

- Create: `README.md` — local bootstrap, architecture summary, common commands.
- Create: `.gitignore` — Python, Node-free frontend artifacts, env files, test caches.
- Create: `.env.example` — backend runtime variables only, no secrets.
- Modify: `server-access` — delete from repo after key rotation, replace with `.env.example` guidance in docs only if the user explicitly wants the file retained as a placeholder.

### Backend files

- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/config.py`
- Create: `backend/db.py`
- Create: `backend/models/__init__.py`
- Create: `backend/models/student.py`
- Create: `backend/models/document_type.py`
- Create: `backend/models/session.py`
- Create: `backend/models/document.py`
- Create: `backend/models/task.py`
- Create: `backend/schemas/__init__.py`
- Create: `backend/schemas/student.py`
- Create: `backend/schemas/document_type.py`
- Create: `backend/schemas/session.py`
- Create: `backend/schemas/document.py`
- Create: `backend/schemas/generation.py`
- Create: `backend/api/__init__.py`
- Create: `backend/api/students.py`
- Create: `backend/api/document_types.py`
- Create: `backend/api/sessions.py`
- Create: `backend/api/documents.py`
- Create: `backend/api/generate.py`
- Create: `backend/services/llm_service.py`
- Create: `backend/services/finetune_service.py`
- Create: `backend/services/dashscope_workflow_service.py`
- Create: `backend/services/pipeline.py`
- Create: `backend/tasks/__init__.py`
- Create: `backend/tasks/celery_app.py`
- Create: `backend/tasks/generation.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/0001_initial_schema.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_healthcheck.py`
- Create: `backend/tests/api/test_students.py`
- Create: `backend/tests/api/test_document_types.py`
- Create: `backend/tests/api/test_sessions.py`
- Create: `backend/tests/api/test_documents.py`
- Create: `backend/tests/api/test_generate.py`
- Create: `backend/tests/services/test_pipeline.py`
- Create: `backend/tests/tasks/test_generation_task.py`

### Frontend files

- Create: `frontend/index.html`
- Create: `frontend/student.html`
- Create: `frontend/editor.html`
- Create: `frontend/css/base.css`
- Create: `frontend/css/editor.css`
- Create: `frontend/js/api.js`
- Create: `frontend/js/state.js`
- Create: `frontend/js/index.js`
- Create: `frontend/js/student.js`
- Create: `frontend/js/editor.js`
- Create: `frontend/js/stream.js`
- Create: `frontend/js/diff.js`
- Create: `frontend/vendor/quill/` only if CDN usage is rejected; otherwise load Quill from CDN in the MVP.

### Infra files

- Create: `docker-compose.yml`
- Create: `nginx/admissioncraft.conf`
- Create: `scripts/dev/up.sh`
- Create: `scripts/dev/test.sh`
- Create: `scripts/dev/seed_document_types.py`

## Delivery Sequence

1. Stabilize the repository and local environment.
2. Stand up the backend skeleton, schema, and migrations.
3. Implement the generation pipeline with Celery and SSE.
4. Add CRUD for students, document types, sessions, and documents.
5. Build the frontend pages and hook them to the API.
6. Finish versions, diff, export, and deployment hardening.

### Task 1: Secure Bootstrap And Runtime Skeleton

**Files:**
- Create: `README.md`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `backend/requirements.txt`
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

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_healthcheck.py -v`
Expected: FAIL with `ModuleNotFoundError` or missing `/health`

- [ ] **Step 3: Add the minimal FastAPI entrypoint and dependency manifest**

```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 4: Add `.env.example`, `.gitignore`, and local helper scripts**

Run: `chmod +x scripts/dev/up.sh scripts/dev/test.sh`
Expected: scripts become executable and only reference `.env`, not tracked secrets

- [ ] **Step 5: Remove plaintext credentials from tracked files after rotation**

Run: `git rm --cached server-access`
Expected: credentials stop being tracked; if the user wants to keep a note file, replace contents with non-secret setup instructions only

- [ ] **Step 6: Re-run the healthcheck test**

Run: `cd backend && pytest tests/test_healthcheck.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add README.md .gitignore .env.example backend scripts
git commit -m "chore: bootstrap admissioncraft runtime"
```

### Task 2: Define Database Schema, Settings, And Migration Flow

**Files:**
- Create: `backend/config.py`
- Create: `backend/db.py`
- Create: `backend/models/__init__.py`
- Create: `backend/models/student.py`
- Create: `backend/models/document_type.py`
- Create: `backend/models/session.py`
- Create: `backend/models/document.py`
- Create: `backend/models/task.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/0001_initial_schema.py`
- Create: `backend/tests/conftest.py`
- Test: `backend/tests/api/test_students.py`
- Test: `backend/tests/api/test_document_types.py`

- [ ] **Step 1: Write failing CRUD tests for `students` and `document_types`**

```python
def test_create_student(client):
    response = client.post("/api/students", json={"name": "Ada", "profile_json": {"gpa": "3.9"}})
    assert response.status_code == 201
    assert response.json()["name"] == "Ada"


def test_list_document_types(client):
    response = client.get("/api/document-types")
    assert response.status_code == 200
```

- [ ] **Step 2: Run the focused tests to confirm missing DB and routes**

Run: `cd backend && pytest tests/api/test_students.py tests/api/test_document_types.py -v`
Expected: FAIL because tables, fixtures, and routes do not exist

- [ ] **Step 3: Implement settings and SQLAlchemy session management**

```python
class Settings(BaseSettings):
    database_url: str
    redis_url: str
    openai_api_key: str | None = None
    finetune_api_key: str | None = None
    dashscope_api_key: str | None = None
    dashscope_app_id: str | None = None
```

- [ ] **Step 4: Add SQLAlchemy models and the initial Alembic migration**

Run: `cd backend && alembic upgrade head`
Expected: tables `students`, `document_types`, `sessions`, `documents`, `generation_tasks` appear in Postgres

- [ ] **Step 5: Seed initial document types for PS, recommendation letter, self-recommendation, and motivation letter**

Run: `python scripts/dev/seed_document_types.py`
Expected: four starter document types inserted idempotently

- [ ] **Step 6: Re-run the CRUD tests**

Run: `cd backend && pytest tests/api/test_students.py tests/api/test_document_types.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend scripts/dev/seed_document_types.py
git commit -m "feat: add schema and base data model"
```

### Task 3: Implement Provider Adapters And Two-Stage Pipeline

**Files:**
- Create: `backend/services/llm_service.py`
- Create: `backend/services/finetune_service.py`
- Create: `backend/services/dashscope_workflow_service.py`
- Create: `backend/services/pipeline.py`
- Create: `backend/tests/services/test_pipeline.py`

- [ ] **Step 1: Write the failing pipeline unit tests with stub providers**

```python
def test_pipeline_yields_llm_then_finetune_chunks():
    llm = FakeStreamingProvider(["draft-1", "draft-2"])
    finetune = FakeStreamingProvider(["style-1"])
    pipeline = GenerationPipeline(llm_service=llm, finetune_service=finetune)

    events = list(pipeline.stream(session_payload={"prompt": "test"}))

    assert [event["stage"] for event in events] == ["llm_draft", "llm_draft", "finetune_output"]
```

- [ ] **Step 2: Run the pipeline tests**

Run: `cd backend && pytest tests/services/test_pipeline.py -v`
Expected: FAIL because provider services and pipeline are missing

- [ ] **Step 3: Implement `llm_service.py` and `finetune_service.py` behind a shared streaming interface**

```python
class StreamingProvider(Protocol):
    def stream(self, prompt: str, system_prompt: str | None = None) -> Iterator[str]:
        ...
```

- [ ] **Step 4: Implement `dashscope_workflow_service.py` as an optional adapter for Aliyun workflow applications**

Run: `cd backend && python -c "from services.dashscope_workflow_service import DashScopeWorkflowService"`
Expected: imports cleanly even when credentials are absent

- [ ] **Step 5: Implement `pipeline.py` to aggregate the first-stage draft and stream the second-stage rewrite**

Run: `cd backend && pytest tests/services/test_pipeline.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/services backend/tests/services/test_pipeline.py
git commit -m "feat: add generation pipeline services"
```

### Task 4: Add Celery Execution, Task Persistence, And SSE Streaming API

**Files:**
- Create: `backend/tasks/celery_app.py`
- Create: `backend/tasks/generation.py`
- Create: `backend/schemas/generation.py`
- Create: `backend/api/generate.py`
- Modify: `backend/main.py`
- Test: `backend/tests/api/test_generate.py`
- Test: `backend/tests/tasks/test_generation_task.py`

- [ ] **Step 1: Write failing API and task tests**

```python
def test_post_generate_returns_task_id(client, session_factory):
    session = session_factory()
    response = client.post("/api/generate", json={"session_id": session.id})
    assert response.status_code == 202
    assert "task_id" in response.json()


def test_stream_returns_sse_events(client, generation_task_factory):
    task = generation_task_factory(status="running")
    response = client.get(f"/api/stream/{task.id}")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
```

- [ ] **Step 2: Run the focused tests**

Run: `cd backend && pytest tests/api/test_generate.py tests/tasks/test_generation_task.py -v`
Expected: FAIL because generation route, Celery task, and SSE responses are missing

- [ ] **Step 3: Implement Celery app wiring and a DB-backed generation task lifecycle**

```python
@celery_app.task(name="generation.run")
def run_generation(task_id: int) -> None:
    ...
```

- [ ] **Step 4: Implement `POST /api/generate` to create a `generation_tasks` row and enqueue work**

Run: `curl -X POST http://localhost:8000/api/generate -H 'Content-Type: application/json' -d '{"session_id":1}'`
Expected: `202 Accepted` with JSON containing `task_id`

- [ ] **Step 5: Implement `GET /api/stream/{task_id}` using SSE framing and database-backed event replay for reconnects**

Run: `curl -N http://localhost:8000/api/stream/1`
Expected: `event:` and `data:` lines stream until `[DONE]`

- [ ] **Step 6: Re-run the focused tests**

Run: `cd backend && pytest tests/api/test_generate.py tests/tasks/test_generation_task.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/main.py backend/api/generate.py backend/tasks backend/schemas/generation.py
git commit -m "feat: add async generation and sse streaming"
```

### Task 5: Add Students, Sessions, Documents, And Document-Type CRUD Routes

**Files:**
- Create: `backend/schemas/student.py`
- Create: `backend/schemas/document_type.py`
- Create: `backend/schemas/session.py`
- Create: `backend/schemas/document.py`
- Create: `backend/api/students.py`
- Create: `backend/api/document_types.py`
- Create: `backend/api/sessions.py`
- Create: `backend/api/documents.py`
- Modify: `backend/main.py`
- Test: `backend/tests/api/test_sessions.py`
- Test: `backend/tests/api/test_documents.py`

- [ ] **Step 1: Write failing route tests for session lifecycle and document listing**

```python
def test_create_session(client, student_factory, document_type_factory):
    response = client.post(
        "/api/sessions",
        json={"name": "张三-CMU-PS-2025", "student_id": 1, "document_type_id": 1, "input_data_json": {"target_words": 800}},
    )
    assert response.status_code == 201


def test_list_session_documents(client, document_factory):
    response = client.get("/api/sessions/1/documents")
    assert response.status_code == 200
```

- [ ] **Step 2: Run the CRUD tests**

Run: `cd backend && pytest tests/api/test_sessions.py tests/api/test_documents.py -v`
Expected: FAIL because schemas and routes are incomplete

- [ ] **Step 3: Implement Pydantic schemas and CRUD endpoints**

Run: `cd backend && pytest tests/api/test_students.py tests/api/test_document_types.py tests/api/test_sessions.py tests/api/test_documents.py -v`
Expected: PASS

- [ ] **Step 4: Add validation rules that keep `input_schema_json` and `input_data_json` JSON-friendly**

Run: `cd backend && pytest tests/api/test_document_types.py tests/api/test_sessions.py -v`
Expected: PASS with invalid payloads rejected as `422`

- [ ] **Step 5: Commit**

```bash
git add backend/api backend/schemas backend/main.py backend/tests/api
git commit -m "feat: add core admissioncraft crud routes"
```

### Task 6: Build Frontend Session List, Student Profile, And Generate Flow

**Files:**
- Create: `frontend/index.html`
- Create: `frontend/student.html`
- Create: `frontend/js/api.js`
- Create: `frontend/js/state.js`
- Create: `frontend/js/index.js`
- Create: `frontend/js/student.js`
- Create: `frontend/js/stream.js`
- Create: `frontend/css/base.css`

- [ ] **Step 1: Add static HTML shells for the session list and student profile pages**

```html
<main id="app">
  <section id="session-list"></section>
  <button id="create-session">New Session</button>
</main>
```

- [ ] **Step 2: Implement `api.js` wrappers for all CRUD and generation endpoints**

Run: `node --check frontend/js/api.js`
Expected: no syntax errors

- [ ] **Step 3: Implement `stream.js` with `EventSource` lifecycle handling and reconnect-safe status updates**

```js
export function openGenerationStream(taskId, handlers) {
  const source = new EventSource(`/api/stream/${taskId}`);
  source.onmessage = (event) => handlers.onChunk(JSON.parse(event.data));
  return source;
}
```

- [ ] **Step 4: Wire `index.js` to create sessions, trigger generation, and show task state**

Run: `python -m http.server 4173 --directory frontend`
Expected: the page loads, but API calls still target FastAPI at `localhost:8000`

- [ ] **Step 5: Perform a browser smoke test against the running backend**

Run: open `/Users/sid/Repos/LoveEssay/frontend/index.html` through Nginx or a local static server
Expected: user can create a session, start generation, and see streamed chunks appended live

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat: add session and student frontend flows"
```

### Task 7: Add Rich Text Editor, Version History, Diff View, And Export

**Files:**
- Create: `frontend/editor.html`
- Create: `frontend/css/editor.css`
- Create: `frontend/js/editor.js`
- Create: `frontend/js/diff.js`
- Modify: `backend/api/documents.py`
- Modify: `backend/schemas/document.py`
- Test: `backend/tests/api/test_documents.py`

- [ ] **Step 1: Write failing API tests for version creation and export metadata**

```python
def test_create_manual_edit_version(client, session_factory):
    response = client.post("/api/documents", json={"session_id": 1, "stage": "manual_edit", "content": "edited"})
    assert response.status_code == 201
    assert response.json()["version"] == 2
```

- [ ] **Step 2: Run the document tests**

Run: `cd backend && pytest tests/api/test_documents.py -v`
Expected: FAIL because version increment and export fields are incomplete

- [ ] **Step 3: Extend documents API for manual-save versions, stage filtering, and latest-version lookup**

Run: `cd backend && pytest tests/api/test_documents.py -v`
Expected: PASS

- [ ] **Step 4: Implement Quill-based editor page with autosave button, word count, and version timeline**

Run: `node --check frontend/js/editor.js`
Expected: no syntax errors

Run: `node --check frontend/js/diff.js`
Expected: no syntax errors

- [ ] **Step 5: Implement a minimal diff renderer comparing `llm_draft` and `finetune_output`**

Run: open the editor page in browser
Expected: user can toggle between current content, version history, and line-level diff summary

- [ ] **Step 6: Add Word/PDF export endpoints or stub download links, using HTML-to-file conversion only after manual verification**

Run: manually export a sample document
Expected: `.docx` and `.pdf` download from the current manual edit version

- [ ] **Step 7: Commit**

```bash
git add backend/api/documents.py backend/schemas/document.py frontend
git commit -m "feat: add editor versions diff and export"
```

### Task 8: Package Local Development And Aliyun Deployment

**Files:**
- Create: `docker-compose.yml`
- Create: `nginx/admissioncraft.conf`
- Modify: `README.md`
- Test: `scripts/dev/up.sh`

- [ ] **Step 1: Add `docker-compose.yml` for Postgres and Redis**

```yaml
services:
  postgres:
    image: postgres:16
  redis:
    image: redis:7
```

- [ ] **Step 2: Add Nginx config for static frontend hosting, `/api` proxying, and SSE-safe headers**

Run: `nginx -t -c /Users/sid/Repos/LoveEssay/nginx/admissioncraft.conf`
Expected: configuration is valid

- [ ] **Step 3: Document backend, worker, and Nginx startup order in `README.md`**

Run: `sed -n '1,220p' README.md`
Expected: README includes local dev, migration, seed, worker, and deployment sections

- [ ] **Step 4: Execute end-to-end local acceptance**

Run: `scripts/dev/up.sh`
Expected: Postgres, Redis, FastAPI, Celery worker, and static frontend all start cleanly

- [ ] **Step 5: Run backend regression tests**

Run: `cd backend && pytest -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml nginx/admissioncraft.conf README.md scripts/dev/up.sh
git commit -m "chore: add local stack and deployment wiring"
```

## Acceptance Checklist

- [ ] `/health` returns `200`
- [ ] `students`, `document-types`, `sessions`, and `documents` CRUD APIs pass pytest coverage
- [ ] `POST /api/generate` returns a task id immediately
- [ ] `GET /api/stream/{task_id}` streams `llm_draft`, `finetune_output`, and terminal `[DONE]`
- [ ] Frontend can create a session, launch generation, and display streaming output without full-page refresh
- [ ] Editor can save manual edits as new versions
- [ ] Diff view compares draft and finetuned outputs
- [ ] Export produces at least one verified `.docx` and one verified `.pdf`
- [ ] Nginx proxies SSE traffic without buffering the stream to completion
- [ ] No secrets remain committed in the repository

## Open Questions To Resolve Before Execution

- Which provider pairing is required for production day one: direct OpenAI-compatible LLM plus finetune model, or DashScope workflow application as the first-stage orchestrator?
- Is single-user internal usage acceptable for the MVP, or should even the first release include login and per-consultant isolation?
- For export, is HTML-to-PDF/DOCX fidelity sufficient, or is there a strict template format that requires a Word-native rendering path?
- Should the frontend stay fully static and unbundled, or is introducing a lightweight bundler acceptable if Quill integration becomes cumbersome?

## Execution Notes

- Prefer implementing Tasks 1 through 4 before touching the editor UI.
- Keep migrations and seeded `document_types` idempotent so staging rebuilds are cheap.
- Do not reconnect to any remote cloud resource until the leaked credential in `server-access` has been rotated and removed from version control.
