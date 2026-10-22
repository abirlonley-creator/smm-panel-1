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
          blue: "#3A4EFB",
          "blue-hover": "#2C3FE0",
          lime: "#E3FF3B",
          "lime-hover": "#D5F526",
          navy: "#252943",
          "navy-dark": "#1A1D31",
          "navy-light": "#323758",
          neutral: "#DEE0ED",
          "neutral-light": "#F5F6FA",
          "neutral-border": "#E4E6F0",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter, system-ui)", "system-ui", "-apple-system", "BlinkMacSystemFont", "\"Segoe UI\"", "Roboto", "sans-serif"],
      },
      boxShadow: {
        subtle: "0 1px 3px 0 rgba(37, 41, 67, 0.05), 0 1px 2px -1px rgba(37, 41, 67, 0.05)",
        card: "0 4px 6px -1px rgba(37, 41, 67, 0.06), 0 2px 4px -2px rgba(37, 41, 67, 0.04)",
        dropdown: "0 10px 15px -3px rgba(37, 41, 67, 0.1), 0 4px 6px -4px rgba(37, 41, 67, 0.08)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
    },
  },
  plugins: [],
};
export default config;
