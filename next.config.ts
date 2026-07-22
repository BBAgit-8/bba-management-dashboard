import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required so `opennextjs-cloudflare build --skipBuild` can find
  // .next/standalone produced by our webpack-forced next build.
  output: "standalone",
};

export default nextConfig;
