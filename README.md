# my-nest-demo

一个用于学习与演示的 **NestJS + Prisma + PostgreSQL + LangChain + Vue 3** 全栈项目：包含用户 CRUD、基于 **LangChain** 对接 **DeepSeek（OpenAI 兼容接口）** 的流式聊天，以及会话与消息的持久化。

> **注意**：运行本项目需要先安装并可用数据库（PostgreSQL），并完成迁移与 `DATABASE_URL` 配置（详见下文「环境要求」「快速开始」）。

## 界面预览

> **当前**：已实现 **聊天助手**（流式对话、会话与消息持久化、前端聊天页与侧栏历史等，见下方截图）。
>
> **后续**：**RAG（检索增强生成）** 与  WorkFlow **工作流**；具体排期与实现以仓库代码与变更记录为准。

![聊天助手：新会话与侧栏历史](screenshots/image0.png)
![聊天助手：多轮对话与 Markdown 代码块](screenshots/image1.png)
![PostgreSQL：`chat_sessions` 会话表数据（Navicat）](screenshots/image3.png)

---

## 功能概览


| 能力   | 说明                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------ |
| 用户模块 | `POST /user/create`、`GET /user/list` 等分页与条件查询，以及按 ID 的查询、更新、删除                                                     |
| 流式聊天 | `POST /chat-stream` 返回纯文本分片流；`POST /chat-sse` 返回类 OpenAI 的 SSE `chat.completion.chunk` 帧                           |
| 多轮会话 | 请求体携带 `sessionId`（UUID）时，从数据库读取历史消息、写入本轮用户与助手消息；首轮结束后会异步生成会话标题                                                     |
| 会话列表 | `GET /chat-sessions` 按最近活动时间倒序返回会话摘要（可选 `userId`、`take`）；`GET /chat-sessions/:sessionId/messages` 拉取该会话全部消息（按时间升序） |
| 前端   | Vue 3 + Vite + Tailwind，聊天页支持 Gemini 式侧栏历史、纯流 / SSE、Markdown 渲染（代码高亮、表格等）                                          |


---

## 技术栈

- **后端**：NestJS 11、`@nestjs/config`、Prisma 7、`@prisma/adapter-pg` + `pg`
- **LLM**：`@langchain/openai`（`ChatOpenAI`）流式输出；默认对接 DeepSeek 官方兼容地址
- **数据库**：PostgreSQL
- **前端**：Vue 3、Vue Router、Vite 6、Tailwind CSS 4、`markdown-it`、DOMPurify、highlight.js

---

## 仓库结构（重要路径）

```
├── prisma/
│   ├── schema.prisma          # 数据模型（User / Post / ChatSession / ChatMessage）
│   └── migrations/            # 迁移 SQL
├── prisma.config.ts           # Prisma 7：数据源 URL 从此处读环境变量
├── src/
│   ├── main.ts                # 入口；CORS；端口 SERVER_PORT，默认 3001
│   ├── app.module.ts
│   ├── prisma/                # PrismaService（连接池 + adapter）
│   ├── user/                  # 用户 REST
│   ├── llm/
│   │   ├── llm.controller.ts  # /chat-stream、/chat-sse、/chat-sessions、/chat-sessions/:id/messages
│   │   ├── llm.service.ts     # LangChain 链路与会话持久化
│   │   └── prompts/           # 构建时复制到 dist（见 nest-cli.json）
│   └── generated/prisma/      # prisma generate 输出（勿手改）
└── ui/                        # 独立 Vite 前端工程
    ├── vite.config.ts         # 开发代理：/chat-stream、/chat-sse、/chat-sessions → 后端
    └── src/views/ChatView.vue
```

---

## 环境要求

- **Node.js**：建议 LTS（与 `package.json` 中引擎习惯一致即可）
- **包管理**：仓库根目录与 `ui/` 均使用 **pnpm**（存在 `pnpm-lock.yaml`）
- **PostgreSQL**：本地或远程实例，用于 `DATABASE_URL`

---

## 快速开始

### 1. 安装依赖

在仓库根目录：

```powershell
pnpm install
```

前端：

```powershell
cd ui
pnpm install
cd ..
```

### 2. 配置环境变量

在**项目根目录**创建 `.env`（勿提交密钥到 Git）。Prisma CLI 与 Nest 均会读取该文件。


| 变量                  | 是否必填   | 说明                                                                                 |
| ------------------- | ------ | ---------------------------------------------------------------------------------- |
| `DATABASE_URL`      | **必填** | PostgreSQL 连接串，例如 `postgresql://USER:PASSWORD@localhost:5432/DBNAME?schema=public` |
| `DEEPSEEK_API_KEY`  | 聊天功能必填 | DeepSeek API Key（或你自定义 `DEEPSEEK_BASE_URL` 所对应服务的 Key）                             |
| `DEEPSEEK_BASE_URL` | 可选     | 默认 `https://api.deepseek.com`                                                      |
| `DEEPSEEK_MODEL`    | 可选     | 默认 `deepseek-chat`                                                                 |
| `SERVER_PORT`       | 可选     | HTTP 监听端口；未设置时默认为 **3001**（见 `src/main.ts`）                                        |


