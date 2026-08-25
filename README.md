# Argumen

Plateforme de **débat structuré entre deux personnes** : un sujet, deux camps,
des tours de parole et un message chacun. Les spectateurs suivent l'échange
sans pouvoir l'interrompre.

L'IA n'est **jamais un interlocuteur** — on ne débat pas contre elle. Elle
modère les messages avant publication, calcule un climat de débat et renvoie un
retour privé à l'auteur. Voir « Modération & IA » plus bas.

- `backend/` en `NestJS + Socket.IO` — état des salles en mémoire, persistance
  Supabase (messages écrits au fil de l'eau)
- `frontend/` en `Next.js App Router + Socket.IO client`
- `moderation-service/` en `FastAPI` — modèles Hugging Face auto-hébergés
- `supabase/migrations/` — schéma PostgreSQL

## Fonctionnalités

- Création de rooms de débat
- 2 participants max par room (auto-assignés `Participant A` et `Participant B`)
- spectateurs illimités en lecture seule
- chat temps réel via WebSocket
- suppression manuelle de messages (mode modérateur côté UI)
- liste des rooms actives avec compteurs live (participants/spectateurs)

### Déroulement d'un débat

Le débat alterne **un message chacun**, à tour de rôle :

1. Le créateur ouvre le débat ; il reste ouvert une heure en attente d'un adversaire,
   puis se ferme automatiquement.
2. Quand un second participant rejoint, le créateur valide le démarrage.
3. Chacun parle à son tour. **Envoyer son message passe la parole à l'autre** —
   la durée de tour (3, 5 ou 10 min) est le *délai maximum pour répondre*, pas un
   temps de parole à consommer. Un tour écoulé sans message passe la main.
4. Un participant peut mettre le débat en pause ou le terminer. En pause,
   **l'un ou l'autre** peut demander la reprise, validée par celui qui ne l'a pas
   demandée. Un débat en pause plus de 7 jours est clôturé automatiquement.
5. Une fois terminé, chaque participant rédige sa conclusion.

### Modération & IA (Hugging Face)

- **modération multilingue** — Detoxify `multilingual` (XLM-RoBERTa) : le
  français est traité nativement, avec 7 catégories (insulte, menace, haine
  identitaire…) et ~40 ms par message
- **lexique FR/EN** en complément : rattrape l'obfuscation (`c0nn4rd`,
  `c.o.n.n.a.r.d`) et prend le relais si le service ML est indisponible
- **avertissement pédagogique** : motif du signalement, gravité estimée et
  conseil de reformulation, plutôt qu'un refus opaque
- **garde anti-spam** locale : flood, répétition, mur de caractères (sans modèle)
- **indice de qualité argumentative** : structure, preuves, civilité, nuance —
  retour privé à l'auteur et « climat du débat » affiché à tous
- **classement thématique automatique** des débats (zero-shot, optionnel) :
  sans lui, tous les débats restaient dans « Général »
- **résilience** : circuit breaker, repli lexical, warmup asynchrone

Détail complet : [docs/MODERATION.md](docs/MODERATION.md).

## Structure du projet

```txt
.
├── backend/
└── frontend/
```

## Variables d'environnement

### Backend

Créer `backend/.env` à partir de `backend/.env.example` :

```env
PORT=3001
```

### Frontend

Créer `frontend/.env.local` à partir de `frontend/.env.example` :

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### Mot de passe oublié (Supabase Auth)

Dans **Authentication → URL Configuration** du projet Supabase, ajouter aux **Redirect URLs** :

- `http://localhost:3000/auth/reset-password`
- `https://<votre-domaine-vercel>/auth/reset-password`

La variable backend `FRONTEND_URL` doit lister les mêmes origines (virgules) que pour la confirmation d’email (`/auth/confirm`).

Flux : connexion → **Mot de passe oublié ?** → email Supabase → page `/auth/reset-password` → nouveau mot de passe.

## Lancer en local

### 1) Appliquer le schéma Supabase

Dans le SQL Editor Supabase (ou via CLI), exécuter les migrations dans `supabase/migrations/` :

1. `00001_initial_schema.sql` (tables de base)
2. `00003_user_profiles.sql` (**obligatoire pour les profils et intérêts**)
3. `00004_more_interests.sql` (optionnel — ~30 intérêts supplémentaires)
4. `00005_follows_notifications.sql` (**abonnements + notifications**)
5. `00014_moderation_v2.sql` (modération détaillée : catégories, gravité, langue)
6. `00015_resume_requester_and_title_guard.sql` (**reprise demandable par les deux
   participants** + longueur maximale des titres)

Les migrations `00007` à `00013` (cycle de vie, pause/reprise, débats proposés)
sont également nécessaires au déroulement complet d'un débat. Le backend
fonctionne en mode dégradé si `00015` manque : la reprise retombe alors sur
l'ancienne règle (seul le participant ayant mis en pause peut la demander).

**Appliquer une migration en ligne de commande** — renseignez `DATABASE_URL`
dans `backend/.env` (Supabase → Project Settings → Database → Connection string
→ URI, elle contient le mot de passe de la base, pas la clé service role) :

```bash
cd backend
npm run migrate -- --list                              # migrations disponibles
npm run migrate 00015_resume_requester_and_title_guard # en applique une
```

