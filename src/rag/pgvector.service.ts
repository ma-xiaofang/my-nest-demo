import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DistanceStrategy,
  PGVectorStore,
} from '@langchain/community/vectorstores/pgvector';
import { ZhipuAIEmbeddings } from '@langchain/community/embeddings/zhipuai';
import { Document } from '@langchain/core/documents';
import { Pool } from 'pg';
import { VectorStoreService } from './vector-store.interface.js';

/**
 * 向量数据库访问服务：负责 Embedding、连接池与 PGVectorStore 管理。
 */
@Injectable()
export class PgvectorService implements VectorStoreService {
  private static readonly COLLECTION_NAME = 'rag-knowledge-base';
  private static readonly COLLECTION_TABLE = 'langchain_pg_collection';
  private static readonly EMBEDDING_TABLE = 'langchain_pg_embedding';

  private readonly pool: Pool;
  private readonly embeddings: ZhipuAIEmbeddings;
  private vectorStore: PGVectorStore | null = null;
  private vectorStoreInitPromise: Promise<PGVectorStore> | null = null;
  private readonly pgVectorConfig;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      connectionString: this.configService.get('DATABASE_URL'),
    });
    this.embeddings = new ZhipuAIEmbeddings({
      apiKey: this.configService.get('GLM_API_KEY'),
      modelName: 'embedding-3',
    });
    this.pgVectorConfig = {
      pool: this.pool,
      // 指定集合名，确保写入 embedding 时能关联 collection_id
      collectionName: PgvectorService.COLLECTION_NAME,
      collectionTableName: PgvectorService.COLLECTION_TABLE,
      tableName: PgvectorService.EMBEDDING_TABLE,
      // 跳过库内初始化检查（该逻辑对非英文错误信息兼容性差）
      skipInitializationCheck: true,
      columns: {
        idColumnName: 'id',
        vectorColumnName: 'embedding',
        contentColumnName: 'document',
        metadataColumnName: 'cmetadata',
      },
      distanceStrategy: 'cosine' as DistanceStrategy,
    };
  }

  /**
   * 写入文档块到向量数据库。
   */
  async addDocuments(documents: Document[]): Promise<void> {
    const vectorStore = await this.getVectorStore();
    await vectorStore.addDocuments(documents);
  }

  /**
   * 在向量库中执行相似度检索。
   */
  async similaritySearch(query: string, topK = 4): Promise<Document[]> {
    const vectorStore = await this.getVectorStore();
    return vectorStore.similaritySearch(query, topK);
  }

  /**
   * 在向量库中执行带分数的相似度检索（分数越小越相似）。
   */
  async similaritySearchWithScore(
    query: string,
    topK = 4,
  ): Promise<[Document, number][]> {
    const vectorStore = await this.getVectorStore();
    return vectorStore.similaritySearchWithScore(query, topK);
  }

  /**
   * 惰性初始化向量库实例，避免重复初始化。
   */
  private async getVectorStore(): Promise<PGVectorStore> {
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
   * 初始化向量库；对重复列冲突做一次幂等重试，避免并发初始化失败。
   */
  private async initializeVectorStore(): Promise<PGVectorStore> {
    await this.ensureCollectionSchemaReady();
    try {
      return await PGVectorStore.initialize(this.embeddings, this.pgVectorConfig);
    } catch (error: unknown) {
      const duplicateColumnErrorCode = '42701';
      if (
        this.isPgError(error) &&
        error.code === duplicateColumnErrorCode &&
        error.message.includes('collection_id')
      ) {
        return PGVectorStore.initialize(this.embeddings, this.pgVectorConfig);
      }
      throw error;
    }
  }

  /**
   * 手动幂等初始化集合相关结构，绕开库内部对错误文案的语言依赖。
   */
  private async ensureCollectionSchemaReady(): Promise<void> {
    const collectionTable = PgvectorService.COLLECTION_TABLE;
    const embeddingTable = PgvectorService.EMBEDDING_TABLE;
    const collectionName = PgvectorService.COLLECTION_NAME;
    const foreignKeyName = `${embeddingTable}_collection_id_fkey`;

    await this.pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${collectionTable} (
        uuid uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        name character varying,
        cmetadata jsonb
      );
    `);
    await this.pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_${collectionTable}_name
      ON ${collectionTable}(name);
    `);
    await this.pool.query(`
      ALTER TABLE ${embeddingTable}
      ADD COLUMN IF NOT EXISTS collection_id uuid;
    `);
    await this.pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = '${foreignKeyName}'
        ) THEN
          ALTER TABLE ${embeddingTable}
          ADD CONSTRAINT ${foreignKeyName}
          FOREIGN KEY (collection_id)
          REFERENCES ${collectionTable}(uuid)
          ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);
    await this.pool.query(
      `
      INSERT INTO ${collectionTable}(name, cmetadata)
      VALUES ($1, '{}'::jsonb)
      ON CONFLICT DO NOTHING;
      `,
      [collectionName],
    );
  }

  /**
   * 类型守卫：判断是否为 PostgreSQL 错误对象。
   */
  private isPgError(error: unknown): error is { code?: string; message: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string'
    );
  }
}
