import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: token("--ink-950"),
          900: token("--ink-900"),
          850: token("--ink-850"),
          800: token("--ink-800"),
          750: token("--ink-750"),
          700: token("--ink-700"),
          600: token("--ink-600"),
          500: token("--ink-500"),
        },
        navy: {
          950: "#071827",
          900: "#102A43",
          800: "#163A56",
        },
        line: {
          DEFAULT: token("--line"),
          strong: token("--line-strong"),
        },
        marine: {
          300: token("--marine-300"),
          400: token("--marine-400"),
          500: token("--marine-500"),
          600: token("--marine-600"),
          700: token("--marine-700"),
        },
        signal: {
          cyan: token("--signal-cyan"),
          green: token("--signal-green"),
          amber: token("--signal-amber"),
          red: token("--signal-red"),
        },
        slate: {
          50: token("--slate-50"),
          100: token("--slate-100"),
          200: token("--slate-200"),
          300: token("--slate-300"),
          400: token("--slate-400"),
          500: token("--slate-500"),
          600: token("--slate-600"),
          700: token("--slate-700"),
        },
        red: {
          200: token("--red-200"),
          300: token("--red-300"),
          400: token("--red-400"),
          500: token("--red-500"),
          600: token("--red-600"),
        },
        amber: {
          200: token("--amber-200"),
          300: token("--amber-300"),
          400: token("--amber-400"),
          500: token("--amber-500"),
          600: token("--amber-600"),
        },
        emerald: {
          200: token("--emerald-200"),
          300: token("--emerald-300"),
          400: token("--emerald-400"),
          500: token("--emerald-500"),
          600: token("--emerald-600"),
        },
        sky: {
          200: token("--sky-200"),
          300: token("--sky-300"),
          400: token("--sky-400"),
          500: token("--sky-500"),
          600: token("--sky-600"),
        },
        cyan: {
          200: token("--cyan-200"),
          300: token("--cyan-300"),
          400: token("--cyan-400"),
          500: token("--cyan-500"),
          600: token("--cyan-600"),
        },
        blue: {
          300: token("--blue-300"),
          400: token("--blue-400"),
          500: token("--blue-500"),
          600: token("--blue-600"),
        },
        violet: {
          300: token("--violet-300"),
          400: token("--violet-400"),
          500: token("--violet-500"),
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["'Instrument Sans'", "Inter", "ui-sans-serif", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px", letterSpacing: "0.08em" }],
        "3xs": ["9px", { lineHeight: "12px", letterSpacing: "0.1em" }],
      },
      borderRadius: {
        panel: "12px",
        card: "16px",
      },
      boxShadow: {
        panel: "0 1px 0 0 rgb(var(--shadow-inset) / 0.55) inset, 0 18px 40px -34px rgb(var(--shadow-color) / 0.5)",
        float: "0 28px 70px -38px rgb(var(--shadow-color) / 0.55)",
        lift: "0 22px 55px -32px rgb(var(--shadow-color) / 0.5)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgb(var(--grid-line) / 0.6) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--grid-line) / 0.6) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "32px 32px",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.35", transform: "scale(0.82)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "sweep": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(220%)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(22px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "ship-cross": {
          from: { transform: "translate3d(-12%, 0, 0) rotate(-0.6deg)" },
          to: { transform: "translate3d(12%, 0, 0) rotate(-0.6deg)" },
        },
        bob: {
          "0%, 100%": { transform: "translateY(0) rotate(-0.35deg)" },
          "50%": { transform: "translateY(-7px) rotate(0.35deg)" },
        },
        drift: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "wave-shift": {
          from: { transform: "translate3d(0, 0, 0)" },
          to: { transform: "translate3d(-50%, 0, 0)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-9px)" },
        },
        "slow-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 2.4s ease-in-out infinite",
        "slide-in": "slide-in 180ms ease-out both",
        sweep: "sweep 2.6s ease-in-out infinite",
        "fade-up": "fade-up 700ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "ship-cross": "ship-cross 36s ease-in-out infinite alternate",
        bob: "bob 6s ease-in-out infinite",
        drift: "drift 60s linear infinite",
        "wave-shift": "wave-shift 14s linear infinite",
        marquee: "marquee 34s linear infinite",
        float: "float 7s ease-in-out infinite",
        "slow-spin": "slow-spin 18s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