La migration est jouée dans une transaction (rien n'est appliqué en cas
d'erreur) et les fichiers du projet sont rejouables sans effet de bord.

> **`connect ENETUNREACH` ?** Le host direct `db.<ref>.supabase.co` n'a plus
> d'enregistrement IPv4 : il est injoignable depuis un réseau sans IPv6. Prenez
> la chaîne **Session pooler** du dashboard (`postgres.<ref>@aws-0-<région>
> .pooler.supabase.com:5432`), qui répond en IPv4.

**Profils / intérêts** — si vous voyez `Could not find the table 'public.interests'` :

1. [Supabase Dashboard](https://supabase.com/dashboard) → votre projet → **SQL Editor** → **New query**
2. Copier-coller tout le fichier `supabase/migrations/00003_user_profiles.sql`
3. **Run**

Ou en local (avec le mot de passe base dans `DATABASE_URL`) :

```bash
cd backend
npm install pg --save-dev
# DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@... (Settings → Database → Connection string)
npm run migrate:profiles
```

### 2) Seed des débats d'exemple

```bash
cd backend
npm run seed
```

Crée **2 débats** avec **10 messages** chacun en base (nécessite `SUPABASE_SERVICE_ROLE_KEY` dans `backend/.env`).

### 3) Modération (optionnel mais recommandé)

```bash
cd moderation-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Au premier démarrage, les poids de Detoxify `multilingual` (~1,1 Go) sont
téléchargés en tâche de fond : le service répond immédiatement et le lexique
FR/EN assure la modération pendant ce temps.

Pour développer sans télécharger le moindre modèle :

```bash
MOD_BACKEND=heuristic uvicorn app.main:app --reload --port 8000
```

Ajouter dans `backend/.env` : `MODERATION_SERVICE_URL=http://localhost:8000`

Modèles optionnels (désactivés par défaut, voir `moderation-service/.env.example`) :
`MOD_ENABLE_SENTIMENT`, `MOD_ENABLE_ZEROSHOT` (classement thématique des
débats), `MOD_ENABLE_FRENCH_HATE`.

Voir [docs/MODERATION.md](docs/MODERATION.md) pour l'architecture complète.

### 4) Démarrer le backend

```bash
cd backend
npm install
npm run start:dev
```

Backend disponible sur `http://localhost:3001`.

### 5) Démarrer le frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend disponible sur `http://localhost:3000`.

## Événements Socket.IO (backend)

- `createRoom` → crée une room (`title`, `roomId?`)
- `joinRoom` → rejoint une room (`roomId`, `username?`)
- `sendMessage` → envoie un message (participants uniquement)
- `deleteMessage` → supprime un message (modération manuelle)
- `getRooms` → renvoie la liste des rooms

Événements push émis par le serveur :

- `roomsUpdated` → liste globale des rooms (sans les messages)
- `roomUpdated` → état complet d'une room, y compris les messages et le tour courant
- `joinedRoom` → rôle attribué à l'utilisateur
- `errorMessage` → erreurs métier (dont `MODERATION_BLOCK`, `RATE_LIMIT`, `DUPLICATE`)
- `moderationWarn` → message signalé : motifs, gravité, conseil de reformulation
- `messageInsight` → retour privé à l'auteur (indice d'argumentation)
- `debateInsights` → civilité et qualité moyennes du débat

## Déploiement

## Backend sur Render

Créer un **Web Service** sur Render pointant sur le repo GitHub.

Configuration :

- Root Directory: `backend`
- Build Command: `npm ci && npm run build` (les `devDependencies` sont requises pour compiler Nest)
- Start Command: `npm run start:prod` (lance `dist/main.js`)

Un fichier `render.yaml` à la racine du repo peut servir de blueprint. Si le build échoue avec `Cannot find module dist/main`, vérifier que `dist/main.js` est bien produit localement après `npm run build` dans `backend/`.
- Environment Variable:
  - `PORT` peut être laissé vide (Render l'injecte automatiquement)

Le backend écoute `process.env.PORT`, compatible Render.

## Frontend sur Vercel

Créer un projet Vercel depuis le même repo.

Configuration :

- Root Directory: `frontend`
- Framework preset: `Next.js`
- Environment Variables:
  - `NEXT_PUBLIC_BACKEND_URL=https://<votre-backend-render>.onrender.com`

Puis déployer.

## Sécurité

- **Ne jamais committer de clés** dans `*.env.example` : ces fichiers sont
  versionnés. La `SUPABASE_SERVICE_ROLE_KEY` contourne toutes les RLS ; si elle
  fuite, il faut la révoquer dans Supabase → Settings → API.
- **CORS** restreint aux origines de `FRONTEND_URL`, côté API HTTP **et** côté
  gateway Socket.IO (qui transporte les jetons d'accès et tout le trafic de
  débat). Sans cette variable, le backend accepte toutes les origines et le log
  l'annonce au démarrage — à ne pas laisser en production.
- **Validation** globale des entrées (`class-validator`) : tout champ non
  déclaré dans un DTO est rejeté, chaque champ est typé et borné.
- **Anti brute-force** : `/auth/signin` (10 / 5 min), `/auth/signup` (5 / h),
  `/auth/forgot-password` (3 / 15 min), `/auth/reset-password` (5 / 15 min).
- **Réinitialisation de mot de passe** : le chemin administrateur n'est ouvert
  qu'aux jetons issus d'un lien email (revendication `amr`), jamais à un jeton
  de session ordinaire. Les autres sessions sont invalidées après changement.
- **Corps de requête** plafonné (`BODY_LIMIT`, 100 ko par défaut).

## Notes MVP

- Persistance Supabase (les rooms en mémoire sont restaurées depuis la base)
- Les sessions sont renouvelées automatiquement avant expiration (`/auth/refresh`)