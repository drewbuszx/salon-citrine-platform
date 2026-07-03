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
  },
});
