# Prisma Schema 迁移完整指南

> 本项目使用 **Prisma 7** + **PostgreSQL** + **NestJS**
> 配置文件：`prisma/schema.prisma`、`prisma.config.ts`

---

## 目录

1. [安装与初始化](#1-安装与初始化)
2. [基础概念](#2-基础概念)
3. [开发环境迁移流程](#3-开发环境迁移流程)
4. [生产环境部署流程](#4-生产环境部署流程)
5. [常用命令速查](#5-常用命令速查)
6. [实际示例](#6-实际示例)
7. [最佳实践](#7-最佳实践)
8. [常见问题](#8-常见问题)

---

## 1. 安装与初始化

本章介绍从零开始在 NestJS 项目中搭建 Prisma 的完整流程。

### 1.1 前置要求

| 工具 | 版本要求 | 用途 |
|------|----------|------|
| Node.js | >= 18.x | 运行时环境 |
| pnpm / npm / yarn | 任选其一 | 包管理器 |
| PostgreSQL | >= 14 | 数据库 |
| TypeScript | >= 5.0 | 类型支持 |

```bash
# 检查当前版本
node -v    # v20.x.x
pnpm -v    # 9.x.x
psql --version  # PostgreSQL 15.x 或更高
```

### 1.2 安装 Prisma 相关依赖

#### 方式一：在已有项目中添加 Prisma（本项目的情况）

```bash
# 进入项目目录
cd my-nest-demo

# 安装 Prisma CLI（开发依赖）
pnpm add -D prisma dotenv

# 安装 Prisma Client（运行时依赖）
pnpm add @prisma/client @prisma/adapter-pg pg

# 如果用 MySQL（本项不用管）
# pnpm add @prisma/adapter-mysql mysql2

# 验证安装
npx prisma --version   # 应输出类似：Prisma 7.7.0
```

#### 方式二：全新项目从零初始化

```bash
# 1. 创建新项目目录
mkdir my-project && cd my-project

# 2. 初始化 package.json
npm init -y

# 3. 安装全部依赖
npm install @prisma/client @prisma/adapter-pg pg
npm install -D prisma dotenv typescript ts-node @types/node

# 4. 初始化 Prisma（自动创建 prisma 目录和 schema 文件）
npx prisma init
```

执行 `prisma init` 后会生成以下文件：

```
prisma/
├── schema.prisma          # 数据模型定义（核心文件）
└── migrations/            # 迁移文件存放目录（自动创建）

prisma.config.ts           # Prisma 7 配置文件（自动创建）
.env                       # 环境变量文件（自动创建模板）
```

### 1.3 环境变量配置（`.env` 文件）

#### 自动生成

执行 `prisma init` 会自动生成一个 `.env` 模板：

```env
# .env（自动生成的默认内容）
DATABASE_URL="postgresql://postgres:123456@localhost:5432/mydb?schema=public"
```

#### 手动创建（推荐）

如果 `prisma init` 没有自动创建 `.env`，或需要更完整的配置：

**Step 1: 在项目根目录创建 `.env` 文件**

```bash
# Windows (PowerShell)
New-Item -Name ".env" -ItemType "File"

# Mac / Linux
touch .env
```

**Step 2: 填写配置内容**

```env
# ============================================
# .env - 环境变量配置（勿提交到 Git！）
# ============================================

# ─── 数据库连接（必填）───
# 格式：postgresql://用户名:密码@主机:端口/数据库名?schema=模式名
DATABASE_URL="postgresql://postgres:你的密码@localhost:5432/nest_demo?schema=public"

# ─── 应用服务 ───
APP_NAME=MyNestDemo
SERVER_PORT=3009

# ─── API 密钥 ───
DEEPSEEK_API_KEY=sk-your-deepseek-key
GLM_API_KEY=your-glm-key
TAVILY_API_KEY=tvly-your-tavily-key
```

**Step 3: 创建 `.env.example` 作为模板（提交到 Git）**

```env
# ============================================
# .env.example - 环境变量模板（可提交到 Git）
# 使用方法：复制此文件为 .env 并填写真实值
#   cp .env.example .env     (Mac/Linux)
#   copy .env.example .env   (Windows)
# ============================================

# ─── 数据库（必填）───
# Prisma CLI 与 NestJS 的 PrismaService 均使用此连接串
DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/DATABASE_NAME?schema=public"

# ─── HTTP 服务 ───
SERVER_PORT=3009

# ─── LLM API Keys（按需填写）───
DEEPSEEK_API_KEY=
GLM_API_KEY=
TAVILY_API_KEY=

# ─── 可选配置 ───
APP_NAME=my-nest-demo
# DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
# DEEPSEEK_MODEL=deepseek-chat
```

#### 各数据库连接串格式对照表

| 数据库 | 连接串格式 | 示例 |
|--------|-----------|------|
| **PostgreSQL** | `postgresql://user:pwd@host:port/db?schema=xxx` | `postgresql://postgres:123@localhost:5432/myapp` |
| **MySQL** | `mysql://user:pwd@host:port/db` | `mysql://root:123@localhost:3306/myapp` |
| **SQLite** | `file:./dev.db` | `file:./mydb.sqlite` |
| **SQL Server** | `sqlserver://user:pwd@host:port?database=db` | `sqlserver://sa:123@localhost:1433?database=myapp` |

#### Docker 中运行的 PostgreSQL 示例

如果数据库运行在 Docker 容器中：

```env
# 本地 Docker PostgreSQL
DATABASE_URL="postgresql://postgres:postgres123@host.docker.internal:5432/nest_demo?schema=public"

# 或使用容器名称（同一 docker-compose 网络）
DATABASE_URL="postgresql://postgres:postgres123@db:5432/nest_demo?schema=public"

# 云数据库（如 Supabase、Neon、Railway）
DATABASE_URL="postgresql://postgres:xxxx@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

### 1.4 确保 .env 被正确加载

Prisma 7 需要在 `prisma.config.ts` 中手动加载 `.env` 文件：

```typescript
// prisma.config.ts（Prisma 7 必需）
import "dotenv/config";                    // ← 加载 .env 文件
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],      // ← 从环境变量读取
  },
});
```

> ⚠️ **关键点**：Prisma 7 不再像旧版本那样自动加载 `.env`，必须通过 `dotenv/config` 显式导入。

### 1.5 验证数据库连接

配置好 `.env` 后，验证能否连上数据库：

```bash
# 验证 Prisma 能否正常连接数据库
npx prisma db execute --stdin <<< "SELECT 1;"

# 或者直接验证
npx prisma migrate dev --name init
# 如果成功说明连接没问题；如果失败检查 DATABASE_URL 是否正确
```

### 1.6 配置 Git 忽略规则

确保敏感信息不会被提交：

```gitignore
# .gitignore

# 环境变量（包含密钥！）
.env
.env.local
.env.*.local

# Prisma 生成的代码（自动生成，不需提交）
src/generated/prisma/

# 缓存
node_modules/
*.tsbuildinfo
```

### 1.7 完整初始化流程图

```mermaid
graph TD
    A[新建/进入项目] --> B[安装依赖<br>prisma + @prisma/client]
    B --> C[执行 prisma init]
    C --> D{是否生成了 .env?}
    D -->|是| E[填写 .env 中的 DATABASE_URL]
    D -->|否| F[手动创建 .env 文件]
    F --> E
    E --> G[编辑 schema.prisma<br>定义数据模型]
    G --> H[执行首次迁移<br>migrate dev --name init]
    H --> I{连接成功？}
    I -->|是| J[✅ 初始化完成！<br>可以开始开发了]
    I -->|否| K[检查：<br>1. PostgreSQL 是否启动<br>2. DATABASE_URL 是否正确<br>3. 用户名密码是否正确]
    K --> E
```

### 1.8 常见初始化错误排查

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `Can't reach database server at xxx` | 数据库未启动或地址错误 | 启动 PostgreSQL，检查 host/port |
| `password authentication failed` | 密码错误 | 检查 `.env` 中的密码 |
| `database "xxx" does not exist` | 数据库不存在 | 先 `createdb nest_demo` 创建 |
| `FATAL: role "xxx" does not exist` | 用户不存在 | 先 `createuser -s postgres` 创建 |
| `dotenv not found` | 未安装 dotenv | `pnpm add -D dotenv` |

---

## 2. 基础概念

### 2.1 核心文件说明

```
prisma/
├── schema.prisma          # 数据模型定义（你修改的就是这个）
├── config.ts              # Prisma 7 配置（数据库连接等）
└── migrations/            # 迁移文件目录（自动生成）
    └── 20260525000000_add_user_avatar/
        └── migration.sql   # 具体的 SQL 语句

src/generated/prisma/      # Prisma Client 生成位置（不要手动修改）
```

### 2.2 两个关键操作的区别

| 操作 | 命令 | 作用 | 改变的文件 |
|------|------|------|-----------|
| **生成 Client** | `prisma generate` | 根据 schema 生成 TypeScript 类型代码 | `src/generated/prisma/` |
| **执行迁移** | `migrate dev / deploy` | 执行 SQL 改变数据库表结构 | 数据库 |

> ⚠️ 两者必须同步：代码要知道新字段（generate），数据库也要有新列（deploy）

### 2.3 dev 与 deploy 的区别

| 特性 | `migrate dev` | `migrate deploy` |
|------|---------------|------------------|
| 适用环境 | 开发环境（本地） | 生产环境 / CI-CD |
| 创建迁移 SQL 文件 | ✅ 自动生成到 `prisma/migrations/` | ❌ 不创建 |
| 执行迁移 | ✅ 自动执行待处理的迁移 | ✅ 执行待处理的迁移 |
| 回滚支持 | 支持 `migrate reset` | ❌ 不支持回滚 |
| 危险性 | 较低（开发环境） | 需谨慎（生产环境） |

**一句话总结：**
- `dev` = 写施工方案（SQL文件）+ 施工
- `deploy` = 按已有方案施工（不写新方案）

---

## 3. 开发环境迁移流程

### 3.1 完整步骤（推荐）

#### Step 1: 修改 schema.prisma

```prisma
// prisma/schema.prisma

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  password  String
  role      String   @default("user")
  // ====== 新增字段 ======
  avatar    String?  @default("/default-avatar.png")
  phone     String?  @unique
  // =====================
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  posts         Post[]
  chatSessions  ChatSession[]

  @@map("users")
}
```

#### Step 2: 创建并执行迁移

```bash
npx prisma migrate dev --name add_user_avatar_phone
```

这条命令会自动完成三件事：

```
✅ 1. 对比 schema 与数据库差异
✅ 2. 在 prisma/migrations/ 下生成迁移 SQL 文件
✅ 3. 执行该 SQL（改变数据库表结构）
✅ 4. 重新生成 Prisma Client
```

生成的文件结构：

```
prisma/migrations/
└── 20260525175400_add_user_avatar_phone/
    └── migration.sql    -- 内容类似：
                          -- ALTER TABLE "users" ADD COLUMN "avatar" TEXT;
                          -- ALTER TABLE "users" ADD COLUMN "phone" TEXT;
                          -- CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
```

#### Step 3: 使用新字段

现在可以在代码中使用新字段了：

```typescript
// 创建用户时带新字段
const user = await prisma.user.create({
  data: {
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashed123',
    avatar: '/avatars/test.png',
    phone: '13800138000',
  },
});

// 查询时包含新字段
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    avatar: true,  // 新字段
    phone: true,   // 新字段
  },
});
```

### 3.2 只生成迁移不执行（进阶）

```bash
# 仅创建迁移文件，不立即执行
npx prisma migrate dev --name add_field --create-only

# 之后手动执行
npx prisma migrate deploy
```

适用场景：需要先 review 生成的 SQL 再执行。

---

## 4. 生产环境部署流程

### 4.1 完整部署脚本

```bash
#!/bin/bash
# deploy.sh - 生产环境部署脚本

set -e  # 遇到错误立即退出

echo "=== 1. 安装依赖 ==="
pnpm install --prod

echo "=== 2. 生成 Prisma Client ==="
npx prisma generate

echo "=== 3. 执行数据库迁移 ==="
npx prisma migrate deploy

echo "=== 4. 构建项目 ==="
pnpm run build

echo "=== 5. 启动服务 ==="
pnpm run start:prod

echo "=== 部署完成 ==="
```

### 4.2 Docker 部署示例

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN npx prisma generate          # 生成 Client
RUN pnpm run build               # 构建 NestJS

FROM node:20-alpine AS runner
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated  # 复制生成的 Client
COPY --from=builder /app/prisma ./prisma

CMD ["sh", "-c", "npx prisma migrate deploy && pnpm run start:prod"]
```

### 4.3 推荐的 package.json 脚本配置

```json
{
  "scripts": {
    "build": "prisma generate && nest build",
    "start:prod": "prisma migrate deploy && pm2-runtime start ecosystem.config.cjs",
    "migrate:dev": "prisma migrate dev",
    "migrate:create": "prisma migrate dev --create-only",
    "migrate:status": "prisma migrate status",
    "migrate:reset": "prisma migrate reset",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "db:seed": "ts-node prisma/seed.ts"
  }
}
```

### 4.4 CI/CD 示例（GitHub Actions）

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Generate Prisma Client
        run: npx prisma generate
        
      - name: Run migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: npx prisma migrate deploy
        
      - name: Build application
        run: pnpm run build
        
      - name: Deploy
        run: # 你的部署命令
```

---

## 5. 常用命令速查

### 5.1 迁移相关

```bash
# 开发：创建迁移并执行
npx prisma migrate dev --name <描述性名称>

# 开发：只创建迁移文件，不执行
npx prisma migrate dev --name <名称> --create-only

# 生产：执行所有待处理迁移
npx prisma migrate deploy

# 查看迁移状态（哪些已执行、哪些待执行）
npx prisma migrate status

# 回滚数据库到初始状态（删除所有数据！慎用）
npx prisma migrate resolve --rolled-back <迁移版本>

# 解决卡住的迁移状态标记
npx prisma migrate resolve --applied <迁移版本>
```

### 5.2 Client 生成

```bash
# 根据 schema 重新生成 TypeScript Client
npx prisma generate
```

### 5.3 快速原型开发（跳过迁移文件）

```bash
# 直接将 schema 推送到数据库（无迁移文件）
npx prisma db push

# 适用场景：
# - 快速原型开发
# - 本地实验
# - 不适合：生产环境（无法追踪历史、无法回滚）
```

### 5.4 其他实用命令

```bash
# 启动可视化数据库管理界面
npx prisma studio

# 查看即将执行的 SQL（不真正执行）
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma.config.ts --script

# 格式化 schema 文件
npx prisma format

# 验证 schema 语法是否正确
npx prisma validate
```

---

## 6. 实际示例

### 6.1 示例一：给 User 表添加头像和手机号

**Step 1 - 修改 schema：**

```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  password  String
  role      String   @default("user")
  avatar    String?                              // 新增
  phone     String?  @unique                     // 新增
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  posts         Post[]
  chatSessions  ChatSession[]
  @@map("users")
}
```

**Step 2 - 执行迁移：**

```bash
npx prisma migrate dev --name add_avatar_and_phone
```

**Step 3 - 使用新字段：**

```typescript
// src/user/user.service.ts
async createUser(createUserDto: CreateUserDto) {
  return this.prisma.user.create({
    data: {
      ...createUserDto,
      avatar: createUserDto.avatar ?? '/default-avatar.png',
    },
  });
}
```

### 6.2 示例二：新建一张表（Article 文章表）

**Step 1 - 修改 schema：**

```prisma
model Article {
  id        Int      @id @default(autoincrement())
  title     String
  content   String   @db.Text
  summary   String?  @db.Text
  coverImage String?
  views     Int      @default(0)
  status    ArticleStatus @default(DRAFT)
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([authorId, status])
  @@index([createdAt])
  @@map("articles")
}

enum ArticleStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

**Step 2 - 更新 User 模型添加关联：**

```prisma
model User {
  // ... 现有字段
  articles Article[]       // 新增关联
  @@map("users")
}
```

**Step 3 - 执行迁移：**

```bash
npx prisma migrate dev --name create_article_table
```

### 6.3 示例三：修改字段类型或删除字段

```prisma
// 修改前
role String @default("user")

// 修改后：改为枚举
role UserRole @default(USER)

enum UserRole {
  USER
  ADMIN
  SUPER_ADMIN
}
```

```bash
npx prisma migrate dev --name change_role_to_enum
```

> ⚠️ **注意**：修改/删除字段可能导致数据丢失，Prisma 会提示确认。

### 6.4 示例四：添加索引优化查询性能

```prisma
model ChatMessage {
  id        String   @id @default(uuid())
  sessionId String
  role      ChatRole
  content   String   @db.Text
  createdAt DateTime @default(now())

  session ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])  // 复合索引：按会话+时间查询消息
  @@map("chat_messages")
}
```

```bash
npx prisma migrate dev --name add_chat_message_index
```

---

## 7. 最佳实践

### 7.1 迁移命名规范

使用清晰、描述性的名称，方便后续追踪：

```bash
# ✅ 好的命名
--name init                            # 初始化
--name create_user_table              # 创建用户表
--name add_user_avatar_phone           # 添加用户头像手机号
--name change_email_to_unique          # 邮箱改唯一约束
--name add_post_views_index            # 文章浏览量索引
--name rename_content_to_body          # 字段重命名

# ❌ 不好的命名
--name abc
--name tmp
--name update                         # 太模糊
--name fix                             # 不清楚修了什么
```

### 7.2 团队协作规范

```mermaid
graph LR
    A[开发者A<br>本地 migrate dev] --> B[提交迁移文件到 Git]
    B --> C[Code Review<br>检查 migration.sql]
    C --> D[合并到主分支]
    D --> E[CI 自动执行<br>migrate deploy]
    E --> F[生产环境更新]
```

**关键规则：**

1. **始终提交迁移文件** — 不要只提交 `schema.prisma`
2. **先 review SQL 再合并** — 确保 `migration.sql` 符合预期
3. **不要修改已提交的迁移文件** — 如果出错，创建新的迁移来修复
4. **保持迁移顺序一致** — 按时间顺序排列，不要打乱

### 7.3 Git 提交检查清单

每次 schema 变更后，确保提交以下文件：

```
✅ prisma/schema.prisma                    # 模型定义
✅ prisma/migrations/<时间戳>_<名称>/migration.sql  # 迁移 SQL
❌ src/generated/prisma/*                  # 不要提交（自动生成）
❌ node_modules/*                           # 不要提交
```

建议在 `.gitignore` 中添加：

```
# .gitignore
src/generated/prisma/
```

### 7.4 数据库变更流程决策树

```
场景是什么？
├── 开发中新增字段/表？
│   └── → migrate dev --name xxx
│
── 生产部署？
│   └── → migrate deploy
│
── 快速实验/原型？
│   └── → db push（小心：无迁移记录）
│
── 想看会生成什么 SQL 但不执行？
│   └── → migrate dev --create-only
│
── 出错了想重置本地数据库？
│   └── → migrate reset（数据全丢！）
│
── 迁移状态卡住了？
    └── → migrate resolve --applied/rolled-back
```

### 7.5 种子数据（Seed）

创建 `prisma/seed.ts` 用于填充初始数据：

```typescript
// prisma/seed.ts
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('开始播种数据...');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin',
      password: '$2b$10$xxx',  // bcrypt 加密后的密码
      role: 'ADMIN',
    },
  });

  console.log('管理员创建成功:', admin.id);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => await prisma.$disconnect());
```

在 `package.json` 中配置：

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

运行：`npx prisma db seed` 或在 `migrate dev` 后自动触发。

---

## 8. 常见问题

### Q1: 执行 migrate dev 报错 "Database is not empty"

**原因**：数据库已经有表，但没有任何迁移记录。

**解决方案**：

```bash
# 方案 A：如果数据库可以清空（开发环境）
npx prisma migrate dev --name init

# 方案 B：将现有数据库作为基线
npx prisma migrate resolve --applied 0
npx prisma migrate dev --name first_migration
```

### Q2: 迁移文件冲突（多人同时修改 schema）

**原因**：两个开发者创建了同时间戳的迁移。

**解决方案**：

```bash
# 1. 回退本地未推送的迁移
git checkout HEAD~1 -- prisma/migrations/

# 2. 拉取远程最新的迁移
git pull origin main

# 3. 重新基于最新状态创建迁移
npx prisma migrate dev --name your_changes
```

### Q3: 修改了已存在的迁移文件

**⚠️ 强烈不建议这样做！** 如果必须修改：

```bash
# 如果迁移还未应用到任何环境
# 可以修改后重新执行

# 如果已经应用到了其他环境
# 应该创建一个新的迁移来修复，而不是修改旧的
npx prisma migrate dev --name fix_previous_migration
```

### Q4: Prisma Client 找不到新生成的字段

**原因**：Client 没有重新生成。

**解决方案**：

```bash
npx prisma generate
```

如果还是不行，尝试清理缓存后重新生成：

```bash
rm -rf node_modules/.cache/prisma
npx prisma generate
```

### Q5: 想要回滚某个迁移

Prisma **不支持直接回滚单个迁移**，有两种方式：

**方式一：手动修复（推荐）**

```bash
# 1. 创建一个新迁移来撤销之前的变更
# 2. 手动编写反向 SQL 或修改 schema
npx prisma migrate dev --name revert_xxx_change
```

**方式二：完全重置（仅开发环境）**

```bash
# ⚠️ 这会删除所有数据！
npx prisma migrate reset
```

### Q6: "Pxxxx" 错误码含义

| 错误码 | 含义 |
|--------|------|
| P1001 | 数据库服务器找不到 |
| P1002 | 数据库可到达但拒绝了连接 |
| P1003 | 数据库不存在 |
| P1008 | 操作超时 |
| P1010 | 认证失败（用户名/密码错误） |
| P1011 | 数据库 `xxx` 无法访问 |
| P1012 | 版本不匹配 |
| P1017 | 服务器关闭了连接 |
| P1018 | 请求超时 |
| P2002 | 唯一约束冲突（重复数据） |
| P2003 | 外键约束失败 |
| P2025 | 找不到要操作的记录 |

### Q7: migrate deploy 和 db push 该选哪个？

| 场景 | 推荐 |
|------|------|
| 生产环境 | `migrate deploy` |
| 团队协作项目 | `migrate dev` + `migrate deploy` |
| 个人快速原型 | `db push`（简单但无迁移记录） |
| CI/CD 自动化流水线 | `migrate deploy` |
| 数据库已有数据需保持 | `migrate deploy` |

---

## 附录：本项目 Prisma 配置参考

### prisma.config.ts（Prisma 7 特有）

```typescript
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

### schema.prisma generator 配置

```prisma
generator client {
  provider     = "prisma-client"   # Prisma 7 新格式
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"             # NestJS 必须用 CommonJS
}
```

---

*文档最后更新：2026-05-25*
