// Bundle the Fastify server into a single ESM file with all workspace
// packages (@conflict-game/*) inlined. Third-party dependencies from
// node_modules stay external so they can be resolved at runtime from the
// bundled server/node_modules directory (see apps/desktop/package.json
// extraResources).

import { build } from 'esbuild';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));

// The packaged desktop app runs in in-memory mode (no DATABASE_URL), so the
// Drizzle / Postgres code paths are never executed. We stub those modules
// out at bundle time to keep the binary self-contained and avoid shipping
// their (heavy, native-binding) node_modules trees.
const STUB = resolve(__dirname, 'build-stubs/empty.cjs');
const stubPatterns = [
  /^drizzle-orm(\/.*)?$/,
  /^postgres$/,
];

const stubPlugin = {
  name: 'stub-db-packages',
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => {
      if (stubPatterns.some((re) => re.test(args.path))) {
        return { path: STUB };
      }
      return null;
    });
  },
};

// Externals: nothing. Everything is bundled or stubbed. The only requires
// that survive at runtime are Node's built-ins, which esbuild handles
// transparently.
const external = [];

mkdirSync(resolve(__dirname, 'dist'), { recursive: true });

await build({
  entryPoints: [resolve(__dirname, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: resolve(__dirname, 'dist/index.js'),
  plugins: [stubPlugin],
  external,
  sourcemap: false,
  logLevel: 'info',
  // Allow TypeScript files to import each other with .js extensions
  // (tsc's NodeNext convention) — esbuild resolves these transparently.
  resolveExtensions: ['.ts', '.tsx', '.js', '.mjs', '.json'],
  // ESM output that still needs to interop with CJS-only deps (fastify
  // plugins, pino, etc.) must have `require` available.
  banner: {
    js: [
      "import { createRequire as __esbuildCreateRequire } from 'module';",
      "const require = __esbuildCreateRequire(import.meta.url);",
    ].join('\n'),
  },
});

console.log(`✅ Server bundled → dist/index.js`);
console.log(`   externals: ${external.join(', ')}`);
