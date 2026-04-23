// src/models/models.service.ts

import { Injectable } from '@nestjs/common'
import { Response } from 'express'
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ModelService {
  constructor(
    private readonly configService: ConfigService,
    private readonly llm: ChatOpenAI
  ) {
    this.llm = new ChatOpenAI({
      model: 'deepseek-chat', 
      apiKey: this.configService.get('DEEPSEEK_API_KEY'),
      configuration: { baseURL:'https://api.deepseek.com/v1'},
      temperature: 0.3,
    })
  }

  // ── 方式一：基础调用（等待完整回答后返回）──────────────
  // 适合：简单问答、不需要流式输出的场景
  async basicChat(message: string) {
    // invoke 接收消息数组，返回 AIMessage 对象
    // HumanMessage 对应 role: "user"
    const response = await this.llm.invoke([
      new HumanMessage(message),
    ])

    // response.content 是模型返回的文字内容
    return {
      question: message,
      answer: response.content,
      // usage 包含 token 消耗信息（qwen3.5:0.8b 支持）
      usage: response.usage_metadata,
    }
  }

  // ── 方式二：带 System Prompt 的调用 ────────────────────
  // System Prompt 用于设定模型的角色和行为规范
  async chatWithSystem(system: string, message: string) {
    const response = await this.llm.invoke([
      // SystemMessage 最先传入，设定角色
      new SystemMessage(system),
      // HumanMessage 是用户的实际问题
      new HumanMessage(message),
    ])

    return {
      system,
      question: message,
      answer: response.content,
    }
  }

  // ── 方式三：SSE 流式输出 ────────────────────────────────
  // 适合：需要逐字显示的对话场景（类似 ChatGPT 打字效果）
  // res 是 Express 的 Response 对象，用于向客户端推送数据
  async streamChat(message: string, res: Response) {
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')

    // stream 方法返回 AsyncGenerator，每次产出一个 chunk
    const stream = await this.llm.stream([
      new HumanMessage(message),
    ])

    // 逐个 chunk 推送给客户端
    for await (const chunk of stream) {
      // chunk.content 是这个片段的文字内容
      if (chunk.content) {
        // SSE 格式：data: 内容\n\n
        res.write(`data: ${JSON.stringify({ text: chunk.content })}\n\n`)
      }
    }

    // 发送结束标记
    res.write('data: [DONE]\n\n')
    res.end()
  }

  // ── 方式四：使用 pipe 链式调用 ─────────────────────────
  // StringOutputParser 把 AIMessage 对象转成纯字符串
  async chatWithParser(message: string) {
    // pipe 是 LangChain 的管道操作符
    // llm → StringOutputParser 构成一个简单的链
    const chain = this.llm.pipe(new StringOutputParser())

    // invoke 返回的是字符串，不是 AIMessage 对象
    const answer = await chain.invoke([
      new HumanMessage(message),
    ])

    return { question: message, answer }
  }
}