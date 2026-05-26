import { ApiProperty } from '@nestjs/swagger';

export class SimpleChatDto {
  @ApiProperty({ example: '你好', description: '消息内容' })
  message: string;
}

export class MemoryChatDto {
  @ApiProperty({ example: 'thread-001', description: '线程ID' })
  threadId: string;

  @ApiProperty({ example: '你还记得我们聊过什么吗？', description: '消息内容' })
  message: string;
}
