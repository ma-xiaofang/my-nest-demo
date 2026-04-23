import { Inject, Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';
/**
 * 多种提示词模板练习
 */
@Injectable()
export class PromptsService {
    @Inject()
    private readonly configService: ConfigService;
    constructor(
        private readonly llm: ChatOpenAI
    ) {
        this.llm = new ChatOpenAI({
            model: 'deepseek-chat', 
            apiKey: this.configService.get('DEEPSEEK_API_KEY'),
            configuration: { baseURL:'https://api.deepseek.com/v1'}
        })
    }
    


}
