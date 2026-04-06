# AdmissionCraft 留学文书工作台
### 架构设计文档 · v1.0

| 版本 | 后端 | 服务器 | 状态 |
|------|------|--------|------|
| v1.0 | Python / FastAPI | 阿里云 | 设计阶段 |

---

## 1. 产品定位

AdmissionCraft 是一个面向留学文书顾问的 AI 写作工作台，核心围绕「AI 辅助生成 + 人工精编」的工作流设计，支持多种文书类型，兼顾个性化风格与扩展性。

> **核心价值主张：** 你的微调模型负责风格，大模型负责内容结构，你负责最终把关 —— 三层协作，让每篇文书既高效又有辨识度。

---

## 2. 核心功能模块

### 2.1 PS 生成器（两阶段 Pipeline）

用户输入学生信息 + 申请要求后，系统依次调用大模型和微调模型，生成风格化初稿。

```
学生信息 + 申请要求
        ↓
  [ 大模型 API ]   ← 生成结构完整的英文初稿
        ↓
  [ 微调模型 API ] ← 风格化改写（符合你的文风）
        ↓
   可编辑草稿（富文本编辑器）
```

额外功能点：

- **Diff 视图**：对比大模型版本 vs 微调输出，清楚看到改动点
- **局部重写**：选中某段单独送入微调模型，无需全文重跑
- **多版本管理**：同一篇 PS 保存 v1/v2/v3，随时回溯

---

### 2.2 Session 系统

Session 是平台的核心组织单元，每个 Session 对应一篇文书的完整工作上下文。

| 文书类型 | 语言 | 系统 Prompt 特点 | 可配置字段 |
|----------|------|-----------------|-----------|
| Personal Statement | EN | PS 专用 prompt | 学校、字数、风格 |
| 推荐信（导师） | EN | 推荐信 prompt | 推荐人关系、侧重点 |
| 推荐信（业界） | EN | 推荐信变体 | 职位、项目描述 |
| 中文自荐信 | ZH | 中文写作 prompt | 目标院校、专业 |
| 动机信 (ML) | EN | ML 专用 prompt | 研究方向、匹配度 |

每个 Session 支持：

- 自定义名称（如「张三-CMU-PS-2025」）
- 保存 Prompt 模板 + 上次输入数据
- 关联到学生档案，信息自动填入
- 查看该 Session 下的所有文书版本

---

### 2.3 学生档案库

结构化存储学生信息，避免重复录入，所有 Session 均可关联复用。

- **基本信息**：姓名、GPA、专业、目标国家
- **经历模块**：科研、实习、竞赛、出版物（JSON 存储，灵活扩展）
- **申请列表**：目标院校 + 项目 + 对应文书 Session

---

### 2.4 文书编辑器

- 富文本编辑（Quill.js 或原生 contenteditable）
- 实时字数统计，对比目标字数
- AI 内联操作：选中文字 → 右键「润色 / 缩短 / 换个说法」
- 批注模式：给自己或学生留修改意见
- 导出 Word / PDF

---

## 3. 技术架构

### 3.1 整体架构图

```
┌──────────────────────────────────────────────────┐
│                  阿里云服务器                      │
│                                                  │
│   Nginx  (反向代理 + 静态文件 + HTTPS)             │
│     ↓                    ↓                       │
│  FastAPI 后端         前端 (HTML + JS)             │
│     ↓                                            │
│  Celery Worker    ←→   Redis (任务队列 + 缓存)     │
│     ↓                                            │
│  PostgreSQL  (持久化)                             │
└──────────────────────────────────────────────────┘
         ↓                        ↓
    大模型 API               微调模型 API
 (OpenAI / Claude)        (OpenAI Compatible)
```

---

### 3.2 流式生成方案（解决卡顿问题）

> **现有问题：** 两个 API 串行同步调用，字数多时前端长时间无响应，网络抖动直接失败。

