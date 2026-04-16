// src/user/dto/create-user.dto.ts
export class CreateUserDto {
    name: string // 用户名
    email: string // 邮箱
    password: string // 密码
    role?: string // 角色
  }