import { Body, Controller, Post, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PromptsService } from './prompts.service';

@ApiTags('Prompt 模板')
@Controller('prompts')
export class PromptsController {
  @Inject(PromptsService)
  private readonly promptsService: PromptsService;

  @Post('translate-assistant')
  @ApiOperation({ summary: '翻译助手' })
  translateAssistant(@Body() body: { text: string; target_language: string }) {
    return this.promptsService.translateAssistant(
      body.text,
      body.target_language,
    );
  }

  @Post('code-review-assistant')
  @ApiOperation({ summary: '代码审查助手' })
  codeReviewAssistant(@Body() body: { codeStr: string; language: string }) {
    return this.promptsService.codeReviewAssistant(body.codeStr, body.language);
  }
}