**解决方案：异步任务队列 + SSE 推流**

```
前端                   后端                    外部 API
 |                      |                         |
 |-- POST /generate --> |                         |
 |<-- { task_id } ----- |  (立即返回，不阻塞)      |
 |                      |                         |
 |-- GET /stream/{id} ->|  (SSE 长连接)            |
 |                      |--- 调大模型 stream=True ->|
 |<-- data: chunk1 ---- |<-- chunk1 -------------- |
 |<-- data: chunk2 ---- |<-- chunk2 -------------- |
 |                      |--- 调微调模型 stream=True->|
 |<-- data: chunk3 ---- |<-- chunk3 -------------- |
 |<-- data: [DONE] ---- |                         |
```

关键实现要点：

- **后端**：Celery + Redis 做任务队列，网络断开任务不丢失
- **调用**：两个模型均使用 `stream=True`，chunk 到即推送
- **前端**：`EventSource` API 接收 SSE，天然支持断线重连
- **状态**：`generation_tasks` 表记录任务状态，支持前端轮询

---

### 3.3 项目目录结构

```
admissioncraft/
├── backend/
│   ├── main.py                  # FastAPI 入口
│   ├── config.py                # 环境变量（API key, DB URL 等）
│   ├── models/                  # SQLAlchemy ORM
│   │   ├── student.py
│   │   ├── session.py
│   │   ├── document.py
│   │   └── task.py
│   ├── api/                     # 路由层
│   │   ├── students.py
│   │   ├── sessions.py
│   │   ├── documents.py
│   │   └── generate.py          # 生成 + SSE 接口
│   ├── services/
│   │   ├── llm_service.py       # 调大模型（流式）
│   │   ├── finetune_service.py  # 调微调模型（流式）
│   │   └── pipeline.py          # 两阶段 Pipeline 逻辑
│   ├── tasks/
│   │   └── generation.py        # Celery 异步任务
│   └── db.py                    # 数据库连接
├── frontend/
│   ├── index.html               # 主页 / Session 列表
│   ├── editor.html              # 文书编辑器
│   ├── student.html             # 学生档案
│   └── js/
│       ├── api.js               # 封装所有后端请求
│       ├── editor.js            # 编辑器逻辑
│       └── stream.js            # SSE 处理
├── nginx/
│   └── admissioncraft.conf
├── docker-compose.yml           # PostgreSQL + Redis 一键启动
└── requirements.txt
```

---

## 4. 数据库设计

> **核心设计原则：** 扩展性优先，新增文书类型无需改表结构。

### 4.1 students — 学生档案

```sql
CREATE TABLE students (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(200),
    profile_json    JSONB,          -- 非结构化信息（GPA、经历等）
    created_at      TIMESTAMP DEFAULT NOW()
);
```

### 4.2 document_types — 文书类型模板

```sql
CREATE TABLE document_types (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,   -- "PS", "推荐信", "自荐信"
    lang                VARCHAR(10)  NOT NULL,   -- "en" / "zh"
    system_prompt       TEXT,                    -- 固定系统 Prompt
    input_schema_json   JSONB,                   -- 动态表单字段定义
    use_finetune_model  BOOLEAN DEFAULT TRUE,    -- 是否走微调模型
    created_at          TIMESTAMP DEFAULT NOW()
);
```

> `input_schema_json` 定义每种文书类型需要填哪些字段，新增类型不需要改表，直接插一条记录即可。

### 4.3 sessions — 文书 Session

```sql
CREATE TABLE sessions (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(200) NOT NULL,   -- 用户自定义名称
    student_id          INTEGER REFERENCES students(id),
    document_type_id    INTEGER REFERENCES document_types(id),
    custom_prompt       TEXT,                    -- Session 级别自定义 Prompt
    input_data_json     JSONB,                   -- 本次输入（字数、风格等）
    created_at          TIMESTAMP DEFAULT NOW()
);
```

