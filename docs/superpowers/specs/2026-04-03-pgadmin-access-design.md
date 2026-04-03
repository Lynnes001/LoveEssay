# 云端 PostgreSQL 可视化访问设计

## 背景

当前项目通过 Docker Compose 在单台阿里云 ECS 上运行 `web`、`worker`、`redis`、`postgres`、`nginx`。`postgres` 只在 Compose 网络内可访问，外部用户无法直接查看数据。

需求是提供一个长期可用的网页后台，用于查看 PostgreSQL 中的表结构、表数据并执行只读或受控 SQL，同时避免把数据库端口直接暴露到公网。

## 目标

- 提供一个长期在线的网页数据库后台
- 保持 PostgreSQL 仅在容器内网暴露，不开放宿主机 `5432`
- 复用现有 `nginx` 入口，不新增独立公网端口
- 为数据库后台增加独立登录认证
- 方案应适配当前仓库的 `docker-compose.yml` 与 `docker/nginx/default.conf`

## 非目标

- 不在本次设计中引入专用堡垒机、VPN 或阿里云数据库代理产品
- 不实现多用户权限体系
- 不把应用登录和数据库后台登录强行合并为单点登录

## 方案比较

### 方案 A：直接开放 PostgreSQL 5432 到公网

做法是在 `postgres` 服务增加 `ports: ["5432:5432"]`，再通过阿里云安全组限制来源 IP，本地使用 DBeaver、Navicat 等工具连接。

优点：

- 本地客户端体验最好
- 不需要新增网页管理容器

缺点：

- 风险最高，数据库服务直接面向公网
- 容易因安全组或密码配置失误暴露数据库
- 与“长期网页后台”目标不匹配

结论：不推荐。

### 方案 B：在 ECS 上增加 pgAdmin，并通过现有 Nginx 反向代理

做法是在 Compose 中新增 `pgadmin` 服务，内部连接 `postgres:5432`，不对宿主机开放端口；外部通过 `nginx` 的 `/pgadmin/` 路径访问。

优点：

- PostgreSQL 仍只在内网暴露
- 用户通过浏览器即可查看数据
- 与现有 Compose 架构最匹配，改动集中

缺点：

- 需要处理反向代理下的路径前缀与登录配置
- 后台界面偏数据库运维风格

结论：推荐。

### 方案 C：在 ECS 上增加 CloudBeaver，并通过现有 Nginx 反向代理

做法与方案 B 类似，但使用 CloudBeaver 作为网页数据库客户端。

优点：

- 界面更现代
- 对日常查表和浏览数据较友好

缺点：

- 对当前项目来说比 pgAdmin 更重
- 首次接入和配置复杂度略高

结论：可作为后续替代方案，但本次不选。

## 推荐方案

采用方案 B：`pgAdmin + nginx 反代 + 阿里云安全组白名单 + 独立登录密码`。

### 架构

新增组件：

- `pgadmin` 容器：作为网页数据库管理后台

保留现有组件职责：

- `postgres`：数据库，仅暴露到 Compose 网络
- `nginx`：统一公网入口，新增 `/pgadmin/` 反代规则

访问路径：

1. 用户访问 `http(s)://<域名或ECS地址>/pgadmin/`
2. `nginx` 将请求转发到 `pgadmin` 容器
3. `pgadmin` 使用内部地址 `postgres:5432` 连接数据库

### 配置改动

#### 1. Docker Compose

在 `docker-compose.yml` 中新增 `pgadmin` 服务：

- 镜像建议使用固定版本标签的 `dpage/pgadmin4`，避免长期运行中因 `latest` 漂移导致行为变化
- 不配置宿主机端口映射
- 使用环境变量设置初始登录邮箱和密码
- 增加数据卷保存 pgAdmin 配置
- 依赖 `postgres` 健康检查
- 通过 `SCRIPT_NAME=/pgadmin` 告知容器其对外运行在子路径下

需要新增的环境变量：

- `PGADMIN_DEFAULT_EMAIL`
- `PGADMIN_DEFAULT_PASSWORD`
- `PGADMIN_IMAGE`

可选增强：

- `PGADMIN_CONFIG_ENHANCED_COOKIE_PROTECTION=True`
- `PGADMIN_CONFIG_LOGIN_BANNER="Authorized access only"`
- `PGADMIN_CONFIG_CONSOLE_LOG_LEVEL=30`

#### 2. Nginx

在 `docker/nginx/default.conf` 中新增 `/pgadmin/` 路由：

- 代理到 `http://pgadmin:80/`
- 透传 `Host`、`X-Forwarded-*`
- 显式设置 `X-Script-Name: /pgadmin`
- 支持较长会话和大响应

pgAdmin 官方文档说明，子路径部署时需要至少满足以下之一：

