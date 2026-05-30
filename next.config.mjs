/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Manuscript facsimiles are served as static files from /public/manuscripts.
    // They are already sized for the archive, so we skip the optimizer.
    unoptimized: true,
  },
};

export default nextConfig;
