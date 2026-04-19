import { BadRequestException, Body, Controller, Post, Res } from '@nestjs/common';
import { LlmService } from './llm.service';
import type { Response } from 'express';
import {
  chatCompletionChunk,
  chatCompletionResponse,
  newChatcmplId,
  toLangChainMessages,
  type OpenAiChatCompletionRequest,
} from './openai-chat-compat';

@Controller()
export class LlmController {
    constructor(private readonly llmService: LlmService) {}
    /**
     * 聊天流式输出
     * @param body 请求体
     * @param response 响应
     * @returns 裸流式输出，需要前端自己处理
     */
    @Post('/chat-stream')
    async chatStream(@Body() body: { message: string }, @Res() response: Response) {
        // 设置响应头
        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        response.setHeader('Cache-Control', 'no-cache');
        response.setHeader('Connection', 'keep-alive');
        response.setHeader('X-Accel-Buffering', 'no');
        response.setHeader('Transfer-Encoding', 'chunked');
        // 流式输出
        for await (const chunk of this.llmService.chatStream(body.message)) {
            response.write(chunk as string);
        }
        // 结束响应
        response.end();
    }
    /**
     * 聊天SSE输出
     * @param body 请求体
     * @param response 响应
     * @returns SSE输出
     */
    @Post('/chat-sse')
    async chatSSE(@Body() body: { message: string }, @Res() response: Response) {
        // 设置响应头
        response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        response.setHeader('Cache-Control', 'no-cache, no-transform');// 不缓存，不转换
        response.setHeader('Connection', 'keep-alive');
        // nginx：关闭代理缓冲，SSE/分块才能尽快到达客户端（无 nginx 时可忽略）
        response.setHeader('X-Accel-Buffering', 'no');
        // 流式输出，如果出错则写入错误信息
        try {
            //循环输出
            for await (const chunk of this.llmService.chatStream(body.message)) {
                const text = typeof chunk === 'string' ? chunk : String(chunk);
                // 写入响应，格式为data: {text: text}
                response.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
            // 结束响应标志
            response.write('data: [DONE]\n\n');
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            response.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
        }
        response.end();
    }

    /**
     * OpenAI 兼容：Chat Completions（支持 stream: true SSE / stream: false JSON）
     * @see https://platform.openai.com/docs/api-reference/chat/create
     */
    @Post('/v1/chat/completions')
    async openAiChatCompletions(
        @Body() body: OpenAiChatCompletionRequest,
        @Res() res: Response,
    ) {
        if (!body?.messages?.length) {
            throw new BadRequestException('messages is required and must be non-empty');
        }
        const lcMessages = toLangChainMessages(body.messages);
        const id = newChatcmplId();
        const created = Math.floor(Date.now() / 1000);
        const modelName = body.model ?? this.llmService.getDefaultModelName();

        if (body.stream === true) {
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            try {
                res.write(
                    `data: ${JSON.stringify(
                        chatCompletionChunk({
                            id,
                            created,
                            model: modelName,
                            delta: { role: 'assistant' },
                            finish_reason: null,
                        }),
                    )}\n\n`,
                );
                for await (const piece of this.llmService.chatStreamFromMessages(lcMessages, body.model)) {
                    if (!piece) continue;
                    res.write(
                        `data: ${JSON.stringify(
                            chatCompletionChunk({
                                id,
                                created,
                                model: modelName,
                                delta: { content: piece },
                                finish_reason: null,
                            }),
                        )}\n\n`,
                    );
                }
                res.write(
                    `data: ${JSON.stringify(
                        chatCompletionChunk({
                            id,
                            created,
                            model: modelName,
                            delta: {},
                            finish_reason: 'stop',
                        }),
                    )}\n\n`,
                );
                res.write('data: [DONE]\n\n');
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                res.write(`data: ${JSON.stringify({ error: { message, type: 'api_error' } })}\n\n`);
            }
            res.end();
            return;
        }

        const content = await this.llmService.chatFromMessages(lcMessages, body.model);
        res.json(
            chatCompletionResponse({
                id,
                created,
                model: modelName,
                content,
            }),
        );
    }
}
