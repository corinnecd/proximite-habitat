import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["web-push"],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  images: {
    remotePatterns: [
      {
        // Buckets publics Supabase Storage
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // Buckets privés Supabase Storage (signed URLs)
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
      {
        // Signed URLs via le proxy authentifié
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/authenticated/**",
      },
    ],
  },
};

export default nextConfig;
