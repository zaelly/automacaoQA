import plugin from 'tailwindcss/plugin'

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        primary: 'hsl(var(--primary))',
        'primary-glow': 'hsl(var(--primary-glow))',
        accent: 'hsl(var(--accent))',
      },
    },
  },
  plugins: [
    plugin(function({ addUtilities, theme }) {
      addUtilities({
        '.border-border': {
          borderColor: theme('colors.border'),
        },
      })
    }),
  ],
}
