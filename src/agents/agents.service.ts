import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';
import {
    HumanMessage,
    AIMessage,
    ToolMessage,
    SystemMessage,
    BaseMessage,
} from '@langchain/core/messages';
import { allAgentTools, agentToolMap } from './tools';
@Injectable()
export class AgentsService {
    constructor(private readonly config: ConfigService) {
        this.llm = new ChatOpenAI({
            model: 'deepseek-v4-flash',
            apiKey: this.config.get('DEEPSEEK_API_KEY'),
            configuration: { baseURL: 'https://api.deepseek.com/v1' },
        });
    }

    private llm: ChatOpenAI;

    /**
     * 运行 Agent
     * @param userMessage 用户消息
     * @returns 运行结果
     */
    async runAgent(userMessage: string) {
        const tools = allAgentTools;
        const toolMap: Record<string, any> = agentToolMap;
        // bindTools：把工具列表注册到模型
        // 注册后模型回复里会包含 tool_calls 字段（当它决定调用工具时）
        const llmWithTools = this.llm.bindTools(tools);
        // 消息历史数组：Agent 每一轮都能看到完整的对话 + 工具结果
        const messages: BaseMessage[] = [
            // System 消息：设定客服角色和行为规范
            new SystemMessage(
                `你是「极速购」电商平台的 AI 智能客服助手。
        你可以使用以下工具帮助客户：
         - check_product：查询商品库存和价格
         - create_order：为客户创建订单
         - check_order：查询订单状态
         - apply_refund：申请退款
        工作原则：
         1. 先用工具获取真实信息，再给客户答复
         2. 下单前必须先查询库存确认有货
         3.下单需要知道客户姓名，如果用户没说，主动询问
         4. 回答简洁友好，使用中文`,
            ),
            new HumanMessage(userMessage),
        ];
        // 记录每步执行过程（用于前端展示 / 演示）
        const steps: string[] = [];
        let roundCount = 0; // 回合计数器：每轮对话+工具调用算一轮

        // ── Agent 循环 ──────────────────────────────────────
        // 每一轮：模型看消息历史 → 决定调用工具还是直接回答
        // 直到模型不再调用工具为止（最多 6 轮，防止死循环）
        while (roundCount < 6) {
            roundCount++;
            /**
             * 模型生成回复
             * 模型会根据消息历史决定是否调用工具
             * 如果模型决定调用工具，会返回 tool_calls 字段
             * @param messages 消息历史
             * @returns 模型回复
             */
            const response = await llmWithTools.invoke(messages);
            // 把模型回复加入历史
            messages.push(response);

            // tool_calls 为空 → 模型有了最终答案，或者用户的提问不需要工具调用，退出循环
            if (!response.tool_calls || response.tool_calls.length === 0) {
                steps.push(`💬 [最终回答] ${response.content}`);

                break;
            }

            /**
             * 模型决定调用工具，依次执行所有工具调用
             * @param response.tool_calls 工具调用列表, 每个工具调用包含工具名称、参数和ID
             * @returns 执行工具结果
             */
            for (const toolCall of response.tool_calls) {
                // 生成工具调用ID, 用于关联工具结果
                const toolCallId =
                    toolCall.id ?? `${toolCall.name}-${roundCount}-${Date.now()}`;
                steps.push(
                    `🔧 [调用工具] ${toolCall.name}(${JSON.stringify(toolCall.args)})`,
                );
                console.log(`[工具调用] ${toolCall.name}`, toolCall.args);
                // 获取工具函数
                const toolFn = toolMap[toolCall.name];
                // 工具不存在, 提示错误
                if (!toolFn) {
                    const errMsg = `工具「${toolCall.name}」不存在`;
                    steps.push(`❌ [错误] ${errMsg}`);
                    messages.push(
                        new ToolMessage({ content: errMsg, tool_call_id: toolCallId }),
                    );

                    continue;
                }

                // 执行工具，获取结果
                const toolResult = await toolFn.invoke(toolCall.args);
                steps.push(`✅ [工具结果] ${toolResult}`);
                console.log(`[工具结果] ${toolResult}`);

                // 把工具结果加入消息历史
                // 模型下一轮看到结果后，再决定继续调工具还是直接回答
                messages.push(
                    new ToolMessage({
                        content: String(toolResult),
                        tool_call_id: toolCallId,
                    }),
                );
            }
        }

        // 获取最终回答（最后一条 AIMessage 的内容）
        const finalAnswer = [...messages].reverse().find((msg) => msg instanceof AIMessage);
        return {
            userMessage,
            steps,
            totalRounds: roundCount,
            answer: finalAnswer?.content ?? '抱歉，暂时无法处理您的请求'
        };
    }
}
