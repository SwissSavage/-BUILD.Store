/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Strip the `X-Powered-By: Next.js` header from responses. Cosmetic
   * hygiene — one fewer request byte, one fewer piece of fingerprint
   * signal for anyone scanning the surface.
   */
  poweredByHeader: false,

  /**
   * Explicit off so a future maintainer doesn't flip it on by accident.
   * Source maps in production ship megabytes of unminified paths to
   * every visitor and reveal internal file structure.
   */
  productionBrowserSourceMaps: false,

  /**
   * Compression is on by default at the Next.js layer; making it
   * explicit keeps intent legible when we swap to Dokploy + Cloudflare
   * (Cloudflare will re-compress at the edge, which is fine).
   */
  compress: true,

  experimental: {
    /**
     * Tree-shake barrel imports aggressively. When a package exports
     * hundreds of symbols and we import only a handful, this makes Next
     * split-import each one instead of dragging in the whole module.
     * Free bundle savings once we start pulling in bigger libraries at
     * the auth + payments swap.
     */
    optimizePackageImports: ["clsx", "tailwind-merge"],
  },
};

export default nextConfig;
  },
};

export default nextConfig;
