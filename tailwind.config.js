/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        figma: {
          bg: "#1E1E1E",
          surface: "#2C2C2C",
          elevated: "#383838",
          border: "#3E3E3E",
          accent: "#7B61FF",
          "accent-hover": "#9747FF",
          text: "#FFFFFF",
          "text-secondary": "#ABABAB",
          "text-placeholder": "#717171",
          error: "#F24822",
          "error-surface": "#3D1A14",
          success: "#1BC47D",
          "success-surface": "#0D2D1E",
        },
      },
    },
  },
  plugins: [],
};
