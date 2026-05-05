/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Permitir imágenes desde Supabase Storage (signed URLs y públicas)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wlvlhiosyzyeqhyabcnx.supabase.co',
        pathname: '/storage/v1/**',
      },
    ],
    // formats: webp + avif para reducir bytes ~30-50%
    formats: ['image/avif', 'image/webp'],
  },
  // Reduce el tamaño del response cuando Vercel cachea
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;
