import { withPayload } from '@payloadcms/next/withPayload'
import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'
import { hostname, networkInterfaces } from 'node:os'

const config: NextConfig = {
  output: 'standalone',
  // Next rejects a bare '*' wildcard. This covers all dotted hosts, LAN IPs,
  // and this machine's single-label hostname / IPv6 interface addresses.
  allowedDevOrigins:
    process.env.NODE_ENV === 'development'
      ? [
          '**.*',
          hostname(),
          ...Object.values(networkInterfaces()).flatMap((entries) =>
            (entries || []).flatMap(({ address }) => [address, `[${address}]`]),
          ),
        ]
      : undefined,
  experimental: { globalNotFound: true },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...(process.env.NODE_ENV === 'development'
            ? [
                { key: 'Access-Control-Allow-Origin', value: '*' },
                {
                  key: 'Access-Control-Allow-Methods',
                  value: 'GET, HEAD, POST, OPTIONS',
                },
                {
                  key: 'Access-Control-Allow-Headers',
                  value: 'Content-Type, Authorization',
                },
              ]
            : []),
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ]
  },
}
export default withPayload(
  createNextIntlPlugin('./src/i18n/request.ts')(config),
)
