import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import {
  StateGraph,
  START,
  END,
  MessagesAnnotation,
} from '@langchain/langgraph';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChatRole } from 'src/generated/prisma/client';

@Injectable()
export class LanggraphService implements OnModuleInit {
  private simpleGraph: any; // 简单图
  private memoryGraph: any; // 记忆图（消息存储改为 Prisma）
  private llm!: ChatOpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.llm = new ChatOpenAI({
      model: 'deepseek-v4-flash',
      modelKwargs: { thinking: { type: 'disabled' } },
      apiKey: this.configService.get('DEEPSEEK_API_KEY'),
      configuration: { baseURL: 'https://api.deepseek.com/v1' },
    });

    // ── 工作流一：无记忆，每次 invoke 独立 ─────────────
    const callModel = async (state: typeof MessagesAnnotation.State) => {
      // state.messages 包含本次传入的所有消息
      const response = await this.llm.invoke(state.messages);
      // 只返回新增消息，LangGraph 自动追加（不覆盖历史）
      return { messages: [response] };
    };
    this.simpleGraph = new StateGraph(MessagesAnnotation)
      .addNode('callModel', callModel)
      .addEdge(START, 'callModel')
      .addEdge('callModel', END)
      .compile();

    // ── 工作流二：有记忆（由 Prisma 提供历史） ───────────
    // 节点函数
    const callModelWithMemory = async (
      state: typeof MessagesAnnotation.State,
    ) => {
      const response = await this.llm.invoke(state.messages);
      return { messages: [response] };
    };
    // 创建记忆图
    this.memoryGraph = new StateGraph(MessagesAnnotation)
      // 添加节点
      .addNode('callModel', callModelWithMemory)
      // 添加开始边
      .addEdge(START, 'callModel')
      // 添加结束边
      .addEdge('callModel', END)
      // 编译图
      .compile();

    console.log(`✅ LangGraph 初始化完成`);
  }

  // 无记忆，每次 invoke 独立
  async simpleChat(message: string): Promise<string> {
    const result = await this.simpleGraph.invoke({
      messages: [
        new SystemMessage('你是专业的 AI 助手，回答简洁清晰。'),
        new HumanMessage(message),
      ],
    });
    return result.messages.at(-1).content as string;
  }

  // 有记忆，同 threadId 共享历史
  async memoryChat(threadId: string, message: string): Promise<string> {
    // 确保会话存在，不存在则自动创建。
    await this.ensureSession(threadId);
    // 获取历史消息
    const history = await this.prisma.chatMessage.findMany({
      where: { sessionId: threadId },
      orderBy: { createdAt: 'asc' },
    });
    const messagesForLlm: BaseMessage[] = [
      new SystemMessage(
        '你是专业的 AI 助手，根据历史对话内容，回答用户的问题。',
      ),
      ...history.map((item) =>
        item.role === ChatRole.user
          ? new HumanMessage(item.content)
          : new AIMessage(item.content),
      ),
      new HumanMessage(message),
    ];
    // 调用记忆图
    const result = await this.memoryGraph.invoke({
      messages: messagesForLlm,
    });
    const answer = result.messages.at(-1).content as string;

    //Prisma 事务，保证数据一致性
    await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: { sessionId: threadId, role: ChatRole.user, content: message },
      }),
      this.prisma.chatMessage.create({
        data: {
          sessionId: threadId,
          role: ChatRole.assistant,
          content: answer,
        },
      }),
    ]);
    return answer;
  }

  /**
   * 确保会话存在，不存在则自动创建。
   */
  private async ensureSession(threadId: string): Promise<void> {
    const existing = await this.prisma.chatSession.findUnique({
      where: { id: threadId },
      select: { id: true },
    });
    if (existing) {
      return;
    }
    await this.prisma.chatSession.create({
      data: { id: threadId },
    });
  }
  // 获取历史消息
  async getHistory(threadId: string) {
    const history = await this.prisma.chatMessage.findMany({
      where: { sessionId: threadId },
      orderBy: { createdAt: 'asc' },
    });
    return history.map((item, index) => ({
      index,
      role: item.role,
      content: item.content,
    }));
  }
}
