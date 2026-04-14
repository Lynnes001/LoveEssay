## Context

本次重构基于以下核心洞察：这个 APP 是一个**人工介入的多阶段流水线**，每个阶段之间有人工 gate，每个阶段内部是自动跑的 AI 任务。当前设计把这两层混在一起，导致状态机膨胀、Pipeline 职责不清。

已确认的关键前提：
- draft 和 finetune 是两个独立步骤，中间有人工介入点
- 重新生成某步 = 截断重来，删掉该步及所有下游 artifact
- 不保留向后兼容，可以大刀阔斧改

---

## 状态机设计

### workflow_status 的 7 个值

```
start
  ↓ [Phase 1: extraction + outline_draft]
outline_ready          ← 人工 review / edit / 重新生成
  ↓ [用户确认 outline → Phase 2a: draft]
draft_ready            ← 人工 review / edit / 重新生成
  ↓ [用户确认 draft → Phase 2b: finetune]
finetuned_ready        ← 人工 review / edit / 重新生成
  ↓ [用户确认 → Phase 3: fact_check]
fact_check_done        ← 人工看报告
  ├── pass ──────────────────────────────▶ done
  └── fail
        ↓ [用户触发 Phase 4: repair（可选）]
      repaired         ← 人工 review / edit / 重新生成
        ├── 满意 ───────────────────────▶ done
        └── 重新 fact_check → 回到 Phase 3
```

**语义规则：**
- `workflow_status` 只在**人工确认**时向前推进，不在 AI 任务完成时自动推进
- 例外：`outline_ready` 在 Phase 1 完成时由后端推进（因为 outline 生成完成即可 review，无需额外确认触发）
- AI 任务的运行状态只通过 SSE stream 表达，不写入 `workflow_status`

### 截断规则

```
重新生成 outline   → 删 outline, draft_doc, finetuned_doc, fc_report, repair_doc
                   → workflow_status = "start"

重新生成 draft     → 删 draft_doc, finetuned_doc, fc_report, repair_doc
                   → workflow_status = "outline_ready"（outline 保留）

重新生成 finetune  → 删 finetuned_doc, fc_report, repair_doc
                   → workflow_status = "draft_ready"

重新生成 fact_check → 删 fc_report, repair_doc
                    → workflow_status = "finetuned_ready"

重新生成 repair    → 删 repair_doc
                   → workflow_status = "fact_check_done"（fc_report 保留）
```

---

## 数据模型变化

### WritingSession

```python
# 删除：status 字段（和 GenerationTask.status 语义重叠，冗余）
# 修改：workflow_status 枚举值
workflow_status: str  # start | outline_ready | draft_ready | finetuned_ready
                      # | fact_check_done | repaired | done
```

### Document（stage 字段重命名）

```
旧 stage 值        新 stage 值
──────────────────────────────
"extraction"    →  "extraction"   （不变）
"draft"         →  "draft"        （不变）
"rewrite"       →  "finetuned"    ← 改名，语义更准确
"repair"        →  "repair"       （不变）
```

### GenerationTask（新增 phase 字段）

```python
# 新增：phase 字段，记录本次 task 跑的是哪个 pipeline
phase: str  # outline | draft | finetune | fact_check | repair
```

这样 `SELECT * FROM generation_tasks WHERE session_id=X` 可以直接看出每个 phase 跑了几次，不需要从 `workflow_status` 反推。

---

## Pipeline 拆分

### 现状

```
DraftPipeline.stream() → draft chunks → rewrite chunks（融合在一个 task）
```

### 目标

```
DraftPipeline.stream()    → draft chunks only
FinetunePipeline.stream() → finetuned chunks only（接受 draft_text 作为输入）
```

**FinetunePipeline 输入：**
- `draft_text`：当前 draft document 的内容（从 DB 读取）
- `session_payload`：原始输入（program, requirements 等）
- `outline_data`：confirmed outline

**RepairPipeline 变化：**
- 删除内嵌的自动 fact_check 逻辑
- repair 完成后 workflow_status = `"repaired"`，由用户决定下一步

---

## API 设计

### 触发端点（全部替换，不保留 legacy）

```
POST /api/generate/outline
  前置：workflow_status in ("start",) 或强制重新生成（任意状态均可，truncate 逻辑处理）
  动作：reset_from("outline") → enqueue OutlineTask
  返回：{task_id, session_id}

POST /api/generate/draft
  前置：outline confirmed（outlines 表有 status="confirmed" 的记录）
  动作：reset_from("draft") → enqueue DraftTask
  返回：{task_id, session_id}

POST /api/generate/finetune
  前置：draft_doc 存在（documents 表有 stage="draft" 的记录）
  动作：reset_from("finetune") → enqueue FinetuneTask
  返回：{task_id, session_id}

POST /api/generate/fact-check
  前置：finetuned_doc 存在（documents 表有 stage="finetuned" 的记录）
  动作：reset_from("fact_check") → enqueue FactCheckTask
  返回：{task_id, session_id}

POST /api/generate/repair
  前置：fc_report 存在且 pass_=false
  动作：reset_from("repair") → enqueue RepairTask
  返回：{task_id, session_id}
```

