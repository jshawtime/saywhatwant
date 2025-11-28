const fs = require('fs');
const path = require('path');

// Read version from VERSION file at build time
const versionPath = path.join(__dirname, 'VERSION');
const version = fs.existsSync(versionPath) 
  ? fs.readFileSync(versionPath, 'utf8').trim() 
  : '1.0.0';

console.log('[Build] App version:', version);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  // Allow CORS for Cloudflare Workers and R2
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
}

module.exports = nextConfig
