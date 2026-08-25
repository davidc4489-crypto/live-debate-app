/**
 * Toutes les couleurs pointent vers des variables CSS définies dans
 * `app/globals.css`, en canaux RGB (`9 9 11`) pour rester compatibles avec les
 * modificateurs d'opacité Tailwind (`bg-surface/50`).
 *
 * Conséquence : basculer en mode sombre ne demande que de redéfinir les
 * variables, sans toucher aux centaines de classes déjà écrites.
 */
const withOpacity = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: withOpacity("--surface"),
          muted: withOpacity("--surface-muted"),
          subtle: withOpacity("--surface-subtle"),
          elevated: withOpacity("--surface-elevated"),
        },
        ink: {
          DEFAULT: withOpacity("--ink"),
          secondary: withOpacity("--ink-secondary"),
          muted: withOpacity("--ink-muted"),
          faint: withOpacity("--ink-faint"),
        },
        brand: {
          DEFAULT: withOpacity("--brand"),
          hover: withOpacity("--brand-hover"),
          light: withOpacity("--brand-light"),
          ring: withOpacity("--brand-ring"),
          /** Texte posé sur `bg-brand` : clair en thème clair, sombre en thème sombre. */
          on: withOpacity("--on-brand"),
          accent: withOpacity("--accent"),
          "accent-hover": withOpacity("--accent-hover"),
          "accent-light": withOpacity("--accent-light"),
        },
        border: {
          DEFAULT: withOpacity("--border"),
          strong: withOpacity("--border-strong"),
        },
        success: {
          soft: withOpacity("--success-soft"),
          text: withOpacity("--success-text"),
          border: withOpacity("--success-border"),
        },
        warning: {
          soft: withOpacity("--warning-soft"),
          text: withOpacity("--warning-text"),
          border: withOpacity("--warning-border"),
        },
        danger: {
          soft: withOpacity("--danger-soft"),
          text: withOpacity("--danger-text"),
          border: withOpacity("--danger-border"),
        },
        /** Les deux camps d'un débat — jamais « bon » contre « mauvais ». */
        stance: {
          for: withOpacity("--stance-for"),
          "for-soft": withOpacity("--stance-for-soft"),
          "for-border": withOpacity("--stance-for-border"),
          against: withOpacity("--stance-against"),
          "against-soft": withOpacity("--stance-against-soft"),
          "against-border": withOpacity("--stance-against-border"),
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
        card: "var(--shadow-card)",
        elevated: "var(--shadow-elevated)",
        float: "var(--shadow-float)",
        glow: "var(--shadow-glow)",
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
