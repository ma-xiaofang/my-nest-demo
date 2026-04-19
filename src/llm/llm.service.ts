import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { PrismaService } from '../prisma/prisma.service';
import type { ChatMessage, ChatSession } from '../generated/prisma/client';
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

/** DeepSeek OpenAI 兼容接口默认地址（可被环境变量覆盖） */
const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
/** 默认模型名，对应 DeepSeek Chat */
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';

/** 编译后位于 dist/llm/，与 nest-cli 复制的 prompts 相对路径一致 */
const SESSION_SYSTEM_PROMPT = readFileSync(
  join(__dirname, 'prompts', 'session-system.md'),
  'utf8',
).trim();

/** 封装 DeepSeek（OpenAI SDK 兼容）调用、会话持久化与标题生成 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly chatModel: ChatOpenAI;
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // 使用环境变量中的密钥与可选 baseURL/model，便于切换自建网关
    this.chatModel = new ChatOpenAI({
      apiKey: this.configService.get<string>('DEEPSEEK_API_KEY'),
      model:
        this.configService.get<string>('DEEPSEEK_MODEL') ??
        DEFAULT_DEEPSEEK_MODEL,
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

  /** 无 sessionId 时的单轮模板：不读库、不写库 */
  private readonly chatPromptTemplate = ChatPromptTemplate.fromMessages([
    ['system', 'You are a helpful assistant.'],
    ['user', '{input}'],
  ]);

  /** 多轮会话：系统词 + 占位历史 + 当前用户输入 */
  private readonly sessionPromptTemplate = ChatPromptTemplate.fromMessages([
    { role: 'system', content: SESSION_SYSTEM_PROMPT },
    /**
     * 会话历史
     */
    new MessagesPlaceholder('history'),
    { role: 'user', content: '{input}' },
  ]);

  /** 将模型消息块解析为纯文本 token 流 */
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
    // 空会话 ID：不落库，直接流式返回（匿名一问一答）
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

    // 有会话 ID：保证会话行存在，并刷新 updatedAt（供列表按最近活动排序）
    await this.prisma.chatSession.upsert({
      where: { id: sid },
      create: {
        id: sid,
        // 首轮用用户首句占位标题，后续可由 LLM 生成更短更准的标题覆盖
        title: message.slice(0, 120) || null,
      },
      update: { updatedAt: new Date() },
    });

    // 按时间正序取出历史，拼成 LangChain 消息链
    const messageHistoryList: ChatMessage[] =
      await this.prisma.chatMessage.findMany({
        where: { sessionId: sid },
        orderBy: { createdAt: 'asc' },
      });

    // 将 Prisma 查询结果转换为 LangChain 消息链
    // 1. 创建一个空数组来存储消息
    // 2. 遍历 Prisma 查询结果，将每个消息转换为 LangChain 消息类型
    // 3. 将转换后的消息添加到数组中
    // 4. 返回转换后的消息数组
    const history: BaseMessage[] = messageHistoryList.map((row) => {
      if (row.role === 'user') {
        return new HumanMessage(row.content);
      } else {
        return new AIMessage(row.content);
      }
    });

    // 创建 LangChain 链，将系统词 + 历史 + 当前用户输入作为输入，调用模型生成回复
    const chain = this.sessionPromptTemplate
      .pipe(this.chatModel)
      .pipe(this.stringOutputParser);

    // 执行 LangChain 链，生成回复
    const stream = await chain.stream({ input: message, history });

    // 一个空字符串，用于拼接助手回复
    let assistantText = '';
    for await (const chunk of stream) {
      // 边推送给前端边拼接助手回复
      assistantText += chunk;
      yield chunk;
    }

    // 本轮用户输入与完整助手回复成对落库
    await this.prisma.chatMessage.createMany({
      data: [
        { sessionId: sid, role: 'user', content: message },
        { sessionId: sid, role: 'assistant', content: assistantText },
      ],
    });

    /*判断是否是第一轮对话*/
    const isFirstTurn: boolean = messageHistoryList.length === 0;

    // 仅首轮异步生成列表展示用标题，失败不影响主流程
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
   * @param sessionId 会话ID
   * @param user 用户内容
   * @param assistant 助手内容
   * @returns void
   */
  private async refreshSessionTitleFromFirstExchange(
    sessionId: string,
    user: string,
    assistant: string,
  ): Promise<void> {
    //使用标题生成模板，生成标题
    const chain = this.sessionTitlePrompt
      .pipe(this.chatModel)
      .pipe(this.stringOutputParser);

    //用来存储标题生成结果
    let raw: string;
    try {
      // 控制上下文长度，避免标题请求占用过多 token
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

    //去掉引号与多余空白，并截断为安全长度供 UI 展示
    const title = this.sanitizeSessionTitle(raw);
    if (!title) return;

    /*更新会话标题*/
    try {
      await this.prisma.chatSession.update({
        //根据会话ID更新会话标题
        where: { id: sessionId },
        //更新标题
        data: { title },
      });
    } catch (e) {
      this.logger.warn(
        `会话标题写入失败 sessionId=${sessionId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** 
   * 去掉引号与多余空白，并截断为安全长度供 UI 展示
   * @param raw 原始标题
   * @returns 安全标题
   */
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
   * @param options 选项
   * @param options.userId 用户ID
   * @param options.take 取多少条
   * @returns 会话列表
   */
  async listChatSessions(options: { userId?: number; take: number }) {
    const { userId, take } = options;
    // userId 未传则不过滤（演示/单用户场景）；有值时只列该用户的会话
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
    // 把 Prisma 的 _count 展平为前端友好的 messageCount
    return rows.map(({ _count, ...rest }) => ({
      ...rest,
      messageCount: _count.messages,
    }));
  }

  /**
   * 某会话下的消息（按时间正序），供前端恢复历史对话
   * @param sessionId 会话ID
   * @returns 消息列表
   */
  async getSessionMessages(sessionId: string) {
    return this.prisma.chatMessage.findMany({
      //根据会话ID查询消息
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });
  }
}
