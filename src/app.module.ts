import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { LlmModule } from './llm/llm.module';
import { ModelModule } from './model/model.module';
import { PromptsModule } from './prompts/prompts.module';
import { ChainsModule } from './chains/chains.module';
import { AgentsModule } from './agents/agents.module';

/**
 * 应用根模块：注册根控制器与根服务。
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, UserModule, LlmModule, ModelModule, PromptsModule, ChainsModule, AgentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
