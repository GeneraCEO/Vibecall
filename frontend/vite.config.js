import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
    },
    // Required for @livekit/track-processors (MediaPipe uses SharedArrayBuffer)
    // SharedArrayBuffer only works in a "cross-origin isolated" context.
    // These two headers enable that context in the dev server.
    headers: {
      "Cross-Origin-Opener-Policy":   "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },

  // Required for MediaPipe WASM binary files used by track-processors
  optimizeDeps: {
    exclude: ["@livekit/track-processors"],
  },

  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split track-processors into its own chunk — it's large (~5MB with WASM)
          // This keeps the main bundle fast and loads it only when bg is activated
          "track-processors": ["@livekit/track-processors"],
          livekit: ["livekit-client", "@livekit/components-react"],
          react:   ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
