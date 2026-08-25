"use client";

interface PauseStateBannerProps {
  isPaused: boolean;
  isPausedByMe: boolean;
  /** Le participant peut lancer une demande de reprise (aucune en attente). */
  canRequestResume: boolean;
  /** Une demande est en attente, et elle vient de moi. */
  iRequestedResume: boolean;
  /** Une demande est en attente, et c'est à moi de la valider. */
  canValidateResume: boolean;
  pausedByDisplayName?: string | null;
  resumeRequestedByDisplayName?: string | null;
  presenceMessage: string | null;
  showAbsentModal: boolean;
  isFinished: boolean;
  resumeLoading: boolean;
  onRequestResume: () => void;
  onValidateResume: () => void;
}

/**
 * Bandeau de pause.
 *
 * Il s'articule autour de **qui a demandé la reprise**, et non plus de qui a mis
 * en pause : les deux participants peuvent désormais demander la reprise, et
 * c'est l'autre qui valide. L'ancienne version laissait le participant qui
 * n'avait pas mis en pause devant un message sans la moindre action possible.
 */
export function PauseStateBanner({
  isPaused,
  isPausedByMe,
  canRequestResume,
  iRequestedResume,
  canValidateResume,
  pausedByDisplayName,
  resumeRequestedByDisplayName,
  presenceMessage,
  showAbsentModal,
  isFinished,
  resumeLoading,
  onRequestResume,
  onValidateResume,
}: PauseStateBannerProps) {
  if (!isPaused) {
    if (presenceMessage && !isFinished && !showAbsentModal) {
      return (
        <section className="card debate-lifecycle-banner" role="status">
          <p>{presenceMessage}</p>
        </section>
      );
    }
    return null;
  }

  if (canRequestResume) {
    return (
      <section className="card debate-lifecycle-banner debate-validate-banner" role="alert">
        <p>
          {isPausedByMe
            ? "Vous avez mis ce débat en pause. Demandez la reprise lorsque vous êtes prêt à continuer."
            : `Ce débat est en pause${
                pausedByDisplayName ? ` (par ${pausedByDisplayName})` : ""
              }. Vous pouvez demander la reprise : l'autre participant devra la valider.`}
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={resumeLoading}
          onClick={onRequestResume}
        >
          {resumeLoading ? "Envoi…" : "Demander la reprise"}
        </button>
      </section>
    );
  }

  if (iRequestedResume) {
    return (
      <section className="card debate-lifecycle-banner" role="status">
        <p>Reprise demandée. L&apos;autre participant doit valider pour relancer le débat.</p>
      </section>
    );
  }

  if (canValidateResume) {
    return (
      <section className="card debate-lifecycle-banner debate-validate-banner" role="alert">
        <p>
          {resumeRequestedByDisplayName ?? pausedByDisplayName ?? "L'autre participant"} souhaite
          reprendre le débat. Validez pour relancer les tours de parole.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={resumeLoading}
          onClick={onValidateResume}
        >
          {resumeLoading ? "Validation…" : "Valider la reprise"}
        </button>
      </section>
    );
  }

  // Spectateur d'un débat en pause : aucune action, seulement l'état.
  return (
    <section className="card debate-lifecycle-banner" role="status">
      <p>
        {presenceMessage ??
          `Ce débat est en pause${pausedByDisplayName ? ` par ${pausedByDisplayName}` : ""}.`}
      </p>
    </section>
  );
}
