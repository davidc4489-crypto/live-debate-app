"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DebateConclusionForm } from "@/components/DebateConclusionForm";
import { DebateConclusionsSection } from "@/components/DebateConclusionsSection";
import { DebateNoteSection } from "@/components/DebateNoteSection";
import { EndDebateConfirmModal } from "@/components/EndDebateConfirmModal";
import { ParticipantPill } from "@/components/ParticipantPill";
import { getStoredAuth } from "@/lib/auth";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";
import { DebateDetail } from "@/lib/debate";
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
  const pendingTextRef = useRef<string | null>(null);

  const isFinished = room?.status === "finished" || dbDebate?.status === "finished";
  const isParticipant = role === "participantA" || role === "participantB";

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
    const accessToken = getStoredAuth()?.session.accessToken;

    const onJoinedRoom = (payload: JoinedRoomPayload) => {
      setRole(payload.role);
      setDisplayName(payload.displayName);
      setSessionUserId(payload.userId);
    };

    const onRoomUpdated = (snapshot: RoomSnapshot) => {
      if (snapshot.id !== roomId) return;
      setRoom(snapshot);
      const pending = pendingTextRef.current;
      if (!pending) return;
      const accepted = snapshot.messages.some(
        (message) => message.user === displayName && message.text === pending,
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

    socket.on("joinedRoom", onJoinedRoom);
    socket.on("roomUpdated", onRoomUpdated);
    socket.on("debateEnded", onDebateEnded);
    socket.on("errorMessage", onError);
    socket.on("moderationWarn", onModerationWarn);
    socket.on("tick", onTick);

    socket.emit("joinRoom", { roomId, accessToken });
    socket.emit("getRoomState", { roomId });

    return () => {
      socket.off("joinedRoom", onJoinedRoom);
      socket.off("roomUpdated", onRoomUpdated);
      socket.off("debateEnded", onDebateEnded);
      socket.off("errorMessage", onError);
      socket.off("moderationWarn", onModerationWarn);
      socket.off("tick", onTick);
    };
  }, [roomId, displayName, refreshDebate]);

  useEffect(() => {
    setRemainingSeconds(room?.remainingSeconds ?? 0);
  }, [room?.remainingSeconds]);

  const waitingForOpponent = !isFinished && (room?.participants ?? 0) < 2;
  const isActiveSpeaker = useMemo(
    () =>
      !isFinished &&
      !waitingForOpponent &&
      role !== "spectator" &&
      room?.currentSpeakerName === displayName,
    [isFinished, waitingForOpponent, role, room?.currentSpeakerName, displayName],
  );
  const canSend = useMemo(
    () => isActiveSpeaker && remainingSeconds > 0,
    [isActiveSpeaker, remainingSeconds],
  );

  const roleLabel = useMemo(() => {
    if (role === "participantA") return "Participant A";
    if (role === "participantB") return "Participant B";
    return "Spectateur";
  }, [role]);

  const turnStatusText = useMemo(() => {
    if (isFinished) return "Débat terminé.";
    if (waitingForOpponent) {
      return isParticipant
        ? "En attente d'un second participant pour commencer."
        : "Le débat commencera lorsque deux participants seront présents.";
    }
    if (role === "spectator") return "Mode spectateur : vous observez le tour en direct.";
    return isActiveSpeaker ? "Vous avez la parole." : "En attente de l'autre participant.";
  }, [isFinished, waitingForOpponent, isParticipant, role, isActiveSpeaker]);

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
          <h2>{room?.title || dbDebate?.title || `Room ${roomId}`}</h2>
          {isFinished ? <span className="finished-badge">Débat terminé</span> : null}
          {dbDebate ? (
            <div className="participants debate-room-participants">
              {dbDebate.participants.map((participant) => (
                <ParticipantPill
                  key={participant.userId ?? participant.displayName}
                  participant={participant}
                />
              ))}
            </div>
          ) : null}
          <p className="muted">
            Participants: {room?.participants ?? 0} | Spectateurs: {room?.spectators ?? 0}
          </p>
          {!isFinished && !waitingForOpponent ? (
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
          {isParticipant && !isFinished ? (
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

      {moderationWarn && !isFinished ? (
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
        {room?.messages?.length ? null : <p className="muted">Aucun message.</p>}
        <div className="chat-messages">
          {room?.messages.map((message) => (
            <article className={`chat-bubble ${message.user === displayName ? "self" : ""}`} key={message.id}>
              <div className="bubble-head">
                <strong>{message.user}</strong>
              </div>
              <p>{message.text}</p>
            </article>
          ))}
        </div>
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

      {dbDebate && !isFinished ? (
        <DebateNoteSection
          debateId={dbDebate.id}
          debateTitle={dbDebate.title}
          messages={dbDebate.messages}
        />
      ) : null}

      {!isFinished ? (
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
            {waitingForOpponent
              ? "Le débat démarre dès qu'un second participant rejoint la room."
              : role === "spectator"
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
