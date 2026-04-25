import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import {
  RunnablePassthrough,
  RunnableSequence,
} from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 链模块:多步骤链、并行链、条件链、循环链
 */
@Injectable()
export class ChainsService {
  constructor(private readonly config: ConfigService) {
    this.llm = new ChatOpenAI({
      model: 'deepseek-chat',
      apiKey: this.config.get('DEEPSEEK_API_KEY'),
      configuration: { baseURL: 'https://api.deepseek.com/v1' },
    });
  }
  private llm: ChatOpenAI;
  private parser = new StringOutputParser();

  /**
   * 多步骤链
   */
  // ── Chain 一：简单线性链 ─────────────────────────────
  // 场景：文章润色（分析 → 润色）
  async polishArticle(article: string) {
    // 第一步：分析文章问题
    const analyzePrompt = ChatPromptTemplate.fromMessages([
      ['system', '你是专业编辑，只输出问题列表，不要其他内容。'],
      ['human', '分析这篇文章存在哪些问题：\n\n{article}'],
    ]);
    // 第二步：根据问题列表润色文章
    const polishPrompt = ChatPromptTemplate.fromMessages([
      ['system', '你是专业编辑，根据问题列表润色原文，保持原意。'],
      [
        'human',
        '原文：\n{article}\n\n问题列表：\n{issues}\n\n请输出润色后的文章：',
      ],
    ]);
    // 第一条链：article → 分析问题 → issues 字符串
    const analyzeChain = analyzePrompt.pipe(this.llm).pipe(this.parser);

    // 第二条链：{ article, issues } → 润色文章 → 最终文章
    const polishChain = polishPrompt.pipe(this.llm).pipe(this.parser);
    // LCEL

    // RunnableSequence：把多个步骤组合成一个完整链
    const fullChain = RunnableSequence.from([
      // 步骤一：同时保留原文，并调用分析链得到 issues
      {
        // RunnablePassthrough 直接透传输入值，不做任何处理
        article: new RunnablePassthrough(),
        issues: analyzeChain,
      },
      // 步骤二：把 { article, issues } 传给润色链
      polishChain,
    ]);

    const result = await fullChain.invoke(article);
    return { original: article, polished: result };
  }

  // ── Chain 二：顺序链（Sequential Chain）────────────────
  // 场景：博客生成（关键词 → 大纲 → 文章 → SEO 标题）
  async generateBlog(keywords: string) {
    // 第一步：生成大纲
    const outlinePrompt = ChatPromptTemplate.fromMessages([
      ['system', '你是专业编辑，根据关键词生成大纲。'],
      ['human', '关键词：\n{keywords}\n\n请输出大纲：'],
    ]);
    const outlineChain = outlinePrompt.pipe(this.llm).pipe(this.parser);

    // 第二步：根据大纲生成文章
    const articlePrompt = ChatPromptTemplate.fromMessages([
      ['system', '你是专业编辑，根据大纲生成文章。'],
      ['human', '大纲：\n{outline}\n\n请输出文章：'],
    ]);
    const articleChain = articlePrompt.pipe(this.llm).pipe(this.parser);

    // 第三步：根据文章生成 SEO 标题
    const seoTitlePrompt = ChatPromptTemplate.fromMessages([
      ['system', '你是专业编辑，根据文章生成 SEO 标题，只输出标题本身。'],
      ['human', '文章：\n{article}\n\n请输出 SEO 标题：'],
    ]);
    // 管道流：把多个步骤组合成一个完整链
    // RunnableSequence：把多个步骤组合成一个完整链 管道流
    const seoTitleChain = seoTitlePrompt.pipe(this.llm).pipe(this.parser);

    const fullChain = RunnableSequence.from([
      outlineChain,
      articleChain,
      seoTitleChain,
    ]);

    const result = await fullChain.invoke(keywords);
    return result;
  }

  // ── Chain 三：链式条件分支（Chain of Conditional Branches）────────────────
  // 场景：智能客服路由（根据问题类型路由到不同处理链）
  async smartRouter(question: string) {
    // 第一步：判断问题类型
    // 第一步：分类问题
    const classifyPrompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `分析用户问题，只输出分类标签（不要其他内容）：
        - 技术问题 → 输出: TECH
        - 退款问题 → 输出: REFUND
        - 投诉建议 → 输出: COMPLAINT
        - 其他 → 输出: OTHER`,
      ],
      ['human', '{question}'],
    ]);

    // 获取问题分类的链
    const classifyChain = classifyPrompt.pipe(this.llm).pipe(this.parser);
    const category = (await classifyChain.invoke({ question })).trim();
    // 第二步：根据分类选择不同 Prompt
    const prompts = {
      TECH: '你是技术支持专家，专业解答技术问题，给出具体操作步骤。',
      REFUND: '你是退款专员，引导用户完成退款流程，态度友好。',
      COMPLAINT: '你是客户关系专员，认真对待投诉，给出解决方案。',
      OTHER: '你是通用客服，友好回答各类问题。',
    }
    // 根据分类选择不同 Prompt
    const systemPrompt = prompts[category] || prompts.OTHER
    // 根据分类选择不同 Prompt 的链
    const answerPrompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      ['human', '{question}'],
    ])
    const answerChain = answerPrompt.pipe(this.llm).pipe(this.parser);
    const answer = await answerChain.invoke({ question });
    return answer;
  }
}
