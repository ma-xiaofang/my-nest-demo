import { Document } from '@langchain/core/documents';

export const VECTOR_STORE_SERVICE = 'VECTOR_STORE_SERVICE';

/**
 * 向量库服务抽象：用于屏蔽具体实现（PGVector / Chroma）。
 */
export interface VectorStoreService {
  addDocuments(documents: Document[]): Promise<void>;
  similaritySearch(query: string, topK?: number): Promise<Document[]>;
  similaritySearchWithScore(
    query: string,
    topK?: number,
  ): Promise<[Document, number][]>;
}
