<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import { RouterLink } from "vue-router";
import MarkdownBody from "@/components/MarkdownBody.vue";
import { useSSE } from "@/hooks/useSSE";

type StreamMode = "plain" | "sse";

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  /** 模型思考链（DashScope reasoning）；仅助手消息 */
  reasoning?: string;
  /** 类 Gemini：流结束后默认折叠思考块 */
  reasoningCollapsed?: boolean;
};

type ChatSessionRow = {
  id: string;
  title: string | null;
  userId: number | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

/** 空状态问候用：偏友好、中性，避免冒犯或过于戏谑 */
const GREETING_EMOJIS = [
  "👋",
  "✨",
  "🙂",
  "🌟",
  "💬",
  "🙌",
  "💡",
  "🎯",
  "🌈",
  "☀️",
  "📚",
  "🔮",
  "🤝",
  "🌿",
  "🎈",
  "✅",
] as const;

function pickGreetingEmoji(): string {
  const i = Math.floor(Math.random() * GREETING_EMOJIS.length);
  return GREETING_EMOJIS[i]!;
}

const greetingEmoji = ref(pickGreetingEmoji());

const sessionId = ref<string>(crypto.randomUUID());
const messages = ref<ChatMsg[]>([]);
const input = ref("");
const mode = ref<StreamMode>("plain");
const loading = ref(false);
const error = ref<string | null>(null);
const abortRef = ref<AbortController | null>(null);
const scrollRef = ref<HTMLElement | null>(null);
const bottomAnchorRef = ref<HTMLElement | null>(null);

const sessions = ref<ChatSessionRow[]>([]);
const sessionsLoading = ref(false);
const sessionsError = ref<string | null>(null);
const mobileDrawerOpen = ref(false);
/** 桌面端（md+）侧栏是否在布局中展开 */
const sidebarDesktopExpanded = ref(true);

function toggleDesktopSidebar() {
  sidebarDesktopExpanded.value = !sidebarDesktopExpanded.value;
}

function newSession() {
  stop();
  sessionId.value = crypto.randomUUID();
  messages.value = [];
  error.value = null;
  mobileDrawerOpen.value = false;
  greetingEmoji.value = pickGreetingEmoji();
}

function apiBase(): string {
  return import.meta.env.VITE_API_BASE ?? "";
}

const sse = useSSE(() => `${apiBase()}/chat-sse`, {
  onDelta(d) {
    const last = messages.value[messages.value.length - 1];
    if (last?.role !== "assistant") return;
    if (d.content) last.content += d.content;
    if (d.reasoning) {
      last.reasoning = (last.reasoning ?? "") + d.reasoning;
      last.reasoningCollapsed = false;
    }
  },
});

const busy = computed(() =>
  mode.value === "sse" ? sse.loading.value : loading.value,
);

function stop() {
  sse.stop();
  abortRef.value?.abort();
  abortRef.value = null;
}

function scrollToBottom() {
  const run = () => {
    const anchor = bottomAnchorRef.value;
    const root = scrollRef.value;
    const instant = busy.value;
    if (anchor) {
      anchor.scrollIntoView({
        block: "end",
        behavior: instant ? "auto" : "smooth",
      });
      return;
    }
    if (root) {
      root.scrollTo({
        top: root.scrollHeight,
        behavior: instant ? "auto" : "smooth",
      });
    }
  };
  nextTick(() => {
    requestAnimationFrame(run);
  });
}

watch(messages, () => scrollToBottom(), { deep: true, flush: "post" });

watch(busy, (on, wasOn) => {
  if (wasOn && !on) {
    const last = messages.value[messages.value.length - 1];
    if (last?.role === "assistant" && last.reasoning?.trim()) {
      last.reasoningCollapsed = true;
    }
    scrollToBottom();
  }
});

function formatSessionTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const t = d.getTime();
  if (t >= start) {
    return d.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (t >= start - 86400000) return "昨天";
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  }
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function fetchSessions() {
  sessionsLoading.value = true;
  sessionsError.value = null;
  try {
    const res = await fetch(`${apiBase()}/chat-sessions?take=50`);
    if (!res.ok) {
      sessionsError.value = `加载会话列表失败（HTTP ${res.status}）`;
      return;
    }
    sessions.value = (await res.json()) as ChatSessionRow[];
  } catch (e) {
    sessionsError.value = e instanceof Error ? e.message : String(e);
  } finally {
    sessionsLoading.value = false;
  }
}

async function openSessionFromHistory(id: string) {
  if (busy.value) return;
  stop();
  error.value = null;
  sse.error.value = null;
  try {
    const res = await fetch(
      `${apiBase()}/chat-sessions/${encodeURIComponent(id)}/messages`,
    );
    if (!res.ok) {
      error.value = `加载历史消息失败（HTTP ${res.status}）`;
      return;
    }
    const rows = (await res.json()) as Array<{
      role: string;
      content: string;
    }>;
    sessionId.value = id;
    messages.value = rows.map((r) => ({
      role: r.role === "user" ? "user" : "assistant",
      content: r.content,
    }));
    mobileDrawerOpen.value = false;
    nextTick(() => scrollToBottom());
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

function trimFailedPair(restoreInput: boolean) {
  const m = messages.value;
  const last = m[m.length - 1];
  const prev = m[m.length - 2];
  if (last?.role === "assistant" && prev?.role === "user") {
    if (restoreInput) input.value = prev.content;
    m.pop();
    m.pop();
  }
}

function toggleReasoningCollapse(i: number) {
  const msg = messages.value[i];
  if (msg?.role !== "assistant") return;
  msg.reasoningCollapsed = !(msg.reasoningCollapsed ?? false);
}

async function send() {
  const message = input.value.trim();
  if (!message || busy.value) return;

  input.value = "";
  error.value = null;
  messages.value.push({ role: "user", content: message });
  messages.value.push({ role: "assistant", content: "" });

  if (mode.value === "sse") {
    await sse.start({ body: { message, sessionId: sessionId.value } });
    if (sse.error.value) {
      const last = messages.value[messages.value.length - 1];
      if (
        last?.role === "assistant" &&
        !last.content.trim() &&
        !last.reasoning?.trim()
      ) {
        trimFailedPair(true);
      }
    } else {
      void fetchSessions();
    }
    return;
  }

  loading.value = true;
  stop();
  const ac = new AbortController();
  abortRef.value = ac;

  const url = `${apiBase()}/chat-stream`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId: sessionId.value }),
      signal: ac.signal,
    });

    if (!res.ok) {
      error.value = `请求失败：HTTP ${res.status}`;
      trimFailedPair(true);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      error.value = "响应无正文流";
      trimFailedPair(true);
      return;
    }

    const decoder = new TextDecoder("utf-8");
    let lineBuf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lineBuf += decoder.decode(value, { stream: true });
      const lines = lineBuf.split("\n");
      lineBuf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let o: { c?: string; r?: string };
        try {
          o = JSON.parse(line) as { c?: string; r?: string };
        } catch {
          error.value = "流解析失败（非 NDJSON）";
          trimFailedPair(true);
          return;
        }
        const last = messages.value[messages.value.length - 1];
        if (last?.role !== "assistant") continue;
        if (typeof o.c === "string" && o.c) last.content += o.c;
        if (typeof o.r === "string" && o.r) {
          last.reasoning = (last.reasoning ?? "") + o.r;
          last.reasoningCollapsed = false;
        }
      }
    }
    if (lineBuf.trim()) {
      try {
        const o = JSON.parse(lineBuf) as { c?: string; r?: string };
        const last = messages.value[messages.value.length - 1];
        if (last?.role === "assistant") {
          if (typeof o.c === "string" && o.c) last.content += o.c;
          if (typeof o.r === "string" && o.r) {
            last.reasoning = (last.reasoning ?? "") + o.r;
            last.reasoningCollapsed = false;
          }
        }
      } catch {
        error.value = "流解析失败（末尾不完整）";
        trimFailedPair(true);
        return;
      }
    }
    void fetchSessions();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    error.value = e instanceof Error ? e.message : String(e);
    trimFailedPair(true);
  } finally {
    loading.value = false;
    abortRef.value = null;
  }
}

