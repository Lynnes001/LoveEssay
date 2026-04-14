## 1. Database Migration

- [x] 1.1 新建 Alembic migration：新增 `students` 表（id, name, email, profile_json JSONB, created_at）
- [x] 1.2 同一 migration 在 `sessions` 表新增 `student_id INTEGER REFERENCES students(id) NULL`
- [x] 1.3 运行 migration 并验证表结构正确

## 2. Student Model and API

- [x] 2.1 新建 `backend/models/student.py`，定义 `Student` SQLAlchemy model
- [x] 2.2 在 `WritingSession` model 中添加 `student_id` 外键字段和 `student` relationship
- [x] 2.3 新建 `backend/api/students.py`，实现 `GET /api/students`、`POST /api/students`、`GET /api/students/{id}`、`PATCH /api/students/{id}`
- [x] 2.4 在 `backend/main.py` 中注册 students router

## 3. Session API Completion

- [x] 3.1 新建或完善 `backend/api/sessions.py`，实现 `GET /api/sessions`（最近 50 条）
- [x] 3.2 实现 `POST /api/sessions`（接受 name + optional student_id，返回创建的 session）
- [x] 3.3 实现 `GET /api/sessions/{id}`（返回完整 session 含 workflow_status）
- [x] 3.4 实现 `PATCH /api/sessions/{id}`（支持更新 name）
- [x] 3.5 实现 `DELETE /api/sessions/{id}`（级联删除相关数据）
- [x] 3.6 在 `backend/main.py` 中注册 sessions router

## 4. Document API

- [x] 4.1 新建或完善 `backend/api/documents.py`，实现 `GET /api/sessions/{id}/documents`（按 version 降序）
- [x] 4.2 实现 `GET /api/documents/{id}`（返回完整内容）
- [x] 4.3 在 `backend/main.py` 中注册 documents router

## 5. Frontend: Session List Page

- [x] 5.1 改造 `frontend/index.html` 为 session 列表页，展示 session 列表（name、workflow_status、created_at）
- [x] 5.2 列表页新增"新建 Session"入口，触发创建表单（name 输入 + 学生选择）
- [x] 5.3 列表页每条 session 可点击跳转到 `editor.html?session_id={id}`

## 6. Frontend: Session Detail Page

- [x] 6.1 新建或改造 `frontend/editor.html` 为 session 详情页，顶部显示 session name（可编辑）和 workflow_status
- [x] 6.2 将现有生成控制台逻辑迁移到 editor.html，通过 URL 参数 session_id 加载对应 session
- [x] 6.3 session 有关联 student 时，自动从 student.profile_json 预填 student_background 输入（字段为空时）

## 7. Frontend: Document Version List

- [x] 7.1 session 详情页新增版本列表面板，展示 version、stage、word_count、created_at
- [x] 7.2 点击版本条目，在输出区展示对应 document 内容
- [x] 7.3 页面加载时默认展示最新版本
- [x] 7.4 每个版本展示"复制到剪贴板"按钮，复制 content 并短暂显示确认提示

## 8. Frontend: Student Management Page

- [x] 8.1 新建 `frontend/student.html`，展示学生列表（name、email）
- [x] 8.2 支持创建新学生（name、email、profile_json 文本区域）
- [x] 8.3 支持查看和编辑学生 profile_json

## 9. Verification

- [x] 9.1 端到端：创建学生 → 创建关联 session → 打开 editor，验证 student_background 预填
- [x] 9.2 验证 session 列表按最近更新排序
- [x] 9.3 验证版本列表展示正确，切换版本内容正确显示
- [x] 9.4 验证复制到剪贴板功能在主流浏览器中正常工作
- [x] 9.5 验证 DELETE session 级联删除相关 outline、documents、tasks、fact_check_reports
