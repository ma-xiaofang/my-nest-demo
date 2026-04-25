import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const createOrderTool = tool(
  async ({
    productName,
    quantity,
    customerName,
  }: {
    productName: string;
    quantity: number;
    customerName: string;
  }) => {
    console.log(`[工具执行] create_order → ${customerName} 购买 ${productName} x${quantity}`);

    const prices: Record<string, number> = {
      'iPhone 16': 7999,
      'iPhone 16 Pro': 9999,
      'MacBook Pro': 15999,
      'AirPods Pro': 1799,
      'iPad Air': 4799,
    };

    const unitPrice = prices[productName] ?? 0;
    const totalPrice = unitPrice * quantity;
    // 生成简短订单号，便于演示
    const orderId = `ORD-${Date.now().toString().slice(-6)}`;

    return `订单创建成功！订单号：${orderId}，客户：${customerName}，商品：${productName} x${quantity}，单价 ¥${unitPrice}，总价 ¥${totalPrice}。请在 30 分钟内完成支付。`;
  },
  {
    name: 'create_order',
    description:
      '为客户创建购买订单。需要知道商品名称、购买数量、客户姓名才能下单。用户说"我要买XX"、"帮我下单"时调用。',
    schema: z.object({
      productName: z.string().describe('商品名称'),
      quantity: z.number().describe('购买数量，默认为 1'),
      customerName: z.string().describe('客户姓名'),
    }),
  },
);
