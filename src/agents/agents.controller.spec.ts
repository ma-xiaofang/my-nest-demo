import { Test, TestingModule } from '@nestjs/testing';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

describe('AgentsController', () => {
  let controller: AgentsController;
  let agentsService: jest.Mocked<AgentsService>;

  const mockResult = {
    userMessage: '测试消息',
    steps: ['💬 [最终回答] 您好，有什么可以帮助您的？'],
    totalRounds: 1,
    answer: '您好，有什么可以帮助您的？',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentsController],
      providers: [
        {
          provide: AgentsService,
          useValue: {
            runAgent: jest.fn().mockResolvedValue(mockResult),
          },
        },
      ],
    }).compile();

    controller = module.get<AgentsController>(AgentsController);
    agentsService = module.get(AgentsService);
  });

  it('应该被定义', () => {
    expect(controller).toBeDefined();
  });

  describe('POST ai-customer-service', () => {
    it('应该调用 AgentsService.runAgent 并返回结果', async () => {
      const body = { userMessage: '我想查询订单' };
      const result = await controller.runAgent(body);

      expect(agentsService.runAgent).toHaveBeenCalledWith('我想查询订单');
      expect(result).toEqual(mockResult);
    });

    it('应该处理空消息', async () => {
      const body = { userMessage: '' };
      agentsService.runAgent.mockResolvedValue({
        userMessage: '',
        steps: ['💬 [最终回答] 您好，请描述您的问题'],
        totalRounds: 1,
        answer: '您好，请描述您的问题',
      });

      const result = await controller.runAgent(body);

      expect(agentsService.runAgent).toHaveBeenCalledWith('');
      expect(result.answer).toBe('您好，请描述您的问题');
    });

    it('应该处理服务抛出的异常', async () => {
      agentsService.runAgent.mockRejectedValue(new Error('API 调用失败'));

      await expect(controller.runAgent({ userMessage: 'hi' })).rejects.toThrow(
        'API 调用失败',
      );
    });

    it('应该传递不同的用户消息', async () => {
      const messages = ['查询库存', '我要退款', '帮我下单'];
      for (const msg of messages) {
        agentsService.runAgent.mockReset();
        agentsService.runAgent.mockResolvedValue({
          userMessage: msg,
          steps: [],
          totalRounds: 1,
          answer: `收到: ${msg}`,
        });

        const result = await controller.runAgent({ userMessage: msg });

        expect(agentsService.runAgent).toHaveBeenCalledWith(msg);
        expect(result.userMessage).toBe(msg);
      }
    });
  });
});
