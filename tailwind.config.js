/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Legacy palette (kept for components not yet re-themed) ──
        'vibrant-coral': {
          50:  '#fceae8', 100: '#fad6d1', 200: '#f5ada3', 300: '#f08475',
          400: '#eb5a47', 500: '#e63119', 600: '#b82714', 700: '#8a1e0f',
          800: '#5c140a', 900: '#2e0a05', 950: '#200704',
        },
        'lemon-chiffon': {
          50:  '#fbfbe9', 100: '#f8f6d3', 200: '#f1eda7', 300: '#eae47b',
          400: '#e2db50', 500: '#dbd224', 600: '#afa81d', 700: '#847e15',
          800: '#58540e', 900: '#2c2a07', 950: '#1f1d05',
        },
        'ash-grey': {
          50:  '#eff5f4', 100: '#e0ebea', 200: '#c0d8d5', 300: '#a1c4bf',
          400: '#82b0aa', 500: '#629d95', 600: '#4f7d77', 700: '#3b5e59',
          800: '#273f3c', 900: '#141f1e', 950: '#0e1615',
        },
        'tropical-teal': {
          50:  '#eef6f6', 100: '#deeced', 200: '#bcdadc', 300: '#9bc7ca',
          400: '#79b4b9', 500: '#58a2a7', 600: '#468186', 700: '#356164',
          800: '#234143', 900: '#122021', 950: '#0c1717',
        },
        'soft-linen': {
          50:  '#f3f5ef', 100: '#e6ebe0', 200: '#cdd7c1', 300: '#b4c3a2',
          400: '#9baf83', 500: '#829c63', 600: '#687c50', 700: '#4e5d3c',
          800: '#343e28', 900: '#1a1f14', 950: '#12160e',
        },
        // ── NeuroBank dark palette ──────────────────────────────────
        'nb': {
          // Page & surface backgrounds (darkest → lightest)
          950: '#06080f',
          900: '#131926',  // Page bg (lighter canvas)
          850: '#0d1120',
          800: '#0e1220',  // Sidebar, header, action bars
          750: '#05080e',  // Card bg (true near-black, sunken)
          700: '#0b0f1e',  // Hover rows, group headers
          650: '#18223a',  // Active nav
          600: '#1c2844',  // Borders (standard)
          500: '#253357',  // Borders (emphasis)
        },
        // NeuroBank blue accent
        'neuro': {
          50:  '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#4f7ef7', 600: '#3b6aef', 700: '#2355d4',
          800: '#1a42b0', 900: '#12318a',
        },
      },
    },
  },
  plugins: [],
}
