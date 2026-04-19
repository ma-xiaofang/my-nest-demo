/**
 * 应用入口：创建 Nest 应用并监听端口。
 */
import { NestFactory } from '@nestjs/core';
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

  const port = configService.get<number>('SERVER_PORT') ?? 3001;
  await app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}
bootstrap();
