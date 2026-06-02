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
          primary: "#0a0a0a",
          secondary: "#111111",
          surface: "#1a1a1a",
        },
        text: {
          primary: "#f0ebe0",
          secondary: "rgba(240,235,224,0.5)",
          muted: "rgba(240,235,224,0.3)",
        },
        accent: {
          red: "#c0392b",
        },
        border: "rgba(240,235,224,0.1)",
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
