## Why

前两个 change 完成了核心生成流程，但平台缺少对多个学生、多次生成任务的组织管理能力。顾问无法查看历史 session、复用输入、或跨 session 切换工作。这个 change 将平台从"单次生成工具"升级为真正的"文书工作台"。

## What Changes

- 新增 Session 列表页面：展示所有 session，支持按学生/状态筛选
- Session 支持自定义命名（如「张三-CMU-PS-2025」）
- Session 支持关联学生档案：新增 `students` 表和学生档案 CRUD
- 学生档案信息在 session 创建时自动填入输入表单
- 文书版本管理：同一 session 下多次生成的 essay 按版本号保存，支持查看历史版本
- Session 详情页：显示当前 session 的 workflow_status、outline、所有文书版本
- 导出功能：将最终文书导出为纯文本（v1 先不做 Word/PDF）

## Capabilities

### New Capabilities

- `session-management`: session 列表、重命名、学生档案关联、session 详情页
- `student-profiles`: 学生档案 CRUD（姓名、基本信息、经历 JSON）
- `document-versioning`: 文书版本列表、版本切换查看

### Modified Capabilities

- `generation-console-ui`: 生成控制台集成 session 选择和命名入口

## Impact

- **新增**：`backend/models/student.py`、`backend/api/students.py`、`backend/api/sessions.py`（扩展）、新前端页面
- **修改**：`backend/models/session.py`（新增 student_id 外键、name 字段语义完善）、`backend/api/generate.py`（session 关联）
- **数据库**：新增 `students` 表，`sessions` 表新增 `student_id`、`name` 字段
- **前端**：新增 session 列表页、学生档案管理页、session 详情页
