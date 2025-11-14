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
        primary: {
          DEFAULT: '#1d4ed8',
          dark: '#1e40af',
          light: '#e0e7ff'
        }
      },
      borderRadius: {
        xl: '12px'
      }
    }
  },
  plugins: []
} satisfies Config
