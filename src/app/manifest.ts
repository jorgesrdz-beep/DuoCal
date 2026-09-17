import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DuoCal - Tracking Nutricional & Meal Prep en Duo',
    short_name: 'DuoCal',
    description: 'Control de calorías, macros y meal prep colaborativo para el hogar y roomies',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#059669',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/icon.svg',
        sizes: '192x192 512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
