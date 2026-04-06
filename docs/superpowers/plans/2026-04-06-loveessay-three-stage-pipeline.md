# LoveEssay Three-Stage Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current two-stage generation flow with a stable three-stage pipeline: `extraction -> draft -> rewrite`, using the prompt files in `prompts/` as the single source of truth.

**Architecture:** Keep the current request shape and async task model, but refactor prompt construction into a dedicated prompt-rendering layer. The worker will first convert raw user input into a structured profile JSON, then generate an essay draft from that profile, then rewrite the draft into the final essay. Stage names, persisted documents, SSE events, and frontend panels must all align to these three stages.

**Tech Stack:** Python 3.12, FastAPI, Celery, SQLAlchemy 2.x, OpenAI-compatible chat completions, vanilla JS, pytest

---

## Scope Guardrails

- This plan upgrades only the main generation path to `extraction -> draft -> rewrite`.
- `fact-check-system.md`, `fact-check-user.md`, and `repair-user.md` remain unused in this iteration.
- The request payload stays as-is for now: `name`, `student_background`, `program`, `requirements`, `custom_prompt`.
- No schema migration is required unless the team decides to enforce stage enums at the DB level later.

## File Structure

### Backend files

- Create: `backend/services/prompt_service.py`
- Modify: `backend/services/pipeline.py`
- Modify: `backend/services/llm_service.py`
- Modify: `backend/services/finetune_service.py`
- Modify: `backend/tasks/generation.py`
- Modify: `backend/schemas/session.py`
- Modify: `backend/config.py`

### Frontend files

- Modify: `frontend/index.html`
- Modify: `frontend/js/generation-form.js`

### Test files

- Modify: `backend/tests/services/test_pipeline.py`
- Modify: `backend/tests/tasks/test_generation_task.py`
- Modify: `backend/tests/api/test_generate.py`
- Modify: `backend/tests/test_configuration.py`

### Docs files

- Modify: `README.md`

## Design Decisions

### Prompt ownership

- `prompts/` is the source of truth for stage instructions.
- The app should stop hardcoding stage-specific prompt text inside model service classes.
- A new `PromptService` should load Markdown prompt files, extract the fenced `text` block, and render `{{variable}}` placeholders.

### Stage-to-model mapping

- `extraction` uses the current base model adapter in `LLMService`.
- `draft` uses the current base model adapter in `LLMService`.
- `rewrite` uses the current polish model adapter in `FinetuneService`.
- This preserves the current infra contract while changing workflow behavior.

### Request-to-prompt mapping

- `school_name` comes from `program` for this iteration.
- `chunk_content` comes from `student_background`, plus a compact appendix built from `requirements` and `custom_prompt` so extraction sees all user-provided raw material.
- `chunk_section_type` is a fixed hint such as `student_background`.
- `query_text` comes from `requirements`.
- `notes` comes from `custom_prompt` or an empty string.
- `grounding_block` should be generated from the structured extraction result rather than accepted from users.

### Persisted stage names

- Replace `llm_draft` with `extraction`.
- Replace `finetune_output` with `rewrite`.
- Add new persisted stage `draft`.
- The task lifecycle should end with `current_stage = "rewrite"`.

## Task 1: Add Prompt Loading And Rendering Support

**Files:**
- Create: `backend/services/prompt_service.py`
- Modify: `backend/tests/test_configuration.py`
- Test: `backend/tests/services/test_pipeline.py`

- [ ] **Step 1: Write a failing pipeline test that expects rendered stage prompts instead of the current raw concatenated payload**

```python
def test_pipeline_renders_prompt_files_for_each_stage():
    ...
    assert extraction.calls[0]["system_prompt"] == "..."
    assert "结构化资料" in draft.calls[0]["prompt"]
```

- [ ] **Step 2: Run the pipeline test to verify the current implementation fails**

Run: `cd backend && pytest tests/services/test_pipeline.py -v`
Expected: FAIL because `pipeline.py` still concatenates raw fields directly and has no prompt loader

- [ ] **Step 3: Create `backend/services/prompt_service.py` with focused responsibilities**

