/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        et: {
          bg: "#0f1c15",
          panel: "#1a2f23",
          border: "#5c4033",
          gold: "#f4c430",
          sky: "#87ceeb",
          text: "#f3f0e6",
          muted: "#a0a0a0",
          joy: "#ffd700",
          calm: "#87ceeb",
          sad: "#6a5acd",
          angry: "#ff4500",
          tired: "#808080",
          anxious: "#ff8c00",
        },
      },
      fontFamily: {
        display: ["ZCOOL KuaiLe", "Press Start 2P", "cursive"],
        pixel: ["Press Start 2P", "cursive"],
        number: ["VT323", "monospace"],
        body: ["Noto Sans SC", "sans-serif"],
      },
      boxShadow: {
        pixel: "4px 4px 0 rgba(0,0,0,0.25)",
      },
    },
  },
  plugins: [],
};
