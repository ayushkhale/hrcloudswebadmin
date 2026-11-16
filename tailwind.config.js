/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        "pricing-break": "840px",
      },
      colors: {
        // Primary
        "primary-800": "#1E1B22",
        "primary-700": "#221F26",
        "primary-600": "#27232B",
        "primary-500": "#2B2730",
        "primary-400": "#403D45",
        "primary-300": "#555259",
        "primary-200": "#6B686E",
        "primary-50": "#AAA9AC",

        // Accent
        "accent-800": "#b38135",
        "accent-700": "#cc933d",
        "accent-600": "#e6a644",
        "accent-500": "#FFB84C",
        "accent-400": "#ffbf5e",
        "accent-300": "#ffc670",
        "accent-200": "#FFCD82",

        "white-shade": "#F6F6F6",

        // ── Dark theme surfaces ──────────────────────────────────────────
        // The dark counterparts of `#F8F7FB`, white and `slate-100`. Every
        // one of these is a neutral with some purple left in it, NOT a grey:
        // a true grey beside the brand's purple-600 reads as a dead screen
        // with one coloured button on it.
        //
        // Six steps and no more. A surface, a raised surface and a hairline
        // is everything a card needs, and each extra step is another chance
        // for two screens to pick different ones. These only ever appear
        // behind `dark:` — the light theme keeps its slate values untouched.
        "night-950": "#0B0910", // the page itself — dark's `#F8F7FB`
        "night-900": "#120F1A", // sidebar and top bar, a shade under a card
        "night-850": "#171320", // a card
        "night-800": "#201B2C", // hover, an input, a tile inside a card
        "night-700": "#2A2338", // the hairline a card wears
        "night-600": "#3A3150", // a border meant to be seen (focus, inputs)
      },
      keyframes: {
        "translate-x-reverse": {
          from: { transform: "translateX(0%)" },
          to: { transform: "translateX(-100%)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(36px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-36px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
      },
      animation: {
        "translate-x-reverse": "translate-x-reverse 50s linear infinite",
        "translate-x-reverse-slowed": "translate-x-reverse 30s linear infinite",
        "slide-up": "slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-down": "slide-down 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fade-in 1s ease-out forwards",
        "float": "float 6s ease-in-out infinite",
      },
    },
    fontFamily: {
      sans: ["Manrope", "sans-serif"],
    },
  },
  plugins: [],
};
