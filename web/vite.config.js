import {defineConfig} from "vite";

// Shopify CLI runs this with FRONTEND_PORT (the port its tunnel proxies to)
// and SHOPIFY_API_KEY (the app's client_id, injected into index.html so
// App Bridge can boot — see %SHOPIFY_API_KEY% in index.html).
const port = Number(process.env.FRONTEND_PORT || process.env.PORT || 5173);

export default defineConfig({
  // Expose SHOPIFY_* env vars to import.meta.env / %HTML% replacement.
  envPrefix: ["VITE_", "SHOPIFY_"],
  server: {
    port,
    host: true,
    // Page is served through the CLI's cloudflare tunnel — accept its Host.
    allowedHosts: true,
    // Browser runs on this same Mac, so HMR can talk straight to localhost.
    hmr: {protocol: "ws", host: "localhost", port},
  },
  // GitHub Pages serves from a subpath (github.io/<repo>/), so use relative
  // asset URLs and build into docs/ (the folder Pages can publish from main).
  base: "./",
  build: {outDir: "docs"},
});
