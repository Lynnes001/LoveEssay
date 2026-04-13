# Outline Schema v1

本文档用于定义 PS workflow 中 `outline` 对象的正式数据结构、字段语义和校验规则。

本文档只回答三个问题：

- `outline` 到底包含哪些字段
- 每个字段的语义边界是什么
- 一个 `outline` 在什么条件下才算合法

本文档默认服务于以下两个对象：

- `outline_candidate`
- `outline_confirmed`

二者共用同一套 schema，仅在状态语义上不同。

---

## 1. 设计目标

`outline` 是工作流中的结构边界对象。

它的职责不是保存正文，而是定义：

- 文章总主线是什么
- 开头如何切入
- 中间各段分别要证明什么
- 每段允许调用哪些事实材料
- 结尾回收到哪里
- 用户对后续生成还有哪些全局控制要求

因此，`outline` 应满足以下目标：

- 结构化到足以支撑 `draft`
- 轻量到足以支持用户直接编辑
- 可引用 `profile` 中的事实对象
- 可作为 `rewrite`、`fact_check`、`repair` 的对照边界

---

## 2. 适用范围

本 schema 当前只面向：

- 文书类型：`Personal Statement`
- 语言范围：`中文` / `英文`
- 工作流版本：`PS workflow v1`

本 schema 当前不处理：

- 多文书类型通用建模
- 段内句子级结构规划
- 精细化风格参数系统
- 多版本 diff 结构

---

## 3. Canonical Shape

```yaml
outline_object:
  schema_version: "v1"
  status: "candidate" | "confirmed"
  updated_at: string
  data:
    thesis: string
    intro:
      direction: string
    sections:
      - id: string
        claim: string
        evidence_refs: [string]
        angle: string | null
        user_notes: string | null
    conclusion:
      direction: string
    controls:
      must_include: [string]
      must_avoid: [string]
      generation_notes: string | null
      target_language: string | null
```

---

## 4. Object Semantics

### 4.1 outline_candidate

`outline_candidate` 表示由系统起草、尚未被用户最终确认的 outline。

特点：

- 可被用户完整编辑
- `target_language` 可暂为空
- 不应直接作为最终正文生成的唯一依据

### 4.2 outline_confirmed

`outline_confirmed` 表示用户已确认、可作为后续正文生成结构边界的 outline。

特点：

- 是 `draft` 的正式输入对象
- `target_language` 必须明确
- 后续 `draft`、`rewrite`、`repair` 不应改动其核心结构

---

## 5. Field Definitions

### 5.1 Top-level Metadata

#### `schema_version`

**Type**

- `string`

**Meaning**

标识当前 `outline` 使用的数据结构版本。

**Rules**

- 必填
- v1 固定为 `"v1"`

#### `status`

**Type**

- `"candidate"` | `"confirmed"`

**Meaning**

标识当前对象的流程状态。

**Rules**

- 必填
- `candidate` 表示 AI 起草版
- `confirmed` 表示用户确认版

#### `updated_at`

**Type**

- `string`

**Meaning**

记录当前对象最近一次被更新的时间。

**Rules**

- 必填
- 推荐使用 ISO 8601 格式

#### `data`

**Type**

- `object`

**Meaning**

承载实际 outline 内容的对象。

**Rules**

- 必填

---

### 5.2 `data.thesis`

**Type**

- `string`

**Meaning**

整篇文章的总主线，回答“这篇 PS 最终想证明什么”。

**Should Represent**

- 申请动机与成长逻辑的统一表达
- 对申请方向的核心论证

**Should Not Represent**

- 某个经历标题
- 一句空泛口号
- 具体正文句子

**Examples**

较好：

- “我适合继续在该方向深造，不是因为零散地参加过一些活动，而是因为我持续把兴趣转化为主动探索和更清晰的学习路径。”

较差：

- “我热爱人工智能”
- “我的活动经历很丰富”

**Rules**

- 必填
- 必须是完整论断
- 不应退化为标签词或短语

---

### 5.3 `data.intro.direction`

**Type**

- `string`

**Meaning**

定义开头段的职责和切入方式，而不是开头正文。

**Should Represent**

- 从什么进入主线
- 第一段如何完成引入与过渡

**Should Not Represent**

- 完整开头文案
- 与主线无关的素材堆叠

**Examples**

- “从最初接触该领域的问题意识切入，再过渡到申请目标。”
- “先写一次关键经历带来的认知变化，再引出更长期的兴趣主线。”

**Rules**

- 必填
- 应描述段落职责，而非成文句子

---

### 5.4 `data.sections`

**Type**

- `array<section>`

**Meaning**

定义正文中部的核心分论点结构。每个 section 是一个论证单元，而不是一个经历单元。

**Rules**

- 必填
- v1 建议长度为 `2..3`
- 每个元素必须符合 `section` 规则

