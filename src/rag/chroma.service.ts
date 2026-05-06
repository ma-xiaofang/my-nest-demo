import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { ZhipuAIEmbeddings } from '@langchain/community/embeddings/zhipuai';
import { Document } from '@langchain/core/documents';
import { VectorStoreService } from './vector-store.interface.js';

@Injectable()
export class ChromaService implements VectorStoreService {
  private readonly embeddings: ZhipuAIEmbeddings;
  private readonly chromaConfig: {
    url: string;
    collectionName: string;
  };
  private vectorStore: Chroma | null = null;
  private vectorStoreInitPromise: Promise<Chroma> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.embeddings = new ZhipuAIEmbeddings({
      apiKey: this.configService.get('GLM_API_KEY'),
      modelName: 'embedding-3',
    });
    this.chromaConfig = {
      url: this.configService.get('CHROMA_URL') ?? 'http://127.0.0.1:8000',
      collectionName:
        this.configService.get('CHROMA_COLLECTION') ?? 'rag-knowledge-base',
    };
  }

  /**
   * 写入文档块到 Chroma 向量库。
   */
  async addDocuments(documents: Document[]): Promise<void> {
    const vectorStore = await this.getVectorStore();
    await vectorStore.addDocuments(documents);
  }

  /**
   * 在 Chroma 中执行相似度检索。
   */
  async similaritySearch(query: string, topK = 4): Promise<Document[]> {
    const vectorStore = await this.getVectorStore();
    return vectorStore.similaritySearch(query, topK);
  }

  /**
   * 在 Chroma 中执行带分数的相似度检索（分数越小越相似）。
   */
  async similaritySearchWithScore(
    query: string,
    topK = 4,
  ): Promise<[Document, number][]> {
    const vectorStore = await this.getVectorStore();
    return vectorStore.similaritySearchWithScore(query, topK);
  }

  /**
   * 惰性初始化 Chroma 实例，避免重复初始化。
   */
  private async getVectorStore(): Promise<Chroma> {
    if (this.vectorStore) {
      return this.vectorStore;
    }
    if (this.vectorStoreInitPromise) {
      return this.vectorStoreInitPromise;
    }

    this.vectorStoreInitPromise = this.initializeVectorStore();
    try {
      this.vectorStore = await this.vectorStoreInitPromise;
      return this.vectorStore;
    } finally {
      this.vectorStoreInitPromise = null;
    }
  }

  /**
   * 初始化 Chroma 连接与集合。
   */
  private async initializeVectorStore(): Promise<Chroma> {
    return Chroma.fromExistingCollection(this.embeddings, this.chromaConfig);
  }
}
