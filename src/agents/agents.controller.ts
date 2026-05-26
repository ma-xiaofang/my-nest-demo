import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { AiCustomerServiceDto } from './dto';

@ApiTags('AI Agent')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('ai-customer-service')
  @ApiOperation({ summary: 'AI 客服 Agent' })
  @ApiResponse({
    status: 200,
    description: 'AI 客服回复',
    example: {
      output: '您好！我是AI客服助手，请问有什么可以帮您？',
    },
  })
  async runAgent(@Body() body: AiCustomerServiceDto) {
    return this.agentsService.runAgent(body.userMessage);
  }
}
