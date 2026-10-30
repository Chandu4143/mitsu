import type { NextConfig } from "next";

// The desktop build (`pnpm build:desktop`) emits a static bundle that the Tauri
// shell serves from `out/`. A static export cannot use server-side rewrites, so
// the browser build keeps the proxy and the desktop build talks to the local
// API directly through `window.__MITSU_API_BASE__`.
const staticExport = process.env.MITSU_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  ...(staticExport
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "http://127.0.0.1:8000/api/:path*",
            },
          ];
        },
      }),
};

export default nextConfig;
