/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // react-beautiful-dnd 호환성을 위해 임시로 비활성화
  output: 'standalone',
}

module.exports = nextConfig

