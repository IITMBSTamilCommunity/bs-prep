import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BSPrep - IITM BS Student Portal',
    short_name: 'BSPrep',
    description: 'The ultimate portal for IITM BS students. GPA tools, notes, quiz prep, and community support.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/new-logo-favicon.png',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
