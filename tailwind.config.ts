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
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.18s ease-out forwards",
        slideInRight: "slideInRight 0.2s ease-out forwards",
      },
    },
  },
  plugins: [],
} satisfies Config;
