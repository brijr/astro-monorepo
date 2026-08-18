import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://site-starter.example.com",
  output: "static",
  server: {
    port: 4399,
  },
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
