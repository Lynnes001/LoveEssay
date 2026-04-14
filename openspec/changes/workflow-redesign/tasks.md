## 1. Database Migration (0005)

- [x] 1.1 新建 Alembic migration 0005：`sessions` 表删除 `status` 列，`workflow_status` 更新为新枚举值（start | outline_ready | draft_ready | finetuned_ready | fact_check_done | repaired | done）；存量数据映射：`pending → start`，`outline_drafted → outline_ready`，`outline_confirmed → outline_ready`，`draft_completed → finetuned_ready`，`fact_check_passed → done`，`needs_repair → fact_check_done`，`needs_repair_manual → fact_check_done`，`done → done`
- [x] 1.2 同一 migration：`generation_tasks` 表新增 `phase` 列（VARCHAR 20, nullable=True，存量数据可留 NULL）
- [x] 1.3 同一 migration：`documents` 表执行 `UPDATE documents SET stage='finetuned' WHERE stage='rewrite'`
- [x] 1.4 运行 migration，验证表结构

## 2. 数据模型更新

- [x] 2.1 `backend/models/session.py`：删除 `status` 字段，更新 `workflow_status` 注释/枚举
- [x] 2.2 `backend/models/task.py`：新增 `phase` 字段（`Mapped[Optional[str]]`）
- [x] 2.3 更新 `backend/models/__init__.py` 导出

## 3. Session Reset Helper

- [x] 3.1 新建 `backend/services/session_reset.py`，实现 `reset_from(db, session, phase)` 函数，包含 `ARTIFACT_CASCADE` 和 `PHASE_RESET_STATUS` 逻辑
- [x] 3.2 为每种 artifact 实现对应的 delete helper：`_delete_outlines`，`_delete_documents(stage)`，`_delete_fc_reports`

## 4. Pipeline 拆分

- [x] 4.1 修改 `backend/services/draft_pipeline.py`：`DraftPipeline.stream()` 只跑 draft stage，删除 rewrite/finetune 逻辑
- [x] 4.2 新建 `backend/services/finetune_pipeline.py`：`FinetunePipeline.stream(draft_text, session_payload, outline_data)` 用 `FinetuneService` 跑 rewrite/finetune
- [x] 4.3 修改 `backend/services/fact_check_pipeline.py`：`RepairPipeline.stream()` 删除内嵌的自动 fact_check 逻辑，只跑 repair，返回修复后文本
- [x] 4.4 验证 `PromptService` 的 stage prompt 键名（"rewrite" 是否需要改为 "finetune"，或保持不变只改 pipeline 层）

## 5. Celery Tasks 重构

- [x] 5.1 修改 `backend/tasks/outline_generation.py`
- [x] 5.2 新建 `run_finetune` task
- [x] 5.3 修改 `backend/tasks/fact_check_generation.py`

## 6. API Endpoints 替换

- [x] 6.1 重写 `backend/api/generate.py`，删除 legacy `/api/generate` 路由，保留 SSE stream 路由不变
- [x] 6.2 `POST /api/generate/outline`
- [x] 6.3 `POST /api/generate/draft`
- [x] 6.4 新增 `POST /api/generate/finetune`
- [x] 6.5 修改 `POST /api/generate/fact-check`
- [x] 6.6 修改 `POST /api/generate/repair`
- [x] 6.7 修改 `POST /api/sessions/{id}/outline/confirm`：只更新 outline.status="confirmed"，不触发任何 task
- [x] 6.8 确认 `main.py` 路由注册正确

## 7. Schema 更新

- [x] 7.1 更新相关 Pydantic schema（`backend/schemas/`）以匹配模型变更（删除 session status 字段等）
- [x] 7.2 新增 `GenerateFinetuneRequest` schema（如需要）

## 8. 前端适配

- [x] 8.1 `editor.html`：Step 3 改为"Draft Review"，Step 4 改为"Finetune Review"，Step 5 改为"Fact Check"，共 5 步（Outline / Draft / Finetune / Fact Check / Done）
- [x] 8.2 `editor.js`：`onGenerationDone` 在 draft pipeline 完成后展示"生成 Finetune"按钮（类似当前 outline → draft 的流转逻辑）
- [x] 8.3 `editor.js`：新增 finetune step 的 SSE 连接和 UI 状态管理
- [x] 8.4 `editor.js`：fact-check step 触发改为在 finetuned_ready 状态，读取 `stage="finetuned"` 的 document
- [x] 8.5 `api.js`：新增 `createFinetuneTask(sessionId)` 方法，调用 `POST /api/generate/finetune`
- [x] 8.6 `generation-form.js`：`outputNodes` 中 `"rewrite"` 改为 `"finetuned"`

## 9. Verification

- [x] 9.1 端到端流程：outline → (edit) → draft → (edit) → finetune → (edit) → fact_check → done（pass path）
- [x] 9.2 端到端流程：fact_check fail → repair → fact_check → done
- [x] 9.3 截断测试：在 finetune_ready 阶段点"重新生成 draft"，验证 finetuned_doc 和 fc_report 被清除，workflow_status 回到 outline_ready
- [x] 9.4 验证 legacy `/api/generate` 路由已删除，调用返回 404
- [x] 9.5 验证 `stage="rewrite"` 在 migration 后不再存在于 documents 表
