import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  reactStrictMode: false,
  sassOptions: {
    additionalData: `@use "@/static/additional.scss" as *;`,
  }
};

export default nextConfig;
