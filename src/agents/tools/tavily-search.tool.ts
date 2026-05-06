import { TavilySearch } from '@langchain/tavily';

/** undefined：尚未解析；null：无密钥；否则为已构造的实例 */
let _tavilySearchTool: TavilySearch | null | undefined;

/**
 * 返回 Tavily 联网搜索工具；无 `TAVILY_API_KEY` 时返回 null。
 * 须在 `ConfigModule` 加载 `.env` 之后调用（勿在模块顶层 import 阶段调用）。
 */
export function getTavilySearchTool(): TavilySearch | null {
  if (_tavilySearchTool !== undefined) {
    return _tavilySearchTool;
  }
  if (!process.env['TAVILY_API_KEY']) {
    console.warn('[Tavily] TAVILY_API_KEY 未设置，联网搜索工具已禁用');
    _tavilySearchTool = null;
    return null;
  }
  _tavilySearchTool = new TavilySearch({
    maxResults: 5, // 最多返回 5 个结果
    searchDepth: 'advanced', // 搜索深度为高级
    includeAnswer: true, // 包含答案
    includeRawContent: false, // 不包含原始内容
    includeImages: false, // 不包含图片
    topic: 'general', // 一般主题
    name: 'web_search', // 工具名称
    description:
      '一个专为 AI 智能体优化的搜索引擎。当需要查询实时信息、新闻、未知知识或任何需要联网搜索的内容时使用此工具。输入应为自然语言搜索查询词。',
    tavilyApiKey: process.env['TAVILY_API_KEY'],
  });
  return _tavilySearchTool;
}
