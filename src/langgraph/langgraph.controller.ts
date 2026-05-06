import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { LanggraphService } from './langgraph.service';

@Controller('langgraph')
export class LanggraphController {
    constructor(private readonly langgraphService: LanggraphService) {}
    @Post('simple-chat')
    async simpleChat(@Body() body: { message: string }) {
        const answer = await this.langgraphService.simpleChat(body.message)
        return { answer }
    }
    @Post('memory-chat')
    async memoryChat(@Body() body: { threadId: string, message: string }) {
        const answer = await this.langgraphService.memoryChat(body.threadId, body.message)
        return { answer }
    }
    @Get('get-history')
    async getHistory(@Query('threadId') threadId: string) {
        const history = await this.langgraphService.getHistory(threadId)
        return { history }
    }
}
