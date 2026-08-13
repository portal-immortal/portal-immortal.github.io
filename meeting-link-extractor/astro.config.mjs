import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://portal-immortal.github.io",
  base: "/meeting-link-extractor",
  output: "static",
  compressHTML: true,
});