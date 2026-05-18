"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DebateConclusionForm } from "@/components/DebateConclusionForm";
import { DebateConclusionsSection } from "@/components/DebateConclusionsSection";
import { DebateNoteSection } from "@/components/DebateNoteSection";
import { EndDebateConfirmModal } from "@/components/EndDebateConfirmModal";
import { ParticipantPill } from "@/components/ParticipantPill";
import { DebateProgress } from "@/components/ui/DebateProgress";
import { DebateThread } from "@/components/ui/DebateThread";
import { getStoredAuth } from "@/lib/auth";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";
import { DebateDetail } from "@/lib/debate";
import { rosterToParticipants } from "@/lib/participant-roster";
import { fetchDebate } from "@/lib/debates-api";
import { getSocket } from "@/lib/socket";
import { RoomSnapshot, UserRole } from "@/lib/types";
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

interface ModerationWarnPayload {
  roomId: string;
  text: string;
  warnToken: string;
  message: string;
}

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
  const [error, setError] = useState("");
  const [errorIsBlock, setErrorIsBlock] = useState(false);
  const [moderationWarn, setModerationWarn] = useState<ModerationWarnPayload | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [endingDebate, setEndingDebate] = useState(false);
  const [validatingStart, setValidatingStart] = useState(false);
  const pendingTextRef = useRef<string | null>(null);
  const displayNameRef = useRef(displayName);

  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);

  const isCancelled =
    room?.status === "cancelled" || dbDebate?.status === "cancelled";
  const isFinished =
    room?.status === "finished" ||
    dbDebate?.status === "finished" ||
    isCancelled;
  const isParticipant = role === "participantA" || role === "participantB";
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
    !awaitingValidation &&
    (room?.debateValidated === true || dbDebate?.status === "active");

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
      }
    };

    const onDebateEnded = (payload: { roomId: string; snapshot?: RoomSnapshot }) => {
      if (payload.roomId !== roomId) return;
      if (payload.snapshot) setRoom(payload.snapshot);
      setEndModalOpen(false);
      setEndingDebate(false);
      void refreshDebate();
    };

    const onError = (payload: { message: string; code?: string }) => {
      setModerationWarn(null);
      setError(payload.message);
      setErrorIsBlock(payload.code === "MODERATION_BLOCK");
      setEndingDebate(false);
      setValidatingStart(false);
    };

    const onModerationWarn = (payload: ModerationWarnPayload) => {
      if (payload.roomId !== roomId) return;
      setError("");
      setErrorIsBlock(false);
      setModerationWarn(payload);
      setDraft(payload.text);
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
      setValidatingStart(false);
      void refreshDebate();
    };

    const onDebateCancelled = (payload: { roomId: string }) => {
      if (payload.roomId !== roomId) return;
      void refreshDebate();
    };

    socket.on("joinedRoom", onJoinedRoom);
    socket.on("roomUpdated", onRoomUpdated);
    socket.on("debateEnded", onDebateEnded);
    socket.on("debateStarted", onDebateStarted);
    socket.on("awaitingValidation", onAwaitingValidation);
    socket.on("debateCancelled", onDebateCancelled);
    socket.on("errorMessage", onError);
    socket.on("moderationWarn", onModerationWarn);
    socket.on("tick", onTick);

    return () => {
      socket.off("joinedRoom", onJoinedRoom);
      socket.off("roomUpdated", onRoomUpdated);
      socket.off("debateEnded", onDebateEnded);
      socket.off("debateStarted", onDebateStarted);
      socket.off("awaitingValidation", onAwaitingValidation);
      socket.off("debateCancelled", onDebateCancelled);
      socket.off("errorMessage", onError);
      socket.off("moderationWarn", onModerationWarn);
      socket.off("tick", onTick);
    };
  }, [roomId, refreshDebate]);

  useEffect(() => {
    const socket = getSocket();
    const accessToken = getStoredAuth()?.session.accessToken;

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

  const waitingForOpponent =
    !isFinished && !isCancelled && (room?.participants ?? 0) < 2;
  const isActiveSpeaker = useMemo(
    () =>
      debateIsLive &&
      !waitingForOpponent &&
      role !== "spectator" &&
      room?.currentSpeakerName === displayName,
    [debateIsLive, waitingForOpponent, role, room?.currentSpeakerName, displayName],
  );
  const canSend = useMemo(
    () => isActiveSpeaker && remainingSeconds > 0,
    [isActiveSpeaker, remainingSeconds],
  );

  const turnStatusText = useMemo(() => {
    if (isCancelled) {
      return "Ce débat a été fermé faute de participant dans le délai imparti.";
    }
    if (isFinished) return "Débat terminé.";
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
    return isActiveSpeaker ? "Vous avez la parole." : "En attente de l'autre participant.";
  }, [
    isCancelled,
    isFinished,
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

  const headerParticipants = useMemo(() => {
    return (
      rosterToParticipants(room?.participantRoster) ??
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
    if (warnToken) {
      pendingTextRef.current = text;
      getSocket().emit("sendMessage", { roomId, text, warnToken });
      return;
    }
    pendingTextRef.current = text;
    getSocket().emit("sendMessage", { roomId, text });
  }

  function confirmWarnedMessage() {
    if (!moderationWarn) return;
    submitMessage(
      { preventDefault: () => undefined } as FormEvent,
      moderationWarn.warnToken,
    );
  }

  function confirmValidateStart() {
    const accessToken = getStoredAuth()?.session.accessToken;
    if (!accessToken) {
      setError("Connectez-vous pour démarrer le débat.");
      return;
    }
    setValidatingStart(true);
    getSocket().emit("validateDebateStart", { roomId, accessToken });
  }

  function confirmEndDebate() {
    const accessToken = getStoredAuth()?.session.accessToken;
    if (!accessToken) {
      setError("Connectez-vous pour mettre fin au débat.");
      return;
    }
    setEndingDebate(true);
    getSocket().emit("endDebate", { roomId, accessToken });
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
          {isParticipant && debateIsLive ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm end-debate-btn"
              onClick={() => setEndModalOpen(true)}
            >
              Mettre fin au débat
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <p className={errorIsBlock ? "auth-error moderation-block-msg" : "muted"}>{error}</p>
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

      {moderationWarn && debateIsLive ? (
        <section className="card moderation-warn-banner" role="alert">
          <p>{moderationWarn.message}</p>
          <div className="moderation-warn-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModerationWarn(null)}>
              Modifier
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={confirmWarnedMessage}>
              Envoyer quand même
            </button>
          </div>
        </section>
      ) : null}

      <section className="chat-stream card">
        <DebateThread
          messages={(room?.messages ?? []).map((m) => ({
            id: m.id,
            author: m.user,
            text: m.text,
          }))}
          currentUserLabel={displayName}
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
          <form onSubmit={submitMessage} className="chat-form">
            <div className="chat-input-field">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                placeholder={role === "spectator" ? "Mode lecture seule" : "Écrivez votre argument..."}
                disabled={!canSend}
                maxLength={MAX_MESSAGE_LENGTH}
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
              Envoyer
            </button>
          </form>
        {!canSend ? (
          <p className="muted">
            {role === "spectator"
              ? "Les spectateurs sont en lecture seule."
              : "Vous pouvez écrire uniquement pendant votre tour."}
          </p>
        ) : null}
        </section>
      ) : isFinished && isParticipant && !user ? (
        <p className="muted">Connectez-vous pour rédiger votre conclusion.</p>
      ) : null}

      <EndDebateConfirmModal
        open={endModalOpen}
        loading={endingDebate}
        onConfirm={confirmEndDebate}
        onCancel={() => setEndModalOpen(false)}
      />
    </div>
  );
}
