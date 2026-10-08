import { resolve } from "path"
import path from "path"
import { defineConfig } from "electron-vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  main: {
    resolve: {
      alias: {
        "@main": resolve("src/main/"),
      },
    },
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@": path.resolve(__dirname, "src/renderer/src"),
        "@main": resolve("src/main/"),
      },
    },
    plugins: [react()],
  },
})
