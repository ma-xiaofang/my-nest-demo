import { onUnmounted, ref } from "vue";

/** 解析单条 `data:` 负载：OpenAI `chat.completion.chunk` 或流内 `error` */
function handleSseDataLine(
  dataLine: string,
  onText: (t: string) => void,
  onError: (m: string) => void,
): void {
  if (dataLine === "[DONE]") return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataLine) as Record<string, unknown>;
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== "object") return;
  const o = parsed as {
    error?: { message?: string };
    choices?: Array<{ delta?: { content?: string | null } }>;
  };
  if (o.error) {
    onError(o.error.message ?? JSON.stringify(o.error));
    return;
  }
  const content = o.choices?.[0]?.delta?.content;
  if (typeof content === "string" && content.length > 0) {
    onText(content);
  }
}

function appendSseBlocks(
  buffer: string,
  onText: (t: string) => void,
  onError: (m: string) => void,
): string {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const block of parts) {
    const lines = block.split("\n");
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (dataLines.length === 0) continue;
    const payload = dataLines.join("\n");
    handleSseDataLine(payload, onText, onError);
  }
  return rest;
}

export interface UseSSEStartParams {
  body?: unknown;
  method?: string;
  headers?: Record<string, string>;
}

export interface UseSSEOptions {
  /** 每个解析出的文本增量（与 text ref 累加同步触发） */
  onChunk?: (chunk: string) => void;
  /** 流内错误（OpenAI 形 `data: {"error":{...}}` 等） */
  onStreamError?: (message: string) => void;
}

/**
 * 通过 fetch + ReadableStream 消费 **POST** 返回的 `text/event-stream`
 *（解析 OpenAI `chat.completion.chunk`：`choices[0].delta.content`）。
 */
export function useSSE(
  url: string | (() => string),
  options: UseSSEOptions = {},
) {
  const text = ref("");
  const error = ref<string | null>(null);
  const loading = ref(false);
  const abortRef = ref<AbortController | null>(null);

  function stop() {
    abortRef.value?.abort();
    abortRef.value = null;
  }

  async function start(params: UseSSEStartParams = {}) {
    if (loading.value) return;

    text.value = "";
    error.value = null;
    loading.value = true;
    stop();
    const ac = new AbortController();
    abortRef.value = ac;

    const resolvedUrl = typeof url === "function" ? url() : url;

    try {
      const res = await fetch(resolvedUrl, {
        method: params.method ?? "POST",
        headers: {
          "Content-Type": "application/json",
          ...params.headers,
        },
        body:
          params.body !== undefined ? JSON.stringify(params.body) : undefined,
        signal: ac.signal,
      });

      if (!res.ok) {
        error.value = `请求失败：HTTP ${res.status}`;
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        error.value = "响应无正文流";
        return;
      }

      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = appendSseBlocks(
          buffer,
          (chunk) => {
            text.value += chunk;
            options.onChunk?.(chunk);
          },
          (m) => {
            error.value = m;
            options.onStreamError?.(m);
          },
        );
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
      abortRef.value = null;
    }
  }

  onUnmounted(() => {
    stop();
  });

  return {
    text,
    error,
    loading,
    start,
    stop,
  };
}
