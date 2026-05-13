import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07111f",
        mist: "#d7e4f4",
        accent: "#3dd5f3",
        ember: "#f59e0b"
      },
      boxShadow: {
        glow: "0 20px 60px rgba(61, 213, 243, 0.12)"
      }
    }
  },
  plugins: []
} satisfies Config;
