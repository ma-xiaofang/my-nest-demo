import { config } from 'dotenv';

config();

import { GlmSmokeTest } from './glm-smoke-test';

const apiKey = process.env.ZHIPUAI_API_KEY;
const describeGlm = apiKey ? describe : describe.skip;

describeGlm('GLM 智谱（GlmSmokeTest）', () => {
  jest.setTimeout(60_000);

  let client: GlmSmokeTest;

  beforeAll(() => {
    client = new GlmSmokeTest(apiKey!);
  });

  it('对话接口应返回非空文本', async () => {
    const text = await client.invokeChat('只回复两个字：联通');
    expect(text.trim().length).toBeGreaterThan(0);
  });

  it('嵌入接口应返回数值向量', async () => {
    const vec = await client.embedQuery('hello glm');
    expect(Array.isArray(vec)).toBe(true);
    expect(vec.length).toBeGreaterThan(0);
    expect(typeof vec[0]).toBe('number');
  });
});
