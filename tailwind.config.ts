// tailwind.config.ts

import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#BD80FF',
          light: '#F2E6FF',
        },
        secondary: '#DEBFFF',
        accent: '#FFEA80',
        text: '#2F2040',
        success: '#9BE673',
        info: '#80D4FF',
        warning: '#EE808A',
      },
      fontFamily: {
        sans: ['var(--font-lato)', 'system-ui', 'sans-serif'],
        accent: ['var(--font-philosopher)', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
