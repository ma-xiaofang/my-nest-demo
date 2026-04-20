import { onUnmounted, ref } from "vue";

export type SseStreamDelta = { content?: string; reasoning?: string };

/** 解析单条 `data:` 负载：OpenAI `chat.completion.chunk` 或流内 `error` */
function handleSseDataLine(
  dataLine: string,
  onDelta: (d: SseStreamDelta) => void,
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
    choices?: Array<{
      delta?: {
        content?: string | null;
        reasoning_content?: string | null;
      };
    }>;
  };
  if (o.error) {
    onError(o.error.message ?? JSON.stringify(o.error));
    return;
  }
  const delta = o.choices?.[0]?.delta;
  if (!delta) return;
  const piece: SseStreamDelta = {};
  const c = delta.content;
  const r = delta.reasoning_content;
  if (typeof c === "string" && c.length > 0) piece.content = c;
  if (typeof r === "string" && r.length > 0) piece.reasoning = r;
  if (piece.content !== undefined || piece.reasoning !== undefined) {
    onDelta(piece);
  }
}

function appendSseBlocks(
  buffer: string,
  onDelta: (d: SseStreamDelta) => void,
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
    handleSseDataLine(payload, onDelta, onError);
  }
  return rest;
}

export interface UseSSEStartParams {
  body?: unknown;
  method?: string;
  headers?: Record<string, string>;
}

export interface UseSSEOptions {
  /** 每个解析出的正文/思考增量（与 text ref 的正文累加同步触发） */
  onDelta?: (d: SseStreamDelta) => void;
  /** 流内错误（OpenAI 形 `data: {"error":{...}}` 等） */
  onStreamError?: (message: string) => void;
}

/**
 * 通过 fetch + ReadableStream 消费 **POST** 返回的 `text/event-stream`
 *（解析 OpenAI `chat.completion.chunk`：`delta.content` 与扩展字段 `delta.reasoning_content`）。
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
          (d) => {
            if (d.content) text.value += d.content;
            options.onDelta?.(d);
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
