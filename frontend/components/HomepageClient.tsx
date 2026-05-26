"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthModal, AuthModalMode } from "@/components/AuthModal";
import { DebateCard } from "@/components/DebateCard";
import { FilterChips } from "@/components/FilterChips";
import { SectionLayout } from "@/components/SectionLayout";
import { DebateListItem, DebateTheme, debateThemes, getDebatePopularityScore } from "@/lib/debate";
import { fetchDebates, fetchProposedDebates, fetchScheduledDebates } from "@/lib/debates-api";
import { ProposedDebateListItem, ScheduledDebateListItem } from "@/lib/debate";
import { addFavorite, fetchFavorites, removeFavorite } from "@/lib/favorites-api";
import { mergeLiveRoomsIntoDebateList } from "@/lib/participant-roster";
import { getSocket } from "@/lib/socket";
import { RoomSnapshot } from "@/lib/types";
import { APP_NAME } from "@/lib/brand";
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
      // ignore — l'erreur initiale est déjà affichée au premier chargement
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
    <div className="home-root">
      <section className="hero reveal">
        <div className="hero-card">
          <p className="kicker">{APP_NAME} · débats posés · tours de parole · conclusions</p>
          <h1>Des échanges structurés, pour penser avant de répondre.</h1>
          <p className="hero-subtitle">
            Une plateforme sobre dédiée à la qualité du débat : tours de parole, modération attentive et
            synthèses de fin d&apos;échange. Pas de bruit, pas de course au clash.
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
          {user ? (
            <SectionLayout
              title="Mes débats favoris"
              subtitle="Retrouvez les débats que vous avez enregistrés pour les revoir plus tard."
            >
              {favoritesLoading ? (
                <div className="empty-state">Chargement de vos favoris…</div>
              ) : favoritesError ? (
                <div className="empty-state">{favoritesError}</div>
              ) : filteredFavorites.length > 0 ? (
                <div className="debate-grid">
                  {filteredFavorites.map((debate) => renderDebateCard(debate))}
                </div>
              ) : (
                <div id="favorites" className="empty-state">
                  Aucun favori pour le moment. Cliquez sur l&apos;étoile d&apos;un débat pour l&apos;ajouter ici.
                </div>
              )}
            </SectionLayout>
          ) : null}

          <SectionLayout
            title="Débats proposés"
            subtitle="Sujets ouverts sans date fixée — manifestez votre intérêt ou planifiez un créneau."
          >
            {proposedLoading ? (
              <div className="empty-state">Chargement des débats proposés…</div>
            ) : filteredProposed.length > 0 ? (
              <div className="debate-grid">
                {filteredProposed.map((debate) => renderDebateCard(debate))}
              </div>
            ) : (
              <div className="empty-state">
                Aucun débat proposé pour le moment. Créez-en un via « Proposer un sujet ».
              </div>
            )}
          </SectionLayout>

          <SectionLayout
            title="Débats planifiés"
            subtitle="Dates confirmées — les prochains créneaux apparaissent en premier."
          >
            {scheduledLoading ? (
              <div className="empty-state">Chargement des débats planifiés…</div>
            ) : filteredScheduled.length > 0 ? (
              <div className="debate-grid">
                {filteredScheduled.map((debate) => renderDebateCard(debate))}
              </div>
            ) : (
              <div className="empty-state">
                Aucun débat planifié pour le moment. Une date apparaîtra ici après accord entre les
                participants.
              </div>
            )}
          </SectionLayout>

          <SectionLayout title="Continue watching" subtitle="Reprenez les debats les plus actifs de votre fil.">
            {continueWatching.length > 0 ? (
              <div className="debate-grid">
                {continueWatching.map((debate) => renderDebateCard(debate))}
              </div>
            ) : (
              <div className="empty-state">Aucun debat actif pour ce theme. Essayez un autre filtre.</div>
            )}
          </SectionLayout>

          <SectionLayout title="Derniers débats" subtitle="Les discussions les plus récentes, prêtes à rejoindre.">
            {latestDebates.length > 0 ? (
              <div id="latest" className="debate-grid">
                {latestDebates.map((debate) => renderDebateCard(debate))}
              </div>
            ) : (
              <div id="latest" className="empty-state">
                Aucun débat pour le moment. Lancez le seed backend ou créez un débat.
              </div>
            )}
          </SectionLayout>

          <SectionLayout
            title="Débats les plus populaires"
            subtitle="Classement par vues (terminés) ou spectateurs (en cours)."
          >
            {trendingDebates.length > 0 ? (
              <div className="debate-grid">
                {trendingDebates.map((debate) => renderDebateCard(debate, true))}
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
