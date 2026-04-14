## Why

draft + rewrite 完成后，当前没有任何机制检查最终文本是否越过了事实边界或遗漏了硬性要求。顾问必须人工逐一核对，效率低且容易遗漏。fact_check + repair 两个 stage 提供结构化的事实校验报告，并在发现问题时自动修复，让人工复核聚焦在高价值判断而非基础核查。

## What Changes

- 新增 `fact_check` stage：rewrite 完成后，AI 基于 profile + outline_confirmed 对最终文本做事实边界和结构边界校验，产出 `fact_check_report`
- 新增 `repair` stage：fact_check 未通过时，AI 依据 fact_check_report 修复文本，产出 `essay_final`
- repair 完成后强制重新执行 fact_check（最多重试 N 次，防死循环）
- 新增 `fact_check_reports` 数据库表，存储每次校验结果
- 新增 `POST /api/generate/fact-check` 和 `POST /api/generate/repair` 接口
- `sessions.workflow_status` 扩展支持 `fact_check_passed` / `needs_repair` / `done` 状态
- 前端展示 fact_check_report（问题列表），并提供触发 repair 的操作

## Capabilities

### New Capabilities

- `fact-check-repair`: fact_check stage 执行、fact_check_report 持久化、repair stage 执行、重试循环控制

### Modified Capabilities

- `outline-gate`: sessions.workflow_status 状态机扩展（新增 fact_check_passed / needs_repair / done）
- `generation-console-ui`: pipeline monitor 新增 fact_check / repair stage 展示，新增 fact_check_report 面板

## Impact

- **新增**：`backend/models/fact_check_report.py`、`backend/api/fact_check.py`、Alembic migration
- **修改**：`backend/services/pipeline.py`（新增 fact_check + repair pipeline）、`backend/api/generate.py`（新增路由）
- **前端**：pipeline monitor 新增两个 stage，新增 report 展示面板
- **数据库**：新增 `fact_check_reports` 表
