import { defineConfig } from "vitest/config";
import { cloudflarePool, cloudflareTest } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        // Override remote KV with local-only for tests
        kvNamespaces: ["claude_status"],
        // Pre-add flags so vitest-pool-workers doesn't emit debug noise
        compatibilityFlags: [
          "enable_nodejs_tty_module",
          "enable_nodejs_fs_module",
          "enable_nodejs_http_modules",
          "enable_nodejs_perf_hooks_module",
          "enable_nodejs_v8_module",
          "enable_nodejs_process_v2",
        ],
      },
    }),
  ],
  test: {
    pool: cloudflarePool({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        kvNamespaces: ["claude_status"],
      },
    }),
  },
});
