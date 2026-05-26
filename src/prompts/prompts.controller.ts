import { Body, Controller, Post, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PromptsService } from './prompts.service';
import { TranslateAssistantDto, CodeReviewAssistantDto } from './dto';

@ApiTags('Prompt 模板')
@Controller('prompts')
export class PromptsController {
  @Inject(PromptsService)
  private readonly promptsService: PromptsService;

  @Post('translate-assistant')
  @ApiOperation({ summary: '翻译助手' })
  @ApiResponse({
    status: 200,
    description: '翻译结果',
    example: {
      translation: 'Hello, World!',
    },
  })
  translateAssistant(@Body() body: TranslateAssistantDto) {
    return this.promptsService.translateAssistant(
      body.text,
      body.target_language,
    );
  }

  @Post('code-review-assistant')
  @ApiOperation({ summary: '代码审查助手' })
  @ApiResponse({
    status: 200,
    description: '代码审查结果',
    example: {
      review: '代码整体结构清晰，建议：1. 添加错误处理 2. 变量命名更具描述性',
    },
  })
  codeReviewAssistant(@Body() body: CodeReviewAssistantDto) {
    return this.promptsService.codeReviewAssistant(body.codeStr, body.language);
  }
}
