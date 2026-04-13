# PS 工作流 Stage Contract + Minimal Schemas v1

本文档用于把当前确认的 PS workflow 固化为一套可落地的 stage contract 与最小对象定义，供后续产品设计、API 设计、数据建模、prompt 编排和工程实现共用。

`outline` 的字段定义与校验规则已单独细化到 [OutlineSchema_v1.md](/Users/sid/Repos/LoveEssay/docs/OutlineSchema_v1.md)。

本文档解决的问题不是“prompt 怎么写”，而是：

- 每个 stage 到底消费什么对象
- 每个 stage 到底产出什么对象
- 什么属于事实边界
- 什么属于结构边界
- 什么情况下允许进入下一阶段
- 失败和重试如何定义

---

## 1. 设计目标

本版 contract 采用产品 workflow 视角，而不是仅采用后端自动执行视角。

原因是：

- 产品 workflow 决定用户能看到和编辑什么
- 数据对象决定 API 和数据库该如何设计
- prompt 和模型编排只是这些对象之间的实现方式

因此，本文档把以下七个节点视为正式 stage：

```text
1. extraction
2. outline_draft
3. user_confirm
4. draft
5. rewrite
6. fact_check
7. repair
```

---

## 2. 核心原则

### 2.1 profile 是事实边界

`profile` 用来界定：

- 哪些事实明确存在
- 哪些经历可以使用
- 哪些内容不确定
- 哪些内容不得编造

`draft`、`rewrite`、`repair` 都不得越过 `profile`。

### 2.2 outline_confirmed 是结构边界

`outline_confirmed` 用来界定：

- 文章主线是什么
- 每段要证明什么
- 哪些材料必须写
- 哪些内容不能写

`draft`、`rewrite`、`repair` 都不得改变 `outline_confirmed` 的核心结构。

### 2.3 用户控制结构，系统负责展开

系统可以：

- 起草 outline
- 生成正文
- 优化语言
- 检查问题
- 修复问题

系统不应：

- 替用户决定最终主线
- 在 rewrite 或 repair 阶段重新设计文章结构

### 2.4 fact_check 只判断，不改写

`fact_check` 的职责是产生结构化报告，而不是直接改正文。

### 2.5 repair 只修问题，不重新创作

`repair` 是兜底阶段，只处理 `fact_check_report` 中标出的实际问题。

---

## 3. Stage Definitions

### 3.1 extraction

**Goal**

从原始资料中提取结构化事实，生成后续流程共享的 `profile`。

**Consumes**

- `generation_request`

**Produces**

- `profile`

**Required Inputs**

- `student_background`
- `requirements`
- `program`
- `document_type`
- `source_language`

**Optional Inputs**

- `custom_prompt`

**Exit Criteria**

- 产出可解析的 `profile`
- 具体事实可追溯到原始资料
- 缺失项进入 `unknowns`

**Failure Conditions**

- 输出无法解析
- 具体事实无法追溯
- 核心输入缺失且无法继续

**User Visibility**

- 可选
- 默认可隐藏，但应支持调试查看

### 3.2 outline_draft

**Goal**

基于 `profile` 起草一版可编辑的论证框架 `outline_candidate`。

**Consumes**

- `profile`
- `generation_request`

**Produces**

- `outline_candidate`

**Required Inputs**

- `profile`
- `requirements`
- `program`
- `document_type`

**Optional Controls**

- `outline_language`
- `word_count_target`
- `outline_style_hint`

**Exit Criteria**

- 存在明确主线
- 存在 2 到 3 个核心论点或等价 section
- 每个 section 能映射到 `profile` 中的证据

**Failure Conditions**

- 输出退化为正文
- 输出只是经历罗列
- 核心 section 无事实支撑

**User Visibility**

- 是

### 3.3 user_confirm

**Goal**

将 `outline_candidate` 转换为用户确认后的 `outline_confirmed`，作为正文生成的结构边界。

**Consumes**

- `outline_candidate`
- `user_edits`
- `generation_controls`

**Produces**

- `outline_confirmed`

**Required Inputs**

- `outline_candidate`
- `target_language`

**Optional Inputs**

- `generation_notes`
- `must_include_overrides`
- `must_avoid_overrides`

**Exit Criteria**

- 结构字段完整
- 目标语言明确
- 用户备注与禁写项明确

**Failure Conditions**

- 用户未完成确认
- 核心结构字段为空
- 目标语言不明确

**User Visibility**

- 是

### 3.4 draft

**Goal**

基于 `outline_confirmed` 和 `profile` 生成完整初稿 `essay_draft`。

**Consumes**

