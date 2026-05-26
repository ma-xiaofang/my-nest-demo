import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('默认')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: '欢迎页面' })
  @ApiResponse({ status: 200, description: '欢迎文案', example: 'Hello World!' })
  getHello(): string {
    return this.appService.getHello();
  }
}
