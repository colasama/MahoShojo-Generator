import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 图片优化配置（Cloudflare Pages 不支持默认的图片优化）
  images: {
    unoptimized: true
  },
  
  // 其他配置
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
