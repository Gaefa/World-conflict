#!/usr/bin/env node
/**
 * Bundle size gate. Fails the build if critical artifacts exceed thresholds.
 * Run after `turbo run build` (i.e. after web static export + server esbuild bundle exist).
 *
 * Thresholds have ~2x headroom over current sizes. If they trip, the first question is
 * "did we add a legit dep?" not "raise the limit."
 */
import { statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MB = 1024 * 1024;

const targets = [
  { path: 'apps/server/dist/index.js', limitMB: 4, kind: 'file' },
  { path: 'apps/web/out',              limitMB: 5, kind: 'dir'  },
];

function dirSize(p) {
  let total = 0;
  for (const entry of readdirSync(p, { withFileTypes: true })) {
    const full = join(p, entry.name);
    if (entry.isDirectory()) total += dirSize(full);
    else if (entry.isFile()) total += statSync(full).size;
  }
  return total;
}

let failed = false;
for (const t of targets) {
  const bytes = t.kind === 'dir' ? dirSize(t.path) : statSync(t.path).size;
  const mb = bytes / MB;
  const ok = mb <= t.limitMB;
  const tag = ok ? 'OK  ' : 'FAIL';
  console.log(`[${tag}] ${t.path.padEnd(30)} ${mb.toFixed(2).padStart(6)} MB  (limit ${t.limitMB} MB)`);
  if (!ok) failed = true;
}

if (failed) {
  console.error('\nBundle size gate failed. Investigate new dependencies before raising limits.');
  process.exit(1);
}
