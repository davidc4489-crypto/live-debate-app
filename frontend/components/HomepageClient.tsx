"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthModal, AuthModalMode } from "@/components/AuthModal";
import { DebateCard } from "@/components/DebateCard";
import { FilterChips } from "@/components/FilterChips";
import { SectionLayout } from "@/components/SectionLayout";
import { HomeFeatures } from "@/components/marketing/HomeFeatures";
import { HomeHero } from "@/components/marketing/HomeHero";
import { HomeProductPreview } from "@/components/marketing/HomeProductPreview";
import { HomeStats } from "@/components/marketing/HomeStats";
import {
  DebateListItem,
  DebateTheme,
  debateThemes,
  getDebatePopularityScore,
  ProposedDebateListItem,
  ScheduledDebateListItem,
} from "@/lib/debate";
import { fetchDebates, fetchProposedDebates, fetchScheduledDebates } from "@/lib/debates-api";
import { addFavorite, fetchFavorites, removeFavorite } from "@/lib/favorites-api";
import { mergeLiveRoomsIntoDebateList } from "@/lib/participant-roster";
import { getSocket } from "@/lib/socket";
import { RoomSnapshot } from "@/lib/types";
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
  const [proposedDebates, setProposedDebates] = useState<ProposedDebateListItem[]>([]);
  const [proposedLoading, setProposedLoading] = useState(true);
  const [scheduledDebates, setScheduledDebates] = useState<ScheduledDebateListItem[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(true);
  const [favoriteDebates, setFavoriteDebates] = useState<DebateListItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteLoadingId, setFavoriteLoadingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [error, setError] = useState("");
  const [favoritesError, setFavoritesError] = useState("");
  const liveRoomsRef = useRef<RoomSnapshot[]>([]);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshDebatesFromApi = useCallback(async () => {
    try {
      const [data, proposed, scheduled] = await Promise.all([
        fetchDebates(),
        fetchProposedDebates(),
        fetchScheduledDebates(),
      ]);
      setDebates(mergeLiveRoomsIntoDebateList(data, liveRoomsRef.current));
      setProposedDebates(proposed);
      setScheduledDebates(scheduled);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDebates() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchDebates();
        if (!cancelled) {
          setDebates(mergeLiveRoomsIntoDebateList(data, liveRoomsRef.current));
        }
      } catch {
        if (!cancelled) {
          setError("Impossible de charger les débats. Vérifiez que le backend tourne.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadProposed() {
      setProposedLoading(true);
      try {
        const data = await fetchProposedDebates();
        if (!cancelled) setProposedDebates(data);
      } catch {
        if (!cancelled) setProposedDebates([]);
      } finally {
        if (!cancelled) setProposedLoading(false);
      }
    }

    async function loadScheduled() {
      setScheduledLoading(true);
      try {
        const data = await fetchScheduledDebates();
        if (!cancelled) setScheduledDebates(data);
      } catch {
        if (!cancelled) setScheduledDebates([]);
      } finally {
        if (!cancelled) setScheduledLoading(false);
      }
    }

    void loadDebates();
    void loadProposed();
    void loadScheduled();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onRoomsUpdated = (rooms: RoomSnapshot[]) => {
      liveRoomsRef.current = rooms;
      setDebates((current) => mergeLiveRoomsIntoDebateList(current, rooms));
      setFavoriteDebates((current) => mergeLiveRoomsIntoDebateList(current, rooms));

      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => {
        void refreshDebatesFromApi();
      }, 400);
    };

    socket.on("roomsUpdated", onRoomsUpdated);
    socket.emit("getRooms");

    return () => {
      socket.off("roomsUpdated", onRoomsUpdated);
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, [refreshDebatesFromApi]);

  useEffect(() => {
    if (!user) {
      setFavoriteDebates([]);
      setFavoriteIds(new Set());
      setFavoritesError("");
      return;
    }

    let cancelled = false;

    async function loadFavorites() {
      setFavoritesLoading(true);
      setFavoritesError("");
      try {
        const data = await fetchFavorites();
        if (!cancelled) {
          setFavoriteDebates(data);
          setFavoriteIds(new Set(data.map((debate) => debate.id)));
        }
      } catch {
        if (!cancelled) {
          setFavoritesError("Impossible de charger vos débats favoris.");
        }
      } finally {
        if (!cancelled) setFavoritesLoading(false);
      }
    }

    void loadFavorites();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleFavoriteToggle = useCallback(
    async (debateId: string, nextFavorite: boolean) => {
      if (!user) return;

      setFavoriteLoadingId(debateId);
      setFavoritesError("");

      const previousIds = favoriteIds;
      const previousDebates = favoriteDebates;

      if (nextFavorite) {
        const debate = debates.find((item) => item.id === debateId);
        setFavoriteIds((current) => new Set([...current, debateId]));
        if (debate) {
          setFavoriteDebates((current) => [debate, ...current.filter((item) => item.id !== debateId)]);
        }
      } else {
        setFavoriteIds((current) => {
          const next = new Set(current);
          next.delete(debateId);
          return next;
        });
        setFavoriteDebates((current) => current.filter((item) => item.id !== debateId));
      }

      try {
        if (nextFavorite) {
          await addFavorite(debateId);
        } else {
          await removeFavorite(debateId);
        }
      } catch {
        setFavoriteIds(previousIds);
        setFavoriteDebates(previousDebates);
        setFavoritesError("Impossible de mettre à jour vos favoris.");
      } finally {
        setFavoriteLoadingId(null);
      }
    },
    [user, favoriteIds, favoriteDebates, debates],
  );

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
    const liveList = debates.filter(
      (d) => d.status !== "proposed" && d.status !== "scheduled",
    );
    if (activeTheme === "Tous") return liveList;
    return liveList.filter((debate) => debate.theme === activeTheme);
  }, [activeTheme, debates]);

  const filteredProposed = useMemo(() => {
    if (activeTheme === "Tous") return proposedDebates;
    return proposedDebates.filter((debate) => debate.theme === activeTheme);
  }, [activeTheme, proposedDebates]);

  const filteredScheduled = useMemo(() => {
    const list = [...scheduledDebates].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
    if (activeTheme === "Tous") return list;
    return list.filter((debate) => debate.theme === activeTheme);
  }, [activeTheme, scheduledDebates]);

  const filteredFavorites = useMemo(() => {
    if (activeTheme === "Tous") return favoriteDebates;
    return favoriteDebates.filter((debate) => debate.theme === activeTheme);
  }, [activeTheme, favoriteDebates]);

  const latestDebates = filteredDebates;
  const trendingDebates = [...filteredDebates]
    .sort((a, b) => getDebatePopularityScore(b) - getDebatePopularityScore(a))
    .slice(0, 6);
  const continueWatching = filteredDebates.filter((debate) => debate.messagesCount >= 10);

  const liveCount = filteredDebates.filter((d) => d.isLive || d.status === "pending").length;

  function renderDebateCard(debate: DebateListItem, trending = false) {
    return (
      <DebateCard
        key={debate.id}
        debate={debate}
        trending={trending}
        showFavorite={Boolean(user)}
        isFavorite={favoriteIds.has(debate.id)}
        favoriteLoading={favoriteLoadingId === debate.id}
        currentUserId={user?.id ?? null}
        onFavoriteToggle={handleFavoriteToggle}
      />
    );
  }

  return (
    <div className="home-marketing">
      <HomeHero onCreateDebate={handleCreateDebateClick} />
      <HomeFeatures />
      <HomeProductPreview />
      <HomeStats
        liveCount={liveCount}
        proposedCount={proposedDebates.length}
        scheduledCount={scheduledDebates.length}
      />

      <div id="debates" className="home-debates">
        <div className="home-debates-inner">
          <div className="home-debates-filters">
            <div className="mkt-section-intro">
              <p className="mkt-kicker">Catalogue</p>
              <h2 className="mkt-section-title">Tous les débats</h2>
              <p className="mkt-section-lead">
                Filtrez par thème, rejoignez une discussion en cours ou proposez un nouveau sujet.
              </p>
            </div>
            <FilterChips themes={debateThemes} activeTheme={activeTheme} onChange={setActiveTheme} />
          </div>

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
              {user ? (
                <SectionLayout
                  title="Mes favoris"
                  subtitle="Débats enregistrés pour les retrouver rapidement."
                  variant="muted"
                >
                  {favoritesLoading ? (
                    <div className="empty-state">Chargement de vos favoris…</div>
                  ) : favoritesError ? (
                    <div className="empty-state">{favoritesError}</div>
                  ) : filteredFavorites.length > 0 ? (
                    <div className="debate-grid">{filteredFavorites.map((d) => renderDebateCard(d))}</div>
                  ) : (
                    <div className="empty-state">
                      Aucun favori. Cliquez sur l&apos;étoile d&apos;un débat pour l&apos;ajouter.
                    </div>
                  )}
                </SectionLayout>
              ) : null}

              <SectionLayout
                title="Débats proposés"
                subtitle="Sujets sans date — manifestez votre intérêt ou planifiez un créneau."
              >
                {proposedLoading ? (
                  <div className="empty-state">Chargement…</div>
                ) : filteredProposed.length > 0 ? (
                  <div className="debate-grid">{filteredProposed.map((d) => renderDebateCard(d))}</div>
                ) : (
                  <div className="empty-state">
                    Aucun débat proposé. Créez-en un via « Proposer un sujet ».
                  </div>
                )}
              </SectionLayout>

              <SectionLayout
                title="Débats planifiés"
                subtitle="Dates confirmées — les prochains créneaux en premier."
                variant="muted"
              >
                {scheduledLoading ? (
                  <div className="empty-state">Chargement…</div>
                ) : filteredScheduled.length > 0 ? (
                  <div className="debate-grid">{filteredScheduled.map((d) => renderDebateCard(d))}</div>
                ) : (
                  <div className="empty-state">
                    Aucun débat planifié pour le moment.
                  </div>
                )}
              </SectionLayout>

              {continueWatching.length > 0 ? (
                <SectionLayout title="À suivre" subtitle="Les échanges les plus actifs en ce moment.">
                  <div className="debate-grid">{continueWatching.map((d) => renderDebateCard(d))}</div>
                </SectionLayout>
              ) : null}

              <SectionLayout
                id="latest"
                title="Derniers débats"
                subtitle="Discussions récentes, prêtes à rejoindre."
              >
                {latestDebates.length > 0 ? (
                  <div className="debate-grid">{latestDebates.map((d) => renderDebateCard(d))}</div>
                ) : (
                  <div className="empty-state">Aucun débat pour ce filtre.</div>
                )}
              </SectionLayout>

              <SectionLayout
                title="Populaires"
                subtitle="Classés par spectateurs (en cours) ou vues (terminés)."
                variant="muted"
              >
                {trendingDebates.length > 0 ? (
                  <div className="debate-grid">
                    {trendingDebates.map((d) => renderDebateCard(d, true))}
                  </div>
                ) : (
                  <div className="empty-state">Aucun débat populaire pour ce filtre.</div>
                )}
              </SectionLayout>
            </>
          )}
        </div>
      </div>

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