function fillSuggestion(text: string) {
  if (busy.value) return;
  input.value = text;
}

const moreMenuOpen = ref(false);
const moreMenuRoot = ref<HTMLElement | null>(null);

let removeMoreMenuOutsideListener: (() => void) | null = null;

watch(moreMenuOpen, (open) => {
  removeMoreMenuOutsideListener?.();
  removeMoreMenuOutsideListener = null;
  if (!open) return;
  const onPointerDown = (e: PointerEvent) => {
    const root = moreMenuRoot.value;
    if (root && !root.contains(e.target as Node)) {
      moreMenuOpen.value = false;
    }
  };
  document.addEventListener("pointerdown", onPointerDown, true);
  removeMoreMenuOutsideListener = () =>
    document.removeEventListener("pointerdown", onPointerDown, true);
});

onMounted(() => {
  void fetchSessions();
});

onUnmounted(() => {
  removeMoreMenuOutsideListener?.();
  stop();
});

const canSend = computed(() => input.value.trim().length > 0 && !busy.value);

const outputError = computed(() =>
  mode.value === "sse" ? sse.error.value : error.value,
);

/** 顶栏中部：与侧栏列表一致的标题逻辑，未入库前用首条用户话作临时预览 */
const headerSessionTitle = computed(() => {
  const sid = sessionId.value;
  const row = sessions.value.find((s) => s.id === sid);
  if (row?.title?.trim()) return row.title.trim();
  if (row) return "新会话";
  const firstUser = messages.value.find((m) => m.role === "user");
  if (firstUser?.content?.trim()) {
    const t = firstUser.content.trim().replace(/\s+/g, " ");
    return t.length > 40 ? `${t.slice(0, 40)}…` : t;
  }
  return "新会话";
});
</script>

