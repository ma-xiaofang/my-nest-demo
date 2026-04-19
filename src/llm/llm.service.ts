import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
  AIMessage,
  HumanMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import { ConfigService } from '@nestjs/config';

const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';

/** 编译后位于 dist/llm/，与 nest-cli 复制的 prompts 相对路径一致 */
const SESSION_SYSTEM_PROMPT = readFileSync(
  join(__dirname, 'prompts', 'session-system.md'),
  'utf8',
).trim();

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly chatModel: ChatOpenAI;
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.chatModel = new ChatOpenAI({
      apiKey: this.configService.get<string>('DEEPSEEK_API_KEY'),
      model:
        this.configService.get<string>('DEEPSEEK_MODEL') ?? DEFAULT_DEEPSEEK_MODEL,
      configuration: {
        baseURL:
          this.configService.get<string>('DEEPSEEK_BASE_URL') ??
          DEFAULT_DEEPSEEK_BASE_URL,
      },
    });
  }

  /** 用于 SSE `model` 字段与 OpenAI 形 chunk */
  getDefaultModelName(): string {
    return this.chatModel.model;
  }

  /**
   * 聊天提示模板
   */
  private readonly chatPromptTemplate = ChatPromptTemplate.fromMessages([
    ['system', 'You are a helpful assistant.'],
    ['user', '{input}'],
  ]);
  
  /**
   * 会话提示模板
   */
  private readonly sessionPromptTemplate = ChatPromptTemplate.fromMessages([
    { role: 'system', content: SESSION_SYSTEM_PROMPT },
    /**
     * 会话历史
     */
    new MessagesPlaceholder('history'),
    { role: 'user', content: '{input}' },
  ]);

  /**
   * 字符串输出解析器
   */
  private readonly stringOutputParser = new StringOutputParser();

  /** 首轮完成后：根据一问一答生成会话主题（列表展示用） */
  private readonly sessionTitlePrompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      [
        '你是会话标题生成器。根据下面「用户消息」和「助手回复」生成一句会话标题。',
        '规则：简体中文；不超过20个字；不要引号；不要前缀如「关于」「对话」；',
        '概括核心意图或话题；只输出标题文本本身，不要解释或标点收尾的废话。',
      ].join(''),
    ],
    ['user', '【用户】\n{user}\n\n【助手】\n{assistant}'],
  ]);

  /**
   * 聊天流式输出
   * @param message 消息
   * @param sessionId 可选；传入时在同一会话内保留多轮上下文
   * @returns 流式输出
   */
  async *chatStream(message: string, sessionId?: string) {
    const sid = sessionId?.trim();
    /**
     * 没有会话 ID 时，使用聊天提示模板
     */
    if (!sid) {
      const chain = this.chatPromptTemplate
        .pipe(this.chatModel)
        .pipe(this.stringOutputParser);
      const stream = await chain.stream({ input: message });
      for await (const chunk of stream) {
        yield chunk;
      }
      return;
    }
    /**
     * 有会话 ID 时：从数据库读历史、流式生成后写回用户与助手消息
     */
    await this.prisma.chatSession.upsert({
      where: { id: sid },
      create: {
        id: sid,
        title: message.slice(0, 120) || null,
      },
      update: { updatedAt: new Date() },
    });

    const stored = await this.prisma.chatMessage.findMany({
      where: { sessionId: sid },
      orderBy: { createdAt: 'asc' },
    });
    const history: BaseMessage[] = [];
    for (const row of stored) {
      if (row.role === 'user') {
        history.push(new HumanMessage(row.content));
      } else {
        history.push(new AIMessage(row.content));
      }
    }

    const chain = this.sessionPromptTemplate
      .pipe(this.chatModel)
      .pipe(this.stringOutputParser);
    const stream = await chain.stream({ input: message, history });
    let assistantText = '';
    for await (const chunk of stream) {
      assistantText += chunk;
      yield chunk;
    }

    const isFirstTurn = stored.length === 0;
    await this.prisma.chatMessage.createMany({
      data: [
        { sessionId: sid, role: 'user', content: message },
        { sessionId: sid, role: 'assistant', content: assistantText },
      ],
    });
    if (isFirstTurn) {
      await this.refreshSessionTitleFromFirstExchange(
        sid,
        message,
        assistantText,
      );
    }
  }

  /**
   * 用首轮用户+助手内容生成主题并写回 chat_sessions.title
   */
  private async refreshSessionTitleFromFirstExchange(
    sessionId: string,
    user: string,
    assistant: string,
  ): Promise<void> {
    const chain = this.sessionTitlePrompt
      .pipe(this.chatModel)
      .pipe(this.stringOutputParser);
    let raw: string;
    try {
      raw = await chain.invoke({
        user: user.slice(0, 1200),
        assistant: assistant.slice(0, 2000),
      });
    } catch (e) {
      this.logger.warn(
        `会话主题生成失败 sessionId=${sessionId}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }
    const title = this.sanitizeSessionTitle(raw);
    if (!title) return;
    try {
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { title },
      });
    } catch (e) {
      this.logger.warn(
        `会话标题写入失败 sessionId=${sessionId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private sanitizeSessionTitle(raw: string): string | null {
    const oneLine = raw.replace(/\s+/g, ' ').trim();
    if (!oneLine) return null;
    const stripped = oneLine
      .replace(/^["'「『]+/, '')
      .replace(/["'」』]+$/, '')
      .trim();
    const cut = stripped.slice(0, 48);
    return cut.length > 0 ? cut : null;
  }

  /**
   * 会话列表：按最近活动时间倒序
   */
  async listChatSessions(options: { userId?: number; take: number }) {
    const { userId, take } = options;
    const rows = await this.prisma.chatSession.findMany({
      where: userId !== undefined ? { userId } : {},
      orderBy: { updatedAt: 'desc' },
      take,
      select: {
        id: true,
        title: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
    return rows.map(({ _count, ...rest }) => ({
      ...rest,
      messageCount: _count.messages,
    }));
  }

  /**
   * 某会话下的消息（按时间正序），供前端恢复历史对话
   */
  async getSessionMessages(sessionId: string) {
    return this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });
  }
}
