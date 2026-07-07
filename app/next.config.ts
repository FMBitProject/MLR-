import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow Server Actions when the app is accessed through a
      // port-forwarding proxy (GitHub Codespaces, Gitpod) whose public host
      // differs from the local origin.
      allowedOrigins: [
        "localhost:3000",
        "localhost:3123",
        "*.app.github.dev",
        "*.githubpreview.dev",
        "*.gitpod.io",
      ],
    },
  },
};

export default nextConfig;
