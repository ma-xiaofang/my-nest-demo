import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const applyRefundTool = tool(
  async ({ orderId, reason }: { orderId: string; reason: string }) => {
    console.log(`[工具执行] apply_refund → 订单 ${orderId}，原因：${reason}`);

    const refundId = `REF-${Date.now().toString().slice(-6)}`;
    return `退款申请已提交！退款单号：${refundId}，订单：${orderId}，退款原因：${reason}。预计 1-3 个工作日内退回原支付渠道，请注意查收。`;
  },
  {
    name: 'apply_refund',
    description:
      '为客户申请订单退款。用户说"我要退款"、"申请退货"、"不想要了"时调用。需要订单号和退款原因。',
    schema: z.object({
      orderId: z.string().describe('需要退款的订单号'),
      reason: z.string().describe('退款原因，例如：质量问题、不喜欢、买错了'),
    }),
  },
);
