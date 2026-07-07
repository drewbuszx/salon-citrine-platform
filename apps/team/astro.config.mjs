// @ts-check
import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://team.saloncitrineindy.com",
  base: "/team",
  output: "server",
  adapter: cloudflare(),
  devToolbar: {
    enabled: false,
  },
  security: import.meta.env.PROD
    ? {
        allowedDomains: [
          { hostname: "team.saloncitrineindy.com" },
          { hostname: "salon-citrine-team.dbuszx.workers.dev" },
          { hostname: "salon-citrine-platform.dbuszx.workers.dev" },
        ],
      }
    : {
        checkOrigin: false,
      },
  server: {
    host: true,
    port: 4322,
  },
  vite: {
    envDir: "../../",
    optimizeDeps: {
      exclude: [
        "@cloudflare/unenv-preset",
        "@cloudflare/unenv-preset/node/process",
        "astro/compiler-runtime",
        "@cloudflare/vite-plugin",
        "unenv",
      ],
    },
    server: {
      // Fail fast when 4322 is taken (e.g. marketing site preview) instead of
      // silently binding another port and serving /team/* from the wrong app.
      strictPort: true,
    },
  },
});
