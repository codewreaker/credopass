import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        neonlime: {
          DEFAULT: '#D6FF00',
          50: '#F5FFCC',
          100: '#ECFF99',
          200: '#E3FF66',
          300: '#DAFF33',
          400: '#D6FF00',
          500: '#ABD100',
          600: '#84A200',
          700: '#5C7300',
          800: '#354400',
          900: '#0E1500'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),
  ],
}

export default config
