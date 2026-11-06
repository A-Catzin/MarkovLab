/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // La subida de CSV desde /admin/importaciones admite archivos de hasta 5 MB (más el formulario).
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
