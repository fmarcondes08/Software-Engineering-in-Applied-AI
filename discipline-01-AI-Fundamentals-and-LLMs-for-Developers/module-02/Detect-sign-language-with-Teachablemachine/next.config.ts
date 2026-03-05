import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@teachablemachine/image", "@tensorflow/tfjs"],
};

export default nextConfig;
