/**
 * 应用入口：创建 Nest 应用并监听端口。
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * 启动 HTTP 服务器；端口优先读取环境变量 `PORT`，默认 3000。
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