示例（请按本机修改）：

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/my_nest_demo?schema=public"
DEEPSEEK_API_KEY="sk-xxxxxxxx"
SERVER_PORT=3009
```

> **与前端代理一致**：`ui/vite.config.ts` 里开发代理默认指向 `http://127.0.0.1:3009`。若你使用默认后端端口 `3001`，请把 Vite 里的 `target` 改成 `3001`，或把 `SERVER_PORT` 设为 `3009` 与现配置对齐。

### 3. 数据库迁移与 Prisma Client

在**项目根目录**执行（与下文 [Prisma 命令说明](#prisma-命令说明) 对应）：

```powershell
pnpm exec prisma migrate deploy
```

本地从零建库时可用：

```powershell
pnpm exec prisma migrate dev
```

生成客户端（依赖或 schema 变更后）：

```powershell
pnpm exec prisma generate
```

说明：本项目使用 **Prisma 7**，`schema.prisma` 中 `generator` 将 Client 输出到 `src/generated/prisma`，且 `moduleFormat = "cjs"` 以兼容 NestJS 的 CommonJS 构建。数据库连接串在 `**prisma.config.ts`** 中通过 `DATABASE_URL` 读取，CLI 执行迁移时同样会加载该配置。

### 4. 启动后端

```powershell
pnpm run start:dev
```

浏览器访问根路径：`http://localhost:<SERVER_PORT>/` 应返回欢迎字符串（由 `AppController` 提供）。

### 5. 启动前端（开发）

另开一个终端：

```powershell
cd ui
pnpm run dev
```

按 Vite 提示打开本地地址，进入 **「流式聊天」** 路由（`/chat`）。开发模式下请求会经代理转发到后端，避免跨域。

---

## Prisma 命令说明

以下命令均在**仓库根目录**执行。可用 `pnpm exec prisma …`（与本仓库一致）或全局/本地的 `prisma …` / `npx prisma …`，效果相同。执行前请已配置 `.env` 中的 `DATABASE_URL`。

### 与 Client（代码生成）相关


| 命令                    | 作用                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `**prisma generate`** | 根据 `prisma/schema.prisma` 的 `generator` 重新生成 **Prisma Client**（本仓库输出到 `src/generated/prisma`）。**改模型后、CI 构建前、`pnpm install` 后若 Client 缺失**，都应执行；否则 TypeScript 或运行时会找不到新字段。 |
| `**prisma validate`** | 校验 `schema.prisma` 语法与约束是否合法，**不改数据库、不写文件**。                                                                                                                              |
| `**prisma format`**   | 按 Prisma 约定格式化 `schema.prisma`（缩进、换行等），便于提交统一风格的 diff。                                                                                                                    |


### 与迁移（版本化 schema 变更）相关


| 命令                           | 典型场景                | 说明                                                                                                                                      |
| ---------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `**prisma migrate dev**`     | 本地开发、**需要新增/修改表结构** | 将当前 schema 与数据库对比，生成新的迁移 SQL 到 `prisma/migrations/`，并**应用**到当前 `DATABASE_URL` 指向的库；首次会建 `_prisma_migrations` 等元数据。会提示为迁移命名。适合个人/团队日常开发。 |
| `**prisma migrate deploy`**  | 测试/预发/生产、CI         | **只执行** `prisma/migrations` 里尚未应用的迁移，**不会**根据 schema 自动生成新迁移。上线或新环境拉代码后用它对齐数据库结构。                                                       |
| `**prisma migrate status`**  | 检查环境是否一致            | 列出迁移的已应用 / 待应用状态，排查「本地有迁移未推」「服务器缺迁移」等问题。                                                                                                |
| `**prisma migrate resolve**` | 迁移历史与实际情况不一致时       | 将某条迁移标记为已应用或已回滚（高级用法，需对照官方文档谨慎使用）。                                                                                                      |


### 与数据库直接同步（非迁移文件流）


| 命令                   | 典型场景               | 说明                                                                                                 |
| -------------------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| `**prisma db push**` | 快速原型、个人临时库         | 把 schema **直接推到数据库**，**不**在 `prisma/migrations/` 下生成迁移文件。与「迁移驱动」团队协作时容易造成历史分叉，**正式环境慎用**；更适合本地试字段。 |
| `**prisma db pull`** | 已有数据库、要反向生成 schema | 根据当前数据库结构**内省**并更新（或生成）`schema.prisma`，常用于接手工库后再纳入 Prisma 管理。                                      |


### 开发与调试


| 命令                         | 作用                                                                        |
| -------------------------- | ------------------------------------------------------------------------- |
| `**prisma studio`**        | 启动本地 Web 界面，浏览、筛选、编辑表数据；依赖 `DATABASE_URL`，**不会**替代应用里的业务校验。               |
| `**prisma migrate reset`** | **删除数据库中所有数据**（或按 Prisma 行为重建），再按顺序应用全部迁移；可选执行 seed。仅用于开发环境，**切勿对生产库执行**。 |


### 本仓库推荐用法小结

1. **第一次克隆**：配置 `.env` → `pnpm exec prisma migrate deploy`（或本地从零用 `migrate dev`）→ `pnpm exec prisma generate` → 启动 Nest。
2. **你改了 `schema.prisma`**：本地用 `migrate dev` 生成并应用迁移；提交 `prisma/migrations` 与代码；其他环境用 `migrate deploy`。
3. **只升级依赖或拉分支后 Client 报错**：在根目录执行 `pnpm exec prisma generate`。

更多选项（如 `--name`、`--create-only`）见 [Prisma CLI 官方文档](https://www.prisma.io/docs/orm/reference/prisma-cli-reference)。

---

## HTTP API 摘要

除特别说明外，请求体为 JSON，`Content-Type: application/json`。

### 聊天

- `**POST /chat-stream`**  
  - Body：`{ "message": string, "sessionId"?: string }`  
  - 响应：纯文本流（逐块 `write`），适合 `fetch` + `ReadableStream` 解析。
- `**POST /chat-sse**`  
  - Body：同上。  
  - 响应：SSE，载荷为 OpenAI 风格的 `chat.completion.chunk` JSON 行，便于与现有 SSE 客户端对齐。
- `**GET /chat-sessions**`  
  - Query：`userId`（可选，数字）、`take`（可选，默认 50，最大 100）  
  - 返回：会话列表（含 `messageCount` 等）。
- `**GET /chat-sessions/:sessionId/messages**`  
  - Path：`sessionId` 为会话 UUID（勿为空）  
  - 返回：`{ role, content }[]`（`role` 为 `user` / `assistant`），按 `createdAt` 升序，供前端恢复历史气泡。

### 用户（前缀 `/user`）

- `POST /user/create` — 创建  
- `GET /user/list` — 分页与筛选（见控制器注释）  
- `GET /user/:id`、`PUT /user/:id`、`DELETE /user/:id`

具体字段以 `src/user/dto/*.ts` 为准。

---

## 会话与 `sessionId` 行为说明

- **不传 `sessionId`**：每次相当于「无状态单轮」，使用服务内简单的 system + user 模板，**不会**写入 `ChatSession` / `ChatMessage`。
- **传入固定 `sessionId`（建议 UUID）**：会 `upsert` 会话、拉取历史、流式生成后写入本轮的 user/assistant 两条记录；若库中该会话尚无消息，首轮结束后会尝试用模型生成**会话标题**并写回 `chat_sessions.title`（失败时仅打日志，不影响主流程）。

前端 `ChatView.vue` 默认每次进入使用 `crypto.randomUUID()` 作为会话 ID；侧栏「新聊天」或同逻辑会换新 ID 并清空界面消息；点击某条历史会请求上述 messages 接口并载入气泡。

---

## 生产构建与部署要点

**后端**

```powershell
pnpm run build
pnpm run start:prod
```

- 需在生产环境配置同样的环境变量（至少 `DATABASE_URL`，以及聊天所需的 `DEEPSEEK_*`）。
- `nest-cli.json` 已将 `src/llm/prompts/**/*.md` 作为 **assets** 复制到 `dist`，保证运行时 `readFileSync(join(__dirname, 'prompts', ...))` 能读到文件。

**前端**

```powershell
cd ui
pnpm run build
```

生产环境下，浏览器会直接请求你配置的 API 源。可通过 `**VITE_API_BASE**` 指向后端完整地址（例如 `https://api.example.com`），未设置时为空字符串，即与页面**同源**路径（需由 Nginx 等反向代理把 `/chat-stream`、`/chat-sse`、`/chat-sessions` 等转到 Nest）。

---

## 常见问题

**1. 启动报 `DATABASE_URL is not configured`**  
检查项目根目录 `.env` 是否被加载；`PrismaService` 在缺少该变量时会直接抛错。

**2. Prisma / `Cannot use import statement in a module`**  
确认 `schema.prisma` 里 generator 使用 `moduleFormat = "cjs"`（与本仓库一致），且 Client 生成路径未被改坏。

**3. 前端能打开但聊天无响应或 404**  
核对 `SERVER_PORT` 与 `ui/vite.config.ts` 中 `proxy.target` 是否一致；浏览器开发者工具里查看请求 URL 与状态码。

**4. 聊天报 API Key 或上游错误**  
确认 `DEEPSEEK_API_KEY` 有效；若使用代理或自建兼容网关，同步设置 `DEEPSEEK_BASE_URL` 与 `DEEPSEEK_MODEL`。

---

## 脚本参考


| 目录    | 命令                   | 用途                |
| ----- | -------------------- | ----------------- |
| 根目录   | `pnpm run start:dev` | Nest 开发热重载        |
| 根目录   | `pnpm run build`     | 编译 Nest 到 `dist/` |
| 根目录   | `pnpm run lint`      | ESLint            |
| 根目录   | `pnpm test`          | Jest 单元测试         |
| `ui/` | `pnpm run dev`       | Vite 开发服务器        |
| `ui/` | `pnpm run build`     | 前端生产构建            |


---

## 许可与声明

**MIT**

本项目中的第三方服务（如 DeepSeek）受其各自条款与计费策略约束，使用时请遵守相关规定。
