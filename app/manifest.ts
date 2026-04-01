import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ThinkFlow',
    short_name: 'ThinkFlow',
    description: 'AI research visualization — explore ideas as branching conversation trees',
    start_url: '/',
    display: 'standalone',
    background_color: '#f0efed',
    theme_color: '#1a1a1a',
    orientation: 'landscape',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
