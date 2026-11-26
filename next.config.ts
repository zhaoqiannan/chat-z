import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  reactStrictMode: true,
  sassOptions: {
    additionalData: `@use "@/static/additional.scss" as *;`,
  },
};

export default nextConfig;
