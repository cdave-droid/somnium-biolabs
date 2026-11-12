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
      // The White Paper page was taken down for now; send its link to the home page until it returns.
      {
        source: "/white-paper",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
