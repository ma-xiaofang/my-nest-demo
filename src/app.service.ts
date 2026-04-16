import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 根服务：可注入，提供应用级业务逻辑（示例）。
 */
@Injectable()
export class AppService {
  @Inject()
  private readonly configService: ConfigService;
  getHello(): string {
    const appName = this.configService.get<string>('APP_NAME', 'my-nest-demo');
    return `Hello ${appName}!`;
  }
}
