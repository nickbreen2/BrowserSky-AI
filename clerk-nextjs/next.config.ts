import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack(config, { nextRuntime }) {
    if (nextRuntime === "edge") {
      config.resolve.conditionNames = [
        "edge-light",
        "worker",
        "browser",
        ...config.resolve.conditionNames,
      ];
    }
    return config;
  },
};

export default nextConfig;
