// @ts-check
import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://team.saloncitrineindy.com",
  base: "/team",
  output: "server",
  adapter: cloudflare(),
  server: {
    host: true,
    port: 4322,
  },
  vite: {
    envDir: "../../",
    server: {
      // Fail fast when 4322 is taken (e.g. marketing site preview) instead of
      // silently binding another port and serving /team/* from the wrong app.
      strictPort: true,
    },
  },
});
