import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * 根控制器：暴露基础 HTTP 路由。
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  /**
   * 根路径 GET：返回欢迎文案。
   * @returns 问候字符串
   */
  getHello(): string {
    return this.appService.getHello();
  }
}