### 4.4 documents — 文书版本

```sql
CREATE TABLE documents (
    id          SERIAL PRIMARY KEY,
    session_id  INTEGER REFERENCES sessions(id),
    version     INTEGER NOT NULL DEFAULT 1,
    stage       VARCHAR(50),   -- "llm_draft" | "finetune_output" | "manual_edit"
    content     TEXT,
    word_count  INTEGER,
    created_at  TIMESTAMP DEFAULT NOW()
);
```

> `stage` 字段区分内容来源，三个版本并存，Diff 视图直接对比 `llm_draft` vs `finetune_output`。

### 4.5 generation_tasks — 生成任务

```sql
CREATE TABLE generation_tasks (
    id          SERIAL PRIMARY KEY,
    session_id  INTEGER REFERENCES sessions(id),
    document_id INTEGER REFERENCES documents(id),
    status      VARCHAR(20) DEFAULT 'pending',  -- pending|running|done|failed
    error_msg   TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## 5. API 接口设计

| Method | Path | 说明 |
|--------|------|------|
| `POST` | `/api/generate` | 提交生成任务，返回 task_id |
| `GET` | `/api/stream/{task_id}` | SSE 推流，返回生成内容 |
| `GET` | `/api/students` | 获取学生列表 |
| `POST` | `/api/students` | 创建学生档案 |
| `GET` | `/api/sessions` | 获取 Session 列表 |
| `POST` | `/api/sessions` | 创建 Session |
| `PATCH` | `/api/sessions/{id}` | 更新 Session（重命名、改 prompt）|
| `GET` | `/api/sessions/{id}/documents` | 获取某 Session 的所有版本 |
| `GET` | `/api/document-types` | 获取文书类型列表 |

---

## 6. 分阶段实施计划

### Phase 1 · 流式 Pipeline（1~2 天）
> 先解决最痛的卡顿问题，让现有 PS 生成好用起来。

- 接入 Celery + Redis 任务队列
- 两阶段调用改为 `stream=True`
- 后端 SSE 推流接口（`/api/stream/{task_id}`）
- 前端 `EventSource` 接收展示
- `generation_tasks` 表记录任务状态

### Phase 2 · Session 系统（2~3 天）
> 让平台从「PS 工具」变成「文书工作台」。

- `document_types` 文书类型管理（初始录入 PS、推荐信、自荐信）
- Session 增删改查、重命名
- Prompt 模板保存与加载
- 基于 `input_schema_json` 的动态表单

### Phase 3 · 学生档案 + 多版本（2~3 天）
> 提升复用效率，支持精细化编辑。

- 学生档案库（`profile_json` 存储灵活字段）
- 文书版本管理（v1 / v2 / v3）
- Diff 视图（`llm_draft` vs `finetune_output`）
- 文书导出（Word / PDF）

### Phase 4 · 扩展文书类型（持续迭代）
> 在 Phase 2 的基础上，只需往 `document_types` 插记录。

- 中文自荐信模板
- 导师推荐信 / 业界推荐信模板
- 动机信（Motivation Letter）
- 更多语言支持

---

## 7. 技术选型说明

| 技术 | 选型 | 理由 |
|------|------|------|
| 后端框架 | FastAPI | Python 熟悉，原生 async，SSE 支持好 |
| 任务队列 | Celery + Redis | 任务持久化，断线不丢，横向扩容方便 |
| 数据库 | PostgreSQL | 已有，JSONB 支持灵活字段扩展 |
| 前端 | 原生 HTML + JS | 已有基础，无需引入构建工具 |
| 富文本编辑器 | Quill.js | 开源轻量，易集成，支持自定义工具栏 |
| 反向代理 | Nginx | 静态文件 + API 代理 + HTTPS 一体 |
| 微调模型接入 | OpenAI Compatible | 直接复用 `openai` Python SDK，零适配成本 |

---

*— 文档结束 —*
