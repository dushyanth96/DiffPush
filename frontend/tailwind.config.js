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
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
