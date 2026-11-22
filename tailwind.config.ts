import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gemini: {
          base: "#131314",
          surface: "#1e1f20",
          bubble: "#282a2c",
          border: "#2c2d30",
          borderSubtle: "#212226",
          blue: "#4285f4",
          purple: "#9b72cb",
          red: "#d96570",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
