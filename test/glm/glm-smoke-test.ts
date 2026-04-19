import { ChatZhipuAI } from '@langchain/community/chat_models/zhipuai';
import { ZhipuAIEmbeddings } from '@langchain/community/embeddings/zhipuai';
import { HumanMessage } from '@langchain/core/messages';

/**
 * 智谱 GLM 对话与嵌入的轻量封装，用于集成测试或本地快速验证 API Key 是否有效。
 */
export class GlmSmokeTest {
  constructor(private readonly apiKey: string) {}

  createChat(model = 'glm-4-flash') {
    return new ChatZhipuAI({
      apiKey: this.apiKey,
      model,
      temperature: 0.5,
    });
  }

  createEmbeddings(modelName: 'embedding-2' | 'embedding-3' = 'embedding-3') {
    return new ZhipuAIEmbeddings({
      apiKey: this.apiKey,
      modelName,
    });
  }

  async invokeChat(prompt: string, model?: string): Promise<string> {
    const llm = this.createChat(model);
    const msg = await llm.invoke([new HumanMessage(prompt)]);
    if (typeof msg.content === 'string') return msg.content;
    return String(msg.content);
  }

  /**
   * 使用 ChatZhipuAI.stream 拉取增量，返回每个文本分片与拼接结果。
   */
  async collectStreamChat(
    prompt: string,
    model?: string,
  ): Promise<{ chunks: string[]; text: string }> {
    const llm = this.createChat(model);
    const chunks: string[] = [];
    const stream = await llm.stream([new HumanMessage(prompt)]);
    for await (const part of stream) {
      if (typeof part.content === 'string' && part.content.length > 0) {
        chunks.push(part.content);
      }
    }
    return { chunks, text: chunks.join('') };
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.createEmbeddings().embedQuery(text);
  }
}
