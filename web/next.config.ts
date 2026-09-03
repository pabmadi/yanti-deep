import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Node 24 built-in sqlite; keep the runtime on Node, not edge.
  serverExternalPackages: [],
};

export default nextConfig;
