import { Injectable, OnModuleInit } from '@nestjs/common';
import {
    PGVectorStore,
    DistanceStrategy,
} from '@langchain/community/vectorstores/pgvector';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { Pool } from 'pg';

@Injectable()
export class RagService {
    private llm: ChatOpenAI;
    private embeddings: OpenAIEmbeddings;
    private pool: Pool;
    private pgVectorConfig: {
        pool: Pool;
        collectionName: string;
        collectionTableName: string;
        tableName: string;
        columns: {
            idColumnName: string;
            vectorColumnName: string;
            contentColumnName: string;
            metadataColumnName: string;
        };
        distanceStrategy: DistanceStrategy;
    };
    constructor(private readonly config: ConfigService) {
        this.llm = new ChatOpenAI({
            model: 'deepseek-v4-flash',
            modelKwargs: { thinking: { type: 'disabled' } },
            apiKey: this.config.get('DEEPSEEK_API_KEY'),
            configuration: { baseURL: 'https://api.deepseek.com/v1' },
        });
        this.embeddings = new OpenAIEmbeddings({
            model: 'embedding-3',
            apiKey: this.config.get('GLM_API_KEY'),
            configuration: {
                baseURL: 'https://open.bigmodel.cn/api/paas/v4/embeddings',
            },
        });
        this.pool = new Pool({
            connectionString: this.config.get('DATABASE_URL'),
        });
        this.pgVectorConfig = {
            pool: this.pool,
            collectionName: 'rag-knowledge-base',
            collectionTableName: 'langchain_pg_collection',
            tableName: 'langchain_pg_embedding',
            columns: {
                idColumnName: 'id',
                vectorColumnName: 'embedding',
                contentColumnName: 'document',
                metadataColumnName: 'cmetadata',
            },
            distanceStrategy: 'cosine' as DistanceStrategy,
        };
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
        // 将块和向量存储到 PostgreSQL
        await PGVectorStore.fromDocuments(
            allDocs,
            this.embeddings,
            this.pgVectorConfig,
        );

        this.docCount += documents.length;
        return {
            success: true,
            originalDocs: documents.length,
            totalChunks: allDocs.length,
            message: `已存入 ${documents.length} 篇文档（${allDocs.length} 个块）到 PostgreSQL`,
        };
    }
}
