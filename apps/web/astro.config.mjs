// @ts-check
import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://saloncitrineindy.com",
  base: "/book",
  output: "static",
  adapter: cloudflare(),
  server: {
    host: true,
  },
  vite: {
    envDir: "../../",
  },
});