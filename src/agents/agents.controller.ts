import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AgentsService } from './agents.service';

@ApiTags('AI Agent')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('ai-customer-service')
  @ApiOperation({ summary: 'AI 客服 Agent' })
  async runAgent(@Body() body: { userMessage: string }) {
    return this.agentsService.runAgent(body.userMessage);
  }
}
