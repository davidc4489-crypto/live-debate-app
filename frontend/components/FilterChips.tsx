"use client";

import { DebateTheme } from "@/mock/debates";

interface FilterChipsProps {
  themes: DebateTheme[];
  activeTheme: DebateTheme | "Tous";
  onChange: (theme: DebateTheme | "Tous") => void;
}

export function FilterChips({ themes, activeTheme, onChange }: FilterChipsProps) {
  return (
    <div className="chips-wrap reveal">
      <button
        type="button"
        className={`chip ${activeTheme === "Tous" ? "active" : ""}`}
        onClick={() => onChange("Tous")}
      >
        Tous
      </button>
      {themes.map((theme) => (
        <button
          key={theme}
          type="button"
          className={`chip ${activeTheme === theme ? "active" : ""}`}
          onClick={() => onChange(theme)}
        >
          {theme}
        </button>
      ))}
    </div>
  );
}
