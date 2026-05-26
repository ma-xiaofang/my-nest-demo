import { ApiProperty } from '@nestjs/swagger';

export class TranslateAssistantDto {
  @ApiProperty({ example: '你好世界', description: '要翻译的文本' })
  text: string;

  @ApiProperty({ example: 'en', description: '目标语言代码（en/zh/ja等）' })
  target_language: string;
}

export class CodeReviewAssistantDto {
  @ApiProperty({
    example: 'function add(a, b) { return a + b; }',
    description: '需要审查的代码',
  })
  codeStr: string;

  @ApiProperty({ example: 'javascript', description: '编程语言' })
  language: string;
}
