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
        // Semantic / CSS-variable-driven colors (match globals.css --color-* vars)
        border: 'hsl(var(--color-border))',
        input: 'hsl(var(--color-input))',
        ring: 'hsl(var(--color-ring))',
        background: 'hsl(var(--color-background))',
        foreground: 'hsl(var(--color-foreground))',
        card: {
          DEFAULT: 'hsl(var(--color-card))',
          foreground: 'hsl(var(--color-card-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--color-primary-light))',
          foreground: 'hsl(var(--color-text))',
        },
        // Design system brand colors
        primary: {
          DEFAULT: '#BD80FF',
          light: '#F2E6FF',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#DEBFFF',
          foreground: '#2F2040',
        },
        accent: {
          DEFAULT: '#FFEA80',
          foreground: '#2F2040',
        },
        text: '#2F2040',
        success: '#9BE673',
        info: '#80D4FF',
        warning: '#EE808A',
        destructive: {
          DEFAULT: '#EE808A',
          foreground: '#ffffff',
        },
        popover: {
          DEFAULT: 'hsl(var(--color-card))',
          foreground: 'hsl(var(--color-card-foreground))',
        },
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
