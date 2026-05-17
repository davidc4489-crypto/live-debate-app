"use client";

import { FormEvent, useState } from "react";
import { CONCLUSION_PROMPT, MAX_CONCLUSION_LENGTH } from "@/lib/debate";
import { ConclusionSubmitError, submitConclusion } from "@/lib/debates-api";

interface DebateConclusionFormProps {
  debateId: string;
  existingContent?: string | null;
  onSubmitted?: () => void;
}

export function DebateConclusionForm({
  debateId,
  existingContent = null,
  onSubmitted,
}: DebateConclusionFormProps) {
  const [content, setContent] = useState(existingContent ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errorIsBlock, setErrorIsBlock] = useState(false);
  const [moderationWarn, setModerationWarn] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent, confirmWarn = false) {
    event.preventDefault();
    setError("");
    setErrorIsBlock(false);
    setModerationWarn(false);
    setSaving(true);

    try {
      await submitConclusion(debateId, content, confirmWarn);
      setSuccess(true);
      onSubmitted?.();
    } catch (err) {
      if (err instanceof ConclusionSubmitError) {
        setError(err.message);
        setErrorIsBlock(err.code === "MODERATION_BLOCK");
        if (err.code === "MODERATION_WARN") {
          setModerationWarn(true);
        }
      } else {
        setError(err instanceof Error ? err.message : "Impossible d'enregistrer la conclusion.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (success && existingContent) {
    return (
      <section className="card debate-conclusion-card">
        <p className="notebook-success">Votre conclusion a été enregistrée.</p>
      </section>
    );
  }

  if (success) {
    return (
      <section className="card debate-conclusion-card">
        <p className="notebook-success">Merci ! Votre conclusion a été enregistrée.</p>
      </section>
    );
  }

  return (
    <section className="card debate-conclusion-card">
      <h3>Votre conclusion</h3>
      <p className="muted debate-conclusion-prompt">{CONCLUSION_PROMPT}</p>

      {moderationWarn ? (
        <div className="moderation-warn-banner" role="alert">
          <p>Ce texte pourrait être perçu comme agressif. Souhaitez-vous le modifier ou l&apos;envoyer quand même ?</p>
          <div className="moderation-warn-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setModerationWarn(false)}
            >
              Modifier
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={(event) => void handleSubmit(event, true)}
              disabled={saving}
            >
              Publier quand même
            </button>
          </div>
        </div>
      ) : null}

      <form className="notebook-form debate-conclusion-form" onSubmit={(e) => void handleSubmit(e)}>
        <label>
          Conclusion
          <textarea
            required
            rows={6}
            value={content}
            onChange={(event) => setContent(event.target.value.slice(0, MAX_CONCLUSION_LENGTH))}
            placeholder="Partagez ce que ce débat vous a apporté…"
            disabled={saving}
            maxLength={MAX_CONCLUSION_LENGTH}
          />
        </label>
        <span className="muted chat-char-count">
          {content.length}/{MAX_CONCLUSION_LENGTH}
        </span>

        {error ? (
          <p className={errorIsBlock ? "auth-error moderation-block-msg" : "auth-error"}>{error}</p>
        ) : null}

        <div className="notebook-form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving || !content.trim()}>
            {saving ? "Enregistrement…" : existingContent ? "Mettre à jour" : "Publier ma conclusion"}
          </button>
        </div>
      </form>
    </section>
  );
}
