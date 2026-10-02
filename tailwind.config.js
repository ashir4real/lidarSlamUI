/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'rgb(var(--bg-primary) / <alpha-value>)',
          800: 'rgb(var(--bg-secondary) / <alpha-value>)',
          700: 'rgb(var(--bg-tertiary) / <alpha-value>)',
          600: 'rgb(var(--bg-tertiary) / <alpha-value>)',
        },
        neon: {
          cyan: 'rgb(var(--neon-cyan) / <alpha-value>)',
          blue: 'rgb(var(--neon-blue) / <alpha-value>)',
          purple: 'rgb(var(--neon-purple) / <alpha-value>)',
          amber: 'rgb(var(--neon-amber) / <alpha-value>)',
          red: 'rgb(var(--neon-red) / <alpha-value>)',
          emerald: 'rgb(var(--neon-emerald) / <alpha-value>)',
        },
        dim: { DEFAULT: '#9CA3AF', dark: '#4B5563' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
        blink: 'blink 1s steps(2) infinite',
        scan: 'scan 4s linear infinite',
        glow: 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-dot': {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.35', transform: 'scale(0.85)' },
        },
        blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.25' } },
        scan: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100%)' } },
        glow: {
          '0%,100%': { boxShadow: '0 0 8px rgb(var(--neon-red) / 0.8)' },
          '50%': { boxShadow: '0 0 22px rgb(var(--neon-red) / 0.9)' },
        },
      },
    },
  },
  plugins: [],
};