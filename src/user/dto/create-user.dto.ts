// src/user/dto/create-user.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: '用户名', example: '张三' })
  name: string;

  @ApiProperty({ description: '邮箱', example: 'test@example.com' })
  email: string;

  @ApiProperty({ description: '密码', example: '123456' })
  password: string;

  @ApiPropertyOptional({ description: '角色', example: 'user', default: 'user' })
  role?: string;
}
