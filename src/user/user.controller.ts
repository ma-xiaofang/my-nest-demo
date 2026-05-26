// src/user/user.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';

@ApiTags('用户管理')
@Controller('user')
export class UserController {
  @Inject()
  private readonly userService: UserService;

  @Post('create')
  @ApiOperation({ summary: '创建用户' })
  @ApiResponse({
    status: 201,
    description: '创建成功',
    example: {
      id: 1,
      email: 'test@example.com',
      name: '张三',
      role: 'user',
      createdAt: '2026-05-25T10:00:00.000Z',
      updatedAt: '2026-05-25T10:00:00.000Z',
    },
  })
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Get('list')
  @ApiOperation({ summary: '查询用户列表（分页+筛选）' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    example: {
      data: [
        {
          id: 1,
          email: 'test@example.com',
          name: '张三',
          role: 'user',
          createdAt: '2026-05-25T10:00:00.000Z',
          updatedAt: '2026-05-25T10:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    },
  })
  findAll(
    @Query() query: QueryUserDto,
  ) {
    return this.userService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询单个用户' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    example: {
      id: 1,
      email: 'test@example.com',
      name: '张三',
      password: '******',
      role: 'user',
      createdAt: '2026-05-25T10:00:00.000Z',
      updatedAt: '2026-05-25T10:00:00.000Z',
      posts: [],
      chatSessions: [],
    },
  })
  @ApiResponse({ status: 404, description: '用户不存在' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新用户' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({
    status: 200,
    description: '更新成功',
    example: {
      id: 1,
      email: 'new@example.com',
      name: '李四',
      role: 'admin',
      createdAt: '2026-05-25T10:00:00.000Z',
      updatedAt: '2026-05-25T12:00:00.000Z',
    },
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除用户' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({ status: 200, description: '删除成功', example: { id: 1 } })
  @ApiResponse({ status: 404, description: '用户不存在' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }
}
