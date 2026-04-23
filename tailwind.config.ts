import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf7f4',
          100: '#f9ecec',
          200: '#f1d6d3',
          300: '#e5b4ad',
          400: '#d18f87',
          500: '#b96f66',
          600: '#9a544d',
          700: '#7d4039',
          800: '#5e2f2b',
          900: '#42201e',
        },
        gold: {
          400: '#d4a574',
          500: '#c19360',
          600: '#a57a4b',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
