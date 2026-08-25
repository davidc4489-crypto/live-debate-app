"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthModal, AuthModalMode } from "@/components/AuthModal";
import { DebateCard } from "@/components/DebateCard";
import { FilterChips } from "@/components/FilterChips";
import { SectionLayout } from "@/components/SectionLayout";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { EmptyState } from "@/components/ui/EmptyState";
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
import { mergeLiveRoomsIntoDebateList, roomsSignature } from "@/lib/participant-roster";
import { getSocket } from "@/lib/socket";
import { RoomSummary } from "@/lib/types";
import { useAuthSession } from "@/lib/useAuthSession";

type ThemeFilter = DebateTheme | "Tous";

export function ExplorePageClient() {
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
  const liveRoomsRef = useRef<RoomSummary[]>([]);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomsSignatureRef = useRef<string>("");

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

    const onRoomsUpdated = (rooms: RoomSummary[]) => {
      liveRoomsRef.current = rooms;
      setDebates((current) => mergeLiveRoomsIntoDebateList(current, rooms));
      setFavoriteDebates((current) => mergeLiveRoomsIntoDebateList(current, rooms));

      // Un simple message ou un changement de tour ne modifie pas la liste :
      // on ne relance les requêtes que si une room apparaît, disparaît ou
      // change d'état.
      const signature = roomsSignature(rooms);
      if (signature === roomsSignatureRef.current) return;
      roomsSignatureRef.current = signature;

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
      router.push("/start");
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

  /*
   * Découpage par état plutôt que par « dernier / populaire / à suivre » : un
   * visiteur cherche d'abord une salle où il peut entrer. Les échanges en cours
   * (spectateur), puis les salles qui attendent un adversaire (participant),
   * puis les archives. Les plus actifs remontent dans chaque groupe.
   */
  const byPopularity = (a: DebateListItem, b: DebateListItem) =>
    getDebatePopularityScore(b) - getDebatePopularityScore(a);

  const liveDebates = useMemo(
    () => filteredDebates.filter((d) => d.status === "active").sort(byPopularity),
    [filteredDebates],
  );

  const openDebates = useMemo(
    () => filteredDebates.filter((d) => d.status === "pending").sort(byPopularity),
    [filteredDebates],
  );

  const finishedDebates = useMemo(
    () =>
      filteredDebates
        .filter((d) => d.status === "finished" || d.status === "paused")
        .sort(byPopularity),
    [filteredDebates],
  );

  const isCatalogueEmpty =
    filteredDebates.length === 0 &&
    filteredProposed.length === 0 &&
    filteredScheduled.length === 0 &&
    filteredFavorites.length === 0;

  function renderDebateCard(debate: DebateListItem) {
    return (
      <DebateCard
        key={debate.id}
        debate={debate}
        showFavorite={Boolean(user)}
        isFavorite={favoriteIds.has(debate.id)}
        favoriteLoading={favoriteLoadingId === debate.id}
        currentUserId={user?.id ?? null}
        onFavoriteToggle={handleFavoriteToggle}
      />
    );
  }

  return (
    <div className="explore-page">
      <OnboardingModal />
      <header className="explore-header">
        <div>
          <p className="mkt-kicker">Catalogue</p>
          <h1 className="explore-title">Explorer les débats</h1>
          <p className="muted explore-lead">
            Rejoignez un échange en cours ou lancez le vôtre avec un parcours guidé.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleCreateDebateClick}>
          Nouveau débat
        </button>
      </header>

      <FilterChips themes={debateThemes} activeTheme={activeTheme} onChange={setActiveTheme} />

      <div className="explore-sections">
        {loading ? (
          <DebateGridSkeleton />
        ) : error ? (
          <div className="explore-error card" role="alert">
            <h2>Les débats n&apos;ont pas pu être chargés</h2>
            <p className="muted">{error}</p>
            <button type="button" className="btn btn-secondary" onClick={() => void refreshDebatesFromApi()}>
              Réessayer
            </button>
          </div>
        ) : isCatalogueEmpty ? (
          /* Base vide ou filtre sans résultat : une seule invitation claire,
             plutôt que six sections « aucun débat » empilées. */
          <EmptyState
            title={
              activeTheme === "Tous"
                ? "Aucun débat pour l'instant"
                : `Aucun débat en « ${activeTheme} »`
            }
            description={
              activeTheme === "Tous"
                ? "Vous pouvez ouvrir le premier : posez une question, choisissez votre camp, et attendez un adversaire."
                : "Changez de thème, ou lancez le premier débat sur celui-ci."
            }
            actionLabel="Lancer un débat"
            onAction={handleCreateDebateClick}
          />
        ) : (
          <>
            {user && filteredFavorites.length > 0 ? (
              <SectionLayout
                title="Mes favoris"
                subtitle="Débats enregistrés pour les retrouver rapidement."
                variant="muted"
              >
                <div className="debate-grid">{filteredFavorites.map((d) => renderDebateCard(d))}</div>
              </SectionLayout>
            ) : null}

            {liveDebates.length > 0 ? (
              <SectionLayout
                id="live"
                title="En direct"
                subtitle="Échanges en cours — rejoignez-les comme spectateur."
              >
                <div className="debate-grid">{liveDebates.map((d) => renderDebateCard(d))}</div>
              </SectionLayout>
            ) : null}

            {openDebates.length > 0 ? (
              <SectionLayout
                id="open"
                title="Salles ouvertes"
                subtitle="Un participant attend un adversaire — la place est à prendre."
                variant="muted"
              >
                <div className="debate-grid">{openDebates.map((d) => renderDebateCard(d))}</div>
              </SectionLayout>
            ) : null}

            {filteredProposed.length > 0 ? (
              <SectionLayout
                title="Sujets proposés"
                subtitle="Sans date — manifestez votre intérêt et convenez d'un créneau."
              >
                <div className="debate-grid">{filteredProposed.map((d) => renderDebateCard(d))}</div>
              </SectionLayout>
            ) : null}

            {filteredScheduled.length > 0 ? (
              <SectionLayout
                title="Débats planifiés"
                subtitle="Dates confirmées — les prochains créneaux en premier."
                variant="muted"
              >
                <div className="debate-grid">{filteredScheduled.map((d) => renderDebateCard(d))}</div>
              </SectionLayout>
            ) : null}

            {finishedDebates.length > 0 ? (
              <SectionLayout
                id="finished"
                title="Débats terminés"
                subtitle="À relire : les arguments des deux camps et leurs conclusions."
              >
                <div className="debate-grid">
                  {finishedDebates.map((d) => renderDebateCard(d))}
                </div>
              </SectionLayout>
            ) : null}
          </>
        )}
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
              router.push("/start");
            }
          });
        }}
        onSwitchMode={setAuthMode}
      />
    </div>
  );
}

/** Cartes fantômes pendant le chargement : la page garde sa forme. */
function DebateGridSkeleton() {
  return (
    <section className="section section--default" aria-busy="true" aria-live="polite">
      <div className="section-inner">
        <span className="sr-only">Chargement des débats…</span>
        <div className="debate-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="debate-card-skeleton" />
          ))}
        </div>
      </div>
    </section>
  );
}
