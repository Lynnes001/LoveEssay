## 1. Update System Prompt

- [x] 1.1 Rewrite `prompts/rewrite-system.md` — scope to style/tone/wording only, explicitly prohibit changing facts, structure, or content; add instruction to ignore content-type notes

## 2. Update User Prompt

- [x] 2.1 Rewrite `prompts/rewrite-user.md` — remove `profile_json`, `grounding_block`, `outline_summary`, `query_text` variables; keep `draft_text`, `school_name`, `notes`

## 3. Update Pipeline

- [x] 3.1 Simplify `backend/services/finetune_pipeline.py` `_build_variables` — remove `query_text`, `grounding_block`, `profile_json`, `outline_summary` from returned dict

## 4. Verify

- [x] 4.1 Confirm `PromptService.render` raises no missing-variable errors with the reduced variable set (grep/trace all `{{...}}` placeholders in new user prompt against what `_build_variables` returns)
