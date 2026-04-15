## Context

Outline 生成后，用户需要在前端 review 并决定是否确认。当前 section 展示只有 `evidence_refs` ID（如 `exp_1`），用户无法判断 AI 选了哪段经历，必须自己翻 profile 对照，review 体验差。

同时 outline_draft prompt 没有明确允许只选部分素材，AI 可能为了"用完"所有材料而塞入不必要的引用，损害论证聚焦度。

profile 数据已在 `sessions.prompt_payload_json.profile` 中，outline 生成后被持久化，前端可通过 `GET /api/sessions/{id}` 获取。

## Goals / Non-Goals

**Goals:**
- outline section 展示时，`evidence_refs` 内联显示对应经历的 title 和 detail
- outline_draft prompt 明确说明：选最能支撑论点的素材即可，不必覆盖所有 experiences/achievements

**Non-Goals:**
- 不改 outline JSON schema（`evidence_refs` 继续存 ID 字符串数组）
- 不改 backend API
- 不改 profile 数据结构

## Decisions

### 决策：前端 resolve，不改 schema

**选择**：`renderOutline` 接收 profile 数据，在渲染 section 时查找每个 `evidence_refs` ID 对应的条目，内联展示 title 和 detail 摘要。

**备选**：在 outline JSON 里内联存 snapshot（改 schema）。

**拒绝原因**：改 schema 需要改 backend model、migration、outline pipeline 的解析逻辑，改动范围大；profile 数据已经在 session 里，前端 resolve 零后端成本。

### 决策：`loadOutline` 额外获取 session

`initializeOutlinePanel` 目前只调用 `getOutline`，不知道 profile。方案：`loadOutline` 内部同时调用 `getSession`，从 `prompt_payload_json.profile` 取 experiences/achievements，传给 `renderOutline`。

两次请求并行发出（`Promise.all`），不增加串行等待时间。

### 决策：Prompt 改动最小化

只在 `outline_draft-user.md` 现有要求列表末尾增加一条：素材选取以论证流畅为准，不必覆盖全部 experiences/achievements。不改 schema，不改输出格式。

## Risks / Trade-offs

- [profile 数据为空] 如果 session 的 profile 尚未提取（outline 生成中断等边缘情况），evidence_refs 无法 resolve → 降级展示原始 ID，不影响功能
- [额外请求] 多一次 `getSession` 请求 → 并行发出影响可忽略，且 session 数据本来就可能被其他地方复用
