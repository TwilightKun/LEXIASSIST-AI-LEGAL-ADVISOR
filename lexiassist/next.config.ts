// next.config.ts
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactCompiler: true,

  async headers() {
    const isProd = process.env.NODE_ENV === "production";

    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'" + (isProd ? "" : " 'unsafe-eval'"), 
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.utfs.io https://*.ufs.sh",
      "font-src 'self' data:",
      "connect-src 'self' https://*.pusher.com wss://*.pusher.com https://*.pusherapp.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.uploadthing.com",
      "frame-src 'self' https://*.utfs.io https://*.ufs.sh",
      "frame-ancestors 'none'", 
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
});