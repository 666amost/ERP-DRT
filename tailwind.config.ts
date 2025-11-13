import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{vue,ts}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb'
        }
      },
      borderRadius: {
        xl: '12px'
      }
    }
  },
  plugins: []
} satisfies Config
