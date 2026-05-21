/** Colonnes ajoutées par les migrations pause / reprise (00008, 00009). */
const PAUSE_MIGRATION_COLUMN =
  /paused_at|paused_by_user_id|resume_requested_at|ended_by_user_id/;

/** PostgREST : colonne absente du cache schéma (ex. migration non appliquée). */
const PGRST_MISSING_COLUMN_MESSAGE =
  /Could not find the '[^']+' column(?: of '[^']+')?(?: in the schema cache)?/i;

/** PostgreSQL : colonne inexistante en base. */
const PG_MISSING_COLUMN_MESSAGE = /column ["']?(?:\w+\.)?(\w+)["']? does not exist/i;

type DbErrorLike = { message: string; code?: string | null };

/**
 * Erreur liée à une colonne pause/reprise absente (migration 00008/00009 non appliquée).
 * Ne matche pas les erreurs « table / fonction introuvable » qui contiennent aussi « Could not find the ».
 */
export function isMissingPauseMigrationColumnError(
  error: DbErrorLike | string,
): boolean {
  const message = typeof error === "string" ? error : error.message;
  const code = typeof error === "string" ? undefined : error.code;

  if (code === "PGRST204") {
    return true;
  }

  if (PGRST_MISSING_COLUMN_MESSAGE.test(message)) {
    return true;
  }

  const pgMatch = PG_MISSING_COLUMN_MESSAGE.exec(message);
  if (pgMatch && PAUSE_MIGRATION_COLUMN.test(pgMatch[1])) {
    return true;
  }

  return (
    PAUSE_MIGRATION_COLUMN.test(message) &&
    /schema cache/i.test(message) &&
    /column/i.test(message)
  );
}
