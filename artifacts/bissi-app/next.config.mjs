/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  images: { unoptimized: true },
  reactStrictMode: true,
  transpilePackages: [
    "@workspace/api-client-react",
    "@workspace/api-zod",
    "@workspace/api-spec"
  ],
};

export default nextConfig;
