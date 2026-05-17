"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DebateNoteSection } from "@/components/DebateNoteSection";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";
import { DebateDetail } from "@/lib/debate";
import { getSocket } from "@/lib/socket";
import { RoomSnapshot, UserRole } from "@/lib/types";

interface DebateRoomClientProps {
  roomId: string;
  dbDebate?: DebateDetail | null;
}

interface JoinedRoomPayload {
  roomId: string;
  role: UserRole;
  displayName: string;
}

interface ModerationWarnPayload {
  roomId: string;
  text: string;
  warnToken: string;
  message: string;
}

export function DebateRoomClient({ roomId, dbDebate }: DebateRoomClientProps) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [role, setRole] = useState<UserRole>("spectator");
  const [displayName, setDisplayName] = useState("Spectator");
  const [draft, setDraft] = useState("");
  const [isModerator, setIsModerator] = useState(false);
  const [error, setError] = useState("");
  const [errorIsBlock, setErrorIsBlock] = useState(false);
  const [moderationWarn, setModerationWarn] = useState<ModerationWarnPayload | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const pendingTextRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const onJoinedRoom = (payload: JoinedRoomPayload) => {
      setRole(payload.role);
      setDisplayName(payload.displayName);
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

    const onError = (payload: { message: string; code?: string }) => {
      setModerationWarn(null);
      setError(payload.message);
      setErrorIsBlock(payload.code === "MODERATION_BLOCK");
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
    socket.on("errorMessage", onError);
    socket.on("moderationWarn", onModerationWarn);
    socket.on("tick", onTick);

    socket.emit("joinRoom", { roomId });
    socket.emit("getRoomState", { roomId });

    return () => {
      socket.off("joinedRoom", onJoinedRoom);
      socket.off("roomUpdated", onRoomUpdated);
      socket.off("errorMessage", onError);
      socket.off("moderationWarn", onModerationWarn);
      socket.off("tick", onTick);
    };
  }, [roomId]);

  useEffect(() => {
    setRemainingSeconds(room?.remainingSeconds ?? 0);
  }, [room?.remainingSeconds]);

  const isActiveSpeaker = useMemo(
    () => role !== "spectator" && room?.currentSpeakerName === displayName,
    [role, room?.currentSpeakerName, displayName],
  );
  const canSend = useMemo(() => isActiveSpeaker && remainingSeconds > 0, [isActiveSpeaker, remainingSeconds]);
  const roleLabel = useMemo(() => {
    if (role === "participantA") return "Participant A";
    if (role === "participantB") return "Participant B";
    return "Spectateur";
  }, [role]);
  const turnStatusText = useMemo(() => {
    if (role === "spectator") return "Mode spectateur: vous observez le tour en direct.";
    return isActiveSpeaker ? "Vous avez la parole." : "En attente de l'autre participant.";
  }, [role, isActiveSpeaker]);
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

  function deleteMessage(messageId: string) {
    setError("");
    getSocket().emit("deleteMessage", { roomId, messageId });
  }

  return (
    <div className="chat-layout reveal">
      <section className="chat-header card">
        <div>
          <h2>{room?.title || `Room ${roomId}`}</h2>
          <p className="muted">
            Participants: {room?.participants ?? 0} | Spectateurs: {room?.spectators ?? 0}
          </p>
          <div className={`turn-timer ${timerTone}`}>
            <span>Tour: {room?.currentSpeakerName || "En attente"}</span>
            <strong>{formattedTimer}</strong>
          </div>
          <p className={`turn-status ${isActiveSpeaker ? "active" : ""}`}>{turnStatusText}</p>
        </div>
        <div className="chat-role-box">
          <span className={`role-badge ${role}`}>{roleLabel}</span>
          <span className="muted">{displayName}</span>
          <label className="moderator-switch">
            <input
              id="moderatorToggle"
              type="checkbox"
              checked={isModerator}
              onChange={(event) => setIsModerator(event.target.checked)}
            />
            <span>Mode modérateur</span>
          </label>
        </div>
      </section>
      {error ? (
        <p className={errorIsBlock ? "auth-error moderation-block-msg" : "muted"}>{error}</p>
      ) : null}

      {moderationWarn ? (
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
                {isModerator ? (
                  <button className="danger" onClick={() => deleteMessage(message.id)}>
                    Supprimer
                  </button>
                ) : null}
              </div>
              <p>{message.text}</p>
            </article>
          ))}
        </div>
      </section>

      {dbDebate ? (
        <DebateNoteSection
          debateId={dbDebate.id}
          debateTitle={dbDebate.title}
          messages={dbDebate.messages}
        />
      ) : null}

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
              : "Input bloque: vous pouvez ecrire uniquement pendant votre tour."}
          </p>
        ) : null}
      </section>
    </div>
  );
}
