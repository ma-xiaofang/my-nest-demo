<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown } from '@/utils/renderMarkdown';

const props = defineProps<{
  source: string;
}>();

const html = computed(() => renderMarkdown(props.source));
</script>

<template>
  <div class="markdown-body min-w-0 overflow-x-auto">
    <div
      class="prose prose-neutral max-w-none min-w-0 text-[15px] leading-relaxed prose-headings:font-semibold prose-headings:tracking-tight prose-p:my-2 prose-table:block prose-table:w-full prose-table:text-left prose-table:text-sm prose-th:border prose-th:border-black/[0.1] prose-th:bg-black/[0.04] prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-black/[0.08] prose-td:px-3 prose-td:py-2 dark:prose-invert dark:prose-th:border-white/[0.12] dark:prose-th:bg-white/[0.06] dark:prose-td:border-white/[0.08]"
      v-html="html" />
  </div>
</template>
