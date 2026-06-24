import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API proxy is handled via src/app/api/[...path]/route.ts
  // which forwards all /api/* calls to the Express backend (BACKEND_URL env var)
};

export default nextConfig;