```python
class PromptService:
    def load_prompt(self, prompt_name: str) -> str: ...
    def render(self, template: str, variables: dict[str, str]) -> str: ...
    def stage_prompts(self, stage: str, variables: dict[str, str]) -> tuple[str, str]: ...
```

- [ ] **Step 4: Make prompt loading deterministic**

Run: load prompt files from `/Users/sid/Repos/LoveEssay/prompts`
Expected: missing file or missing fenced `text` block raises a clear `ValueError`

- [ ] **Step 5: Keep model configuration tests green while leaving env var names unchanged**

Run: `cd backend && pytest tests/test_configuration.py -v`
Expected: PASS without introducing new model env vars

- [ ] **Step 6: Commit**

```bash
git add backend/services/prompt_service.py backend/tests/services/test_pipeline.py backend/tests/test_configuration.py
git commit -m "feat: add prompt rendering service"
```

## Task 2: Refactor Pipeline To Stream `extraction -> draft -> rewrite`

**Files:**
- Modify: `backend/services/pipeline.py`
- Modify: `backend/services/llm_service.py`
- Modify: `backend/services/finetune_service.py`
- Modify: `backend/tests/services/test_pipeline.py`

- [ ] **Step 1: Extend the pipeline test to expect three ordered stages**

```python
assert [event["stage"] for event in events] == [
    "extraction",
    "draft",
    "draft",
    "rewrite",
]
```

- [ ] **Step 2: Run the pipeline test and confirm stage order is still wrong**

Run: `cd backend && pytest tests/services/test_pipeline.py -v`
Expected: FAIL because the current pipeline only emits two stages

- [ ] **Step 3: Refactor `GenerationPipeline` to accept a prompt service and run the three-stage chain**

```python
structured_profile = collect(extraction_service.stream(...))
draft_text = collect(draft_service.stream(...))
yield rewrite_service.stream(...)
```

- [ ] **Step 4: Normalize extraction output handling**

Run: parse the collected extraction text as JSON
Expected: invalid JSON raises a clear exception that fails the task instead of silently continuing

- [ ] **Step 5: Build a stable grounding block from the parsed extraction profile**

Run: render a whitelist-style grounding section from the parsed JSON
Expected: `draft` and `rewrite` always receive both `profile_json` and `grounding_block`

- [ ] **Step 6: Keep provider classes generic**

Run: leave `LLMService.stream(prompt, system_prompt=None)` and `FinetuneService.stream(prompt, system_prompt=None)` as transport adapters only
Expected: no stage-specific hardcoded writing instructions remain in those service classes

- [ ] **Step 7: Re-run the focused pipeline test**

Run: `cd backend && pytest tests/services/test_pipeline.py -v`
Expected: PASS with extraction prompt, draft prompt, and rewrite prompt all verified

- [ ] **Step 8: Commit**

```bash
git add backend/services/pipeline.py backend/services/llm_service.py backend/services/finetune_service.py backend/tests/services/test_pipeline.py
git commit -m "feat: switch pipeline to extraction draft rewrite"
```

## Task 3: Update Task Persistence And SSE Stage Reporting

**Files:**
- Modify: `backend/tasks/generation.py`
- Modify: `backend/tests/tasks/test_generation_task.py`
- Modify: `backend/tests/api/test_generate.py`

- [ ] **Step 1: Update the generation task test to expect three persisted documents**

```python
assert stages == ["extraction", "draft", "rewrite"]
```

- [ ] **Step 2: Run the task test to verify current stage persistence is outdated**

Run: `cd backend && pytest tests/tasks/test_generation_task.py -v`
Expected: FAIL because the worker still persists `llm_draft` and `finetune_output`

- [ ] **Step 3: Change `run_generation()` stage buffers and status events to the new stage names**

```python
stage_buffers = {"extraction": [], "draft": [], "rewrite": []}
task.current_stage = "extraction"
```

- [ ] **Step 4: Ensure stage completion persists each stage once**

Run: persist the collected text when moving from one stage to the next and again only if the final stage has not yet been saved
Expected: exactly one document row per stage

- [ ] **Step 5: Update the API-level SSE test expectation for the final stage**