- `outline_confirmed`
- `profile`

**Produces**

- `essay_draft`

**Required Inputs**

- `outline_confirmed`
- `profile`
- `target_language`

**Optional Controls**

- `word_count_target`
- `generation_notes`

**Exit Criteria**

- 正文覆盖确认版核心 section
- 不偏离确认主线
- 不引入新事实

**Failure Conditions**

- 漏掉核心论点
- 改写主线
- 编造 `profile` 之外的事实

**User Visibility**

- 是

### 3.5 rewrite

**Goal**

在不改变结构的前提下优化措辞、流畅度与人味，生成 `essay_rewritten`。

**Consumes**

- `essay_draft`
- `outline_confirmed`
- `profile`

**Produces**

- `essay_rewritten`

**Required Inputs**

- `essay_draft`
- `outline_confirmed`
- `profile`

**Optional Controls**

- `voice_goal`
- `tone_goal`

**Exit Criteria**

- 文本自然度提升
- 段落过渡改善
- 结构职责与 `outline_confirmed` 一致

**Failure Conditions**

- 改动论点结构
- 引入新主线
- 引入不受支持事实

**User Visibility**

- 是

### 3.6 fact_check

**Goal**

验证最终文本是否符合事实边界、结构边界和硬性要求。

**Consumes**

- `essay_rewritten`
- `profile`
- `outline_confirmed`

**Produces**

- `fact_check_report`

**Required Inputs**

- `essay_rewritten`
- `profile`
- `outline_confirmed`

**Optional Controls**

- `required_elements`
- `forbidden_elements`

**Exit Criteria**

- 产出明确 `pass` 或 `fail`
- 所有 issue 有类型、证据和修复建议

**Failure Conditions**

- 无法判断 pass 或 fail
- issue 不可解释
- 报告无法指导 repair

**User Visibility**

- 建议可见
- 至少在失败时可见摘要

### 3.7 repair

**Goal**

根据 `fact_check_report` 修复问题，生成可交付的 `essay_final`。

**Consumes**

- `essay_rewritten`
- `fact_check_report`
- `profile`
- `outline_confirmed`

**Produces**

- `essay_final`

**Required Inputs**

- `essay_rewritten`
- `fact_check_report`
- `profile`
- `outline_confirmed`

**Optional Controls**

- `repair_scope`

**Exit Criteria**

- 高优先级问题被解决
- 结构重新与 `outline_confirmed` 对齐
- 事实越界被移除

**Failure Conditions**

- 借修复之名重写全文
- 问题未解决
- 引入新的结构或事实问题

**User Visibility**

- 是

---

## 4. Minimal Schemas v1

本节只保留第一版实现真正必须有的字段，目标是：

- 足够支撑 stage contract
- 不提前做过重的数据设计
- 优先保证 API、存储和编排可以落地

### 4.1 generation_request

```yaml
generation_request:
  session_id: string
  student_background: string
  requirements: string
  program: string
  document_type: string
  source_language: string
  custom_prompt: string | null
  requested_word_count: integer | null
```

### 4.2 profile

```yaml
profile:
  source_summary: string
  facts:
    - id: string
      value: string
      source_ref: string
  experiences:
    - id: string
      title: string
      detail: string
      source_ref: string
  achievements:
    - id: string
      title: string
      detail: string
      source_ref: string
  constraints: [string]
  unknowns: [string]
```

`profile` 在 v1 中不要求一次性覆盖所有可能字段，但必须保留：

- 可引用的事实列表
- 可引用的经历列表
- 显式的未知项

### 4.3 outline_candidate

```yaml
outline_candidate:
  thesis: string
  intro_direction: string
  body_sections:
    - id: string
      claim: string
      evidence_refs: [string]
  conclusion_direction: string
  must_avoid: [string]
  risk_notes: [string]
```

v1 中先不要求复杂的 section metadata，但必须保留：

- 主线
- 分论点
- 证据引用
- 风险项

### 4.4 outline_confirmed

```yaml
outline_confirmed:
  thesis: string
  intro_direction: string
  body_sections:
    - id: string
      claim: string
      evidence_refs: [string]
      user_notes: string | null
  conclusion_direction: string
  must_include: [string]
  must_avoid: [string]
  generation_notes: string | null
  target_language: string
```

`outline_confirmed` 是 v1 最关键的结构对象。

后续正文生成至少必须读取：

- `thesis`
- `body_sections`
- `must_include`
- `must_avoid`
- `generation_notes`
- `target_language`

### 4.5 essay_draft

```yaml
essay_draft:
  body_text: string
```

v1 不强制要求 section alignment 持久化，必要时可作为运行时信息。