**注意：前置条件改为检查 artifact 是否存在，而不是检查 workflow_status 字符串。** 这更健壮——即使 workflow_status 因为某种原因不同步，只要 artifact 存在就能继续。

### reset_from 逻辑（集中在 session helper）

```python
ARTIFACT_CASCADE = [
    ("outline",      lambda db, sid: _delete_outlines(db, sid)),
    ("draft",        lambda db, sid: _delete_documents(db, sid, "draft")),
    ("finetune",     lambda db, sid: _delete_documents(db, sid, "finetuned")),
    ("fact_check",   lambda db, sid: _delete_fc_reports(db, sid)),
    ("repair",       lambda db, sid: _delete_documents(db, sid, "repair")),
]

PHASE_RESET_STATUS = {
    "outline":    "start",
    "draft":      "outline_ready",
    "finetune":   "draft_ready",
    "fact_check": "finetuned_ready",
    "repair":     "fact_check_done",
}

def reset_from(db, session, phase: str) -> None:
    idx = [p for p, _ in ARTIFACT_CASCADE].index(phase)
    for _, deleter in ARTIFACT_CASCADE[idx:]:
        deleter(db, session.id)
    session.workflow_status = PHASE_RESET_STATUS[phase]
    db.commit()
```

---

## 决策记录

### 决策 1：前置条件检查 artifact 存在性，而非 workflow_status

**选择：** 检查 artifact 是否存在（`SELECT 1 FROM documents WHERE session_id=X AND stage="draft" LIMIT 1`）

**备选：** 检查 workflow_status 字符串（现有做法）

**理由：**
- workflow_status 是衍生状态，可能和 artifact 不同步（比如 bug、手动数据修复）
- artifact 是事实，是更可靠的前置条件
- 这样 reset_from 和重新生成的幂等性更好

### 决策 2：workflow_status 在 Phase 完成时由后端推进，而非用户确认时推进

**例外规则：**
- `outline_ready`：Phase 1 完成时自动推进（outline 可以直接 review）
- `draft_ready`：Phase 2a 完成时自动推进
- `finetuned_ready`：Phase 2b 完成时自动推进
- `fact_check_done`：Phase 3 完成时自动推进
- `repaired`：Phase 4 完成时自动推进

**用户"确认"动作只触发下一个 Phase，不改 workflow_status：**
- confirm outline → `POST /api/generate/draft`（内部做 reset_from + enqueue）
- confirm draft → `POST /api/generate/finetune`
- confirm finetuned → `POST /api/generate/fact-check`
- trigger repair → `POST /api/generate/repair`
- mark done → `POST /api/sessions/{id}/complete`

**理由：** workflow_status 表达"AI 产出了什么"，而非"用户按了什么按钮"。用户触发下一步和用户手动编辑 artifact 应该是等价的——都不改 workflow_status。

### 决策 3：删除 WritingSession.status 字段

**理由：** `session.status` 和 `task.status` 语义完全重叠（running/done/failed），但 session 是容器，不是任务。session 的"状态"应该由最新的 task 和 workflow_status 推断，不需要单独维护一个字段。删除后，前端查运行状态从 `GET /api/tasks/{id}` 读，查业务进度从 `workflow_status` 读。

### 决策 4：extraction_doc 不在截断链中

extraction 和 outline 是同一个 Phase 1 产出，extraction_doc 是 outline 生成的中间产物。重新生成 outline 时，extraction_doc 随 Phase 1 一起清理，不单独作为截断节点。

---

## Migration Plan

1. Alembic migration 0005：
   - `sessions` 表：删除 `status` 列，`workflow_status` 枚举值更新（ALTER 或重建）
   - `generation_tasks` 表：新增 `phase` 列
   - `documents` 表：`UPDATE documents SET stage='finetuned' WHERE stage='rewrite'`

2. 后端改动顺序（不需要分步部署，一次切换）：
   1. 数据模型更新
   2. Pipeline 拆分（DraftPipeline → draft only，新增 FinetunePipeline）
   3. Celery task 拆分
   4. API endpoint 替换
   5. 前端适配

---

## Risks

- **[风险] outline confirm 端点语义变化：** 现在 confirm outline 会触发 draft pipeline，改造后只更新 outline.status，不触发任何任务。前端需要改成"confirm outline" + 单独按钮"生成 Draft"。可以合并为一个按钮的两步操作。
- **[风险] fact_check_done 状态下 pass/fail 信息丢失：** 现在用 `fact_check_passed` / `needs_repair` 两个状态区分，改为统一的 `fact_check_done` 后，pass/fail 从 `fact_check_reports` 表最新记录读取。前端需要调 `GET /api/sessions/{id}/fact-check-report` 而非读 workflow_status。
- **[风险] stage="rewrite" 的存量数据：** migration 中直接 UPDATE 解决，没有歧义。
