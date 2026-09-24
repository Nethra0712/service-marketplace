import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The admin app never renders data fetched from anywhere but its own API
  // client (see lib/api-client.ts), so there is nothing here for
  // image/remote-pattern config to allow-list.
  reactStrictMode: true,
};

export default nextConfig;
