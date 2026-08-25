"use client";

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "argumen:theme";

/**
 * Script injecté avant le premier rendu.
 *
 * Sans lui, la page s'affiche une fraction de seconde en thème clair avant que
 * React n'applique le choix enregistré — un flash blanc désagréable pour qui a
 * choisi le sombre.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", preference);
  }
  try {
    if (preference === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Navigation privée ou stockage bloqué : le choix vaut pour cette page.
  }
}
