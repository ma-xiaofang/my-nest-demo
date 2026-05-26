import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatBodyDto {
  @ApiProperty({ example: '你好，请帮我写一段代码', description: '用户消息内容' })
  message: string;

  @ApiPropertyOptional({ example: 'session-abc', description: '会话ID（可选）' })
  sessionId?: string;
}
