/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        surface: '#121215',
        primary: '#f4f4f5',
        accent: '#e4e4e7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      height: {
        dvh: '100dvh',
      },
      minHeight: {
        dvh: '100dvh',
      },
    },
  },
  plugins: [],
}
