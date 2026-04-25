import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const checkProductTool = tool(
  async ({ productName }: { productName: string }) => {
    // 模拟商品数据库（实际项目注入 PrismaService 查真实数据库）
    const products: Record<string, { price: number; stock: number; category: string }> = {
      'iPhone 16': { price: 7999, stock: 50, category: '手机' },
      'iPhone 16 Pro': { price: 9999, stock: 20, category: '手机' },
      'MacBook Pro': { price: 15999, stock: 8, category: '电脑' },
      'AirPods Pro': { price: 1799, stock: 0, category: '耳机' },
      'iPad Air': { price: 4799, stock: 30, category: '平板' },
    };

    const product = products[productName];

    if (!product) {
      return `商品「${productName}」不存在，请检查商品名称是否正确。`;
    }

    if (product.stock === 0) {
      return `商品「${productName}」当前缺货，预计下周补货。`;
    }

    return `商品「${productName}」有货，单价 ¥${product.price}，库存 ${product.stock} 件，分类：${product.category}。`;
  },
  {
    name: 'check_product',
    description:
      '查询商品是否有货、商品价格和库存数量。用户问"有没有XX"、"XX多少钱"、"XX有货吗"时调用。',
    schema: z.object({
      productName: z.string().describe('商品名称, 如"iPhone 16"、"MacBook Pro"等'),
    }),
  },
);
