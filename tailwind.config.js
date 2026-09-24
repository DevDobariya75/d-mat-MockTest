/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // dMAT brand magenta, sampled from the official preparatory materials.
        brand: {
          50: '#fdf2f7',
          100: '#fce7f0',
          200: '#fbcfe1',
          300: '#f8a8c8',
          400: '#f072a5',
          500: '#d94183',
          600: '#b5165f',
          700: '#9c0050',
          800: '#7d0041',
          900: '#5d0031',
        },
        ink: {
          50: '#f7f8fa',
          100: '#eef0f4',
          200: '#dde1e9',
          300: '#c3cad7',
          400: '#8c97ab',
          500: '#5f6b81',
          600: '#43506a',
          700: '#2f3a50',
          800: '#1f2738',
          900: '#141a27',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(20, 26, 39, 0.06), 0 8px 24px -12px rgba(20, 26, 39, 0.18)',
      },
    },
  },
  plugins: [],
};
