import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.monkeycode-ai.live"],
  eslint: {
    ignoreDuringBuilds: true, // تجاهل أخطاء ESLint أثناء البناء
  },
  typescript: {
    ignoreBuildErrors: true, // تجاهل أخطاء TypeScript أثناء البناء
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-3ff77cba2e6f472094c4271d8b4e68a9.r2.dev', // دومين R2 الخاص بك
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;