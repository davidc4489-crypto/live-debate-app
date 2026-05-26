/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#FAFAFA",
          subtle: "#F4F4F5",
          elevated: "#FFFFFF",
        },
        ink: {
          DEFAULT: "#09090B",
          secondary: "#3F3F46",
          muted: "#71717A",
          faint: "#A1A1AA",
        },
        brand: {
          DEFAULT: "#18181B",
          hover: "#27272A",
          light: "#F4F4F5",
          ring: "#E4E4E7",
          accent: "#2563EB",
          "accent-hover": "#1D4ED8",
          "accent-light": "#EFF6FF",
        },
        border: {
          DEFAULT: "rgba(9, 9, 11, 0.08)",
          strong: "rgba(9, 9, 11, 0.14)",
        },
        success: {
          soft: "#ECFDF5",
          text: "#047857",
        },
        warning: {
          soft: "#FFFBEB",
          text: "#B45309",
        },
        danger: {
          soft: "#FEF2F2",
          text: "#B91C1C",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      maxWidth: {
        reading: "48rem",
        content: "72rem",
        marketing: "80rem",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        30: "7.5rem",
      },
      boxShadow: {
        card: "0 0 0 1px rgba(9, 9, 11, 0.04), 0 1px 2px rgba(9, 9, 11, 0.04)",
        elevated:
          "0 0 0 1px rgba(9, 9, 11, 0.06), 0 4px 6px -1px rgba(9, 9, 11, 0.05), 0 12px 24px -8px rgba(9, 9, 11, 0.08)",
        float:
          "0 0 0 1px rgba(9, 9, 11, 0.05), 0 8px 30px -12px rgba(9, 9, 11, 0.12)",
        glow: "0 0 80px -20px rgba(37, 99, 235, 0.15)",
      },
      borderRadius: {
        card: "12px",
        lg: "16px",
        pill: "9999px",
      },
      transitionDuration: {
        DEFAULT: "200ms",
        slow: "300ms",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      letterSpacing: {
        tighter: "-0.03em",
        tight: "-0.02em",
      },
    },
  },
  plugins: [],
};
