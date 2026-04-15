## 1. Prompt 改进

- [x] 1.1 在 `prompts/outline_draft-user.md` 的要求列表中增加一条：evidence 选取以论证流畅为准，不必覆盖全部 experiences/achievements

## 2. 前端：获取 profile 数据

- [x] 2.1 在 `frontend/js/outline.js` 的 `loadOutline` 中，用 `Promise.all` 同时请求 `getOutline` 和 `getSession`，从 session 的 `prompt_payload_json.profile` 中提取 `experiences` 和 `achievements`
- [x] 2.2 将 profile 数据传入 `renderOutline(data, profile)`

## 3. 前端：内联展示 evidence 内容

- [x] 3.1 在 `renderOutline` 中，遍历每个 section 的 `evidence_refs`，按 ID 查找 profile 中对应条目（`exp_{n}` 对应 `experiences[n-1]`，`ach_{n}` 对应 `achievements[n-1]`）
- [x] 3.2 将查找结果（title + detail）渲染在 section 的证据引用区域，替代纯 ID 字符串；若 ID 无法 resolve 则降级显示原始 ID
