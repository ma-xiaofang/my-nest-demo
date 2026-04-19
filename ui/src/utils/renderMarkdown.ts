import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";
import MarkdownIt from "markdown-it";
import { escapeHtml } from "markdown-it/lib/common/utils.mjs";
import multimdTable from "markdown-it-multimd-table";

/**
 * 模型 / IME 常混入全角反引号、零宽字符，会导致行内 `code` 无法被 markdown-it 识别。
 */
function normalizeMarkdownSource(input: string): string {
  return input
    .replace(/\uFF40/g, "`")
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, "")
    // 模型常输出 \`foo\`，反引号被 CommonMark 转义，行内代码不成立
    .replace(/\\(`)/g, "$1");
}

/** 围栏语言标识（防 XSS，仅允许常见语言名） */
function safeFenceLang(raw: string): string {
  const name = raw.trim().toLowerCase().split(/\s+/)[0] ?? "";
  if (/^[a-z0-9][a-z0-9+#.-]{0,39}$/i.test(name)) return name;
  return "";
}

function highlightFence(code: string, rawInfo: string): string {
  const lang = safeFenceLang(rawInfo);

  try {
    if (lang && hljs.getLanguage(lang)) {
      const { value } = hljs.highlight(code, {
        language: lang,
        ignoreIllegals: true,
      });
      return `<pre class="hljs"><code class="hljs language-${escapeHtml(lang)}">${value}</code></pre>`;
    }
    if (lang) {
      const { value } = hljs.highlight(code, {
        language: "plaintext",
        ignoreIllegals: true,
      });
      return `<pre class="hljs"><code class="hljs language-${escapeHtml(lang)}">${value}</code></pre>`;
    }
    const { value } = hljs.highlightAuto(code);
    return `<pre class="hljs"><code class="hljs">${value}</code></pre>`;
  } catch {
    return `<pre class="hljs"><code class="hljs">${escapeHtml(code)}</code></pre>`;
  }
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true,
  highlight: highlightFence,
}).use(multimdTable, {
  multiline: false,
  rowspan: true,
  headerless: true,
  multibody: true,
  aotolabel: true,
});

const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const href = token?.attrGet("href");
  if (href && /^https?:\/\//i.test(href)) {
    token.attrPush(["target", "_blank"]);
    token.attrPush(["rel", "noopener noreferrer"]);
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

/** 将 Markdown 转为可安全用于 `v-html` 的 HTML */
export function renderMarkdown(source: string): string {
  if (!source) return "";
  return DOMPurify.sanitize(md.render(normalizeMarkdownSource(source)), {
    ADD_ATTR: ["rowspan", "colspan"],
  });
}
