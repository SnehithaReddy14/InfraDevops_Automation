/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#066AAB',
          hover: '#055990',
          light: '#E6F4FC',
        },
        secondary: {
          DEFAULT: '#7A2CFF',
          hover: '#6320D6',
          magenta: '#BB4CF0',
          dark: '#0B1220',
        },
        success: {
          DEFAULT: '#22C55E',
          light: '#F0FDF4',
          dark: '#15803D',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light: '#FEF3C7',
          dark: '#B45309',
        },
        danger: {
          DEFAULT: '#EF4444',
          light: '#FEF2F2',
          dark: '#B91C1C',
        },
        background: {
          light: '#FFFFFF',
          dark: '#0B1220',
        },
        card: {
          light: '#FFFFFF',
          dark: '#0F172A',
        },
        border: {
          light: '#E5E7EB',
          dark: '#1E293B',
        }
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'SF Pro Display', 'sans-serif'],
      },
      borderRadius: {
        'lg': '16px',
        'xl': '20px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.02)',
        'premium': '0 10px 30px -10px rgba(0, 0, 0, 0.03), 0 1px 1px 0 rgba(0, 0, 0, 0.01)',
      }
    },
  },
  plugins: [],
}
