/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Files copied to the build as-is (the project has no public/ folder).
const STATIC_FILES = ["manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png"];

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? [] : [name]));
}

/**
 * After the build: app.html becomes index.html, the static files are copied in, and sw-template.js becomes sw.js,
 * stamped with a build id and the list of every built file to cache for offline use.
 */
function finishSite(): Plugin {
  let outDir = "dist";
  return {
    name: "finish-site",
    apply: "build",
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() {
      renameSync(join(outDir, "app.html"), join(outDir, "index.html"));
      for (const name of STATIC_FILES) copyFileSync(name, join(outDir, name));
      const files = listFiles(outDir).filter((f) => f !== "sw.js");
      const source = readFileSync("sw-template.js", "utf8")
        .replace("__BUILD_VERSION__", Date.now().toString(36))
        .replace("[/*__PRECACHE__*/]", JSON.stringify(["./", ...files]));
      writeFileSync(join(outDir, "sw.js"), source);
    }
  };
}

/** Adds the manifest and icon links (injected here so Vite doesn't copy the files again under hashed names). */
function appLinks(): Plugin {
  return {
    name: "app-links",
    transformIndexHtml: () => [
      { tag: "link", attrs: { rel: "manifest", href: "./manifest.webmanifest" }, injectTo: "head" },
      { tag: "link", attrs: { rel: "icon", type: "image/png", href: "./icon-192.png" }, injectTo: "head" },
      { tag: "link", attrs: { rel: "apple-touch-icon", href: "./icon-192.png" }, injectTo: "head" }
    ]
  };
}

// base "./" lets the site run from any address, e.g. https://name.github.io/repo-name/.
// Everything is flat: no public/ folder, no subfolders in the build, and fixed file names (app.js, app.css) so that
// uploading a new build simply replaces the old files instead of piling up hashed copies.
export default defineConfig({
  base: "./",
  publicDir: false,
  build: {
    assetsDir: "",
    rollupOptions: {
      input: "app.html",
      output: { entryFileNames: "app.js", chunkFileNames: "[name].js", assetFileNames: "[name][extname]" }
    }
  },
  plugins: [react(), appLinks(), finishSite()],
  esbuild: { jsx: "automatic" },
  test: { environment: "node", globals: false, include: ["*.test.{ts,tsx}"] }
});
