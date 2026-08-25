-- 00015 — Sortie de l'impasse de reprise + garde-fou sur les titres
--
-- 1. `resume_requested_by_user_id` : jusqu'ici seul le participant qui avait mis
--    le débat en pause pouvait en demander la reprise, et seul l'autre pouvait
--    la valider. Si le pauseur ne revenait jamais, son adversaire n'avait aucun
--    moyen de relancer l'échange — sa seule sortie était de le terminer.
--    En mémorisant qui demande la reprise, n'importe lequel des deux peut la
--    demander, et c'est l'autre qui valide.
--
-- 2. `debates_title_max_length` : le titre était un TEXT sans borne, alors qu'il
--    est diffusé à tous les clients connectés (accueil, exploration,
--    notifications aux abonnés). 200 caractères = la limite déjà appliquée aux
--    sujets proposés côté DTO.

ALTER TABLE public.debates
  ADD COLUMN IF NOT EXISTS resume_requested_by_user_id UUID
    REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.debates.resume_requested_by_user_id IS
  'Participant ayant demandé la reprise ; la validation revient à l''autre.';

-- Les titres déjà en base sont tronqués avant la pose de la contrainte, sinon
-- l'ALTER échoue sur les données existantes.
UPDATE public.debates
   SET title = left(title, 200)
 WHERE char_length(title) > 200;

ALTER TABLE public.debates
  DROP CONSTRAINT IF EXISTS debates_title_max_length;

ALTER TABLE public.debates
  ADD CONSTRAINT debates_title_max_length CHECK (char_length(title) <= 200);
