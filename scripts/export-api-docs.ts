/**
 * 导出 API 文档为 Markdown
 *
 * 前置：确保服务已启动（pnpm start:dev）
 *
 * 用法：
 *   pnpm docs:export        # 从运行中的服务获取 OpenAPI 并转 Markdown
 *   pnpm docs:md            # 仅将已有的 docs/api-openapi.json 转为 Markdown
 *
 * 输出：
 *   docs/api-openapi.json   - OpenAPI JSON 规范文件
 *   docs/api-reference.md   - Markdown 格式 API 文档
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createMarkdownFromOpenApi } from '@scalar/openapi-to-markdown';

const outDir = join(process.cwd(), 'docs');
const jsonPath = join(outDir, 'api-openapi.json');
const mdPath = join(outDir, 'api-reference.md');
const BASE_URL = process.env['SERVER_URL'] || 'http://localhost:3009';

async function fetchOpenApiFromServer(): Promise<Record<string, unknown>> {
  console.log(`🌐 从 ${BASE_URL} 获取 OpenAPI 文档...`);

  const res = await fetch(`${BASE_URL}/api-docs`);
  if (!res.ok) {
    throw new Error(
      `请求失败 (${res.status})，请确保服务已启动：pnpm start:dev`,
    );
  }

  // Scalar 返回 HTML 页面，OpenAPI JSON 需要通过 /api-docs-json 获取
  const jsonRes = await fetch(`${BASE_URL}/api-docs-json`);
  if (!jsonRes.ok) {
    throw new Error(`获取 OpenAPI JSON 失败 (${jsonRes.status})`);
  }

  return (await jsonRes.json()) as Record<string, unknown>;
}

async function main() {
  mkdirSync(outDir, { recursive: true });

  let document: Record<string, unknown>;

  // 优先从运行中的服务获取
  try {
    document = await fetchOpenApiFromServer();
    writeFileSync(jsonPath, JSON.stringify(document, null, 2), 'utf-8');
    console.log(`✅ OpenAPI JSON 已保存: ${jsonPath}`);
  } catch {
    // 服务未启动时，尝试从已有文件读取
    if (existsSync(jsonPath)) {
      console.log(`📂 从本地文件读取: ${jsonPath}`);
      document = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    } else {
      console.error('❌ 无法获取 OpenAPI 文档！');
      console.error('   请先启动服务：pnpm start:dev');
      console.error('   或手动将 OpenAPI JSON 保存到：docs/api-openapi.json');
      process.exit(1);
    }
  }

  // 转换为 Markdown
  const markdown = await createMarkdownFromOpenApi({ spec: document });
  writeFileSync(mdPath, markdown, 'utf-8');
  console.log(`✅ Markdown 文档已导出: ${mdPath}`);
}

main().catch((err) => {
  console.error('导出失败:', err);
  process.exit(1);
});
