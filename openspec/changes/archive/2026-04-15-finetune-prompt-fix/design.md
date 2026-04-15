## Context

The finetune stage uses a personal writing-style finetuned model (served via `POLISH_MODEL_*` env vars, defaulting to qwen-plus). The current prompts (`rewrite-system.md`, `rewrite-user.md`) were written when this stage was a generic rewrite step — before the workflow was redesigned into distinct draft / finetune / fact_check phases. As a result, the prompts instruct the model to verify facts, remove unsupported details, and restructure prose — all tasks that now belong to other stages.

Current variable set passed to the model: `school_name`, `query_text`, `notes`, `grounding_block`, `profile_json`, `outline_summary`, `draft_text` (7 variables).

## Goals / Non-Goals

**Goals:**
- System prompt scoped to style/tone/wording only, with explicit prohibition on content and fact changes
- User prompt reduced to the minimum needed: `draft_text`, `school_name`, `notes`
- `finetune_pipeline._build_variables` simplified to match

**Non-Goals:**
- No changes to the finetune model itself, its API, or its configuration
- No changes to API endpoints, DB schema, or frontend
- No changes to any other pipeline stage's prompts

## Decisions

### Decision 1: Drop `profile_json`, `grounding_block`, `outline_summary` from user prompt

**Chosen:** Remove all three variables from the finetune prompt.

**Rationale:** These variables exist to ground the model in source facts and structure. Sending them implicitly invites the model to re-derive content from source material — which is the draft stage's job. The finetuned model should treat `draft_text` as the immutable content source and only transform its surface expression.

**Alternative considered:** Keep them as read-only reference. Rejected — any reference material creates pressure on the model to reconcile prompt content against the draft, causing content drift.

### Decision 2: Keep `notes` despite mixed content

**Chosen:** Keep `notes` in the user prompt, but add a system-level instruction to ignore content-type notes.

**Rationale:** `notes` may contain style hints ("more conversational", "less formal") which are exactly what the finetune stage needs. Since we can't guarantee `notes` is style-only, the system prompt handles the ambiguity: "if notes describe content requirements, ignore them."

### Decision 3: Keep `school_name` for register calibration

**Chosen:** Keep `school_name`.

**Rationale:** Tone and register may reasonably vary by audience (engineering program vs. liberal arts). The model can use this for style calibration without touching content.

### Decision 4: Replace `query_text` with nothing

**Chosen:** Drop `query_text` (maps to `session.requirements`).

**Rationale:** Requirements are content constraints for the draft stage, not style constraints. Sending them to the finetune model risks content modification.

## Risks / Trade-offs

- **[Risk] Finetune model produces shorter output without profile context** → The model no longer has source material as a safety net; if the draft has thin content the finetune output will also be thin. Mitigation: this is the correct behavior — thin draft is a draft-stage problem, not a finetune-stage problem.
- **[Risk] `notes` with content requirements silently ignored** → User may expect finetune to act on content notes. Mitigation: acceptable trade-off; the finetune stage is now explicitly style-only by design.
