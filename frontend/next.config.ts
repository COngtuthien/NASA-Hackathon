import type { NextConfig } from "next";

// Browser talks to the same origin; Next proxies /api/v1/* to the FastAPI backend.
// This keeps CORS closed and makes source-document links (/api/v1/documents/...) work directly.
// Kept in sync with LEGACY in lib/routes.ts (a test asserts they match).
export const LEGACY_REDIRECTS: [string, string][] = [
  ["/assistant", "/copilot"],
  ["/physics/flex", "/phenomena/flame-extinction"],
  ["/physics/bass-ii", "/phenomena/flame-spread"],
  ["/physics/saffire-i", "/phenomena/spacecraft-fire"],
  ["/similar", "/intelligence/similar"],
  ["/compare", "/intelligence/compare"],
  ["/research", "/evidence/literature"],
  ["/ml/flex", "/modeling"],
  ["/quality", "/reliability"],
];

const BACKEND_URL =process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Phase 3 renamed pages around phenomena. Old bookmarks keep working (query string is passed through;
  // the browser keeps any #fragment). Temporary (307) so the mapping can still evolve.
  async redirects() {
    return [
      ...LEGACY_REDIRECTS.map(([source, destination]) => ({ source, destination, permanent: false })),
      { source: "/intelligence", destination: "/intelligence/similar", permanent: false },
    ];
  },
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${BACKEND_URL}/api/v1/:path*` }];
  },
};

export default nextConfig;
