import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/notifications", "@mantine/modals", "react-icons"],
  },
  sassOptions: {
    additionalData: `@use "@/static/additional.scss" as *;`,
  },
};

export default nextConfig;
