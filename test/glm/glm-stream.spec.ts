import { config } from 'dotenv';

config();

import { GlmSmokeTest } from './glm-smoke-test';

const apiKey = process.env.ZHIPUAI_API_KEY;
const describeGlm = apiKey ? describe : describe.skip;

describeGlm('GLM 流式输出（GlmSmokeTest.collectStreamChat）', () => {
  jest.setTimeout(60_000);

  let client: GlmSmokeTest;

  beforeAll(() => {
    client = new GlmSmokeTest(apiKey!);
  });

  it('stream 应产生至少一个增量且全文非空', async () => {
    const { chunks, text } = await client.collectStreamChat(
      '用不超过30字说明 NestJS 是什么。',
    );
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(text.trim().length).toBeGreaterThan(0);
  });

  it('各分片拼接长度应等于全文长度', async () => {
    const { chunks, text } = await client.collectStreamChat('说一个四字成语。');
    const joinedLen = chunks.reduce((n, s) => n + s.length, 0);
    expect(joinedLen).toBe(text.length);
  });
});
