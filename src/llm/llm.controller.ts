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
import { LlmService } from './llm.service';
import type { Response } from 'express';
import {
  applyPlainStreamHeaders,
  applySseHeaders,
  pipeTextIterableToOpenAiSse,
} from './utils/stream-http';

type ChatBody = { message: string; sessionId?: string };

@Controller()
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  /**
   * 拉取某会话的消息列表（按创建时间升序）
   */
  @Get('/chat-sessions/:sessionId/messages')
  async getSessionMessages(@Param('sessionId') sessionId: string) {
    const sid = sessionId?.trim();
    if (!sid) {
      throw new BadRequestException('sessionId 不能为空');
    }
    return this.llmService.getSessionMessages(sid);
  }

  /**
   * 查询会话列表（最近更新在前）
   * @param userId 可选，只查该用户的会话
   * @param take 条数上限，默认 50，最大 100
   */
  @Get('/chat-sessions')
  async listChatSessions(
    @Query('userId') userIdRaw?: string,
    @Query('take') takeRaw?: string,
  ) {
    const take = Math.min(100, Math.max(1, parseInt(takeRaw ?? '50', 10) || 50));
    let userId: number | undefined;
    if (userIdRaw !== undefined && userIdRaw !== '') {
      userId = parseInt(userIdRaw, 10);
      if (!Number.isFinite(userId)) {
        throw new BadRequestException('userId 必须是数字');
      }
    }
    return this.llmService.listChatSessions({ userId, take });
  }

  /**
   * 聊天流式输出
   * @param body 请求体
   * @param response 响应
   * @returns 裸流式输出，需要前端自己处理
   */
  @Post('/chat-stream')
  async chatStream(@Body() body: ChatBody, @Res() response: Response) {
    applyPlainStreamHeaders(response);
    for await (const chunk of this.llmService.chatStream(
      body.message,
      body.sessionId,
    )) {
      response.write(chunk as string);
    }
    response.end();
  }

  /**
   * 聊天 SSE：OpenAI `chat.completion.chunk` 帧
   */
  @Post('/chat-sse')
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
