# Changelog

本文件记录 **my-nest-demo** 面向使用者的可见变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循语义化版本意图（当前包版本见根目录 `package.json`）。

---

## [Unreleased]

（尚未发布；开发中的改动可记在此处，发版时再归入具体版本号。）

---

## [0.0.1] - 2026-04-19

### Added

- **文档**：根目录 `README.md`（项目说明、环境变量、前后端启动、HTTP API、生产部署注意点、常见问题）。
- **文档**：README 中 **Prisma CLI** 常用命令说明（`generate`、`migrate dev/deploy`、`db push`、`studio` 等）。
- **数据库与模型**：Prisma 模型 `ChatSession`、`ChatMessage` 及迁移；多轮会话落库、首轮完成后异步生成会话标题。
- **后端 LLM**
  - `POST /chat-stream`：纯文本分块流式响应。
  - `POST /chat-sse`：SSE，载荷为类 OpenAI `chat.completion.chunk` 帧。
  - `GET /chat-sessions`：会话列表（支持 `userId`、`take`）。
  - `GET /chat-sessions/:sessionId/messages`：按时间升序返回该会话消息，供前端恢复历史。
- **后端集成**：LangChain `ChatOpenAI` 对接 DeepSeek（可配置 `DEEPSEEK_*`）；会话系统提示来自 `src/llm/prompts/session-system.md`（构建时复制到 `dist`）。
- **前端（`ui/`）**
  - 聊天页：Markdown 渲染（代码高亮、表格等）、Plain / SSE 两种流式模式。
  - **侧栏**：近期会话列表（样式参考 Gemini）、新聊天、点击会话拉取历史消息。
  - **桌面端侧栏折叠**：顶栏左侧折叠/展开；窄屏仍为抽屉 + 遮罩。
  - **顶栏**：中部显示当前会话标题（与列表同步；未入库时用首条用户消息作临时预览）。
  - **顶栏菜单**：右侧三点菜单，内含「返回首页」与「开发者选项」（会话 ID、传输模式等）。
  - **空状态**：问候区上方随机问候 emoji（从新聊天等场景会刷新）。
- **开发代理**：`ui/vite.config.ts` 中对 `/chat-stream`、`/chat-sse`、`/chat-sessions` 的代理配置。

### Changed

- **布局**：聊天页根容器固定视口高度（`100dvh` + `overflow-hidden`），**仅主对话区滚动**，侧栏整体不随对话内容被卷走；侧栏内会话列表过长时仅在侧栏内滚动。
- **顶栏**：移除原 Logo 文案区，改为侧栏折叠控制（桌面）；移除顶栏与内容区之间的**底部分割线**。

### Fixed

- （与布局相关的）整页单滚动条导致侧栏与主区一起滚动的问题，通过 flex + `min-h-0` 与独立 `overflow-y-auto` 修正。

### 说明

- 版本号 **0.0.1** 与当前 `package.json` 一致；若你后续发 `0.1.0` / `1.0.0`，请在本文件顶部追加新版本块，并把 `[Unreleased]` 中已发布条目移入对应版本。
- 若某次提交希望出现在 Changelog，可在 PR/提交说明中写一句 **用户可见** 的摘要，便于维护本文件。
