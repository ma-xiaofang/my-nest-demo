import { randomBytes } from 'crypto';
import type { Response } from 'express';

function newChatcmplId(): string {
  return `chatcmpl-${randomBytes(12).toString('hex')}`;
}

/** OpenAI 流式帧：`chat.completion.chunk` */
function chatCompletionChunk(params: {
  id: string;
  created: number;
  model: string;
  delta: { role?: string; content?: string | null };
  finish_reason: string | null;
}) {
  return {
    id: params.id,
    object: 'chat.completion.chunk',
    created: params.created,
    model: params.model,
    choices: [
      {
        index: 0,
        delta: params.delta,
        logprobs: null,
        finish_reason: params.finish_reason,
      },
    ],
  };
}

export function applyPlainStreamHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Transfer-Encoding', 'chunked');
}

export function applySseHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
}

function writeSseData(res: Response, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * 将字符串增量异步流写成 OpenAI 形 `chat.completion.chunk` SSE（含首帧、`[DONE]`）。
 */
export async function pipeTextIterableToOpenAiSse(
  res: Response,
  modelName: string,
  source: AsyncIterable<string | unknown>,
): Promise<void> {
  const id = newChatcmplId();
  const created = Math.floor(Date.now() / 1000);
  try {
    writeSseData(
      res,
      chatCompletionChunk({
        id,
        created,
        model: modelName,
        delta: { role: 'assistant' },
        finish_reason: null,
      }),
    );
    for await (const chunk of source) {
      const piece = typeof chunk === 'string' ? chunk : String(chunk);
      if (!piece) continue;
      writeSseData(
        res,
        chatCompletionChunk({
          id,
          created,
          model: modelName,
          delta: { content: piece },
          finish_reason: null,
        }),
      );
    }
    writeSseData(
      res,
      chatCompletionChunk({
        id,
        created,
        model: modelName,
        delta: {},
        finish_reason: 'stop',
      }),
    );
    res.write('data: [DONE]\n\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeSseData(res, { error: { message, type: 'api_error' } });
  }
}
