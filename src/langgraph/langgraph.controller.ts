import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { LanggraphService } from './langgraph.service';

@ApiTags('LangGraph 工作流')
@Controller('langgraph')
export class LanggraphController {
  constructor(private readonly langgraphService: LanggraphService) {}

  @Post('simple-chat')
  @ApiOperation({ summary: '简单聊天（无记忆）' })
  async simpleChat(@Body() body: { message: string }) {
    const answer = await this.langgraphService.simpleChat(body.message);
    return { answer };
  }

  @Post('memory-chat')
  @ApiOperation({ summary: '带记忆的聊天' })
  async memoryChat(@Body() body: { threadId: string; message: string }) {
    const answer = await this.langgraphService.memoryChat(
      body.threadId,
      body.message,
    );
    return { answer };
  }

  @Get('get-history')
  @ApiOperation({ summary: '获取聊天历史' })
  @ApiQuery({ name: 'threadId', description: '线程ID' })
  async getHistory(@Query('threadId') threadId: string) {
    const history = await this.langgraphService.getHistory(threadId);
    return { history };
  }
}
