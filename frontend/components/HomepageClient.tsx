"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthModal, AuthModalMode } from "@/components/AuthModal";
import { DebateCard } from "@/components/DebateCard";
import { FilterChips } from "@/components/FilterChips";
import { SectionLayout } from "@/components/SectionLayout";
import { DebateListItem, DebateTheme, debateThemes } from "@/lib/debate";
import { fetchDebates } from "@/lib/debates-api";
import { useAuthSession } from "@/lib/useAuthSession";

type ThemeFilter = DebateTheme | "Tous";

export function HomepageClient() {
  const router = useRouter();
  const { user, refresh } = useAuthSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>("signin");
  const [pendingCreate, setPendingCreate] = useState(false);
  const [activeTheme, setActiveTheme] = useState<ThemeFilter>("Tous");
  const [debates, setDebates] = useState<DebateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDebates() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchDebates();
        if (!cancelled) setDebates(data);
      } catch {
        if (!cancelled) {
          setError("Impossible de charger les débats. Vérifiez que le backend tourne.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDebates();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreateDebateClick() {
    if (user) {
      router.push("/room/new");
      return;
    }
    setPendingCreate(true);
    setAuthMode("signin");
    setAuthOpen(true);
  }

  const filteredDebates = useMemo(() => {
    if (activeTheme === "Tous") return debates;
    return debates.filter((debate) => debate.theme === activeTheme);
  }, [activeTheme, debates]);

  const latestDebates = filteredDebates;
  const trendingDebates = [...filteredDebates]
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);
  const continueWatching = filteredDebates.filter((debate) => debate.messagesCount >= 10);

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
            <button type="button" className="btn btn-ghost" onClick={handleCreateDebateClick}>
              Créer un débat
            </button>
          </div>
        </div>
      </section>

      <SectionLayout
        title="Filtres par thèmes"
        subtitle="Explorez rapidement les débats selon les sujets qui vous intéressent."
      >
        <FilterChips themes={debateThemes} activeTheme={activeTheme} onChange={setActiveTheme} />
      </SectionLayout>

      {loading ? (
        <SectionLayout title="Chargement" subtitle="Récupération des débats depuis la base de données.">
          <div className="empty-state">Chargement en cours…</div>
        </SectionLayout>
      ) : error ? (
        <SectionLayout title="Erreur" subtitle="Les débats n'ont pas pu être chargés.">
          <div className="empty-state">{error}</div>
        </SectionLayout>
      ) : (
        <>
          <SectionLayout title="Continue watching" subtitle="Reprenez les debats les plus actifs de votre fil.">
            {continueWatching.length > 0 ? (
              <div className="debate-grid">
                {continueWatching.map((debate) => (
                  <DebateCard key={debate.id} debate={debate} />
                ))}
              </div>
            ) : (
              <div className="empty-state">Aucun debat actif pour ce theme. Essayez un autre filtre.</div>
            )}
          </SectionLayout>

          <SectionLayout title="Derniers débats" subtitle="Les discussions les plus récentes, prêtes à rejoindre.">
            {latestDebates.length > 0 ? (
              <div id="latest" className="debate-grid">
                {latestDebates.map((debate) => (
                  <DebateCard key={debate.id} debate={debate} />
                ))}
              </div>
            ) : (
              <div id="latest" className="empty-state">
                Aucun débat pour le moment. Lancez le seed backend ou créez un débat.
              </div>
            )}
          </SectionLayout>

          <SectionLayout title="Débats les plus populaires" subtitle="Classement basé sur le nombre de vues.">
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
        </>
      )}

      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={() => {
          setAuthOpen(false);
          setPendingCreate(false);
        }}
        onSuccess={() => {
          void refresh().then(() => {
            if (pendingCreate) {
              setPendingCreate(false);
              router.push("/room/new");
            }
          });
        }}
        onSwitchMode={setAuthMode}
      />
    </div>
  );
}
