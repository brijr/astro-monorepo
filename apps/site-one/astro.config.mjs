import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://site-one.example.com",
  output: "static",
  server: {
    port: 4321,
  },
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
