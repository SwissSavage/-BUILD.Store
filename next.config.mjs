/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * /showcase was public and indexed before the rename to /portfolio.
   * Permanent redirect so external links and search results survive
   * rather than landing on a 404.
   */
  async redirects() {
    return [
      { source: "/showcase", destination: "/portfolio", permanent: true },
    ];
  },

  /**
   * Emit a self-contained deployable at .next/standalone. Copies only
   * the production dependencies + files Next.js actually uses at
   * runtime into a minimal directory tree, so the Docker image we ship
   * to ghcr.io stays small (~200MB vs. ~1GB with full node_modules)
   * and cold-start is quick. Required by the Dockerfile in repo root.
   */
  output: "standalone",

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
