<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <div class="flex flex-col items-center gap-6 pb-4 pt-8">
    <p class="max-w-md text-center text-sm text-gray-600 dark:text-gray-400">
      Nest 流式聊天演示前端（Vue 3 + Vite）。
    </p>
    <RouterLink
      to="/chat"
      class="rounded-full border border-gray-300 bg-gray-50 px-5 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
    >
      打开流式聊天
    </RouterLink>
  </div>
</template>
