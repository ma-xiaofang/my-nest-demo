import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { LanggraphService } from './langgraph.service';
import { SimpleChatDto, MemoryChatDto } from './dto';

@ApiTags('LangGraph 工作流')
@Controller('langgraph')
export class LanggraphController {
  constructor(private readonly langgraphService: LanggraphService) {}

  @Post('simple-chat')
  @ApiOperation({ summary: '简单聊天（无记忆）' })
  @ApiResponse({
    status: 200,
    description: '聊天回复',
    example: { answer: '你好！我是AI助手，有什么可以帮你的吗？' },
  })
  async simpleChat(@Body() body: SimpleChatDto) {
    const answer = await this.langgraphService.simpleChat(body.message);
    return { answer };
  }

  @Post('memory-chat')
  @ApiOperation({ summary: '带记忆的聊天' })
  @ApiResponse({
    status: 200,
    description: '带上下文记忆的聊天回复',
    example: { answer: '根据我们之前的对话，你提到了喜欢编程，所以我推荐...' },
  })
  async memoryChat(@Body() body: MemoryChatDto) {
    const answer = await this.langgraphService.memoryChat(
      body.threadId,
      body.message,
    );
    return { answer };
  }

  @Get('get-history')
  @ApiOperation({ summary: '获取聊天历史' })
  @ApiQuery({ name: 'threadId', description: '线程ID' })
  @ApiResponse({
    status: 200,
    description: '聊天历史记录',
    example: {
      history: [
        { type: 'human', content: '你好' },
        { type: 'ai', content: '你好！有什么可以帮你的？' },
      ],
    },
  })
  async getHistory(@Query('threadId') threadId: string) {
    const history = await this.langgraphService.getHistory(threadId);
    return { history };
  }
}
