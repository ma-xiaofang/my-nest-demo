# NestJS 后端 API 镜像（多阶段构建）
# 构建: docker build -t my-nest-demo .
# 运行: docker run --env-file .env -p 3009:3009 my-nest-demo

FROM node:22-alpine AS builder

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY prisma ./prisma
COPY prisma.config.ts nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

# prisma generate 仅生成客户端，不连接真实数据库
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"

RUN pnpm exec prisma generate
RUN pnpm run build

# ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN corepack enable

WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY ecosystem.config.cjs ./

RUN mkdir -p logs && chown -R node:node logs

# 与 .env.example 中 SERVER_PORT 默认一致；实际端口由环境变量控制
EXPOSE 3009

USER node

CMD ["pnpm", "run", "start:prod"]
