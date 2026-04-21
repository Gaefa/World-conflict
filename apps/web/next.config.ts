import type { NextConfig } from "next";

// Static export: the entire UI is client-side (all pages are 'use client',
// there are no API routes, no server components with runtime data-fetching).
// Next.js emits a fully static site into `out/`, which the desktop app loads
// via a file:// URL. No Next.js runtime server, no localhost port for the
// UI — only the Fastify server (http://localhost:3002) remains.
const nextConfig: NextConfig = {
  output: "export",
  // Required for static export: disable Image Optimization (the default
  // loader needs a runtime server).
  images: { unoptimized: true },
  // Trailing slash makes file:// routing work for nested paths since there
  // is no server to rewrite `/foo` -> `/foo/index.html`.
  trailingSlash: true,
  // Workspace packages ship raw TypeScript and use NodeNext `.js` import
  // specifiers that resolve to `.ts` source. Turbopack needs them listed
  // here to run them through the TS loader and remap extensions.
  transpilePackages: [
    '@conflict-game/shared-types',
    '@conflict-game/game-logic',
    '@conflict-game/game-engine',
    '@conflict-game/utils',
  ],
};

export default nextConfig;
