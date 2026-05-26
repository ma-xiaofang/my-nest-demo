import { ApiProperty } from '@nestjs/swagger';

export class AiCustomerServiceDto {
  @ApiProperty({ example: '我想退货', description: '用户消息' })
  userMessage: string;
}