---

### 5.5 `data.sections[].id`

**Type**

- `string`

**Meaning**

section 的稳定标识，用于编辑、排序和引用。

**Rules**

- 必填
- 在同一 outline 内必须唯一
- 推荐使用 `s1`、`s2`、`s3` 形式

---

### 5.6 `data.sections[].claim`

**Type**

- `string`

**Meaning**

该 section 需要证明的分论点。

**Should Represent**

- 一个可以展开论证的判断
- 该段在整篇中的核心职责

**Should Not Represent**

- 单个经历标题
- 主题标签
- 仅仅是活动名称

**Examples**

较好：

- “我的兴趣不是短期热情，而是在持续尝试中逐渐稳定下来的。”
- “比起单次成果，我更重要的成长在于形成了更系统的思考方式。”

较差：

- “机器人比赛”
- “学术兴趣”
- “我的活动”

**Rules**

- 必填
- 必须是论点，不是素材标题
- 应能被 `evidence_refs` 中的事实支撑

---

### 5.7 `data.sections[].evidence_refs`

**Type**

- `string[]`

**Meaning**

该 section 允许调用的事实证据引用列表。

**Design Intent**

`outline` 不直接复制事实内容，`outline` 只组织 `profile` 中已存在的事实对象。

**Rules**

- 必填
- 不可为空
- 每个值都必须引用 `profile` 中已存在的 item id
- 不允许引用不存在的事实对象

**Notes**

推荐允许引用以下类别的 id：

- `facts[].id`
- `experiences[].id`
- `achievements[].id`

---

### 5.8 `data.sections[].angle`

**Type**

- `string | null`

**Meaning**

定义该 section 的展开角度，用于辅助用户理解和后续生成控制。

**Recommended Values**

- `motivation`
- `growth`
- `academic-fit`
- `personal-quality`
- `future-direction`
- `reflection`

**Rules**

- 可为空
- v1 可先接受自由字符串
- 若非空，建议使用推荐枚举值之一

---

### 5.9 `data.sections[].user_notes`

**Type**

- `string | null`

**Meaning**

用户对该段的补充要求或局部限制。

**Examples**

- “不要写得太煽情”
- “这里重点写主动性，不要强调奖项”
- “不要编学校细节”

**Rules**

- 可为空
- 用于局部控制，不应用来替代 `claim`

---

### 5.10 `data.conclusion.direction`

**Type**

- `string`

**Meaning**

定义结尾段的职责和回收方向，而不是结尾正文。

**Should Represent**

- 结尾如何回扣主线
- 是否强调 why this field / why now / future direction

**Should Not Represent**

- 完整结尾文本
- 新增一个独立主线

**Rules**

- 必填
- 应描述结尾功能，而非成文段落

---

### 5.11 `data.controls.must_include`

**Type**

- `string[]`

**Meaning**

整篇文章必须覆盖的内容要求。

**Examples**

- “某次关键项目经历”
- “申请动机中的长期投入”
- “一次能体现主动学习的例子”

**Rules**

- 必填
- 可为空数组
- v1 采用自由文本，不强制引用 id

---

### 5.12 `data.controls.must_avoid`

**Type**

- `string[]`

**Meaning**

整篇文章必须避免的内容或写法。

**Examples**

- “编造学校资源”
- “空泛拔高”
- “写成励志鸡汤”

**Rules**

- 必填
- 可为空数组

---

### 5.13 `data.controls.generation_notes`

**Type**

- `string | null`

**Meaning**

用户给后续生成阶段的全局备注。

**Examples**

- “英文版本希望更自然，不要像模板文”
- “整体语气克制一点”
- “尽量控制在 650 词左右”

**Rules**

- 可为空

---

### 5.14 `data.controls.target_language`

**Type**

- `string | null`

**Meaning**

最终成文目标语言。

**Recommended Values**

- `zh`
- `en`

**Rules**

- `outline_candidate` 中可为空
- `outline_confirmed` 中必填

---

## 6. Structural Rules

以下规则用于判断一个 `outline` 在结构层面是否成立。

### 6.1 Thesis Rule

- 必须存在且非空
- 必须表达整篇文章的主线判断
- 不得退化为标签词、短语或素材名

### 6.2 Intro Rule

- 必须存在 `intro.direction`
- `intro.direction` 必须描述开头职责
- 不应直接写成完整开头正文

### 6.3 Sections Count Rule

- `sections` 必须存在
- v1 建议 section 数量为 `2..3`
- 少于 2 个时通常难以形成合格结构
- 多于 3 个时通常会稀释主线

### 6.4 Section Claim Rule

- 每个 section 必须有 `claim`
- `claim` 必须是分论点，不是素材标签
- `claim` 应能够与 thesis 建立正向支撑关系

### 6.5 Evidence Reference Rule

