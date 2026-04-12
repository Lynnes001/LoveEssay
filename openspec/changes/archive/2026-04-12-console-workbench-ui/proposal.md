## Why

当前前端页面能够完成 Phase 1 的提交流程，但视觉语言偏展示化，输入区与输出区更像营销式卡片而不是高频操作工具。随着用户开始把页面当作日常生成工作台使用，现有界面在状态扫描、流程跟踪和长文本查看上的效率不足，已经影响操作节奏。

## What Changes

- 将现有单页表单重构为控制台 / 工作台风格界面，强调任务状态、阶段进度和输出查看效率。
- 引入固定的任务状态栏，用统一位置展示 session、task、当前状态和阶段信息。
- 将三阶段输出重构为流水线监控视图，突出当前活跃阶段，并保留阶段切换查看能力。
- 将输入区域重构为紧凑的控制面板，弱化装饰性样式，强化信息密度与操作节奏。
- 统一页面视觉语言为低装饰、强分区、状态驱动的工具界面。

## Capabilities

### New Capabilities
- `generation-console-ui`: 定义 Phase 1 生成页的控制台式布局、状态呈现和流水线输出交互要求。

### Modified Capabilities
- None.

## Impact

- Affected code: `frontend/index.html`, `frontend/css/base.css`, `frontend/js/index.js`, `frontend/js/generation-form.js`
- No backend API changes expected; existing task creation、SSE stream、task fetch 接口继续复用
- User experience changes from showcase-style page to operations-focused workspace
