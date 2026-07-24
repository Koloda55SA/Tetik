/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--c-bg)',
        surface: 'var(--c-surface)',
        surface2: 'var(--c-surface2)',
        line: 'var(--c-border)',
        ink: 'var(--c-text)',
        muted: 'var(--c-text-muted)',
        accent: 'var(--c-accent)',
        'accent-hover': 'var(--c-accent-hover)',
        'accent-fg': 'var(--c-accent-fg)',
        ok: 'var(--c-success)',
        danger: 'var(--c-danger)',
        warn: 'var(--c-warning)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        ui: 'var(--font-ui)',
      },
      borderRadius: {
        card: 'var(--r-md)',
        btn: 'var(--r-sm)',
      },
    },
  },
  plugins: [],
}
