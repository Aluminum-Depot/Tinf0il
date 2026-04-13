import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dist = join(root, "dist");

// Clean previous build
if (existsSync(dist)) {
  rmSync(dist, { recursive: true });
}
mkdirSync(dist, { recursive: true });

// 1. Copy UV library files to dist/uv/ (includes default uv.config.js)
const uvSrc = join(
  root,
  "node_modules",
  "@titaniumnetwork-dev",
  "ultraviolet",
  "dist"
);
mkdirSync(join(dist, "uv"), { recursive: true });
cpSync(uvSrc, join(dist, "uv"), { recursive: true });

// 2. Copy public static files to dist/ (custom uv.config.js overwrites the default)
const publicDir = join(root, "Ultraviolet-Static", "public");
cpSync(publicDir, dist, { recursive: true });

console.log("Build complete: static files assembled in dist/");
