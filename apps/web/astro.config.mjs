// @ts-check
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://saloncitrineindy.com",
  base: "/book",
  server: {
    host: true,
  },
  vite: {
    envDir: "../../",
  },
});