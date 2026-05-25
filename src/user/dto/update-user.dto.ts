// src/user/dto/update-user.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: '用户名', example: '李四' })
  name?: string;

  @ApiPropertyOptional({ description: '邮箱', example: 'new@example.com' })
  email?: string;

  @ApiPropertyOptional({ description: '密码', example: '654321' })
  password?: string;

  @ApiPropertyOptional({ description: '角色', example: 'admin' })
  role?: string;
}
