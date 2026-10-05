/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Delulu brand colors
        "delulu-yellow": "#f6c324",
        "delulu-yellow-reserved": "#f6c324",
        "delulu-green": "#35d07f",
        "delulu-charcoal": "#1a1a19",
        "delulu-dark": "#1a1a19",
        "delulu-white": "#ffffff",
        "delulu-light-gray": "#dfdfd9",
        "delulu-border": "#d4d4ce",
        "delulu-blue": {
          DEFAULT: "#2f6be0",
          light: "#eef4ff",
          border: "#b5cbf5",
        },

        // Redesign palette — docs/redesign/README.md
        ink: { DEFAULT: "#161615", 2: "#2a2a28", 3: "#3a3a37" },
        paper: "#f7f7f4",
        line: "#e6e6e0",
        faint: "#8a8a83",
        yellow: { DEFAULT: "#f6c324", edge: "#c99a0a", soft: "#fdf1c7", line: "#e5b41c" },
        green: { DEFAULT: "#2db36f", strong: "#1f9a5b", edge: "#157041", soft: "#e1f5ea", line: "#b9e5cc" },
        orange: { DEFAULT: "#b4410c", soft: "#fbece3" },
        blue: { DEFAULT: "#2f6be0", edge: "#1f4fb0", soft: "#eef4ff", line: "#b5cbf5", tint: "#e3edff" },
        pink: { DEFAULT: "#c23e6e", soft: "#fde6ef", line: "#f6c3d6", bright: "#ec5b8d" },
        purple: { DEFAULT: "#6d3fd6", soft: "#eee7fe" },
        
        // Semantic colors using CSS variables — stored as space-separated RGB
        // triplets in globals.css (not hex) so Tailwind can apply opacity
        // modifiers (e.g. bg-card/80) via the <alpha-value> substitution below.
        // A bare var(--x) can't be given an opacity modifier at build time
        // since Tailwind can't resolve it to RGB components itself.
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
      },
      fontFamily: {
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        brand: ["var(--font-brand)", "var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        edge: "0 4px 0 #e6e6e0",
        "edge-sm": "0 3px 0 #e6e6e0",
        "edge-ink": "0 4px 0 #000000",
        "edge-yellow": "0 4px 0 #c99a0a",
        "edge-yellow-line": "0 4px 0 #e5b41c",
        "edge-green": "0 4px 0 #1e8a52",
        "edge-green-line": "0 4px 0 #b9e5cc",
        "edge-blue": "0 4px 0 #1f4fb0",
        "edge-blue-line": "0 4px 0 #b5cbf5",
        "edge-pink-line": "0 4px 0 #f6c3d6",
        lift: "0 30px 50px -30px rgba(22,22,21,.55)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "fade-in": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: 0, transform: "translateY(30px) scale(0.95)" },
          to: { opacity: 1, transform: "translateY(0) scale(1)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(252, 255, 82, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(252, 255, 82, 0.6)" },
        },
        "progress-indeterminate": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
        },
        "logo-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.08)", opacity: "0.85" },
        },
        rise: {
          from: { opacity: 0, transform: "translateY(16px)" },
          to: { opacity: 1, transform: "none" },
        },
        "bounce-in": {
          "0%": { opacity: 0, transform: "scale(.3)" },
          "100%": { opacity: 1, transform: "scale(1)" },
        },
        wiggle: {
          "0%, 78%, 100%": { transform: "rotate(0)" },
          "82%": { transform: "rotate(-10deg)" },
          "86%": { transform: "rotate(9deg)" },
          "90%": { transform: "rotate(-6deg)" },
          "94%": { transform: "rotate(3deg)" },
        },
        bob: { "50%": { transform: "translateY(-6px)" } },
        "ring-pulse": {
          "0%": { transform: "scale(.85)", opacity: 1 },
          "100%": { transform: "scale(1.2)", opacity: 0 },
        },
        "hole-pulse": {
          "0%": { boxShadow: "0 0 0 0 rgba(246,195,36,.8)" },
          "100%": { boxShadow: "0 0 0 14px rgba(246,195,36,0)" },
        },
        "confetti-fall": {
          from: { transform: "translateY(0) rotate(0)" },
          to: { transform: "translateY(920px) rotate(760deg)" },
        },
        "stamp-slam": {
          "0%": { opacity: 0, transform: "rotate(-9deg) scale(2.8)" },
          "100%": { opacity: 1, transform: "rotate(-9deg) scale(1)" },
        },
        "bar-fill": { from: { transform: "scaleX(0)" } },
        "sheet-up": {
          from: { transform: "translateY(60%)", opacity: 0 },
          to: { transform: "none", opacity: 1 },
        },
        spark: { from: { transform: "scale(.85)" }, to: { transform: "scale(1.25)" } },
        scan: { "0%, 100%": { top: "6%" }, "50%": { top: "90%" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "progress-indeterminate": "progress-indeterminate 1.4s ease-in-out infinite",
        "logo-pulse": "logo-pulse 1.6s ease-in-out infinite",
        rise: "rise .45s cubic-bezier(.2,.8,.2,1) both",
        "bounce-in": "bounce-in .6s cubic-bezier(.34,1.56,.64,1) both",
        wiggle: "wiggle 2.8s ease-in-out infinite",
        bob: "bob 1.6s ease-in-out infinite",
        "ring-pulse": "ring-pulse 1.8s ease-out infinite",
        "hole-pulse": "hole-pulse 1.8s ease-out infinite",
        "confetti-fall": "confetti-fall 2.8s cubic-bezier(.25,.6,.4,1) both",
        "stamp-slam": "stamp-slam .45s cubic-bezier(.5,0,.75,0) both",
        "bar-fill": "bar-fill 1s cubic-bezier(.2,.8,.2,1) .3s both",
        "sheet-up": "sheet-up .5s cubic-bezier(.34,1.56,.64,1) both",
        spark: "spark .6s ease-in-out infinite alternate",
        scan: "scan 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
