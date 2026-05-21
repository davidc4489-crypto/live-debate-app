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
          muted: "#F9FAFB",
          subtle: "#F3F4F6",
        },
        ink: {
          DEFAULT: "#111827",
          secondary: "#374151",
          muted: "#6B7280",
          faint: "#9CA3AF",
        },
        brand: {
          DEFAULT: "#0A66C2",
          hover: "#004182",
          light: "#E8F3FC",
          ring: "#BFDBFE",
        },
        border: {
          DEFAULT: "#E5E7EB",
          strong: "#D1D5DB",
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
      },
      boxShadow: {
        card: "0 1px 0 rgba(16, 24, 40, 0.04)",
        header: "0 1px 0 rgba(16, 24, 40, 0.06)",
      },
      borderRadius: {
        card: "8px",
        pill: "9999px",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
    },
  },
  plugins: [],
};
