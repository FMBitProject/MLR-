import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone bundle only for the Docker image (Dockerfile sets BUILD_STANDALONE);
  // plain `next start` is incompatible with it, so keep it off for local/dev runs.
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
  // pdf-parse (pdfjs-dist) loads its worker + Node built-ins at runtime and
  // breaks when bundled; keep it external so it's required from node_modules.
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    serverActions: {
      // Uploaded decks (PPTX/PDF) exceed the 1 MB default. The real ceiling is
      // the host's: Vercel hard-caps a Function's request body at 4.5 MB, so
      // the form caps files at 4 MB (see lib/upload.ts). Keep this just above
      // that cap so the client-side check is what users actually hit, and so
      // local dev fails at roughly the same point production does.
      bodySizeLimit: "5mb",
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
