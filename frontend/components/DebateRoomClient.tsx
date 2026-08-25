"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DebateConclusionForm } from "@/components/DebateConclusionForm";
import { DebateConclusionsSection } from "@/components/DebateConclusionsSection";
import { DebateNoteSection } from "@/components/DebateNoteSection";
import { LeaveDebateModal } from "@/components/LeaveDebateModal";
import { ParticipantAbsentModal } from "@/components/ParticipantAbsentModal";
import { PauseStateBanner } from "@/components/PauseStateBanner";
import { ParticipantPill } from "@/components/ParticipantPill";
import { DebateInsightsBar } from "@/components/moderation/DebateInsightsBar";
import { MessageInsightHint } from "@/components/moderation/MessageInsightHint";
import { ModerationWarnBanner } from "@/components/moderation/ModerationWarnBanner";
import { DebateProgress } from "@/components/ui/DebateProgress";
import { DebateThread } from "@/components/ui/DebateThread";
import { getStoredAuth } from "@/lib/auth";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";
import { DebateDetail } from "@/lib/debate";
import { rosterToParticipants } from "@/lib/participant-roster";
import { fetchDebate } from "@/lib/debates-api";
import { getSocket } from "@/lib/socket";
import {
  DebateInsights,
  MessageInsight,
  ModerationWarnPayload,
  categoryLabel,
} from "@/lib/moderation";
import { DebatePresencePayload, RoomSnapshot, UserRole } from "@/lib/types";
import { useAuthSession } from "@/lib/useAuthSession";

interface DebateRoomClientProps {
  roomId: string;
  dbDebate?: DebateDetail | null;
}

interface JoinedRoomPayload {
  roomId: string;
  role: UserRole;
  displayName: string;
  userId: string | null;
}

type PendingSocketAction =
  | "validateStart"
  | "leaveDebate"
  | "requestResume"
  | "validateResume"
  | "resolveAbsent";

function isMatchingRoomSnapshot(
  snapshot: RoomSnapshot | null | undefined,
  roomId: string,
): snapshot is RoomSnapshot {
  return Boolean(snapshot && snapshot.id === roomId);
}

