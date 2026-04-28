import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { PgvectorService } from './pgvector.service.js';
import { ChromaService } from './chroma.service.js';
import { VECTOR_STORE_SERVICE } from './vector-store.interface.js';

@Module({
  providers: [
    RagService,
    PgvectorService,
    ChromaService,
    {
      provide: VECTOR_STORE_SERVICE,
      inject: [ConfigService, PgvectorService, ChromaService],
      useFactory: (
        configService: ConfigService,
        pgvectorService: PgvectorService,
        chromaService: ChromaService,
      ) => {
        const provider = (configService.get('RAG_VECTOR_STORE') ?? 'pgvector')
          .toString()
          .toLowerCase();
        return provider === 'chroma' ? chromaService : pgvectorService;
      },
    },
  ],
  controllers: [RagController],
})
export class RagModule {}