Run: `cd backend && pytest tests/api/test_generate.py -v`
Expected: PASS with `current_stage == "rewrite"`

- [ ] **Step 6: Re-run task and API tests**

Run: `cd backend && pytest tests/tasks/test_generation_task.py tests/api/test_generate.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/tasks/generation.py backend/tests/tasks/test_generation_task.py backend/tests/api/test_generate.py
git commit -m "feat: persist three-stage generation outputs"
```

## Task 4: Update Frontend Stage Labels And Stream Rendering

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/js/generation-form.js`

- [ ] **Step 1: Update the UI copy to describe a three-stage flow**

```html
<p class="lede">输入原始材料，依次执行 extraction、draft、rewrite，并实时查看流式输出。</p>
```

- [ ] **Step 2: Replace the two output panels with three stage-aligned panels**

```html
<h2>Extraction</h2>
<h2>Draft</h2>
<h2>Rewrite</h2>
```

- [ ] **Step 3: Update `generation-form.js` to clear and append by the new stage names**

```javascript
if (message.stage === "extraction") { ... }
else if (message.stage === "draft") { ... }
else if (message.stage === "rewrite") { ... }
```

- [ ] **Step 4: Update final document lookup to prefer `rewrite`**

Run: after task completion, set the final panel from the persisted `rewrite` document
Expected: refresh and late-arriving chunks still converge on the stored final essay

- [ ] **Step 5: Smoke-test the browser flow locally**

Run: `./scripts/dev/up.sh`
Expected: form submission shows three panels streaming in order without JS errors

- [ ] **Step 6: Commit**

```bash
git add frontend/index.html frontend/js/generation-form.js
git commit -m "feat: align frontend with three-stage stream"
```

## Task 5: Document The New Workflow And Run Regression Verification

**Files:**
- Modify: `README.md`
- Modify: `backend/schemas/session.py`
- Test: `backend/tests/services/test_pipeline.py`
- Test: `backend/tests/tasks/test_generation_task.py`
- Test: `backend/tests/api/test_generate.py`
- Test: `backend/tests/test_configuration.py`

- [ ] **Step 1: Tighten payload field descriptions in `backend/schemas/session.py` if useful**

```python
class SessionPayload(BaseModel):
    student_background: str  # raw source material
    program: str             # used as school_name in prompts for now
```

- [ ] **Step 2: Update `README.md` to describe the real stage sequence**

Run: replace references to “two-stage” and “草稿 + 润色” with `extraction -> draft -> rewrite`
Expected: docs match runtime behavior

- [ ] **Step 3: Run the focused backend regression suite**

Run: `cd backend && pytest tests/services/test_pipeline.py tests/tasks/test_generation_task.py tests/api/test_generate.py tests/test_configuration.py -v`
Expected: PASS

- [ ] **Step 4: Run the project test entrypoint**

Run: `./scripts/dev/test.sh`
Expected: PASS, or if unrelated failures exist, capture them explicitly before claiming completion

- [ ] **Step 5: Commit**

```bash
git add README.md backend/schemas/session.py
git commit -m "docs: document three-stage generation workflow"
```

## Verification Checklist

- [ ] `POST /api/generate` request shape remains backward compatible
- [ ] Worker emits `status`, `chunk`, `stage_complete`, and `done` events with stages `extraction`, `draft`, `rewrite`
- [ ] `documents` rows are written exactly once for `extraction`, `draft`, and `rewrite`
- [ ] `rewrite` content is the final stored essay shown to the frontend
- [ ] Prompt text comes from `prompts/*.md`, not hardcoded stage instructions in service adapters
- [ ] Invalid extraction JSON fails the task clearly instead of silently producing a low-quality draft

## Risks To Watch

- Extraction prompt may return fenced JSON or extra prose in real providers. If that happens, add a narrow JSON-cleaning helper rather than weakening validation globally.
- Using `program` as `school_name` is a deliberate temporary mapping. If the product later splits school vs program, update prompt variables and form fields together.
- The current request schema has only one raw text field. If users start supplying heterogeneous source documents, add explicit chunking and section typing as a separate project instead of overloading this pipeline further.
