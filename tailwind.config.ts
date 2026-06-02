import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          surface:   "var(--bg-surface)",
        },
        text: {
          primary:   "rgb(var(--fg-rgb))",
          secondary: "rgba(var(--fg-rgb), 0.5)",
          muted:     "rgba(var(--fg-rgb), 0.3)",
        },
        accent: {
          red: "var(--accent)",
        },
        border: "rgba(var(--fg-rgb), 0.1)",
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
        playfair: ["Playfair Display", "serif"],
      },
      fontWeight: {
        black: "900",
        light: "300",
      },
    },
  },
  plugins: [],
};

export default config;
