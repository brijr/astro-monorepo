import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import { SITE_URL } from "./src/lib/constants";

export default defineConfig({
  site: SITE_URL,
  output: "static",
  server: {
    port: 4321,
  },
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
