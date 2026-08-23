import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copies pdf.js's worker into public/ so it can be served from our own origin.
 *
 * The worker cannot be imported like a normal module — it has to be fetched at
 * runtime by URL. Bundler-specific tricks for that (webpack's `new URL(bare
 * specifier, import.meta.url)`) do not survive a move to Turbopack, and a CDN
 * would break the zero-cost, no-third-party-runtime rule. Copying the file at
 * install time works under every bundler and keeps it version-locked to
 * whatever pdfjs-dist is actually installed.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const targetDir = join(root, "public");
const target = join(targetDir, "pdf.worker.min.mjs");

if (!existsSync(source)) {
  console.warn(`[pdf-worker] ${source} not found — skipping. Is pdfjs-dist installed?`);
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log("[pdf-worker] copied pdf.worker.min.mjs into public/");
