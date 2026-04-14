## 1. Database Migration

- [x] 1.1 新建 Alembic migration：新增 `fact_check_reports` 表（id, session_id, document_id, pass, issues JSONB, repair_attempt, created_at）
- [x] 1.2 同一 migration 扩展 `sessions.workflow_status` 枚举，增加 `fact_check_passed` / `needs_repair` / `needs_repair_manual` / `done`
- [x] 1.3 运行 migration 并验证表结构正确

## 2. Fact Check Model

- [x] 2.1 新建 `backend/models/fact_check_report.py`，定义 `FactCheckReport` SQLAlchemy model
- [x] 2.2 在 `WritingSession` model 中添加 `fact_check_reports` relationship

## 3. Fact Check Pipeline

- [x] 3.1 在 `PromptService` 中添加 `fact_check` stage prompt（输入 essay_rewritten + profile + outline_confirmed，输出 JSON: {pass, issues}）
- [x] 3.2 在 `PromptService` 中添加 `repair` stage prompt（输入 essay_rewritten + fact_check_report + profile + outline_confirmed，输出修复后正文）
- [x] 3.3 新建 `FactCheckPipeline`，实现 fact_check stage stream 逻辑，解析 JSON，写入 fact_check_reports 表
- [x] 3.4 新建 `RepairPipeline`，实现 repair stage stream 逻辑，完成后自动触发第二次 fact_check
- [x] 3.5 实现 repair 次数计数：repair_attempt >= 2 时设 workflow_status 为 `needs_repair_manual`，停止循环

## 4. Fact Check API

- [x] 4.1 新建 `backend/api/fact_check.py`，实现 `POST /api/generate/fact-check`（校验 workflow_status == draft_completed，触发 FactCheckPipeline）
- [x] 4.2 实现 `POST /api/generate/repair`（校验 workflow_status == needs_repair，触发 RepairPipeline）
- [x] 4.3 实现 `GET /api/sessions/{id}/fact-check-report`（返回最新 report，404 if none）
- [x] 4.4 实现 `POST /api/sessions/{id}/complete`（workflow_status == draft_completed 时置为 done）
- [x] 4.5 在 `backend/main.py` 中注册 fact_check router

## 5. Frontend: Fact Check Panel

- [x] 5.1 pipeline monitor 新增 `fact_check` 和 `repair` stage 显示
- [x] 5.2 fact_check 完成后展示 report 面板：pass 显示通过 + 完成按钮；fail 显示 issues 列表 + repair 按钮
- [x] 5.3 issues 列表展示 type、severity、evidence、suggested_fix 四个字段
- [x] 5.4 repair 触发后调用 `/api/generate/repair`，pipeline monitor 显示 repair stage 进行中
- [x] 5.5 新增 "跳过校验，直接完成" 按钮（在 draft_completed 状态时可用，调用 /api/sessions/{id}/complete）

## 6. Verification

- [x] 6.1 端到端测试：完整走通 draft_completed → fact_check → repair → fact_check（pass）→ done
- [x] 6.2 验证 repair 次数超过 2 次后 workflow_status 置为 `needs_repair_manual`，不再自动循环
- [x] 6.3 验证 fact_check pass 时 workflow_status 正确置为 `fact_check_passed`
- [x] 6.4 验证跳过接口正确置为 `done`
