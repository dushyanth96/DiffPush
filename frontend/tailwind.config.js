/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#07090E',
        surface: '#0D111A',
        raised: '#131A26',
        popover: '#131A26',
        border: 'rgba(255, 255, 255, 0.08)',
        'diff-emerald': '#10B981',
        'diff-amber': '#F59E0B',
        'diff-rose': '#F43F5E',
        'diff-violet': '#6366F1',
        // Dark-canvas tweak: lighten the two muted text steps so 10–12px
        // labels clear WCAG AA on #0D111A (default 500/600 measured 3.96/2.49).
        slate: {
          500: '#8B9BAD',
          600: '#7D8B9F',
        },
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
