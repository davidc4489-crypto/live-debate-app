"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AuthModal, AuthModalMode } from "@/components/AuthModal";
import { formatDebateDate } from "@/lib/debate";
import { createNote, deleteNote, fetchNotes, Note, updateNote } from "@/lib/notes-api";
import { useAuthSession } from "@/lib/useAuthSession";

const emptyForm = {
  title: "",
  content: "",
};

export function NotebookClient() {
  const { user, loading: authLoading, refresh } = useAuthSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>("signin");

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);

  const loadNotes = useCallback(async () => {
    const data = await fetchNotes();
    setNotes(data);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      setAuthOpen(true);
      return;
    }

    let cancelled = false;

    async function init() {
      setLoading(true);
      setError("");
      try {
        const notesData = await fetchNotes();
        if (!cancelled) setNotes(notesData);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erreur de chargement");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(false);
  }

  function startEdit(note: Note) {
    setFormOpen(true);
    setEditingId(note.id);
    setForm({
      title: note.title,
      content: note.content,
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const title = form.title.trim();
      const content = form.content.trim();

      if (editingId) {
        await updateNote(editingId, { title, content });
      } else {
        await createNote({ title, content });
      }

      await loadNotes();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer la note");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    if (!window.confirm("Supprimer cette note ?")) return;
    setError("");
    try {
      await deleteNote(noteId);
      await loadNotes();
      if (editingId === noteId) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible");
    }
  }

  if (authLoading || loading) {
    return <p className="muted">Chargement du notebook…</p>;
  }

  if (!user) {
    return (
      <>
        <div className="empty-state">
          <p>Connectez-vous pour accéder à votre notebook.</p>
          <button type="button" className="btn btn-primary" onClick={() => setAuthOpen(true)}>
            Se connecter
          </button>
        </div>
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

  return (
    <div className="notebook-layout">
      <header className="notebook-header">
        <div>
          <h1>Mon notebook</h1>
          <p className="muted">
            Notes personnelles sans lien. Pour noter un débat ou un message précis, utilisez
            « Nouvelle note » depuis la page du débat.
          </p>
        </div>
      </header>

      {error ? <p className="auth-error">{error}</p> : null}

      <section className="notebook-list">
        <div className="notebook-list-header">
          <h2>Mes notes ({notes.length})</h2>
          {!formOpen ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
                setFormOpen(true);
              }}
            >
              Nouvelle note
            </button>
          ) : null}
        </div>
        {notes.length === 0 ? (
          <p className="muted notebook-empty">Aucune note pour le moment.</p>
        ) : (
          <div className="notebook-grid">
            {notes.map((note) => (
              <article key={note.id} className="card notebook-note-card">
                <h3>{note.title}</h3>

                {note.link?.debateId ? (
                  <div className="notebook-links">
                    <Link href={`/room/${note.link.debateId}`} className="notebook-link">
                      Débat : {note.link.debateTitle ?? "Voir le débat"}
                    </Link>
                    {note.link.messageId && note.link.messageExcerpt ? (
                      <p className="muted notebook-message-ref">
                        Message : « {note.link.messageExcerpt} »
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {note.content ? <p className="notebook-note-content">{note.content}</p> : null}

                <p className="muted notebook-meta">
                  Modifié {formatDebateDate(note.updatedAt)}
                </p>

                <div className="notebook-note-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(note)}>
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm danger"
                    onClick={() => void handleDelete(note.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={`card notebook-form-card ${formOpen ? "is-open" : "is-collapsed"}`}>
        <button
          type="button"
          className="notebook-form-toggle"
          onClick={() => setFormOpen((open) => !open)}
          aria-expanded={formOpen}
        >
          <span className="notebook-form-toggle-title">
            {editingId ? "Modifier la note" : "Nouvelle note"}
          </span>
          <span className="notebook-form-toggle-icon" aria-hidden>
            {formOpen ? "−" : "+"}
          </span>
        </button>

        {formOpen ? (
          <form className="notebook-form" onSubmit={handleSubmit}>
            <label>
              Titre
              <input
                required
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Ex: Idée à approfondir"
              />
            </label>

            <label>
              Contenu
              <textarea
                rows={5}
                value={form.content}
                onChange={(event) => setForm({ ...form, content: event.target.value })}
                placeholder="Vos réflexions, citations, contre-arguments…"
              />
            </label>

            {editingId && notes.find((n) => n.id === editingId)?.link ? (
              <p className="muted notebook-linked-hint">
                Le lien vers le débat est conservé. Pour le modifier, ouvrez la page du débat.
              </p>
            ) : null}

            <div className="notebook-form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Enregistrement…" : editingId ? "Mettre à jour" : "Ajouter la note"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={resetForm}>
                {editingId ? "Annuler" : "Fermer"}
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
    </div>
  );
}
