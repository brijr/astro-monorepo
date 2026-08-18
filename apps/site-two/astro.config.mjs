import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://site-two.example.com",
  output: "static",
  vite: {
    plugins: [tailwindcss()],
  },
});
