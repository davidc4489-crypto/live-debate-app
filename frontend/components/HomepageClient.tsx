"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DebateCard } from "@/components/DebateCard";
import { FilterChips } from "@/components/FilterChips";
import { SectionLayout } from "@/components/SectionLayout";
import { DebateTheme, debateThemes, mockDebates } from "@/mock/debates";

type ThemeFilter = DebateTheme | "Tous";

export function HomepageClient() {
  const [activeTheme, setActiveTheme] = useState<ThemeFilter>("Tous");

  const filteredDebates = useMemo(() => {
    if (activeTheme === "Tous") return mockDebates;
    return mockDebates.filter((debate) => debate.theme === activeTheme);
  }, [activeTheme]);

  const latestDebates = filteredDebates.slice(0, 9);
  const trendingDebates = [...filteredDebates]
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);
  const continueWatching = filteredDebates.filter((debate) => debate.messagesCount > 100).slice(0, 4);

  return (
    <div className="home-root">
      <section className="hero reveal">
        <div className="hero-card">
          <p className="kicker">Plateforme de débats live entre utilisateurs</p>
          <h1>Débattez en temps réel. Sans bruit. Sans filtre.</h1>
          <p className="hero-subtitle">
            Rejoignez des débats structurés, suivez les échanges en direct et participez sur les sujets qui
            comptent vraiment.
          </p>
          <div className="hero-cta">
            <a href="#latest" className="btn btn-primary">
              Voir les débats
            </a>
            <Link href="/room/new" className="btn btn-ghost">
              Créer un débat
            </Link>
          </div>
        </div>
      </section>

      <SectionLayout
        title="Filtres par thèmes"
        subtitle="Explorez rapidement les débats selon les sujets qui vous intéressent."
      >
        <FilterChips themes={debateThemes} activeTheme={activeTheme} onChange={setActiveTheme} />
      </SectionLayout>

      <SectionLayout title="Continue watching" subtitle="Reprenez les débats les plus actifs de votre fil.">
        {continueWatching.length > 0 ? (
          <div className="debate-grid">
            {continueWatching.map((debate) => (
              <DebateCard key={debate.id} debate={debate} />
            ))}
          </div>
        ) : (
          <div className="empty-state">Aucun débat actif pour ce thème. Essayez un autre filtre.</div>
        )}
      </SectionLayout>

      <SectionLayout title="Derniers débats" subtitle="Les discussions les plus récentes, prêtes à rejoindre.">
        <div id="latest" className="debate-grid">
          {latestDebates.map((debate) => (
            <DebateCard key={debate.id} debate={debate} />
          ))}
        </div>
      </SectionLayout>

      <SectionLayout title="Débats les plus populaires" subtitle="Sélection simulée basée sur les vues.">
        {trendingDebates.length > 0 ? (
          <div className="debate-grid">
            {trendingDebates.map((debate) => (
              <DebateCard key={debate.id} debate={debate} trending />
            ))}
          </div>
        ) : (
          <div className="empty-state">Aucun débat populaire pour ce filtre actuellement.</div>
        )}
      </SectionLayout>
    </div>
  );
}
