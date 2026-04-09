import { defineConfig } from "vitest/config";
import { cloudflarePool, cloudflareTest } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        // Override remote KV with local-only for tests
        kvNamespaces: ["claude_status"],
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