- 每个 section 必须有非空 `evidence_refs`
- 所有 `evidence_refs` 必须能在 `profile` 中解析
- 不允许悬空引用

### 6.6 Conclusion Rule

- 必须存在 `conclusion.direction`
- `conclusion.direction` 必须回收主线，而不是另起新论点

### 6.7 Controls Presence Rule

- `controls` 必须存在
- `must_include`、`must_avoid` 必须存在，即使为空数组
- `generation_notes`、`target_language` 可以为空

---

## 7. Validation Rules

本节给出可直接映射为程序校验的 v1 规则。

### 7.1 Required Field Validation

以下字段必须存在：

- `schema_version`
- `status`
- `updated_at`
- `data`
- `data.thesis`
- `data.intro.direction`
- `data.sections`
- `data.conclusion.direction`
- `data.controls.must_include`
- `data.controls.must_avoid`

### 7.2 Enum Validation

- `status` 必须为 `candidate` 或 `confirmed`
- `schema_version` 在 v1 中必须为 `v1`
- 若 `target_language` 非空，建议限制为 `zh` 或 `en`

### 7.3 Candidate vs Confirmed Validation

当 `status = candidate` 时：

- `target_language` 可以为空

当 `status = confirmed` 时：

- `target_language` 必须非空
- `sections` 必须满足最终结构约束

### 7.4 Sections Validation

对每个 section 执行以下校验：

- `id` 必填
- `id` 在当前 outline 中唯一
- `claim` 必填
- `evidence_refs` 必填且非空
- `evidence_refs` 中每个引用必须有效

### 7.5 Referential Integrity Validation

所有 `evidence_refs` 必须能映射到 `profile` 中某个已存在对象：

- `facts`
- `experiences`
- `achievements`

若存在任意无法解析的引用，则校验失败。

### 7.6 Semantic Validation

以下属于推荐执行的语义校验：

- `thesis` 不应与任一 `section.claim` 完全重复
- section 不应只是经历名或活动名
- 至少一个 section 应与申请方向或未来方向形成连接
- `conclusion.direction` 应与 `thesis` 保持回扣关系

---

## 8. Non-goals in v1

以下内容不纳入 v1 schema：

- 句子级 outline
- 每段字数预算
- 精细化 transition plan
- per-section tone config
- 自动评分字段
- `must_include` 的强引用建模

这些能力可以在后续版本迭代。

---

## 9. Example

```json
{
  "schema_version": "v1",
  "status": "confirmed",
  "updated_at": "2026-04-13T18:30:00+08:00",
  "data": {
    "thesis": "我适合继续在计算机相关方向深造，不是因为零散地参加过一些活动，而是因为我持续把兴趣转化为主动探索、方法积累和更清晰的未来方向。",
    "intro": {
      "direction": "从最初被技术问题吸引的经历切入，再过渡到申请目标。"
    },
    "sections": [
      {
        "id": "s1",
        "claim": "我的兴趣不是短期热情，而是在持续尝试和投入中逐渐稳定下来的。",
        "evidence_refs": ["exp_1", "exp_3"],
        "angle": "motivation",
        "user_notes": "不要写得太抒情"
      },
      {
        "id": "s2",
        "claim": "比起单次成果，我更重要的成长在于开始用更系统的方法理解和解决问题。",
        "evidence_refs": ["exp_2", "ach_1"],
        "angle": "growth",
        "user_notes": null
      },
      {
        "id": "s3",
        "claim": "这些经历让我更明确自己希望在下一阶段继续深入相关方向，并把兴趣转化为长期学习路径。",
        "evidence_refs": ["fact_4"],
        "angle": "future-direction",
        "user_notes": "不要编学校资源"
      }
    ],
    "conclusion": {
      "direction": "回扣主线，强调 why this field / why now。"
    },
    "controls": {
      "must_include": ["一次体现主动学习的关键经历"],
      "must_avoid": ["编造学校细节", "空泛拔高"],
      "generation_notes": "英文版本要自然，不要像标准模板文。",
      "target_language": "en"
    }
  }
}
```

---

## 10. 与 Stage Contract 的关系

本 schema 对应以下 workflow 对象：

- `outline_candidate`
- `outline_confirmed`

其在整体工作流中的位置为：

```text
profile
  -> outline_candidate
  -> user_edit / confirm
  -> outline_confirmed
  -> draft
```

其中：

- `profile` 提供事实边界
- `outline` 提供结构边界
- `essay_*` 是在这两层边界内展开的正文对象

---

## 11. 推荐后续工作

基于本 schema，最适合继续推进的方向有三个：

1. 定义 `profile` item id 的命名和引用规则
2. 定义 outline 编辑 UI 的最小交互结构
3. 定义 `draft` prompt 的输入 contract，明确如何消费 `outline`
