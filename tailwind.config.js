/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens — resolved from CSS variables (see src/index.css) so
        // the same class names work in light & dark. Alpha-aware via <alpha-value>.
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        elevated: 'rgb(var(--elevated) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',

        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          fg: 'rgb(var(--brand-fg) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
          strong: 'rgb(var(--brand-strong) / <alpha-value>)',
        },
        gold: {
          DEFAULT: 'rgb(var(--gold) / <alpha-value>)',
          soft: 'rgb(var(--gold-soft) / <alpha-value>)',
        },
        positive: {
          DEFAULT: 'rgb(var(--positive) / <alpha-value>)',
          soft: 'rgb(var(--positive-soft) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          soft: 'rgb(var(--warning-soft) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          soft: 'rgb(var(--danger-soft) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Hind Siliguri"', 'system-ui', 'sans-serif'],
        sans: ['Inter', '"Hind Siliguri"', 'system-ui', '-apple-system', 'sans-serif'],
        bangla: ['"Hind Siliguri"', '"Noto Sans Bengali"', 'system-ui', 'sans-serif'],
        num: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'balance-sm': ['1.75rem', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '600' }],
        balance: ['2.5rem', { lineHeight: '1.02', letterSpacing: '-0.03em', fontWeight: '600' }],
        'balance-lg': ['3.25rem', { lineHeight: '1', letterSpacing: '-0.035em', fontWeight: '700' }],
      },
      borderRadius: {
        card: '1.25rem',
        '2.5xl': '1.5rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(16 32 27 / 0.04), 0 4px 16px -6px rgb(16 32 27 / 0.10)',
        card: '0 1px 3px rgb(16 32 27 / 0.05), 0 10px 30px -12px rgb(16 32 27 / 0.16)',
        lifted: '0 8px 40px -8px rgb(16 32 27 / 0.24)',
        fab: '0 8px 24px -4px rgb(13 159 110 / 0.44)',
        inset: 'inset 0 1px 0 0 rgb(255 255 255 / 0.06)',
      },
      backgroundImage: {
        'brand-flow': 'linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(var(--brand-strong)) 100%)',
        'ledger-lines':
          'repeating-linear-gradient(180deg, transparent, transparent 31px, rgb(var(--line) / 0.5) 31px, rgb(var(--line) / 0.5) 32px)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'count-pop': {
          '0%': { transform: 'scale(0.98)' },
          '60%': { transform: 'scale(1.015)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        'sheet-in': 'sheet-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both',
        'count-pop': 'count-pop 0.4s ease-out',
        shimmer: 'shimmer 1.6s infinite',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
