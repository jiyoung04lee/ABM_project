import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 유튜브 썸네일 도메인 허용
    domains: ["localhost", "img.youtube.com", "i.ytimg.com"],
  },
};

export default nextConfig;