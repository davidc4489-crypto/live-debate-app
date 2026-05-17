# Live Debate App (MVP)

MVP de débat en temps réel pour petits groupes (environ 10 utilisateurs), avec :

- `backend/` en `NestJS + Socket.IO`
- `frontend/` en `Next.js App Router + Socket.IO client`
- stockage en mémoire (pas de base de données)

## Fonctionnalités

- Création de rooms de débat
- 2 participants max par room (auto-assignés `Participant A` et `Participant B`)
- spectateurs illimités en lecture seule
- chat temps réel via WebSocket
- suppression manuelle de messages (mode modérateur côté UI)
- liste des rooms actives avec compteurs live (participants/spectateurs)

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

## Lancer en local

### 1) Appliquer le schéma Supabase

Dans le SQL Editor Supabase (ou via CLI), exécuter les migrations dans `supabase/migrations/` :

1. `00001_initial_schema.sql` (tables de base)
2. `00003_user_profiles.sql` (**obligatoire pour les profils et intérêts**)
3. `00004_more_interests.sql` (optionnel — ~30 intérêts supplémentaires)
4. `00005_follows_notifications.sql` (**abonnements + notifications**)

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

Ajouter dans `backend/.env` : `MODERATION_SERVICE_URL=http://localhost:8000`

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

- `roomsUpdated` → liste globale des rooms
- `roomUpdated` → état complet d'une room
- `joinedRoom` → rôle attribué à l'utilisateur
- `errorMessage` → erreurs métier

## Déploiement

## Backend sur Render

Créer un **Web Service** sur Render pointant sur le repo GitHub.

Configuration :

- Root Directory: `backend`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start:prod`
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

## Notes MVP

- Pas d'authentification
- Pas de persistance (reset à chaque redémarrage backend)
- CORS ouvert à `*` (MVP uniquement)