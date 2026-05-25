// src/user/dto/query-user.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';

// 分页查询的请求参数结构
// 对应接口：GET /user/list?page=1&pageSize=10&name=大伟&role=admin
export class QueryUserDto {
  @ApiPropertyOptional({ description: '当前页码，默认1', example: '1' })
  page?: string;

  @ApiPropertyOptional({ description: '每页条数，默认10', example: '10' })
  pageSize?: string;

  @ApiPropertyOptional({ description: '按用户名模糊搜索', example: '大伟' })
  name?: string;

  @ApiPropertyOptional({ description: '按角色过滤', example: 'admin' })
  role?: string;
}
