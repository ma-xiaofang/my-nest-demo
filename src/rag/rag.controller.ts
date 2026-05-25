import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RagService } from './rag.service';

@ApiTags('RAG 检索增强')
@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('load')
  @ApiOperation({ summary: '加载文档到向量库' })
  loadDocuments(
    @Body()
    body: {
      documents: { id: string; content: string; source?: string }[];
    },
  ) {
    return this.ragService.loadDocuments(body.documents);
  }

  @Post('query')
  @ApiOperation({ summary: 'RAG 问答查询' })
  query(@Body() body: { question: string; topK?: number }) {
    return this.ragService.query(body.question, body.topK);
  }
}
