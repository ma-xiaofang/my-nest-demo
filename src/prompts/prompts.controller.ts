import { Body, Controller, Post } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PromptsService } from './prompts.service';

@Controller('prompts')
export class PromptsController {
    @Inject(PromptsService)
    private readonly promptsService: PromptsService;
    // 翻译助手
    @Post('translate-assistant')
    translateAssistant(@Body() body: {text: string, target_language: string}) {
        return this.promptsService.translateAssistant(body.text, body.target_language);
    }
    // 代码审查助手
    @Post('code-review-assistant')
    codeReviewAssistant(@Body() body: {codeStr: string, language: string}) {
        return this.promptsService.codeReviewAssistant(body.codeStr, body.language);
    }
}
