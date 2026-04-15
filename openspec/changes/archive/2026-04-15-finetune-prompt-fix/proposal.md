## Why

The finetune stage system and user prompts are misaligned with the model's actual purpose: the model is a personal writing-style finetuned model, but the current prompts instruct it to rewrite content, verify facts, and remove unsupported details — tasks that belong to the draft and fact_check stages. This causes the model to fight against its own training and risks unintended content changes.

## What Changes

- Replace `prompts/rewrite-system.md` with a minimal style-only system prompt that explicitly forbids content/structure/fact changes
- Replace `prompts/rewrite-user.md` to drop `profile_json`, `grounding_block`, and `outline_summary`; retain `draft_text`, `school_name`, and `notes`
- Update `finetune_pipeline.py` `_build_variables` to stop building and passing the dropped variables

## Capabilities

### New Capabilities

*(none — this is a prompt correction, no new capabilities)*

### Modified Capabilities

*(no spec-level behavior changes — the finetune stage output contract is unchanged; only the prompt instructions and variable set are corrected)*

## Impact

- `prompts/rewrite-system.md` — full replacement
- `prompts/rewrite-user.md` — full replacement (variables reduced from 6 to 3)
- `backend/services/finetune_pipeline.py` — `_build_variables` method simplified
- No API, schema, or frontend changes
