import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tensorflow/tfjs"],
};

export default nextConfig;
