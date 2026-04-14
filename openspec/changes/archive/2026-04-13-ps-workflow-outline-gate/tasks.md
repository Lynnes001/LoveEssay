## 1. Database Migration

- [x] 1.1 新建 Alembic migration：新增 `outlines` 表（id, session_id, schema_version, status, data JSONB, created_at, updated_at）
- [x] 1.2 同一 migration 在 `sessions` 表新增 `workflow_status` 字段，存量数据默认值 `pending`
- [x] 1.3 运行 migration 并验证表结构正确

## 2. Outline ORM Model

- [x] 2.1 新建 `backend/models/outline.py`，定义 `Outline` SQLAlchemy model，字段对应 outlines 表
- [x] 2.2 在 `WritingSession` model 中添加 `workflow_status` 字段和 `outlines` relationship

## 3. Outline Pipeline

- [x] 3.1 在 `PromptService` 中添加 `outline_draft` stage 的 prompt 模板（输入 profile JSON，输出符合 OutlineSchema_v1 data 结构的 JSON）
- [x] 3.2 新建 `OutlinePipeline` 类（或在现有 pipeline 中拆分），实现 extraction + outline_draft 两个 stage 的 stream 逻辑
- [x] 3.3 outline_draft stage 完成后解析 JSON，失败时抛出 `ValueError` 并标记 task failed
- [x] 3.4 解析成功后将 outline_candidate 写入 `outlines` 表，session.workflow_status 置为 `outline_drafted`

## 4. Draft Pipeline Update

- [x] 4.1 修改现有 `GenerationPipeline.stream`（或新建 `DraftPipeline`），接受 `outline_confirmed` 作为输入
- [x] 4.2 在 `PromptService` 中更新 `draft` stage prompt，接受 outline 结构化字段（thesis, sections, controls）
- [x] 4.3 draft pipeline 入口校验 session.workflow_status == `outline_confirmed`，否则抛出异常

## 5. Outline API

- [x] 5.1 新建 `backend/api/outline.py`，实现 `GET /api/sessions/{id}/outline`（读取最新 outline，404 if none）
- [x] 5.2 实现 `PATCH /api/sessions/{id}/outline`（更新 data 字段，更新 updated_at，status 保持 candidate）
- [x] 5.3 实现 `POST /api/sessions/{id}/outline/confirm`（校验 target_language 必填，status 置为 confirmed，session.workflow_status 置为 outline_confirmed）
- [x] 5.4 在 `backend/main.py` 中注册 outline router

## 6. Generate API Update

- [x] 6.1 在 `backend/api/generate.py` 新增 `POST /api/generate/outline` 路由，触发 OutlinePipeline，SSE 推流
- [x] 6.2 新增 `POST /api/generate/draft` 路由，校验 workflow_status，触发 DraftPipeline，SSE 推流
- [x] 6.3 保留原有 `POST /api/generate` 路由不删除（标记 deprecated，避免前端 break）

## 7. Frontend: Outline Step

- [x] 7.1 在 `frontend/index.html` 中新增 outline 确认面板（默认隐藏），包含 thesis 输入、sections 列表编辑、controls 编辑、语言选择和确认按钮
- [x] 7.2 在 `frontend/js/` 中新增 outline 相关逻辑：outline generation 完成后展示面板，调用 PATCH 保存编辑，调用 confirm 接口
- [x] 7.3 draft generation 按钮在 outline 未确认时置为 disabled，confirmed 后启用
- [x] 7.4 pipeline monitor 新增 `outline_draft` stage 显示，保持 extraction / draft / rewrite 原有显示

## 8. Verification

- [x] 8.1 端到端测试：提交 outline 生成 → 编辑 outline → 确认 → 触发 draft，验证全流程 SSE 正常
- [x] 8.2 验证跳过确认直接调 /api/generate/draft 返回 400
- [x] 8.3 验证 outline JSON 解析失败时 task 状态为 failed，session workflow_status 不变
