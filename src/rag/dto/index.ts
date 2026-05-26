import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DocumentItem {
  @ApiProperty({ example: 'doc-001' })
  id: string;

  @ApiProperty({ example: 'NestJS 是一个渐进式的 Node.js 框架...' })
  content: string;

  @ApiPropertyOptional({ example: 'nestjs-docs.md' })
  source?: string;
}

export class LoadDocumentsDto {
  @ApiProperty({ type: [DocumentItem], description: '文档列表' })
  documents: DocumentItem[];
}

export class QueryDto {
  @ApiProperty({ example: '什么是 NestJS？', description: '查询问题' })
  question: string;

  @ApiPropertyOptional({ example: 3, description: '返回结果数量上限' })
  topK?: number;
}
