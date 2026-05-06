import { TavilySearch } from '@langchain/tavily';

let _tavilySearchTool: TavilySearch | null = null;

export function getTavilySearchTool(): TavilySearch | null {
  if (!process.env['TAVILY_API_KEY']) {
    console.warn('[Tavily] TAVILY_API_KEY 未设置，联网搜索工具已禁用');
    return null;
  }
  if (!_tavilySearchTool) {
    _tavilySearchTool = new TavilySearch({
      maxResults: 5,
      searchDepth: 'advanced',
      includeAnswer: true,
      includeRawContent: false,
      includeImages: false,
      topic: 'general',
      name: 'web_search',
      description:
        '一个专为 AI 智能体优化的搜索引擎。当需要查询实时信息、新闻、未知知识或任何需要联网搜索的内容时使用此工具。输入应为自然语言搜索查询词。',
      tavilyApiKey: process.env['TAVILY_API_KEY'],
    });
  }
  return _tavilySearchTool;
}
