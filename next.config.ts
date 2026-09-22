import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Avatar uploads go through a Server Action. Storage caps the file at 2 MB;
      // this leaves room for the rest of the form.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
