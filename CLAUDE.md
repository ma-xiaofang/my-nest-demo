# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
# 安装依赖（根目录 + 前端）
pnpm install && cd ui && pnpm install && cd ..

# 开发模式启动
pnpm run start:dev          # Nest 后端（默认 3001 端口，可通过 SERVER_PORT 覆盖）
cd ui && pnpm run dev       # Vue 3 前端（Vite，代理到后端）

# 构建与生产
pnpm run build              # Nest 编译到 dist/
pnpm run start:prod         # 生产启动（node dist/main）

# 测试
pnpm test                   # 运行所有 Jest 单元测试
pnpm test -- <pattern>      # 运行匹配的测试，如 pnpm test -- agents
pnpm test:watch             # 监听模式
pnpm test:cov               # 生成覆盖率报告
pnpm test:e2e               # 端到端测试

# 代码检查与格式化
pnpm run lint               # ESLint + Prettier 检查并自动修复
pnpm run format             # Prettier 格式化 src/ 和 test/

# Prisma
pnpm exec prisma generate   # 重新生成 Prisma Client（输出到 src/generated/prisma）
pnpm exec prisma migrate dev    # 本地开发：根据 schema 变更生成并应用迁移
pnpm exec prisma migrate deploy # 部署：只执行未应用的迁移
pnpm exec prisma studio     # 启动数据库浏览 Web 界面
```

## 运行单一测试

```bash
pnpm test -- --testPathPattern "agents.service"   # 按文件名匹配
pnpm test -- -t "should create user"              # 按测试用例名匹配
```

## 架构概览

### 模块分层（NestJS 11，CommonJS 模式）

项目使用 TypeScript 5.7 + NodeNext 模块方案，但 **Prisma Client 输出为 CJS**（`schema.prisma` 中 `moduleFormat = "cjs"`）以兼容 NestJS 构建。

**8 个功能模块**，全部注册于 [src/app.module.ts](src/app.module.ts)：

| 模块 | 路径 | 职责 |
|------|------|------|
| `PrismaModule` | [src/prisma/](src/prisma/) | `@Global()` 全局模块，封装 `PrismaClient`（Pg 适配器 + 连接池） |
| `UserModule` | [src/user/](src/user/) | 用户 CRUD（`/user` 前缀），分页、模糊搜索、级联删除 |
| `LlmModule` | [src/llm/](src/llm/) | 流式聊天（`/chat-stream`、`/chat-sse`）、会话与历史消息持久化（`/chat-sessions`） |
| `ModelModule` | [src/model/](src/model/) | LLM 调用方式教学示例（基础调用、System Prompt、SSE 流、pipe 链） |
| `PromptsModule` | [src/prompts/](src/prompts/) | 提示词模板练习（翻译助手、代码审查） |
| `ChainsModule` | [src/chains/](src/chains/) | LangChain 链示例（顺序链、条件分支链、博客生成链） |
| `AgentsModule` | [src/agents/](src/agents/) | AI 客服 Agent（工具调用循环：查商品、下单、查订单、退款） |

### 数据层

- **数据库**：PostgreSQL，连接串通过 `DATABASE_URL` 环境变量配置
- **Prisma 7 关键差异**：
  - `prisma.config.ts` 中通过 `datasource.url` 读取 `process.env["DATABASE_URL"]`（不再写在 `schema.prisma` 的 `datasource` 块）
  - Client 输出到 `src/generated/prisma`，**勿手动修改此目录**
  - PrismaService 使用 `@prisma/adapter-pg` + `Pool` 管理连接（见 [src/prisma/prisma.service.ts](src/prisma/prisma.service.ts)）
- 有 4 个数据模型：`User`（`users`）→ `Post`（`posts`），`ChatSession`（`chat_sessions`）→ `ChatMessage`（`chat_messages`）。`User` 删除时级联删除其 `Post`

### 环境变量

核心变量（详见 `.env.example`）：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | **必填**，PostgreSQL 连接串 |
| `DEEPSEEK_API_KEY` | 聊天功能必填 |
| `SERVER_PORT` | 可选，默认 3001 |

### Prompt 文件

`nest-cli.json` 将 `src/llm/prompts/**/*.md` 作为 assets 复制到 `dist/`，运行时通过 `join(__dirname, 'prompts', ...)` 读取。build 后若修改 prompt 文件，需重新 build 或在 dev 模式下 `watchAssets: true` 自动生效。

### 前端

`ui/` 目录是独立的 Vue 3 + Vite 6 + Tailwind CSS 4 工程。开发时 Vite 通过 `proxy.target` 将 `/chat-stream`、`/chat-sse`、`/chat-sessions` 代理到后端（默认 `http://127.0.0.1:3009`）。生产构建后这些路由需由 Nginx 等反向代理转发。

## 代码规范

- 包管理统一使用 **pnpm**（根目录与 `ui/` 各有一个 `pnpm-lock.yaml`）
- 使用 **Prettier**（单引号 + 尾逗号）+ **ESLint**（`typescript-eslint` 严格类型检查）
- 函数需要 **Doc 注释和关键单行注释**，使用简体中文
- 所有用户可见的回答和文档使用**简体中文**
