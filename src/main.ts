/**
 * 应用入口：创建 Nest 应用并监听端口。
 */
// 尽早加载根目录 `.env`，避免其它模块在 import 阶段读取 `process.env` 时尚未注入（与 ConfigModule 互补）
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

/**
 * 启动 HTTP 服务器；端口优先读取环境变量 `SERVER_PORT`，默认 3000。
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 跨域：开发期常用 `origin: true` 回显请求来源；生产环境建议改为白名单数组或从配置读取
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // ─── Swagger / OpenAPI 文档配置 ───
  const config = new DocumentBuilder()
    .setTitle('My Nest Demo API')
    .setDescription('NestJS + Prisma + LangChain 全栈应用 API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = configService.get<number>('SERVER_PORT') ?? 3001;
  await app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Swagger docs at http://localhost:${port}/api-docs`);
  });
}
bootstrap();
