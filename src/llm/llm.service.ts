import { Injectable } from '@nestjs/common';
import { ChatZhipuAI } from '@langchain/community/chat_models/zhipuai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { BaseMessage } from '@langchain/core/messages';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LlmService {
  private readonly chatModel: ChatZhipuAI;
  constructor(private readonly configService: ConfigService) {
    this.chatModel = new ChatZhipuAI({
      apiKey: this.configService.get('ZHIPUAI_API_KEY'),
      model: this.configService.get<string>('GLM_MODEL') ?? 'glm-4-flash',
    });
  }

  /** 当前默认模型名（与请求体 model 覆盖区分，用于 OpenAI 形响应里的 model 字段） */
  getDefaultModelName(): string {
    return this.chatModel.model;
  }

  /** 请求级 model 与默认不一致时新建实例（ChatZhipuAI 类型上无 Runnable.bind） */
  private chatModelForRequest(modelOverride?: string): ChatZhipuAI {
    if (modelOverride === undefined || modelOverride === this.chatModel.model) {
      return this.chatModel;
    }
    const apiKey = this.configService.get<string>('ZHIPUAI_API_KEY');
    return new ChatZhipuAI({
      apiKey,
      model: modelOverride,
    });
  }
  /**
   * 聊天提示模板
   */
  private readonly chatPromptTemplate = ChatPromptTemplate.fromMessages([
    ['system', 'You are a helpful assistant.'],
    ['user', '{input}'],
  ]);
  /**
   * 字符串输出解析器
   */
  private readonly stringOutputParser = new StringOutputParser();
  /**
   * 聊天流式输出
   * @param message 消息
   * @returns 流式输出
   */
  async *chatStream(message: string) {
    // 创建链
    const chain = this.chatPromptTemplate
      .pipe(this.chatModel)
      .pipe(this.stringOutputParser);

    // 执行链
    const stream = await chain.stream({ input: message });
    // 循环输出
    for await (const chunk of stream) {
      // 异步返回给调用者
      yield chunk;
    }
  }

  /**
   * 按 OpenAI 风格多轮 messages 流式输出（字符串增量）。
   * @param model 覆盖模型名，不传则用构造时的默认模型
   */
  async *chatStreamFromMessages(messages: BaseMessage[], model?: string) {
    const chat = this.chatModelForRequest(model);
    const chain = chat.pipe(this.stringOutputParser);
    const stream = await chain.stream(messages);
    for await (const chunk of stream) {
      yield chunk as string;
    }
  }

  /** 非流式：整段助手回复 */
  async chatFromMessages(messages: BaseMessage[], model?: string): Promise<string> {
    const chat = this.chatModelForRequest(model);
    const chain = chat.pipe(this.stringOutputParser);
    const text = await chain.invoke(messages);
    return text as string;
  }
}
