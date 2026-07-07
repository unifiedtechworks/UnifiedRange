import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17211c",
        moss: "#526b4a",
        field: "#e4eee0",
        clay: "#b8603b",
        steel: "#4b6372",
        paper: "#f7f5ef"
      },
      boxShadow: {
        soft: "0 12px 30px rgba(23, 33, 28, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
