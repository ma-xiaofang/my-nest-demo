import { Inject, Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';
import { ChatPromptTemplate } from '@langchain/core/prompts';

/**
 * 多种提示词模板练习
 */
@Injectable()
export class PromptsService {
    constructor(
        private readonly configService: ConfigService,
    ) {
        this.llm = new ChatOpenAI({
            model: 'deepseek-chat', 
            apiKey: this.configService.get('DEEPSEEK_API_KEY'),
            configuration: { baseURL:'https://api.deepseek.com/v1'}
        })
    }
    private readonly llm: ChatOpenAI;
    /**
     * 多消息模板,翻译助手
     */
    async translateAssistant(text: string, target_language: string) {
        const prompt = ChatPromptTemplate.fromMessages([
            ['system', [
                '你是一个翻译助手，你的任务是将用户的{input}翻译成{target_language},要点入下：',
                '1.务必遵循 信达雅原则;',
                '2.确保翻译内容准确无误;',
                '3.使用简洁明了的语言表达;',
                '4.使用专业术语和行话;',
                '5.确保翻译内容符合目标语言的文化和习俗;',
            ].join(' ')],
            ['human', '{input}']
        ]);
        // 构建链
        const chain = prompt.pipe(this.llm);
        // 运行链
        const result = await chain.invoke({ input: text, target_language: target_language });
        console.log(result);
        return result;
    }
    
     /**
      * 代码审查助手
      */
     async codeReviewAssistant(codeStr: string, language: string) {
        const prompt = ChatPromptTemplate.fromMessages([
            ['system',`你是一个专业的{language}代码审查者，你的任务是审查用户的{codeStr},要点如下：
                1.检查代码是否符合语法规范;
                2.检查代码是否符合功能需求;
                4.检查代码是否符合安全要求;
                5.检查代码是否符合可维护性要求;
                6.提出代码整改或优化建议;
            `
            ],
            ['human', '{codeStr}']
        ]);
        // 构建链
        const chain = prompt.pipe(this.llm);
        // 运行链
        const result = await chain.invoke({ codeStr: codeStr, language: language });
        console.log(result);
        return result;
    }


}
