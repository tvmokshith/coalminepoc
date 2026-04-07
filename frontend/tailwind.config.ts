import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        coal: {
          50: '#f0f1f5',
          100: '#d1d5e0',
          200: '#a3aac1',
          300: '#757fa2',
          400: '#475483',
          500: '#1a2964',
          600: '#152150',
          700: '#10193c',
          800: '#0a1028',
          900: '#050814',
          950: '#020409',
        },
        mine: {
          amber: '#f59e0b',
          gold: '#eab308',
          green: '#22c55e',
          red: '#ef4444',
          blue: '#3b82f6',
          purple: '#8b5cf6',
          cyan: '#06b6d4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
