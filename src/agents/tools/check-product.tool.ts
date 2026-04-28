import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const checkProductTool = tool(
  async ({ keyword }: { keyword: string }) => {
    // 模拟商品数据库（实际项目注入 PrismaService 查真实数据库）
    const products: Record<
      string,
      { price: number; stock: number; category: string }
    > = {
      'iPhone 16': { price: 7999, stock: 50, category: '手机' },
      'iPhone 16 Pro': { price: 9999, stock: 20, category: '手机' },
      'MacBook Pro': { price: 15999, stock: 8, category: '电脑' },
      'AirPods Pro': { price: 1799, stock: 0, category: '耳机' },
      'iPad Air': { price: 4799, stock: 30, category: '平板' },
    };

    const normalizedKeyword = keyword.trim();
    const product = products[normalizedKeyword];
    const entries = Object.entries(products);

    if (!product) {
      // 模糊商品名匹配（例如输入 "AirPods"）
      const fuzzyByName = entries.filter(([name]) =>
        name.toLowerCase().includes(normalizedKeyword.toLowerCase()),
      );
      if (fuzzyByName.length > 0) {
        const lines = fuzzyByName.map(([name, p]) =>
          p.stock > 0
            ? `- ${name}：有货，¥${p.price}，库存 ${p.stock} 件`
            : `- ${name}：当前缺货，¥${p.price}`,
        );
        return `为你找到以下相关商品：\n${lines.join('\n')}`;
      }

      // 分类匹配（例如输入 "耳机"）
      const matchByCategory = entries.filter(
        ([, p]) => p.category === normalizedKeyword,
      );
      if (matchByCategory.length > 0) {
        const lines = matchByCategory.map(([name, p]) =>
          p.stock > 0
            ? `- ${name}：有货，¥${p.price}，库存 ${p.stock} 件`
            : `- ${name}：当前缺货，¥${p.price}`,
        );
        return `已为你查询「${normalizedKeyword}」分类商品：\n${lines.join('\n')}`;
      }

      return `未找到与「${keyword}」相关的商品或分类，请检查关键词后重试。`;
    }

    if (product.stock === 0) {
      return `商品「${normalizedKeyword}」当前缺货，预计下周补货。`;
    }

    return `商品「${normalizedKeyword}」有货，单价 ¥${product.price}，库存 ${product.stock} 件，分类：${product.category}。`;
  },
  {
    name: 'check_product',
    description:
      '根据关键词查询商品信息，支持精确商品名、模糊商品名和分类（如耳机）。可返回价格、库存和是否缺货。',
    schema: z.object({
      keyword: z
        .string()
        .describe(
          '查询关键词，可为商品名或分类，如"iPhone 16"、"AirPods"、"耳机"',
        ),
    }),
  },
);
