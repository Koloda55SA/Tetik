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
        'accent-soft': 'var(--c-accent-soft)',
        ok: 'var(--c-success)',
        'ok-soft': 'var(--c-success-soft)',
        danger: 'var(--c-danger)',
        warn: 'var(--c-warning)',
        footer: 'var(--c-footer)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        ui: 'var(--font-ui)',
      },
      borderRadius: {
        card: 'var(--r-md)',
        btn: 'var(--r-sm)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
        top: 'var(--shadow-top)',
      },
    },
  },
  plugins: [],
}
