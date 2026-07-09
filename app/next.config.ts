import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone bundle only for the Docker image (Dockerfile sets BUILD_STANDALONE);
  // plain `next start` is incompatible with it, so keep it off for local/dev runs.
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
  experimental: {
    serverActions: {
      // Uploaded decks (PPTX/PDF) far exceed the 1 MB default; the form caps
      // files at 20 MB client-side, this adds headroom for multipart overhead.
      bodySizeLimit: "25mb",
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
