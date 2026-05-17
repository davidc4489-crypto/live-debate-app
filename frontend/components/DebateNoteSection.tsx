"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AuthModal, AuthModalMode } from "@/components/AuthModal";
import { DebateMessage } from "@/lib/debate";
import { createNote } from "@/lib/notes-api";
import { useAuthSession } from "@/lib/useAuthSession";

interface DebateNoteSectionProps {
  debateId: string;
  debateTitle: string;
  messages: DebateMessage[];
  open?: boolean;
  prefillMessageId?: string;
  onOpenChange?: (open: boolean) => void;
}

export function DebateNoteSection({
  debateId,
  debateTitle,
  messages,
  open: controlledOpen,
  prefillMessageId = "",
  onOpenChange,
}: DebateNoteSectionProps) {
  const { user, refresh } = useAuthSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>("signin");
  const [internalOpen, setInternalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [messageId, setMessageId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const formOpen = controlledOpen ?? internalOpen;

  function setFormOpen(next: boolean) {
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  }

  useEffect(() => {
    if (formOpen && prefillMessageId) {
      setMessageId(prefillMessageId);
    }
  }, [formOpen, prefillMessageId]);

  function resetForm() {
    setTitle("");
    setContent("");
    setMessageId("");
    setFormOpen(false);
    setError("");
    setSuccess("");
  }

  function openForm() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setTitle((current) => current || "Note sur le débat");
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      setAuthOpen(true);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await createNote({
        title: title.trim(),
        content: content.trim(),
        debateId,
        messageId: messageId || undefined,
      });
      setSuccess("Note enregistrée dans votre notebook.");
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer la note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section
        id="debate-note-section"
        className={`card debate-note-card ${formOpen ? "is-open" : "is-collapsed"}`}
      >
        <div className="debate-note-header">
          <button
            type="button"
            className="notebook-form-toggle"
            onClick={() => (formOpen ? resetForm() : openForm())}
            aria-expanded={formOpen}
          >
            <span className="notebook-form-toggle-title">Nouvelle note</span>
            <span className="notebook-form-toggle-icon" aria-hidden>
              {formOpen ? "−" : "+"}
            </span>
          </button>
          {user ? (
            <Link href="/notebook" className="btn btn-ghost btn-sm">
              Voir mon notebook
            </Link>
          ) : null}
        </div>

        {formOpen ? (
          <form className="notebook-form debate-note-form" onSubmit={handleSubmit}>
            <p className="muted debate-note-context">
              Note liée au débat : <strong>{debateTitle}</strong>
            </p>

            <label>
              Titre
              <input
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex: Argument à retenir"
              />
            </label>

            <label>
              Contenu
              <textarea
                rows={4}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Vos réflexions sur ce débat…"
              />
            </label>

            {messages.length > 0 ? (
              <label>
                Message lié (optionnel)
                <select value={messageId} onChange={(event) => setMessageId(event.target.value)}>
                  <option value="">Note sur le débat entier</option>
                  {messages.map((message) => (
                    <option key={message.id} value={message.id}>
                      {message.author} — {message.text.slice(0, 60)}
                      {message.text.length > 60 ? "…" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {error ? <p className="auth-error">{error}</p> : null}
            {success ? <p className="notebook-success">{success}</p> : null}

            <div className="notebook-form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer la note"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={resetForm}>
                Annuler
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => void refresh()}
        onSwitchMode={setAuthMode}
      />
    </>
  );
}
