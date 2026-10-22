#!/usr/bin/env node
// Generates Subresource Integrity (SRI) hashes for every file in dist/, so a
// consumer loading vellar-sdk from a CDN (unpkg, jsdelivr) can pin an
// `integrity="sha384-..."` attribute against a specific, verifiable build
// rather than trusting the CDN to serve the bytes npm actually published.
//
// Run after `npm run build`, so dist/ reflects the commit being released:
//
//   node scripts/generate-sri-hashes.mjs            # print to stdout
//   node scripts/generate-sri-hashes.mjs --write     # also write dist/sri-hashes.json
//
// The release workflow (.github/workflows/publish.yml) runs this with
// --write before `npm publish`, so sri-hashes.json ships inside the published
// tarball (it is not excluded by the package.json "files" allowlist's "dist"
// entry) and is also attachable to the GitHub release notes for the tag.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");

/** SRI only covers algorithms browsers are required to support: sha256/384/512. */
const ALGORITHM = "sha384";

/**
 * Compute the SRI hash for a single file's bytes, in the
 * `<algorithm>-<base64 digest>` form the `integrity` attribute expects.
 */
export function computeSriHash(bytes, algorithm = ALGORITHM) {
  const digest = createHash(algorithm).update(bytes).digest("base64");
  return `${algorithm}-${digest}`;
}

/** Recursively list every regular file under `dir`, relative to `dir`. */
function listFilesRecursive(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      for (const nested of listFilesRecursive(fullPath)) {
        results.push(path.join(entry, nested));
      }
    } else if (stat.isFile()) {
      results.push(entry);
    }
  }
  return results.sort();
}

/**
 * Build the { "dist/foo.js": "sha384-..." } map for every file under
 * `distDir`. Exported so the comparison test can call it directly against a
 * freshly rebuilt dist/ without shelling out.
 */
export function generateSriHashes(targetDistDir = distDir) {
  const hashes = {};
  for (const relativePath of listFilesRecursive(targetDistDir)) {
    const bytes = readFileSync(path.join(targetDistDir, relativePath));
    hashes[path.join("dist", relativePath)] = computeSriHash(bytes);
  }
  return hashes;
}

function main() {
  const hashes = generateSriHashes();
  const output = JSON.stringify(hashes, null, 2) + "\n";

  process.stdout.write(output);

  if (process.argv.includes("--write")) {
    const outPath = path.join(distDir, "sri-hashes.json");
    writeFileSync(outPath, output);
    process.stderr.write(`\nWrote ${Object.keys(hashes).length} hash(es) to ${outPath}\n`);
  }
}

// Only run when invoked directly (`node scripts/generate-sri-hashes.mjs`),
// not when imported by the test that exercises generateSriHashes/computeSriHash.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
