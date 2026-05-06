// src/langgraph/article.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { ConfigService } from '@nestjs/config';

// 自定义 State：定义这个工作流里所有节点共享的数据结构
// 等价 Coze 的全局上下文 变量共享对象
// 等价 Dify 的 session 变量共享对象
const ArticleState = Annotation.Root({
  // 原始文章（输入，各节点只读）
  article: Annotation<string>(),

  // 关键词数组（extractKeywords 写入，generateSummary 读取）
  // reducer 追加：如果并行有多个节点写入，不会互相覆盖
  keywords: Annotation<string[]>({
    reducer: (prev, curr) => [...prev, ...curr],
    default: () => [],
  }),

  // 最终摘要（generateSummary 写入）
  summary: Annotation<string>(),

  // 执行日志（每个节点追加自己的耗时）
  log: Annotation<string[]>({
    reducer: (prev, curr) => [...prev, ...curr],
    default: () => [],
  }),
});

@Injectable()
export class ArticleService implements OnModuleInit {
  private graph: any;
  constructor(private readonly configService: ConfigService) {}
  onModuleInit() {
    const llm = new ChatOpenAI({
      model: 'deepseek-v4-flash',
      apiKey: this.configService.get('DEEPSEEK_API_KEY'),
      configuration: { baseURL: 'https://api.deepseek.com/v1' },
      temperature: 0.3, // 摘要任务用低温度，输出更稳定
    });

    // 节点一：提取关键词
    const extractKeywords = async (state: typeof ArticleState.State) => {
      const t0 = Date.now();
      const res = await llm.invoke([
        new HumanMessage(
          `从以下文章提取 5-8 个核心关键词，只输出关键词，逗号分隔，不要其他内容：\n\n${state.article}`,
        ),
      ]);
      const keywords = (res.content as string)
        .split(/[,，]/)
        .map((k) => k.trim())
        .filter(Boolean);
      return {
        keywords,
        log: [`关键词提取完成（${Date.now() - t0}ms）`],
      };
    };

    // 节点二：生成摘要
    // state.keywords 此时已经是 extractKeywords 写入的值
    const generateSummary = async (state: typeof ArticleState.State) => {
      const t0 = Date.now();
      const res = await llm.invoke([
        new HumanMessage(
          `根据以下文章生成 200 字以内的摘要。\n关键词参考：${state.keywords.join('、')}\n\n文章：\n${state.article}`,
        ),
      ]);
      return {
        summary: res.content as string,
        log: [`摘要生成完成（${Date.now() - t0}ms）`],
      };
    };

    // 等价 Coze 的工作流画布
    this.graph = new StateGraph(ArticleState)
      // 往画布中添加节点：[提取关键词]、[生成摘要]
      .addNode('提取关键词', extractKeywords)
      .addNode('生成摘要', generateSummary)
      // 往画布中添加连线：[开始] ---> [提取关键词]
      .addEdge(START, '提取关键词')
      // 添加连线：[提取关键词] --> [生成摘要]
      .addEdge('提取关键词', '生成摘要') // 串行：先提关键词再生成摘要
      // 添加连线：[生成摘要] ---> [结束]
      .addEdge('生成摘要', END)
      // 等价 Coze 的发布按钮
      .compile();
  }
  async process(article: string) {
    // 等价 Coze 的执行按钮
    const result = await this.graph.invoke({ article });
    return {
      keywords: result.keywords,
      summary: result.summary,
      log: result.log,
    };
  }
}