export function DebateRoomClient({ roomId, dbDebate: initialDbDebate }: DebateRoomClientProps) {
  const { user } = useAuthSession();
  const [dbDebate, setDbDebate] = useState<DebateDetail | null>(initialDbDebate ?? null);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [role, setRole] = useState<UserRole>("spectator");
  const [displayName, setDisplayName] = useState("Spectator");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [errorIsBlock, setErrorIsBlock] = useState(false);
  const [moderationWarn, setModerationWarn] = useState<ModerationWarnPayload | null>(null);
  const [messageInsight, setMessageInsight] = useState<MessageInsight | null>(null);
  const [debateInsights, setDebateInsights] = useState<DebateInsights | null>(null);
  const [blockDetails, setBlockDetails] = useState<{
    categories: string[];
    suggestion: string | null;
  } | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [resolveAbsentLoading, setResolveAbsentLoading] = useState(false);
  const [presenceMessage, setPresenceMessage] = useState<string | null>(null);
  const [validatingStart, setValidatingStart] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const pendingTextRef = useRef<string | null>(null);
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingActionRef = useRef<PendingSocketAction | null>(null);
  const displayNameRef = useRef(displayName);

  const clearPendingActionLoader = useCallback(() => {
    switch (pendingActionRef.current) {
      case "validateStart":
        setValidatingStart(false);
        break;
      case "leaveDebate":
        setLeaveLoading(false);
        break;
      case "requestResume":
      case "validateResume":
        setResumeLoading(false);
        break;
      case "resolveAbsent":
        setResolveAbsentLoading(false);
        break;
      default:
        break;
    }
    pendingActionRef.current = null;
  }, []);

  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);

  useEffect(
    () => () => {
      if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current);
    },
    [],
  );

  const releaseSendLock = useCallback(() => {
    if (sendTimeoutRef.current) {
      clearTimeout(sendTimeoutRef.current);
      sendTimeoutRef.current = null;
    }
    setSending(false);
  }, []);

  const isCancelled =
    room?.status === "cancelled" || dbDebate?.status === "cancelled";
  const isPaused = room?.status === "paused" || dbDebate?.status === "paused";
  const isFinished =
    room?.status === "finished" ||
    dbDebate?.status === "finished" ||
    isCancelled;
  const isParticipant = role === "participantA" || role === "participantB";
  const absentPeer =
    room?.absentParticipantUserId &&
    room.absentParticipantUserId !== sessionUserId
      ? {
          userId: room.absentParticipantUserId,
          displayName: room.absentParticipantDisplayName ?? "L'autre participant",
        }
      : null;
  const showAbsentModal = Boolean(absentPeer && isParticipant && !isFinished && !isPaused);
  const awaitingValidation =
    !isFinished &&
    (room?.awaitingValidation === true ||
      Boolean(dbDebate?.opponentJoinedAt && !dbDebate?.validatedAt));
  const isCreator =
    sessionUserId !== null &&
    (sessionUserId === dbDebate?.createdBy ||
      sessionUserId === room?.creatorUserId);
  const debateIsLive =
    !isFinished &&
    !isPaused &&
    !absentPeer &&
    !awaitingValidation &&
    (room?.debateValidated === true || dbDebate?.status === "active");
  const pausedByUserId = room?.pausedByUserId ?? dbDebate?.pausedByUserId ?? null;
  const resumeRequestedAt = room?.resumeRequestedAt ?? dbDebate?.resumeRequestedAt ?? null;
  const isPausedByMe =
    isPaused && sessionUserId !== null && pausedByUserId === sessionUserId;
  const awaitingResumeValidation = isPaused && Boolean(resumeRequestedAt);
  // Repli sur le pauseur tant que la migration 00015 n'est pas appliquée :
  // avant elle, seul lui pouvait demander la reprise.
  const resumeRequestedByUserId = room?.resumeRequestedByUserId ?? pausedByUserId;
  const iRequestedResume =
    awaitingResumeValidation &&
    sessionUserId !== null &&
    resumeRequestedByUserId === sessionUserId;
  // Les deux participants peuvent demander la reprise ; l'autre valide.
  const canRequestResume = isPaused && isParticipant && !awaitingResumeValidation;
  const canValidateResume =
    isParticipant && awaitingResumeValidation && !iRequestedResume;
  const resumeRequestedByDisplayName =
    room?.participantRoster?.find((slot) => slot.userId === resumeRequestedByUserId)
      ?.displayName ?? null;
  const waitingForOpponent =
    !isFinished &&
    !isCancelled &&
    !isPaused &&
    (room?.participants ?? 0) < 2;
  const aloneWaiting =
    isParticipant &&
    !isPaused &&
    !isCancelled &&
    !isFinished &&
    dbDebate !== null &&
    !dbDebate.opponentJoinedAt &&
    (room?.participants ?? 0) < 2;
  const canQuitVoluntarily =
    isParticipant &&
    !isFinished &&
    !isCancelled &&
    (debateIsLive ||
      awaitingValidation ||
      waitingForOpponent ||
      isPaused ||
      absentPeer !== null);

  const refreshDebate = useCallback(async () => {
    try {
      const debate = await fetchDebate(roomId);
      if (debate) setDbDebate(debate);
    } catch {
      // ignore
    }
  }, [roomId]);

  useEffect(() => {
    setDbDebate(initialDbDebate ?? null);
  }, [initialDbDebate]);

  useEffect(() => {
    const socket = getSocket();

    const onJoinedRoom = (payload: JoinedRoomPayload) => {
      setRole(payload.role);
      setDisplayName(payload.displayName);
      setSessionUserId(payload.userId);
    };

    const applyAwaitingValidationFromSocket = (snapshot: RoomSnapshot) => {
      if (!snapshot.awaitingValidation) return;
      setDbDebate((prev) => {
        if (!prev) return prev;
        if (prev.opponentJoinedAt) return prev;
        return {
          ...prev,
          opponentJoinedAt: new Date().toISOString(),
        };
      });
    };

    const onRoomUpdated = (snapshot: RoomSnapshot | null) => {
      if (!isMatchingRoomSnapshot(snapshot, roomId)) return;
      setRoom(snapshot);
      if (snapshot.status === "paused") {
        setLeaveModalOpen(false);
        setLeaveLoading(false);
      }
      applyAwaitingValidationFromSocket(snapshot);
      if (snapshot.remainingSeconds > 0) {
        setRemainingSeconds(snapshot.remainingSeconds);
      }
      void refreshDebate();
      const pending = pendingTextRef.current;
      if (!pending) return;
      const accepted = snapshot.messages.some(
        (message) => message.user === displayNameRef.current && message.text === pending,
      );
      if (accepted) {
        pendingTextRef.current = null;
        setDraft("");
        setModerationWarn(null);
        releaseSendLock();
        // L'erreur précédente restait affichée sous un débat qui repartait.
        setError("");
        setErrorIsBlock(false);
        setBlockDetails(null);
      }
    };

    const onDebateEnded = (payload: { roomId: string; snapshot?: RoomSnapshot }) => {
      if (payload.roomId !== roomId) return;
      if (payload.snapshot) setRoom(payload.snapshot);
      pendingActionRef.current = null;
      void refreshDebate();
    };

    const onError = (payload: {
      message: string;
      code?: string;
      categories?: string[];
      suggestion?: string | null;
    }) => {
      releaseSendLock();
      pendingTextRef.current = null;
      if (payload.code === "MODERATION_BLOCK") {
        setModerationWarn(null);
        setError(payload.message);
        setErrorIsBlock(true);
        setBlockDetails({
          categories: payload.categories ?? [],
          suggestion: payload.suggestion ?? null,
        });
        return;
      }

      // Anti-spam : même traitement visuel qu'un blocage, sans détail modèle.
      if (payload.code === "RATE_LIMIT" || payload.code === "DUPLICATE" || payload.code === "FLOOD_CHARS") {
        setError(payload.message);
        setErrorIsBlock(true);
        setBlockDetails(null);
        clearPendingActionLoader();
        return;
      }

      setError(payload.message);
      setErrorIsBlock(false);
      setBlockDetails(null);
      clearPendingActionLoader();
    };

    const onModerationWarn = (payload: ModerationWarnPayload) => {
      if (payload.roomId !== roomId) return;
      setError("");
      setErrorIsBlock(false);
      setBlockDetails(null);
      setModerationWarn(payload);
      setDraft(payload.text);
      releaseSendLock();
    };

    const onMessageInsight = (payload: MessageInsight) => {
      setMessageInsight(payload);
    };

    const onDebateInsights = (payload: DebateInsights) => {
      if (payload.roomId !== roomId) return;
      setDebateInsights(payload);
    };

    const onTick = (payload: { roomId: string; remainingSeconds: number }) => {
      if (payload.roomId === roomId) {
        setRemainingSeconds(payload.remainingSeconds);
      }
    };

    const onAwaitingValidation = (snapshot: RoomSnapshot | null) => {
      if (!isMatchingRoomSnapshot(snapshot, roomId)) return;
      setRoom(snapshot);
      applyAwaitingValidationFromSocket(snapshot);
      void refreshDebate();
    };

    const onDebateStarted = (snapshot: RoomSnapshot | null) => {
      if (!isMatchingRoomSnapshot(snapshot, roomId)) return;
      setRoom(snapshot);
      pendingActionRef.current = null;
      setValidatingStart(false);
      setResumeLoading(false);
      void refreshDebate();
    };

    const onDebateCancelled = (payload: { roomId: string }) => {
      if (payload.roomId !== roomId) return;
      void refreshDebate();
    };

    const onDebatePresence = (payload: DebatePresencePayload) => {
      if (payload.roomId !== roomId) return;
      if (payload.snapshot && isMatchingRoomSnapshot(payload.snapshot, roomId)) {
        setRoom(payload.snapshot);
      }
      setPresenceMessage(payload.message);
      void refreshDebate();
      if (payload.kind === "finished" || payload.kind === "paused") {
        setLeaveModalOpen(false);
        pendingActionRef.current = null;
        setLeaveLoading(false);
        setResolveAbsentLoading(false);
      }
      if (payload.kind === "resume_requested" || payload.kind === "resumed") {
        pendingActionRef.current = null;
        setResumeLoading(false);
      }
    };

    socket.on("joinedRoom", onJoinedRoom);
    socket.on("roomUpdated", onRoomUpdated);
    socket.on("debateEnded", onDebateEnded);
    socket.on("debateStarted", onDebateStarted);
    socket.on("awaitingValidation", onAwaitingValidation);
    socket.on("debateCancelled", onDebateCancelled);
    socket.on("debatePresence", onDebatePresence);
    socket.on("errorMessage", onError);
    socket.on("moderationWarn", onModerationWarn);
    socket.on("messageInsight", onMessageInsight);
    socket.on("debateInsights", onDebateInsights);
    socket.on("tick", onTick);

    return () => {
      socket.off("joinedRoom", onJoinedRoom);
      socket.off("roomUpdated", onRoomUpdated);
      socket.off("debateEnded", onDebateEnded);
      socket.off("debateStarted", onDebateStarted);
      socket.off("awaitingValidation", onAwaitingValidation);
      socket.off("debateCancelled", onDebateCancelled);
      socket.off("debatePresence", onDebatePresence);
      socket.off("errorMessage", onError);
      socket.off("moderationWarn", onModerationWarn);
      socket.off("messageInsight", onMessageInsight);
      socket.off("debateInsights", onDebateInsights);
      socket.off("tick", onTick);
    };
  }, [roomId, refreshDebate, clearPendingActionLoader, releaseSendLock]);

  useEffect(() => {
    const socket = getSocket();
    const accessToken = getStoredAuth()?.session?.accessToken;

    const rejoin = () => {
      if (accessToken) {
        socket.emit("subscribeUser", { accessToken });
      }
      socket.emit("joinRoom", { roomId, accessToken });
    };

    const onJoinedRoomForFetch = (payload: JoinedRoomPayload) => {
      if (payload.roomId !== roomId) return;
      socket.emit("getRoomState", { roomId });
    };

    socket.on("joinedRoom", onJoinedRoomForFetch);
    rejoin();
    socket.io.on("reconnect", rejoin);

    return () => {
      socket.off("joinedRoom", onJoinedRoomForFetch);
      socket.io.off("reconnect", rejoin);
    };
  }, [roomId]);

  useEffect(() => {
    setRemainingSeconds(room?.remainingSeconds ?? 0);
  }, [room?.remainingSeconds]);

  const isActiveSpeaker = useMemo(() => {
    if (!debateIsLive || waitingForOpponent || role === "spectator") return false;
    // Priorité à l'identité : deux participants au même nom affiché se
    // croyaient tous les deux locuteurs, et voyaient leurs bulles inversées.
    if (room?.currentSpeakerUserId && sessionUserId) {
      return room.currentSpeakerUserId === sessionUserId;
    }
    return room?.currentSpeakerName === displayName;
  }, [
    debateIsLive,
    waitingForOpponent,
    role,
    room?.currentSpeakerUserId,
    room?.currentSpeakerName,
    sessionUserId,
    displayName,
  ]);
  const canSend = useMemo(
    () => isActiveSpeaker && remainingSeconds > 0 && !sending,
    [isActiveSpeaker, remainingSeconds, sending],
  );

  const turnStatusText = useMemo(() => {
    if (isCancelled) {
      return "Ce débat a été fermé faute de participant dans le délai imparti.";
    }
    if (isFinished) return "Débat terminé.";
    if (isPaused) {
      if (iRequestedResume) {
        return "Reprise demandée : en attente de validation par l'autre participant.";
      }
      if (canValidateResume) {
        const by = resumeRequestedByDisplayName ?? "L'autre participant";
        return `${by} souhaite reprendre le débat. Validez pour relancer les échanges.`;
      }
      if (canRequestResume) {
        return "Débat en pause. Vous pouvez demander la reprise lorsque vous êtes prêt.";
      }
      const by = room?.pausedByDisplayName ?? "un participant";
      return `Débat en pause (par ${by}).`;
    }
    if (absentPeer) {
      return `${absentPeer.displayName} a quitté le débat. Choisissez de mettre en pause ou de terminer.`;
    }
    if (presenceMessage && !debateIsLive) {
      return presenceMessage;
    }
    if (waitingForOpponent) {
      return isParticipant
        ? "En attente d'un second participant."
        : "Le débat commencera lorsque deux participants seront présents.";
    }
    if (awaitingValidation) {
      if (isCreator) {
        return "Un participant a rejoint : validez le début du débat.";
      }
      return "En attente de la validation du créateur pour démarrer.";
    }
    if (role === "spectator") return "Mode spectateur : vous observez le tour en direct.";
    return isActiveSpeaker
      ? "Vous avez la parole : un seul message, puis c'est à l'autre de répondre."
      : "En attente de la réponse de l'autre participant.";
  }, [
    isCancelled,
    isFinished,
    isPaused,
    iRequestedResume,
    canRequestResume,
    canValidateResume,
    resumeRequestedByDisplayName,
    absentPeer,
    presenceMessage,
    debateIsLive,
    waitingForOpponent,
    awaitingValidation,
    isCreator,
    isParticipant,
    role,
    isActiveSpeaker,
  ]);

  const timerTone = useMemo(() => {
    if (remainingSeconds <= 10) return "danger";
    if (remainingSeconds <= 30) return "warning";
    return "safe";
  }, [remainingSeconds]);

  const formattedTimer = useMemo(() => {
    const min = Math.floor(remainingSeconds / 60)
      .toString()
      .padStart(2, "0");
    const sec = (remainingSeconds % 60).toString().padStart(2, "0");
    return `${min}:${sec}`;
  }, [remainingSeconds]);

  const myExistingConclusion = useMemo(() => {
    if (!user?.id || !dbDebate?.conclusions) return null;
    return dbDebate.conclusions.find((c) => c.userId === user.id) ?? null;
  }, [user?.id, dbDebate?.conclusions]);

  const showConclusionForm =
    isFinished && isParticipant && Boolean(user?.id) && sessionUserId === user?.id;

  const stanceByUserId = useMemo(() => {
    const map = new Map<string, "for" | "against">();
    for (const participant of dbDebate?.participants ?? []) {
      if (participant.userId && participant.stance) {
        map.set(participant.userId, participant.stance);
      }
    }
    return map;
  }, [dbDebate?.participants]);

  const headerParticipants = useMemo(() => {
    return (
      rosterToParticipants(room?.participantRoster, dbDebate?.participants) ??
      dbDebate?.participants ?? [
        { userId: null, displayName: "En attente d'un participant" },
        { userId: null, displayName: "En attente d'un participant" },
      ]
    );
  }, [room?.participantRoster, dbDebate?.participants]);

  const roleLabel = useMemo(() => {
    if (role === "spectator") return "Spectateur";
    return displayName;
  }, [role, displayName]);

  function submitMessage(event: FormEvent, warnToken?: string) {
    event.preventDefault();
    setError("");
    setErrorIsBlock(false);
    if (!canSend) return;
    const text = draft.trim();
    if (!text) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      setError(`Le message ne peut pas dépasser ${MAX_MESSAGE_LENGTH} caractères.`);
      return;
    }
    // Sans ce verrou, deux Entrée rapprochées envoyaient deux fois : le second
    // message repartait après le changement de tour et l'auteur récoltait une
    // erreur (« Message déjà envoyé ») juste après un envoi réussi.
    setSending(true);
    pendingTextRef.current = text;
    // Si le serveur ne répond ni par le message ni par une erreur, on rend la
    // main plutôt que de laisser le champ verrouillé.
    if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current);
    sendTimeoutRef.current = setTimeout(() => {
      setSending(false);
      setError("Aucune réponse du serveur. Réessayez.");
    }, 10_000);
    getSocket().emit("sendMessage", warnToken ? { roomId, text, warnToken } : { roomId, text });
  }

  function confirmWarnedMessage() {
    if (!moderationWarn) return;
    submitMessage(
      { preventDefault: () => undefined } as FormEvent,
      moderationWarn.warnToken,
    );
  }

  function confirmValidateStart() {
    const accessToken = getStoredAuth()?.session?.accessToken;
    if (!accessToken) {
      setError("Connectez-vous pour démarrer le débat.");
      return;
    }
    pendingActionRef.current = "validateStart";
    setValidatingStart(true);
    getSocket().emit("validateDebateStart", { roomId, accessToken });
  }

  function emitLeaveDebate(action: "pause" | "finish") {
    const accessToken = getStoredAuth()?.session?.accessToken;
    if (!accessToken) {
      setError("Connectez-vous pour quitter le débat.");
      return;
    }
    pendingActionRef.current = "leaveDebate";
    setLeaveLoading(true);
    setError("");
    getSocket().emit("leaveDebate", { roomId, accessToken, action });
  }

  function confirmRequestResume() {
    const accessToken = getStoredAuth()?.session?.accessToken;
    if (!accessToken) {
      setError("Connectez-vous pour reprendre le débat.");
      return;
    }
    pendingActionRef.current = "requestResume";
    setResumeLoading(true);
    setError("");
    getSocket().emit("requestResumeDebate", { roomId, accessToken });
  }

  function confirmValidateResume() {
    const accessToken = getStoredAuth()?.session?.accessToken;
    if (!accessToken) {
      setError("Connectez-vous pour valider la reprise.");
      return;
    }
    pendingActionRef.current = "validateResume";
    setResumeLoading(true);
    setError("");
    getSocket().emit("validateResumeDebate", { roomId, accessToken });
  }

  function emitResolveAbsent(action: "pause" | "finish") {
    const accessToken = getStoredAuth()?.session?.accessToken;
    if (!accessToken) {
      setError("Connectez-vous pour continuer.");
      return;
    }
    pendingActionRef.current = "resolveAbsent";
    setResolveAbsentLoading(true);
    setError("");
    getSocket().emit("resolveAbsentDebate", { roomId, accessToken, action });
  }

  return (
    <div className="chat-layout reveal">
      <section className="chat-header card">
        <div>
          <div className="debate-header-meta">
            {dbDebate?.theme ? <span className="theme-badge">{dbDebate.theme}</span> : null}
            {isCancelled ? <span className="finished-badge">Débat fermé</span> : null}
            {isFinished && !isCancelled ? (
              <span className="finished-badge">Débat terminé</span>
            ) : null}
            {isPaused ? <span className="finished-badge">En pause</span> : null}
            {debateIsLive ? <span className="live-badge">En direct</span> : null}
          </div>
          <h2>{room?.title || dbDebate?.title || `Room ${roomId}`}</h2>
          <div className="participants debate-room-participants">
            {headerParticipants.map((participant, index) => (
              <ParticipantPill
                key={participant.userId ?? `slot-${index}`}
                participant={participant}
              />
            ))}
          </div>
          <p className="muted">
            {room?.participants ?? 0} participant{(room?.participants ?? 0) !== 1 ? "s" : ""}
            {" · "}
            {room?.spectators ?? 0} spectateur{(room?.spectators ?? 0) !== 1 ? "s" : ""}
          </p>
          <DebateProgress
            messageCount={room?.messages.length ?? 0}
            status={
              isCancelled || isFinished
                ? "finished"
                : awaitingValidation || waitingForOpponent
                  ? "pending"
                  : "active"
            }
            participantCount={room?.participants ?? 0}
            currentSpeakerName={room?.currentSpeakerName}
          />
          {debateIsLive && !waitingForOpponent ? (
            <div className={`turn-timer ${timerTone}`}>
              <span>Tour: {room?.currentSpeakerName || "En attente"}</span>
              <strong>{formattedTimer}</strong>
            </div>
          ) : null}
          <p className={`turn-status ${isActiveSpeaker ? "active" : ""}`}>{turnStatusText}</p>
        </div>
        <div className="chat-role-box">
          <span className={`role-badge ${role}`}>{roleLabel}</span>
          <span className="muted">{displayName}</span>
          {canQuitVoluntarily ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm end-debate-btn"
              onClick={() => setLeaveModalOpen(true)}
            >
              Mettre en pause ou terminer
            </button>
          ) : null}

        </div>
      </section>

      {error ? (
        <div className={errorIsBlock ? "moderation-block-box" : undefined}>
          <p className={errorIsBlock ? "auth-error moderation-block-msg" : "muted"}>{error}</p>
          {blockDetails && blockDetails.categories.length > 0 ? (
            <ul className="moderation-chips" aria-label="Motifs du blocage">
              {blockDetails.categories.map((category) => (
                <li key={category} className="moderation-chip moderation-chip-danger">
                  {categoryLabel(category)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {isCancelled ? (
        <section className="card debate-lifecycle-banner" role="status">
          <p>
            Ce débat a été fermé automatiquement : aucun participant n&apos;a rejoint dans
            l&apos;heure. Vous pourrez bientôt proposer ce sujet dans la section des sujets
            proposés et être notifié lorsqu&apos;un autre participant souhaitera y participer.
          </p>
        </section>
      ) : null}

      {waitingForOpponent && isCreator && !isCancelled ? (
        <section className="card debate-lifecycle-banner" role="status">
          <p>
            En attente d&apos;un adversaire. Si personne ne rejoint dans l&apos;heure, le débat
            sera fermé automatiquement. Vous pourrez ensuite proposer ce sujet dans la section
            des sujets proposés (à venir) et recevoir une notification lorsqu&apos;un participant
            souhaitera s&apos;y inscrire.
          </p>
        </section>
      ) : null}

      {awaitingValidation && isCreator ? (
        <section className="card debate-lifecycle-banner debate-validate-banner" role="alert">
          <p>Un participant a rejoint votre débat. Validez le début pour lancer les échanges.</p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={validatingStart}
            onClick={confirmValidateStart}
          >
            {validatingStart ? "Démarrage…" : "Démarrer le débat"}
          </button>
        </section>
      ) : null}

      {awaitingValidation && !isCreator && isParticipant ? (
        <section className="card debate-lifecycle-banner" role="status">
          <p>Le créateur du débat doit valider le début avant que les tours ne commencent.</p>
        </section>
      ) : null}

      <PauseStateBanner
        isPaused={isPaused}
        isPausedByMe={isPausedByMe}
        canRequestResume={canRequestResume}
        iRequestedResume={iRequestedResume}
        canValidateResume={canValidateResume}
        pausedByDisplayName={room?.pausedByDisplayName}
        resumeRequestedByDisplayName={resumeRequestedByDisplayName}
        presenceMessage={presenceMessage}
        showAbsentModal={showAbsentModal}
        isFinished={isFinished}
        resumeLoading={resumeLoading}
        onRequestResume={confirmRequestResume}
        onValidateResume={confirmValidateResume}
      />

      {moderationWarn && debateIsLive ? (
        <ModerationWarnBanner
          warn={moderationWarn}
          onEdit={() => setModerationWarn(null)}
          onSendAnyway={confirmWarnedMessage}
        />
      ) : null}

      {debateIsLive ? <DebateInsightsBar insights={debateInsights} /> : null}

      <section className="chat-stream card">
        <DebateThread
          messages={(room?.messages ?? []).map((m) => ({
            id: m.id,
            author: m.user,
            authorUserId: m.userId ?? null,
            authorStance: m.userId ? stanceByUserId.get(m.userId) ?? null : null,
            text: m.text,
          }))}
          currentUserLabel={displayName}
          currentUserId={sessionUserId}
        />
      </section>

      {isFinished ? (
        <DebateConclusionsSection conclusions={dbDebate?.conclusions ?? []} />
      ) : null}

      {showConclusionForm ? (
        <DebateConclusionForm
          debateId={roomId}
          existingContent={myExistingConclusion?.content}
          onSubmitted={() => void refreshDebate()}
        />
      ) : null}

      {dbDebate && debateIsLive ? (
        <DebateNoteSection
          debateId={dbDebate.id}
          debateTitle={dbDebate.title}
          messages={dbDebate.messages}
        />
      ) : null}

      {debateIsLive ? (
        <section className="chat-input-wrap card">
          {isParticipant ? (
            <MessageInsightHint
              insight={messageInsight}
              onDismiss={() => setMessageInsight(null)}
            />
          ) : null}
          <form onSubmit={submitMessage} className="chat-form">
            <div className="chat-input-field">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                placeholder={
                  role === "spectator"
                    ? "Mode lecture seule"
                    : sending
                      ? "Envoi en cours…"
                      : "Votre argument — un seul message par tour"
                }
                disabled={!canSend}
                maxLength={MAX_MESSAGE_LENGTH}
                aria-label="Votre argument"
                autoComplete="off"
              />
              {canSend ? (
                <span
                  className={`chat-char-count ${draft.length >= MAX_MESSAGE_LENGTH ? "at-limit" : ""}`}
                  aria-live="polite"
                >
                  {draft.length}/{MAX_MESSAGE_LENGTH}
                </span>
              ) : null}
            </div>
            <button type="submit" disabled={!canSend || !draft.trim()}>
              {sending ? "Envoi…" : "Envoyer et passer la parole"}
            </button>
          </form>
        {role === "spectator" ? (
          <p className="muted">Les spectateurs sont en lecture seule.</p>
        ) : canSend ? (
          <p className="muted">
            Votre message clôt votre tour : prenez le temps de le formuler, le
            chronomètre est le délai maximum pour répondre.
          </p>
        ) : sending ? (
          <p className="muted">Envoi en cours…</p>
        ) : (
          <p className="muted">
            C'est au tour de {room?.currentSpeakerName ?? "l'autre participant"}.
            Vous pourrez répondre dès que son message sera envoyé.
          </p>
        )}
        </section>
      ) : isFinished && isParticipant && !user ? (
        <p className="muted">Connectez-vous pour rédiger votre conclusion.</p>
      ) : null}

      <LeaveDebateModal
        open={leaveModalOpen}
        loading={leaveLoading}
        cancelOnly={aloneWaiting}
        onPause={() => emitLeaveDebate("pause")}
        onFinish={() => emitLeaveDebate("finish")}
        onCancel={() => {
          setLeaveLoading(false);
          setLeaveModalOpen(false);
        }}
      />

      {absentPeer ? (
        <ParticipantAbsentModal
          open={showAbsentModal}
          absentDisplayName={absentPeer.displayName}
          loading={resolveAbsentLoading}
          onPause={() => emitResolveAbsent("pause")}
          onFinish={() => emitResolveAbsent("finish")}
        />
      ) : null}
    </div>
  );
}
