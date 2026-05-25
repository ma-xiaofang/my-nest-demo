import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { LlmService } from './llm.service';
import type { Response } from 'express';
import {
  applyPlainStreamHeaders,
  applySseHeaders,
  pipeTextIterableToOpenAiSse,
} from './utils/stream-http';

type ChatBody = { message: string; sessionId?: string };

@ApiTags('LLM 聊天')
@Controller()
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Get('/chat-sessions/:sessionId/messages')
  @ApiOperation({ summary: '获取会话消息列表' })
  @ApiParam({ name: 'sessionId', description: '会话ID' })
  async getSessionMessages(@Param('sessionId') sessionId: string) {
    const sid = sessionId?.trim();
    if (!sid) {
      throw new BadRequestException('sessionId 不能为空');
    }
    return this.llmService.getSessionMessages(sid);
  }

  @Get('/chat-sessions')
  @ApiOperation({ summary: '查询会话列表' })
  @ApiQuery({ name: 'userId', required: false, description: '用户ID' })
  @ApiQuery({ name: 'take', required: false, description: '条数上限，默认50' })
  async listChatSessions(
    @Query('userId') userIdRaw?: string,
    @Query('take') takeRaw?: string,
  ) {
    const take = Math.min(
      100,
      Math.max(1, parseInt(takeRaw ?? '50', 10) || 50),
    );
    let userId: number | undefined;
    if (userIdRaw !== undefined && userIdRaw !== '') {
      userId = parseInt(userIdRaw, 10);
      if (!Number.isFinite(userId)) {
        throw new BadRequestException('userId 必须是数字');
      }
    }
    return this.llmService.listChatSessions({ userId, take });
  }

  @Post('/chat-stream')
  @ApiOperation({ summary: '聊天流式输出（裸流）' })
  async chatStream(@Body() body: ChatBody, @Res() response: Response) {
    applyPlainStreamHeaders(response);
    for await (const piece of this.llmService.chatStream(
      body.message,
      body.sessionId,
    )) {
      const line = JSON.stringify({
        ...(piece.content ? { c: piece.content } : {}),
        ...(piece.reasoning ? { r: piece.reasoning } : {}),
      });
      if (line !== '{}') {
        response.write(`${line}\n`);
      }
    }
    response.end();
  }

  @Post('/chat-sse')
  @ApiOperation({ summary: '聊天 SSE 输出（OpenAI 格式）' })
  async chatSSE(@Body() body: ChatBody, @Res() response: Response) {
    applySseHeaders(response);
    await pipeTextIterableToOpenAiSse(
      response,
      this.llmService.getDefaultModelName(),
      this.llmService.chatStream(body.message, body.sessionId),
    );
    response.end();
  }
}
