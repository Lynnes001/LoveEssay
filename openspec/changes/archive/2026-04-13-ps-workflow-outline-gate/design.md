## Context

当前 pipeline（`GenerationPipeline.stream`）是一个连续 stream：extraction → draft → rewrite，所有阶段一次完成，用户无法在中途介入。文档设计要求在 extraction 之后插入一个 user_confirm gate，让用户编辑并确认论证框架后，再进入正文生成。

已确认的关键决策：
- 流程拆为两次独立 API 调用，而非一次长连接中暂停
- outline 独立建表，不放 session 的 JSONB 字段

## Goals / Non-Goals

**Goals:**
- 拆分 pipeline 为 outline pipeline（extraction + outline_draft）和 draft pipeline（draft + rewrite）
- 新增 `outlines` 表，存储符合 OutlineSchema_v1 的 outline 对象
- 新增 outline 读写 API，支持前端编辑和确认
- 前端新增 outline 编辑步骤，用户确认后才能触发 draft pipeline

**Non-Goals:**
- fact_check / repair stages
- session 管理 UI
- multi-version diff 视图
- outline 字段级校验（v1 先做结构存储，不做 referential integrity 校验）

## Decisions

### 决策 1：拆为两次 API 调用，而非单流暂停

**选择**：两次独立 HTTP 请求

**备选**：SSE 流中 emit `user_confirm_required` 事件，前端暂停，用户确认后再发第二请求

**理由**：
- 两次调用边界清晰，每次都有独立 task_id，便于重试
- 单流暂停需要在 Redis 中维护流状态，增加复杂度
- 前端 EventSource 无法在同一连接内重启，暂停方案实际上也要发第二个请求

**API 设计**：
```
POST /api/generate/outline   → 执行 extraction + outline_draft，保存 outline_candidate
                               返回 {task_id, session_id}

GET  /api/sessions/{id}/outline      → 读取当前 outline（candidate 或 confirmed）
PATCH /api/sessions/{id}/outline     → 用户编辑保存（保持 candidate 状态）
POST /api/sessions/{id}/outline/confirm → 将 outline 状态置为 confirmed

POST /api/generate/draft     → 读取 outline_confirmed，执行 draft + rewrite
                               返回 {task_id, session_id}
```

### 决策 2：outlines 独立建表

**选择**：新建 `outlines` 表

**备选**：outline 存为 `sessions.prompt_payload_json` 的子字段

**理由**：
- outline 有独立状态机（candidate → confirmed），需要明确的状态字段
- 独立表支持后续版本历史（v2 支持多版本 outline）
- 不污染 session 的 payload 字段语义

**表结构**：
```sql
CREATE TABLE outlines (
    id              SERIAL PRIMARY KEY,
    session_id      INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    schema_version  VARCHAR(10) NOT NULL DEFAULT 'v1',
    status          VARCHAR(20) NOT NULL DEFAULT 'candidate',  -- candidate | confirmed
    data            JSONB NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

每个 session 在 v1 中只有一条活跃 outline（最新一条）。

### 决策 3：sessions 表新增 workflow_status

当前 sessions.status 语义不清晰。新增 `workflow_status` 字段反映业务状态机：

```
pending → outline_drafted → outline_confirmed → draft_completed → done
```

draft pipeline 启动前校验 `workflow_status == outline_confirmed`，否则 400。

### 决策 4：outline_draft prompt 输出格式

outline_draft stage 要求模型输出合法 JSON（符合 OutlineSchema_v1 的 data 字段结构）。
与 extraction 相同，使用 `stream=True` 但在完整输出后做 JSON 解析校验，解析失败则 stage failed。

## Risks / Trade-offs

- **[风险] outline JSON 解析失败** → 模型输出不稳定时会导致 stage failed。缓解：prompt 中明确 JSON 格式要求 + 服务端 strip markdown fence 后解析，解析失败返回 failed 状态，前端提示用户重试
- **[风险] 用户跳过 outline 直接调 /api/generate/draft** → 服务端检查 `workflow_status`，未确认则返回 400
- **[Trade-off] 两次请求增加 UX 摩擦** → 这是设计目标：让用户有意识地确认框架，不是副作用
- **[风险] 旧 session 没有 workflow_status** → Alembic migration 给存量数据补默认值 `pending`

## Migration Plan

1. Alembic migration：新增 `outlines` 表 + `sessions.workflow_status` 字段
2. 存量 sessions 的 `workflow_status` 默认设为 `pending`
3. 旧的 `/api/generate` 接口保留，不删除，但标记为 deprecated（保证现有前端不 break）
4. 新接口：`/api/generate/outline` 和 `/api/generate/draft`

## Open Questions

- outline 编辑 UI 是新页面还是在现有 index.html 中插入步骤？（建议：在现有页面中插入步骤面板，不新建页面）
