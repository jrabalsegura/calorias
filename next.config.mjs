/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keeps the dev-only indicator away from the bottom navigation.
  devIndicators: { position: "top-right" },
  // The photo of a label (reduced to ~1.500 px on the phone) goes in a server action.
  experimental: { serverActions: { bodySizeLimit: "6mb" } }
};

export default nextConfig;