### 4.6 essay_rewritten

```yaml
essay_rewritten:
  body_text: string
```

v1 先只保留正文文本，避免在 rewrite 阶段引入额外存储负担。

### 4.7 fact_check_report

```yaml
fact_check_report:
  pass: boolean
  issues:
    - type: string
      severity: string
      evidence: string
      suggested_fix: string
```

v1 的 `fact_check_report` 先不拆过多字段，但必须能支撑：

- 判断是否通过
- 列出具体问题
- 为 repair 提供修复指令

### 4.8 essay_final

```yaml
essay_final:
  body_text: string
```

---

## 5. Allowed Transitions

工作流只允许以下迁移：

```text
extraction -> outline_draft
outline_draft -> user_confirm
user_confirm -> draft
draft -> rewrite
rewrite -> fact_check
fact_check(pass) -> done
fact_check(fail) -> repair
repair -> fact_check
```

关键约束如下：

- `draft` 不能跳过 `user_confirm`
- `rewrite` 不能直接回到 `outline_draft`
- `repair` 之后必须重新经过 `fact_check`

---

## 6. Stage State Model

每个 stage 统一采用以下状态：

```text
idle
pending
running
blocked
completed
failed
```

定义如下：

- `idle`: 尚未开始
- `pending`: 前置条件已满足，等待执行
- `running`: 正在执行
- `blocked`: 等待用户输入或缺必要条件
- `completed`: 成功完成
- `failed`: 执行失败

整个 workflow 额外使用：

```text
pending
running
waiting_for_user
completed
failed
```

建议映射关系：

- 执行到 `user_confirm` 且等待用户操作时，workflow 进入 `waiting_for_user`
- 任一自动 stage 失败时，workflow 进入 `failed`
- 全部阶段完成时，workflow 进入 `completed`

---

## 7. Retry Semantics

### 7.1 可重试阶段

- `extraction`
- `outline_draft`
- `draft`
- `rewrite`
- `fact_check`
- `repair`

### 7.2 不自动重试阶段

- `user_confirm`

原因是该阶段不是系统执行失败，而是等待用户动作。

### 7.3 重试原则

- 重试某个 stage 时，上游已确认对象必须固定
- 重试不能隐式修改上游资产
- 重试应产出新版本，而不是覆盖旧结果

示例：

- 重跑 `draft` 时，输入仍是同一个 `outline_confirmed + profile`
- 输出可视为 `essay_draft v2`

---

## 8. Failure Taxonomy

建议所有 stage 失败统一归类为以下类型：

### 8.1 validation_error

输入对象不完整，或输出对象不合法。

### 8.2 generation_error

模型阶段未按 contract 输出。

### 8.3 constraint_violation

输出违反边界条件，例如：

- 引入新事实
- 改写主线
- 结构漂移

### 8.4 user_blocked

系统等待用户确认或补充输入。

### 8.5 system_error

底层服务失败，例如：

- 模型调用失败
- 队列失败
- 存储失败

建议统一错误对象格式：

```yaml
failure:
  type: constraint_violation
  message: string
  retryable: boolean
```

---

## 9. v1 实现边界

为了避免第一版设计过重，v1 先做以下限制：

- 只支持 `Personal Statement`
- 只区分 `中文` 和 `英文`
- `outline_candidate` 与 `outline_confirmed` 先保持轻量结构
- `essay_*` 对象先以文本为主
- `fact_check_report` 先以最小 issue 列表为主

v1 暂不要求：

- 复杂 section 层级
- 多版本比较视图
- 细粒度 span 对齐存储
- 自动化评分体系
- 跨文书类型共用 schema

---

## 10. 与当前实现的差距

当前仓库实际流程约为：

```text
generation_request
  -> extraction
  -> draft
  -> rewrite
  -> done
```

目标流程为：

```text
generation_request
  -> extraction
  -> outline_draft
  -> user_confirm
  -> draft
  -> rewrite
  -> fact_check
  -> repair?
  -> done
```

因此，当前最关键的增量不是继续调 prompt，而是补齐以下对象和 gate：

- `outline_candidate`
- `outline_confirmed`
- `fact_check_report`
- `user_confirm` gate
- `fact_check` gate

---

## 11. 推荐下一步

基于本文档，后续最适合继续细化的方向有两个：

1. 把 `Minimal Schemas v1` 映射成数据库字段和 API payload
2. 把每个 stage contract 映射成 prompt input / output contract

如果后续实现优先级偏工程落地，建议下一步先做：

- `Session / Artifact / StageRun` 三类持久化模型最小设计
- `outline_confirmed` 的前后端读写协议
