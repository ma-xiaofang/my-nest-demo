import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/chat-stream": {
        target: "http://127.0.0.1:3009",
        changeOrigin: true,
      },
      "/chat-sse": {
        target: "http://127.0.0.1:3009",
        changeOrigin: true,
      },
      "/chat-sessions": {
        target: "http://127.0.0.1:3009",
        changeOrigin: true,
      },
    },
  },
});
