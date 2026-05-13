import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": [
            "react",
            "react-dom",
            "react-router-dom"
          ],
          "vendor-ethers": [
            "ethers"
          ],
          "vendor-ui": [
            "recharts",
            "react-d3-tree"
          ]
        }
      }
    },
    chunkSizeWarningLimit: 600
  },
  server: {
    host: "0.0.0.0",
    port: 5174,
    allowedHosts: true
  },
  preview: {
    host: "0.0.0.0",
    port: 4174,
    allowedHosts: true
  }
});
