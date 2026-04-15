## Why

当用户在前端 review outline 时，`evidence_refs` 只显示 ID（如 `exp_1`, `ach_2`），无法直接看出引用的是哪段经历，需要反复对照原始素材。同时，AI 生成 outline 时倾向于覆盖所有素材，导致论证结构冗余而非聚焦。

## What Changes

- **前端**：outline 的 section 展示中，`evidence_refs` 不再只显示 ID，而是内联展示对应经历的 `title` 和 `detail` 摘要，便于用户 review 和判断引用是否合理
- **Prompt**：`outline_draft-user.md` 中增加说明，AI 选取素材时应以论证流畅为准，不必覆盖所有 experiences/achievements

## Capabilities

### New Capabilities

（无新能力，属于现有能力的 UX 改进）

### Modified Capabilities

- `outline-gate`: outline section 展示需解析 `evidence_refs` 并内联显示对应素材标题和摘要；outline_draft prompt 增加素材选择性说明

## Impact

- `frontend/js/outline.js`：`renderOutline` 函数，section 渲染部分
- `frontend/js/api.js`：需新增或复用 `getSession` 以获取 profile 数据
- `prompts/outline_draft-user.md`：增加一条素材选择说明
