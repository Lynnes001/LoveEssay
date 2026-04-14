## Why

当前 pipeline 从 extraction 直接跳到 draft，跳过了论证框架的确认步骤，导致 AI 生成的文书主线和结构无法被用户控制。核心问题不是生成质量，而是用户在最关键的结构节点上没有控制权。

## What Changes

- 新增 `outline_draft` stage：extraction 完成后，AI 基于 profile 起草一份中文论证框架（outline_candidate）
- 新增 `user_confirm` gate：outline 生成后 pipeline 暂停，等待用户编辑并确认 outline
- 将生成流程拆为两次独立 API 调用：
  - `POST /api/generate/outline` — 执行 extraction + outline_draft，保存 outline_candidate，返回
  - `POST /api/generate/draft` — 读取 outline_confirmed，执行 draft + rewrite
- 新增 `outlines` 数据库表：存储 outline 对象，含 status（candidate/confirmed）、schema_version、data（JSON）
- 新增 outline 编辑与确认 API：`GET/PATCH /api/sessions/{id}/outline`、`POST /api/sessions/{id}/outline/confirm`
- 前端新增 outline 编辑页面：展示 AI 起草的框架，支持完整编辑，用户确认后才能进入正文生成

## Capabilities

### New Capabilities

- `outline-gate`: outline_draft stage 执行、outline 持久化、user_confirm gate 与前端编辑确认流程

### Modified Capabilities

- `generation-console-ui`: 生成控制台需要适配两阶段流程，增加 outline 确认步骤入口

## Impact

- **新增**：`backend/models/outline.py`、`backend/api/outline.py`、Alembic migration
- **修改**：`backend/services/pipeline.py`（拆分为 outline pipeline + draft pipeline）、`backend/api/generate.py`（新增 /outline 路由）
- **前端**：新增 outline 编辑 UI，修改生成流程控制逻辑
- **数据库**：新增 `outlines` 表，`sessions` 表新增 `workflow_status` 字段
