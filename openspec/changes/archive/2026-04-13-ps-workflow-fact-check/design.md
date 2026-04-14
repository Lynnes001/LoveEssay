## Context

Change 1（ps-workflow-outline-gate）完成后，workflow 到达 `draft_completed` 状态，产出 `essay_rewritten`。此时缺少事实校验和修复环节。本 change 在 rewrite 之后接入 fact_check + repair，形成完整的 7-stage pipeline。

依赖前置：sessions.workflow_status 已有 `draft_completed` 状态，outlines 表已存 outline_confirmed，documents 表已存 essay_rewritten。

## Goals / Non-Goals

**Goals:**
- 实现 fact_check stage：消费 essay_rewritten + profile + outline_confirmed，产出结构化 fact_check_report
- 实现 repair stage：消费 essay_rewritten + fact_check_report + profile + outline_confirmed，产出 essay_final
- repair 后强制重跑 fact_check，最多 2 次修复循环（防止死循环）
- fact_check_reports 持久化
- 前端展示校验结果，提供 repair 触发入口

**Non-Goals:**
- 自动评分体系
- 细粒度 span 对齐
- 多轮对话式修复
- session 管理 UI（change 3）

## Decisions

### 决策 1：fact_check 和 repair 作为独立 API 调用

与 change 1 同样的拆分原则。用户看到 fact_check_report 后可以选择：触发 repair，或直接接受（手动跳过）。

**API 设计**：
```
POST /api/generate/fact-check  → 消费 essay_rewritten，产出 fact_check_report
POST /api/generate/repair      → 消费 fact_check_report，产出 essay_final，自动触发第二次 fact_check
```

### 决策 2：最多 2 次 repair 循环

第一次 repair 后自动重跑 fact_check；若仍 fail，标记 `needs_repair_manual`，不再自动循环，由用户决定。避免无限循环消耗 token。

### 决策 3：fact_check_report 独立建表

```sql
CREATE TABLE fact_check_reports (
    id          SERIAL PRIMARY KEY,
    session_id  INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    document_id INTEGER REFERENCES documents(id),
    pass        BOOLEAN NOT NULL,
    issues      JSONB NOT NULL,   -- [{type, severity, evidence, suggested_fix}]
    repair_attempt INTEGER DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 决策 4：fact_check prompt 只判断，不改写

prompt 明确要求模型输出结构化 JSON（pass: bool, issues: [...]），不输出修改建议的正文。repair 是独立的 stage。

## Risks / Trade-offs

- **[风险] fact_check 误判** → v1 先不做自动循环超过 2 次，避免误修复放大问题
- **[风险] repair 借修复之名重写全文** → prompt 明确约束：只修复 issues 中列出的具体问题，不改变 outline 结构
- **[Trade-off] 用户可能跳过 fact_check** → 提供 "跳过，直接完成" 选项，session.workflow_status 直接置为 `done`

## Migration Plan

1. Alembic migration：新增 `fact_check_reports` 表，`sessions.workflow_status` 枚举扩展
2. 存量 sessions 不受影响（状态均在 `draft_completed` 之前）

## Open Questions

- 无
