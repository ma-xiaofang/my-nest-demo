import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { randomBytes } from 'crypto';

/** 与 OpenAI Chat Completions 请求体对齐的最小字段 */
export type OpenAiChatMessage = {
  role: string;
  content: string;
};

export type OpenAiChatCompletionRequest = {
  model?: string;
  messages: OpenAiChatMessage[];
  stream?: boolean;
};

export function newChatcmplId(): string {
  return `chatcmpl-${randomBytes(12).toString('hex')}`;
}

export function toLangChainMessages(messages: OpenAiChatMessage[]): BaseMessage[] {
  return messages.map((m) => {
    const role = m.role?.toLowerCase() ?? 'user';
    if (role === 'system') return new SystemMessage(m.content);
    if (role === 'assistant') return new AIMessage(m.content);
    return new HumanMessage(m.content);
  });
}

/** OpenAI 流式单帧：chat.completion.chunk */
export function chatCompletionChunk(params: {
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

/** 非流式：chat.completion */
export function chatCompletionResponse(params: {
  id: string;
  created: number;
  model: string;
  content: string;
}) {
  return {
    id: params.id,
    object: 'chat.completion',
    created: params.created,
    model: params.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: params.content },
        logprobs: null,
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}
