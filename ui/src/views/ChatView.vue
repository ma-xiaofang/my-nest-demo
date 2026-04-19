<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { RouterLink } from "vue-router";

type StreamMode = "plain" | "sse";

/** 开发环境经 Vite 代理同源请求；生产构建时设置 VITE_API_BASE（如 http://localhost:3001） */
function apiBase(): string {
  return import.meta.env.VITE_API_BASE ?? "";
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
    let eventName = "message";
    let dataLine: string | null = null;
    for (const line of lines) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) dataLine = line.slice(5).trim();
    }
    if (dataLine === null) continue;
    if (dataLine === "[DONE]") continue;
    if (eventName === "error") {
      try {
        const { message } = JSON.parse(dataLine) as { message: string };
        onError(message);
      } catch {
        onError(dataLine);
      }
      continue;
    }
    try {
      const { text } = JSON.parse(dataLine) as { text: string };
      onText(text);
    } catch {
      /* ignore malformed chunk */
    }
  }
  return rest;
}

const input = ref("");
const reply = ref("");
const mode = ref<StreamMode>("plain");
const loading = ref(false);
const error = ref<string | null>(null);
const abortRef = ref<AbortController | null>(null);

function stop() {
  abortRef.value?.abort();
  abortRef.value = null;
}

async function send() {
  const message = input.value.trim();
  if (!message || loading.value) return;

  reply.value = "";
  error.value = null;
  loading.value = true;
  stop();
  const ac = new AbortController();
  abortRef.value = ac;

  const base = apiBase();
  const path = mode.value === "plain" ? "/chat-stream" : "/chat-sse";
  const url = `${base}${path}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
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

    if (mode.value === "plain") {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        reply.value += chunk;
      }
      return;
    }

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = appendSseBlocks(
        buffer,
        (text) => {
          reply.value += text;
        },
        (m) => {
          error.value = m;
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

const canSend = computed(() => input.value.trim().length > 0 && !loading.value);
</script>

<template>
  <main
    class="mx-auto flex min-h-[100dvh] max-w-3xl flex-col gap-6 px-4 py-8"
  >
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
        流式聊天
      </h1>
      <RouterLink
        to="/"
        class="text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        返回首页
      </RouterLink>
    </header>

    <p class="text-sm text-gray-600 dark:text-gray-400">
      开发时请先启动 Nest（默认
      <code class="rounded bg-gray-100 px-1 dark:bg-gray-800">3001</code>
      ），再运行
      <code class="rounded bg-gray-100 px-1 dark:bg-gray-800">pnpm dev</code>
      ；请求经 Vite 代理到后端。
    </p>

    <fieldset
      class="flex flex-wrap gap-4 text-sm text-gray-800 dark:text-gray-200"
    >
      <legend class="sr-only">接口模式</legend>
      <label class="flex cursor-pointer items-center gap-2">
        <input
          v-model="mode"
          type="radio"
          name="mode"
          value="plain"
          :disabled="loading"
        />
        <span>Plain（/chat-stream）</span>
      </label>
      <label class="flex cursor-pointer items-center gap-2">
        <input
          v-model="mode"
          type="radio"
          name="mode"
          value="sse"
          :disabled="loading"
        />
        <span>SSE（/chat-sse）</span>
      </label>
    </fieldset>

    <div class="flex flex-col gap-2">
      <label
        for="msg"
        class="text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        消息
      </label>
      <textarea
        id="msg"
        v-model="input"
        rows="4"
        :disabled="loading"
        placeholder="输入后发送…"
        class="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
      />
    </div>

    <div class="flex flex-wrap gap-3">
      <button
        type="button"
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!canSend"
        @click="send()"
      >
        {{ loading ? "生成中…" : "发送" }}
      </button>
      <button
        type="button"
        class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        :disabled="!loading"
        @click="stop"
      >
        停止
      </button>
    </div>

    <p
      v-if="error"
      class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
      role="alert"
    >
      {{ error }}
    </p>

    <section class="flex min-h-[12rem] flex-1 flex-col gap-2">
      <h2 class="text-sm font-medium text-gray-700 dark:text-gray-300">
        回复
      </h2>
      <div
        class="flex-1 whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50/80 p-4 text-gray-900 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-100"
      >
        <template v-if="reply">{{ reply }}</template>
        <span v-else class="text-gray-400 dark:text-gray-500">（尚无内容）</span>
      </div>
    </section>
  </main>
</template>
