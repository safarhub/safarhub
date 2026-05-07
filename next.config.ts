import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // reactCompiler: true,

  // ✅ Removed "turbo" (not valid anymore)
  experimental: {
    // You can still include other valid flags here, for example:
    // reactCompiler: true, // already top-level
    // serverActions: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },

  // Prevent Next.js from inferring a higher workspace root on Windows when
  // multiple lockfiles exist outside this project.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
