import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://site-two.example.com",
  output: "static",
  server: {
    port: 4322,
  },
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
