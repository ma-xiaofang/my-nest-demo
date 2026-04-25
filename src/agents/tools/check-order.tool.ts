import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const checkOrderTool = tool(
  async ({ orderId }: { orderId: string }) => {
    console.log(`[工具执行] check_order → 查询订单：${orderId}`);

    // 模拟订单状态（实际项目查数据库）
    const statuses = ['待支付', '已支付待发货', '已发货运输中', '已签收'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const extra = status === '已发货运输中' ? '，预计明天送达' : '';

    return `订单 ${orderId} 当前状态：${status}${extra}。`;
  },
  {
    name: 'check_order',
    description: '查询订单的当前状态。用户说"我的订单"、"订单到哪了"、"查一下订单 ORD-XXX"时调用。',
    schema: z.object({
      orderId: z.string().describe('订单号，格式为 ORD-XXXXXX'),
    }),
  },
);
