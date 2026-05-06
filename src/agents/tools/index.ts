import { applyRefundTool } from './apply-refund.tool';
import { checkOrderTool } from './check-order.tool';
import { checkProductTool } from './check-product.tool';
import { createOrderTool } from './create-order.tool';
import { getTavilySearchTool } from './tavily-search.tool';

const tavilySearchTool = getTavilySearchTool();

export const allAgentTools = [
  checkProductTool,
  createOrderTool,
  checkOrderTool,
  applyRefundTool,
  ...(tavilySearchTool ? [tavilySearchTool] : []),
];

export const agentToolMap: Record<string, any> = {
  check_product: checkProductTool,
  create_order: createOrderTool,
  check_order: checkOrderTool,
  apply_refund: applyRefundTool,
  ...(tavilySearchTool ? { web_search: tavilySearchTool } : {}),
};
