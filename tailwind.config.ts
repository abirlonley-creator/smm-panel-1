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
        aura: {
          ink: "#111413",
          "ink-2": "#1B201E",
          "line-dark": "#222826",
          bone: "#F3F1EA",
          card: "#FFFFFF",
          line: "#E4E0D3",
          lime: "#D4F04F",
          "lime-hover": "#C5E23A",
          forest: "#5E8C1F",
          "forest-dark": "#3F6212",
          clay: "#C4552D",
          muted: "#5B625F",
          "muted-dark": "#9AA39F",
          "warn-bg": "#FBF0DC",
          warn: "#B7791F",
          telegram: "#229ED9",
          views: "#2F6B3A",
          comments: "#2A9D8F",
          likes: "#C4552D",
          saves: "#E0A030",
          shares: "#7C5CBF",
        },
        brand: {
          blue: "#5E8C1F",
          "blue-hover": "#3F6212",
          lime: "#D4F04F",
          "lime-hover": "#C5E23A",
          navy: "#111413",
          "navy-dark": "#111413",
          "navy-light": "#1B201E",
          neutral: "#E4E0D3",
          "neutral-light": "#F3F1EA",
          "neutral-border": "#E4E0D3",
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
