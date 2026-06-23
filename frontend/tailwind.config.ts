import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Near-black canvas scale (warm-neutral, NOT navy, NOT pure #000).
        //    New code uses `vn-*`; legacy `ink-*` is remapped to the same values
        //    so existing components flip to the Cursor look with zero class churn.
        vn: {
          base: "#08090A",
          900: "#0B0C0E",
          850: "#101113",
          800: "#161719",
          750: "#1C1D20",
          700: "#232427",
          600: "#2E2F33",
          500: "#3A3B40",
        },
        ink: {
          950: "#08090A",
          900: "#0B0C0E",
          850: "#101113",
          800: "#161719",
          700: "#232427",
          600: "#2E2F33",
        },
        // ── Text / grey ramp (cool-neutral). Never pure #fff for body.
        text: {
          hi: "#F4F5F6",
          DEFAULT: "#C9CBD0",
          mid: "#9A9CA3",
          low: "#6B6D74",
          faint: "#45474D",
        },
        // ── Accent is white. Color in this product is reserved for AQI data only.
        //    Legacy `brand` (was cyan) is remapped to near-white so every old
        //    active-state / primary-button instantly reads monochrome.
        brand: {
          DEFAULT: "#F4F5F6",
          muted: "#9A9CA3",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "ui-sans-serif", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0, 0, 1)",   // snap-settle (Cursor/Linear)
        entrance: "cubic-bezier(0.16, 1, 0.3, 1)", // expo-out for panels/reveals
        exit: "cubic-bezier(0.4, 0, 1, 1)",
      },
      transitionDuration: {
        instant: "80ms",
        fast: "120ms",
        base: "160ms",
        slow: "240ms",
        data: "600ms",
      },
      saturate: {
        125: "1.25",
      },
      keyframes: {
        "vn-fade": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
        "vn-rise": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "none" },
        },
        "vn-shimmer": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "vn-breathe": {
          "0%,100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
        "vn-flash": {
          from: { background: "rgba(255,255,255,0.10)" },
          to: { background: "rgba(255,255,255,0)" },
        },
      },
      animation: {
        "vn-fade": "vn-fade 0.24s cubic-bezier(0.16,1,0.3,1)",
        "vn-rise": "vn-rise 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "vn-breathe": "vn-breathe 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
