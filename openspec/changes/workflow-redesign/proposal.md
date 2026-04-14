## Why

当前后端把"文章进行到哪一步"和"AI 任务运行状态"混在一起，导致：
- `workflow_status` 有 8 个值，混合了三种性质（阶段事实、人工 gate、终态）
- `DraftPipeline` 把 draft 和 finetune 融合成一个 task，用户无法在两步之间介入
- `RepairPipeline` 内嵌了自动 fact_check，用户没有机会 review repair 结果
- `WritingSession.status` 和 `GenerationTask.status` 语义重叠，冗余
- 没有清晰的"截断重来"机制——重新生成某步时，下游 artifact 的清理逻辑散落各处

## What Changes

**状态机：** 将 `workflow_status` 精简为 7 个语义清晰的值，每个值代表"用户确认过的进度节点"，而非 AI 任务的运行状态

**Pipeline 拆分：** 将现有 `DraftPipeline`（draft + rewrite 融合）拆为两个独立 Pipeline，在 draft_ready 插入人工介入点

**RepairPipeline 简化：** 去掉内嵌的自动 fact_check，repair 完成后由用户决定是否重新 fact_check

**截断重来机制：** 每个 generate endpoint 触发前先清理当前节点及所有下游 artifact，workflow_status 回退到对应节点的上游状态

**数据模型清理：** 删除 `WritingSession.status` 冗余字段，`Document.stage="rewrite"` 改名为 `"finetuned"`，`GenerationTask` 增加 `phase` 字段

## Capabilities

### Modified Capabilities

- `generation-pipeline`: 拆分 DraftPipeline，简化 RepairPipeline，新增 FinetunePipeline
- `generation-console-ui`: Step 3（draft review）和 Step 4（finetune review）拆成两个独立步骤

### New Capabilities

- `workflow-reset`: 重新生成任意阶段时，自动清理该阶段及下游所有 artifact 并回退 workflow_status

## Non-Goals

- 不保留向后兼容——旧的 `/api/generate` legacy 路由一并删除
- 不做 multi-version diff 视图（保留历史 artifact 不在本次范围内）
- 不改动 outline schema 和 prompt 内容

## Impact

- **修改**：`backend/models/session.py`、`backend/models/task.py`、`backend/models/document.py`
- **修改**：`backend/services/draft_pipeline.py`（拆分）、`backend/tasks/outline_generation.py`、`backend/tasks/fact_check_generation.py`
- **新增**：`backend/services/finetune_pipeline.py`、`backend/api/generate_v2.py`（或直接替换现有 generate.py）
- **新增**：Alembic migration 0005
- **删除**：`backend/api/generate.py` 中 legacy `/api/generate` 路由
- **前端**：editor.js / editor.html 适配新的 5 步骤流程
