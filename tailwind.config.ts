import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{vue,ts}'
  ],
  theme: {
    extend: {
      colors: {
        // Neutral primary (black/white) so UI uses high-contrast monochrome
        primary: {
          DEFAULT: '#111827', // gray-900 (near black)
          dark: '#0b1220',
          light: '#f8fafc' // near white for subtle backgrounds
        }
      },
      borderRadius: {
        xl: '12px'
      }
    }
  },
  plugins: []
} satisfies Config
