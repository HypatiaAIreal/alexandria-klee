import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm, dark "ink & parchment" palette — chosen to honour the
        // brown-black ink and aged paper of Klee's manuscript notebooks.
        ink: {
          950: "#100d0a",
          900: "#16120d",
          850: "#1b1611",
          800: "#221c15",
          700: "#2c241b",
          600: "#3a3024",
        },
        parchment: {
          50: "#f7f1e4",
          100: "#efe6d4",
          200: "#e2d4ba",
          300: "#cbb893",
          400: "#a99d88",
        },
        // Accents drawn from Klee's own watercolours.
        ochre: "#d8a657",
        amber: "#e8b964",
        terracotta: "#c1632f",
        rust: "#a8462a",
        kleeblue: "#6f9bb3",
        teal: "#4f8a86",
      },
      fontFamily: {
        display: ['"Playfair Display"', "Georgia", "serif"],
        serif: ['"EB Garamond"', "Georgia", "serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      maxWidth: {
        "8xl": "88rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        shimmer: "shimmer 8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