- 在反向代理中设置 `X-Script-Name`
- 在容器中设置 `SCRIPT_NAME`

为了降低兼容性风险，本方案同时采用这两项配置。实现时应验证静态资源、登录跳转和刷新是否都能正确工作。如路径前缀兼容性仍不稳定，则降级为给 pgAdmin 分配单独二级域名，例如 `dbadmin.example.com`，仍然不开放数据库端口。

#### 3. 环境变量与文档

更新 `.env.example` 和 `README.md`：

- 增加 pgAdmin 默认配置项
- 明确 pgAdmin 访问地址
- 强调生产环境必须修改默认密码
- 说明建议配合阿里云安全组限制来源 IP

## 安全设计

### 认证

pgAdmin 使用独立登录账号密码，不复用应用侧 `APP_LOGIN_USER` / `APP_LOGIN_PASS`。

原因：

- 降低应用凭据与数据库后台凭据耦合
- 后续可以单独轮换后台密码
- 避免应用登录泄漏后直接获得数据库可视化入口

### 网络暴露

- 不为 `postgres` 添加 `ports`
- 对外仅开放 `nginx` 所用宿主机端口
- 在阿里云安全组中，把管理入口访问来源限制为固定公网 IP

### 密码策略

- 替换当前数据库默认密码 `loveessay`
- 替换 pgAdmin 默认密码
- 所有密码仅保存在服务器 `.env`，不提交到仓库

### HTTPS

如果该入口会长期公网访问，应优先通过域名和 HTTPS 提供访问；若当前仅使用 ECS IP 和 HTTP，也至少应依赖安全组白名单限制来源。

## 官方依据

以下内容基于 pgAdmin 官方文档：

- 容器部署支持 `PGADMIN_DEFAULT_EMAIL` 与 `PGADMIN_DEFAULT_PASSWORD` 初始化管理员账号
- 反向代理到子路径时，Nginx 需要传递 `X-Script-Name`
- 容器化场景下也可以通过 `SCRIPT_NAME` 告知 pgAdmin 它被挂载在子路径下

推论：对当前仓库来说，最稳妥的实现不是开放 `5432`，而是在现有 `nginx` 后增加 `pgadmin` 并配齐前缀相关配置。

## 数据流

1. 浏览器请求 `/pgadmin/`
2. `nginx` 转发请求到 `pgadmin`
3. 用户在 pgAdmin 内登录
4. pgAdmin 使用内部网络连接字符串访问 `postgres`
5. 用户在浏览器中查看表、记录和执行 SQL

数据库连接参数如下：

- Host：`postgres`
- Port：`5432`
- Database：`loveessay`
- Username：`loveessay`
- Password：从部署环境变量读取的数据库密码

## 失败与回退

### pgAdmin 反向代理路径兼容问题

风险：静态资源或登录跳转在 `/pgadmin/` 前缀下异常。

处理：

- 先按路径前缀方式实现并验证
- 若兼容性异常，切换为单独虚拟主机或单独端口暴露 `pgadmin`，但仍不暴露数据库端口

### 凭据泄漏

风险：管理页账号或数据库密码泄漏。

处理：

- 立即修改 `.env` 中的相关密码
- 重启受影响服务
- 检查阿里云安全组来源设置

### 误操作数据

风险：通过网页后台直接修改生产数据。

处理：

- 默认只授予查看用途
- 若需要写操作，必须由具备上下文的操作者执行
- 后续可补充只读数据库账号并让 pgAdmin 默认连只读用户

## 测试策略

实现后应验证：

1. `docker compose up -d` 能正常拉起新增服务
2. `postgres` 未对宿主机开放 `5432`
3. 访问 `/pgadmin/` 能进入登录页
4. 登录后能连上 `loveessay` 数据库
5. 能看到现有表与记录
6. 反代下静态资源、跳转和刷新均正常
7. 在非白名单 IP 下无法访问管理入口

## 实施顺序

1. 在 Compose 中新增 `pgadmin` 服务与持久化卷
2. 在 Nginx 中增加 `/pgadmin/` 反代配置
3. 更新 `.env.example` 与 `README.md`
4. 部署到 ECS 并验证访问路径
5. 在阿里云安全组配置 IP 白名单
6. 修改数据库和 pgAdmin 默认密码

## 运维建议

- 如果未来需要更强隔离，优先升级为“二级域名 + HTTPS + 白名单 + 只读数据库账号”
- 如果未来有多人协作查看数据，再考虑引入更细粒度权限或堡垒机

## 最终结论

当前项目最合适的方案是在同一台阿里云 ECS 上新增 `pgAdmin` 容器，通过现有 `nginx` 以 `/pgadmin/` 方式暴露管理入口，同时继续让 PostgreSQL 仅保留在 Docker 内网中。这样能满足长期网页查看数据的需求，同时把风险控制在当前架构可以接受的范围内。
