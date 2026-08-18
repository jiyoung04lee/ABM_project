import type { NextConfig } from "next";

const backendApiUrl = (
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // Django API routes use trailing slashes. If Next.js strips one before the
  // rewrite, Django redirects to /api/... and the /backend-api proxy prefix is
  // lost, causing the browser to land on the frontend 404 page.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        // The wildcard does not retain the trailing slash. Add it explicitly
        // because Django's API URLs are slash-terminated.
        source: "/backend-api/api/:path*",
        destination: `${backendApiUrl}/api/:path*/`,
      },
      {
        source: "/backend-api/:path*",
        destination: `${backendApiUrl}/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/media/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
    ],
  },
};

export default nextConfig;
