import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Clinical Reasoning page was removed; send old links to the home page.
  async redirects() {
    return [
      {
        source: "/clinical-reasoning",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
