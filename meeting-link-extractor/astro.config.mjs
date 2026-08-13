import { defineConfig } from "astro/config";

// Meeting Link Extractor is a fully static, client-side-only utility.
// No SSR, no server adapter, no backend — everything runs in the browser.
export default defineConfig({
  output: "static",
  compressHTML: true,
});