<template>
  <div
    class="flex h-[100dvh] min-h-0 overflow-hidden bg-[#f0f4f9] text-[#1f1f1f] dark:bg-[#131314] dark:text-[#e3e3e3]"
  >
    <!-- 移动端抽屉遮罩 -->
    <button
      v-if="mobileDrawerOpen"
      type="button"
      class="fixed inset-0 z-30 bg-black/35 backdrop-blur-[1px] md:hidden"
      aria-label="关闭菜单"
      @click="mobileDrawerOpen = false"
    />

    <!-- 左侧历史（Gemini 式：窄屏抽屉；桌面可折叠） -->
    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-[min(100%,300px)] max-w-[300px] shrink-0 flex-col border-r border-black/[0.08] bg-[#e3e3e8] transition-[transform] duration-200 ease-out dark:border-white/[0.08] dark:bg-[#1e1e20] max-md:shadow-[4px_0_24px_rgba(0,0,0,0.12)] md:h-full md:w-[272px] md:max-w-none md:shadow-none md:transition-[transform,visibility]"
      :class="[
        mobileDrawerOpen ? 'translate-x-0' : 'max-md:-translate-x-full',
        sidebarDesktopExpanded
          ? 'md:relative md:z-0 md:translate-x-0 md:opacity-100 md:visible'
          : 'md:pointer-events-none md:invisible md:absolute md:left-0 md:top-0 md:z-0 md:-translate-x-full md:opacity-0',
      ]"
      aria-label="历史会话"
    >
      <div class="flex h-14 shrink-0 items-center justify-end border-b border-black/[0.06] px-2 dark:border-white/[0.08] md:hidden">
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-full text-[#444746] hover:bg-black/[0.06] dark:text-[#c4c7c5] dark:hover:bg-white/[0.08]"
          aria-label="关闭侧边栏"
          @click="mobileDrawerOpen = false"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"
            />
          </svg>
        </button>
      </div>

      <div class="flex flex-1 flex-col overflow-hidden px-3 pb-4 pt-2 md:pt-4">
        <button
          type="button"
          class="flex w-full items-center justify-center gap-2 rounded-full border border-black/[0.08] bg-white py-3 text-sm font-medium text-[#1c1c1c] shadow-sm transition hover:bg-[#f8f9fa] dark:border-white/[0.12] dark:bg-[#303030] dark:text-[#e3e3e3] dark:hover:bg-[#3c3c3c]"
          :disabled="busy"
          @click="newSession()"
        >
          <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          新聊天
        </button>

        <p
          class="mt-5 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#5f6368] dark:text-[#9aa0a6]"
        >
          近期对话
        </p>

        <div class="mt-2 min-h-0 flex-1 overflow-y-auto pr-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5">
          <p
            v-if="sessionsError"
            class="rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200"
          >
            {{ sessionsError }}
            <button
              type="button"
              class="mt-1 block font-medium underline"
              @click="fetchSessions()"
            >
              重试
            </button>
          </p>
          <ul v-else-if="sessionsLoading" class="space-y-2 px-0.5" aria-busy="true">
            <li
              v-for="n in 6"
              :key="n"
              class="h-11 animate-pulse rounded-2xl bg-black/[0.06] dark:bg-white/[0.08]"
            />
          </ul>
          <ul v-else class="space-y-0.5">
            <li v-for="s in sessions" :key="s.id">
              <button
                type="button"
                class="flex w-full items-start gap-2 rounded-2xl px-3 py-2.5 text-left text-[14px] leading-snug transition"
                :class="
                  s.id === sessionId
                    ? 'bg-white text-[#1f1f1f] shadow-sm dark:bg-[#3c4043] dark:text-[#e8eaed]'
                    : 'text-[#3c4043] hover:bg-black/[0.06] dark:text-[#e8eaed] dark:hover:bg-white/[0.08]'
                "
                :disabled="busy"
                @click="openSessionFromHistory(s.id)"
              >
                <span class="min-w-0 flex-1 line-clamp-2">{{
                  s.title?.trim() || "新会话"
                }}</span>
                <span
                  class="shrink-0 pt-0.5 text-[11px] tabular-nums text-[#5f6368] dark:text-[#9aa0a6]"
                >{{ formatSessionTime(s.updatedAt) }}</span>
              </button>
            </li>
            <li
              v-if="sessions.length === 0"
              class="px-2 py-6 text-center text-xs leading-relaxed text-[#5f6368] dark:text-[#9aa0a6]"
            >
              暂无已保存会话。<br />发送第一条消息后，会出现在这里。
            </li>
          </ul>
        </div>
      </div>
    </aside>

    <!-- 主栏：min-h-0 让子项 flex-1 的 main 能在视口内收缩，从而只在 main 内滚动 -->
    <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header
        class="z-20 grid h-14 shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 bg-[#f0f4f9]/90 px-2 backdrop-blur-md dark:bg-[#131314]/90 md:px-3"
      >
        <div class="flex min-w-0 items-center gap-1 justify-self-start">
          <!-- 窄屏：打开历史抽屉 -->
          <button
            type="button"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#444746] hover:bg-black/[0.06] dark:text-[#c4c7c5] dark:hover:bg-white/[0.08] md:hidden"
            aria-label="打开菜单"
            :aria-expanded="mobileDrawerOpen"
            @click="mobileDrawerOpen = true"
          >
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            </svg>
          </button>
          <!-- 桌面：折叠 / 展开侧栏 -->
          <button
            type="button"
            class="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#444746] hover:bg-black/[0.06] dark:text-[#c4c7c5] dark:hover:bg-white/[0.08] md:flex"
            :aria-label="sidebarDesktopExpanded ? '收起会话列表' : '展开会话列表'"
            :aria-expanded="sidebarDesktopExpanded"
            @click="toggleDesktopSidebar"
          >
            <svg
              v-if="sidebarDesktopExpanded"
              class="h-6 w-6"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6 1.41-1.41zM6 6h2v12H6V6z"
              />
            </svg>
            <svg
              v-else
              class="h-6 w-6"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            </svg>
          </button>
        </div>
        <h2
          class="min-w-0 justify-self-stretch px-1 text-center text-[15px] font-medium leading-tight text-[#1f1f1f] dark:text-[#e3e3e3]"
          :title="headerSessionTitle"
        >
          <span class="block truncate">{{ headerSessionTitle }}</span>
        </h2>
        <div ref="moreMenuRoot" class="relative shrink-0 justify-self-end">
          <button
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-full text-[#444746] transition hover:bg-black/[0.05] dark:text-[#c4c7c5] dark:hover:bg-white/[0.06]"
            aria-haspopup="menu"
            :aria-expanded="moreMenuOpen"
            aria-label="更多选项"
            @click="moreMenuOpen = !moreMenuOpen"
          >
            <svg
              class="h-6 w-6"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
              />
            </svg>
          </button>
          <div
            v-if="moreMenuOpen"
            class="absolute right-0 top-[calc(100%+4px)] z-50 max-h-[min(70dvh,520px)] w-[min(calc(100dvw-1rem),320px)] overflow-y-auto overscroll-contain rounded-2xl border border-black/[0.08] bg-white py-2 shadow-lg dark:border-white/[0.12] dark:bg-[#2d2d2e]"
            role="menu"
            aria-label="更多选项菜单"
          >
            <RouterLink
              to="/"
              role="menuitem"
              class="block px-4 py-2.5 text-sm text-[#1f1f1f] hover:bg-black/[0.05] dark:text-[#e3e3e3] dark:hover:bg-white/[0.06]"
              @click="moreMenuOpen = false"
            >
              返回首页
            </RouterLink>
            <div
              class="my-1 h-px bg-black/[0.06] dark:bg-white/[0.08]"
              role="separator"
            />
            <div class="space-y-3 px-4 py-3 text-left text-xs text-[#444746] dark:text-[#c4c7c5]">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-[#5f6368] dark:text-[#9aa0a6]">
                开发者选项
              </p>
              <p>
                先启动 Nest，再
                <code class="rounded bg-black/[0.06] px-1 dark:bg-white/[0.08]"
                  >pnpm dev</code
                >
                ；前端经 Vite 代理访问 API（含
                <code class="rounded bg-black/[0.06] px-1 dark:bg-white/[0.08]"
                  >/chat-sessions</code
                >）。
              </p>
              <div class="flex flex-col gap-1">
                <span class="font-medium text-[#1f1f1f] dark:text-[#e3e3e3]"
                  >会话 ID</span
                >
                <input
                  v-model="sessionId"
                  type="text"
                  :disabled="busy"
                  class="w-full rounded-xl border border-black/[0.08] bg-[#f8f9fa] px-3 py-2 font-mono text-[11px] text-[#1f1f1f] outline-none focus:border-[#1a73e8] dark:border-white/[0.1] dark:bg-[#2a2a2a] dark:text-[#e3e3e3]"
                />
              </div>
              <fieldset class="flex flex-wrap gap-3">
                <legend class="mb-1 w-full font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">
                  传输模式
                </legend>
                <label class="flex cursor-pointer items-center gap-2">
                  <input
                    v-model="mode"
                    type="radio"
                    name="mode"
                    value="plain"
                    :disabled="busy"
                  />
                  Plain
                </label>
                <label class="flex cursor-pointer items-center gap-2">
                  <input
                    v-model="mode"
                    type="radio"
                    name="mode"
                    value="sse"
                    :disabled="busy"
                  />
                  SSE
                </label>
              </fieldset>
            </div>
          </div>
        </div>
      </header>

      <main
        ref="scrollRef"
        class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pt-6 pb-[calc(16rem+env(safe-area-inset-bottom,0px))] [scroll-padding-bottom:calc(14rem+env(safe-area-inset-bottom,0px))]"
      >
        <div class="mx-auto w-full max-w-[720px]">
          <div
            v-if="messages.length === 0"
            class="flex flex-col items-center px-2 pt-8 text-center"
          >
            <span
              class="mb-4 block text-[3.25rem] leading-none sm:text-6xl"
              aria-hidden="true"
            >{{ greetingEmoji }}</span>
            <p
              class="max-w-md text-[32px] font-normal leading-tight tracking-tight text-[#1f1f1f] dark:text-[#e3e3e3] sm:text-4xl"
            >
              你好，<br />
              今天有什么可以帮你的？
            </p>
            <div class="mt-10 flex flex-wrap justify-center gap-2">
              <button
                v-for="chip in [
                  '用三句话解释什么是 SSE',
                  '写一段 Nest 流式接口示例',
                  '帮我列一份今日待办',
                ]"
                :key="chip"
                type="button"
                class="rounded-full border border-black/[0.08] bg-white px-4 py-2.5 text-sm text-[#1f1f1f] shadow-sm transition hover:bg-[#f8f9fa] disabled:opacity-50 dark:border-white/[0.12] dark:bg-[#1e1e1e] dark:text-[#e3e3e3] dark:hover:bg-[#2a2a2a]"
                :disabled="busy"
                @click="fillSuggestion(chip)"
              >
                {{ chip }}
              </button>
            </div>
          </div>

          <ul v-else class="flex flex-col gap-6 pb-4">
            <li
              v-for="(msg, i) in messages"
              :key="i"
              class="flex"
              :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                v-if="msg.role === 'user'"
                class="max-w-[min(85%,520px)] rounded-[22px] rounded-br-md bg-[#e3e3e3] px-4 py-3 text-[15px] leading-relaxed text-[#1f1f1f] dark:bg-[#303030] dark:text-[#e3e3e3]"
              >
                {{ msg.content }}
              </div>
              <div
                v-else
                class="w-full max-w-full text-[#1f1f1f] dark:text-[#e3e3e3]"
              >
                <div
                  v-if="msg.reasoning?.trim()"
                  class="mb-3 overflow-hidden rounded-2xl border border-violet-200/90 bg-gradient-to-b from-violet-50/95 to-[#f3f0ff]/60 text-[#444746] shadow-sm dark:border-violet-900/45 dark:from-[#252536]/95 dark:to-[#1a1a22]/70 dark:text-[#c4c7c5]"
                >
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-[#5f6368] transition hover:bg-black/[0.04] dark:text-[#9aa0a6] dark:hover:bg-white/[0.05]"
                    :aria-expanded="msg.reasoningCollapsed !== true"
                    @click="toggleReasoningCollapse(i)"
                  >
                    <svg
                      class="h-4 w-4 shrink-0 text-violet-600 transition-transform duration-200 dark:text-violet-400"
                      :class="msg.reasoningCollapsed === true ? '' : 'rotate-90'"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"
                      />
                    </svg>
                    <span>思考过程</span>
                    <span
                      v-if="busy && i === messages.length - 1"
                      class="ml-auto text-[11px] font-normal tabular-nums text-violet-700/85 dark:text-violet-300/90"
                    >进行中</span>
                  </button>
                  <div
                    v-show="msg.reasoningCollapsed !== true"
                    class="max-h-[min(40vh,320px)] overflow-y-auto overscroll-contain border-t border-violet-200/70 px-3 py-2.5 dark:border-violet-900/40"
                  >
                    <pre
                      class="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-[#3c4043] dark:text-[#babfc4]"
                    >{{ msg.reasoning }}</pre>
                  </div>
                </div>
                <MarkdownBody v-if="msg.content" :source="msg.content" />
                <span
                  v-else-if="busy && i === messages.length - 1"
                  class="inline-flex items-center gap-1 text-[#444746] dark:text-[#c4c7c5]"
                >
                  <span class="inline-flex gap-1" aria-label="正在生成">
                    <span
                      class="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]"
                    />
                    <span
                      class="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]"
                    />
                    <span class="h-2 w-2 animate-bounce rounded-full bg-current" />
                  </span>
                </span>
              </div>
            </li>
          </ul>
          <div
            v-if="messages.length > 0"
            ref="bottomAnchorRef"
            class="pointer-events-none h-8 w-full shrink-0"
            aria-hidden="true"
          />
        </div>
      </main>

      <div
        class="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#f0f4f9] via-[#f0f4f9] to-transparent pb-4 pt-10 dark:from-[#131314] dark:via-[#131314]"
      >
        <div class="pointer-events-auto mx-auto w-full max-w-[720px] px-4">
          <p
            v-if="outputError"
            class="mb-3 rounded-2xl border border-red-200/80 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
            role="alert"
          >
            {{ outputError }}
          </p>

          <div
            class="flex items-end gap-2 rounded-[28px] border border-black/[0.08] bg-white p-2 pl-4 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)] dark:border-white/[0.1] dark:bg-[#1e1e1e] dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
          >
            <textarea
              v-model="input"
              rows="1"
              :disabled="busy"
              placeholder="询问任何问题"
              class="max-h-40 min-h-[48px] w-full flex-1 resize-none border-0 bg-transparent py-3 text-[15px] leading-snug text-[#1f1f1f] outline-none ring-0 placeholder:text-[#444746]/70 disabled:opacity-60 dark:text-[#e3e3e3] dark:placeholder:text-[#c4c7c5]/70"
              @keydown.enter.exact.prevent="canSend ? send() : null"
            />
            <div class="flex shrink-0 flex-col justify-end pb-1 pr-1">
              <button
                v-if="busy"
                type="button"
                class="flex h-11 w-11 items-center justify-center rounded-full border border-black/[0.1] bg-white text-[#1f1f1f] transition hover:bg-[#f8f9fa] dark:border-white/[0.12] dark:bg-[#2a2a2a] dark:text-white dark:hover:bg-[#333]"
                title="停止"
                @click="stop"
              >
                <svg
                  class="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M6 6h12v12H6z" />
                </svg>
              </button>
              <button
                v-else
                type="button"
                class="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#1a73e8] to-[#669df6] text-white shadow-sm transition enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-35"
                :disabled="!canSend"
                title="发送"
                @click="send()"
              >
                <svg
                  class="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d="M12 4l-7 7h4v9h6v-9h4L12 4zm0-2c.3 0 .6.1.8.3l8 8c.5.5.5 1.3 0 1.8-.2.2-.5.3-.8.3h-3v8c0 1.1-.9 2-2 2h-6c-1.1 0-2-.9-2-2v-8H4c-.3 0-.6-.1-.8.3-.5-.5-.5-1.3 0-1.8l8-8c.2-.2.5-.3.8-.3z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
