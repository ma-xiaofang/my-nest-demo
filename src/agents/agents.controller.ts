import { Controller, Post, Body } from '@nestjs/common';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}
  @Post('ai-customer-service')
  async runAgent(@Body() body: { userMessage: string }) {
    return this.agentsService.runAgent(body.userMessage);
  }
}
