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
};

export default nextConfig;
