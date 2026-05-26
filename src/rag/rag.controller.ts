import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RagService } from './rag.service';
import { LoadDocumentsDto, QueryDto } from './dto';

@ApiTags('RAG 检索增强')
@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('load')
  @ApiOperation({ summary: '加载文档到向量库' })
  @ApiResponse({
    status: 200,
    description: '文档加载结果',
    example: {
      message: '成功加载 3 个文档',
      count: 3,
    },
  })
  loadDocuments(@Body() body: LoadDocumentsDto) {
    return this.ragService.loadDocuments(body.documents);
  }

  @Post('query')
  @ApiOperation({ summary: 'RAG 问答查询' })
  @ApiResponse({
    status: 200,
    description: 'RAG 查询结果',
    example: {
      question: '什么是 NestJS？',
      answer: 'NestJS 是一个用于构建高效、可扩展的 Node.js 服务端应用的框架...',
      sources: [
        { id: 'doc-1', content: 'NestJS 是一个...', source: 'nestjs-intro.md', score: 0.92 },
      ],
    },
  })
  query(@Body() body: QueryDto) {
    return this.ragService.query(body.question, body.topK);
  }
}
