import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatOpenAI } from '@langchain/openai';
import { VECTOR_STORE_SERVICE } from './vector-store.interface.js';
import type { VectorStoreService } from './vector-store.interface.js';

@Injectable()
export class RagService {
  private readonly llm: ChatOpenAI;

  constructor(
    @Inject(VECTOR_STORE_SERVICE)
    private readonly vectorStoreService: VectorStoreService,
    private readonly configService: ConfigService,
  ) {
    this.llm = new ChatOpenAI({
      model: 'deepseek-v4-flash',
      modelKwargs: { thinking: { type: 'disabled' } },
      apiKey: this.configService.get('DEEPSEEK_API_KEY'),
      configuration: { baseURL: 'https://api.deepseek.com/v1' },
    });
  }

  private docCount: number = 0;

  private splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500, // 每块最大字符数
    chunkOverlap: 50, // 相邻块重叠 50 个字符
    // 分隔符优先级：从上到下依次尝试
    separators: [
      '\n\n', // 第1优先：段落分隔（语义最完整）
      '\n', // 第2优先：换行
      '。', // 第3优先：中文句号
      '！',
      '？',
      ' ', // 第4优先：空格（英文单词边界）
      '', // 最后手段：强制按字符数截断
    ],
  });

  /**
   * 加载文档并写入向量数据库。
   */
  async loadDocuments(
    documents: { id: string; content: string; source?: string }[],
  ) {
    const allDocs: Document[] = [];
    // 将文档分割成块
    for (const doc of documents) {
      const chunks = await this.splitter.createDocuments(
        [doc.content],
        [{ source: doc.source || doc.id, docId: doc.id }],
      );
      allDocs.push(...chunks);
    }
    // 将块和向量存储到向量数据库 
    await this.vectorStoreService.addDocuments(allDocs);

    this.docCount += documents.length;
    return {
      originalDocs: documents.length,
      totalChunks: allDocs.length,
      message: `已存入 ${documents.length} 篇文档（${allDocs.length} 个块）到向量数据库`,
    };
  }

  /**
   * 查询向量数据库。
   */
  async queryVectorStore(query: string, topK = 4) {
    return this.vectorStoreService.similaritySearch(query, topK);
  }

  /**
   * RAG问答
   *
   */
  async query(question: string, topK = 3) {
    // 向量数据库查询：相似度搜索，返回相似度最高的topK个结果
    const retrieved: [Document, number][] = await this.vectorStoreService.similaritySearchWithScore(
      question,
      topK,
    );

    // score 是距离，越小越相关
    // 滤除距离 > 0.5 的结果只要相似度大于0.5的,距离越远相似度越低,越不相关
    const filtered: [Document, number][] = retrieved.filter(([, score]) => score <= 0.5);

    if (!filtered.length) {
      return { question, answer: '知识库中没有找到相关内容!', sources: [] };
    }
    // 构建上下文
    const context: string = filtered
    // 给每条检索到的文档块前面加一个序号标签 [序号]
      .map(([doc], i) => `[${i + 1}] ${doc.pageContent}`)
      .join('\n\n');

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `你是知识库问答助手，严格基于知识库回答。
        规则：
        1. 只根据参考资料内容回答，不能使用资料外的知识
        2. 资料中没有相关信息，回答"知识库中暂无相关内容"
        3. 回答简洁准确，使用中文
        参考资料(RAG检索结果)：
        {context}`,
      ],
      ['human', '{question}'],
    ]);

    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    const answer = await chain.invoke({ context, question });

    return {
      question,
      answer,
      sources: filtered.map(([doc, score]) => ({
        content: doc.pageContent,
        source: doc.metadata.source,
        similarity: parseFloat((1 - score).toFixed(4)),
      })),
    };
  }
}
