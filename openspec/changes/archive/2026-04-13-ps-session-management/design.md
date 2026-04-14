## Context

Change 1 + 2 完成后，核心 pipeline（extraction → outline_gate → draft → rewrite → fact_check → repair → done）已经完整。当前 `sessions` 表已有 `name`、`workflow_status` 字段，但没有 `student_id`，也没有 students 表。`documents` 表已记录文书版本，但前端没有版本列表 UI。

本 change 在现有数据模型基础上做增量扩展，不修改核心 pipeline 逻辑。

## Goals / Non-Goals

**Goals:**
- 新增 students 表和 CRUD API
- session 关联 student_id（可选，不强制）
- 前端新增 session 列表页和 session 详情页
- 前端文书版本列表（同 session 多版本切换）
- session 重命名
- 导出纯文本

**Non-Goals:**
- Word / PDF 导出（v1 先做纯文本复制）
- Diff 视图（多版本对比）
- 学生申请列表管理
- 多用户 / 权限系统

## Decisions

### 决策 1：students 表结构

轻量化设计，profile_json 存储非结构化信息：

```sql
CREATE TABLE students (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    email        VARCHAR(200),
    profile_json JSONB,   -- GPA、专业、经历等灵活字段
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

sessions 表新增 `student_id INTEGER REFERENCES students(id) NULL`（可选关联，不强制）。

### 决策 2：前端页面结构

维持原生 HTML + JS 风格，不引入前端框架：

```
index.html       → session 列表页（改造现有首页）
editor.html      → session 详情 + 生成控制台（原有功能迁移）
student.html     → 学生档案管理页
```

### 决策 3：文书版本显示

`documents` 表已有 `version` 和 `stage` 字段。session 详情页按版本号分组展示，点击某版本展示该版本的 essay_rewritten（或 essay_final 如存在）。

### 决策 4：导出为纯文本

v1 导出：前端展示 textarea 供用户复制，或提供 "复制到剪贴板" 按钮。不依赖后端生成文件，零额外复杂度。

## Risks / Trade-offs

- **[Trade-off] student_id 可选** → 允许顾问在不建档案的情况下直接开始生成，降低上手摩擦
- **[风险] session 列表数据量大** → v1 不做分页，先简单展示最近 50 条
- **[风险] 现有 index.html 改造** → 需要把现有生成逻辑迁移到 editor.html，避免逻辑散落

## Migration Plan

1. Alembic migration：新增 `students` 表，`sessions` 表新增 `student_id` 和 `name`（已有 name，确认字段即可）
2. 存量 sessions 的 `student_id` 为 NULL，不影响现有功能
3. 前端 index.html 改为 session 列表，生成逻辑迁移到 editor.html

## Open Questions

- 无
