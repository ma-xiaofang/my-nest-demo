import { applyRefundTool } from './apply-refund.tool';
import { checkOrderTool } from './check-order.tool';
import { checkProductTool } from './check-product.tool';
import { createOrderTool } from './create-order.tool';
import { getTavilySearchTool } from './tavily-search.tool';

/**
 * 在请求路径上组装工具列表（含 Tavily），避免在 import 阶段读取 `process.env`，
 * 否则早于 `ConfigModule.forRoot()` 加载 `.env` 会导致密钥始终为空。
 */
export function buildAgentTools() {
  const tavilySearchTool = getTavilySearchTool();
  const tools = [
    checkProductTool,
    createOrderTool,
    checkOrderTool,
    applyRefundTool,
    ...(tavilySearchTool ? [tavilySearchTool] : []),
  ];
  const toolMap: Record<string, any> = {
    check_product: checkProductTool,
    create_order: createOrderTool,
    check_order: checkOrderTool,
    apply_refund: applyRefundTool,
    ...(tavilySearchTool ? { web_search: tavilySearchTool } : {}),
  };
  return { tools, toolMap };
}
