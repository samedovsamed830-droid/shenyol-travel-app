/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '192.168.0.101',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ibb.co' },
      { protocol: 'https', hostname: 'ibb.co' },
      { protocol: 'https', hostname: 'imgbb.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },
}

export default nextConfig