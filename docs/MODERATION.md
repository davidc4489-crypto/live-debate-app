# Modération hybride (Detoxify)

## Architecture

```
[Next.js] --WebSocket--> [NestJS] --HTTP 300ms--> [FastAPI + Detoxify]
                              |
                              +--> [Supabase message_flags]
```

1. L'utilisateur envoie un message via Socket.IO (`sendMessage`).
2. NestJS appelle `POST http://moderation:8000/moderate`.
3. Selon l'action :
   - **allow** → message inséré + flag en base (si message DB)
   - **warn** → `moderationWarn` au client (token 2 min pour confirmer)
   - **block** → `errorMessage` (pas d'insertion)

## Seuils

| Condition | Action |
|-----------|--------|
| `toxicity >= 0.75` | BLOCK |
| `threat >= 0.70` | BLOCK |
| `identity_hate >= 0.70` | BLOCK |
| `insult >= 0.80` | BLOCK |
| `toxicity >= 0.50` | WARN |
| `insult + hate >= 0.45` (combiné) | WARN |

## Démarrage local

```bash
# Terminal 1 — Python
cd moderation-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 — NestJS (ajouter dans backend/.env)
MODERATION_SERVICE_URL=http://localhost:8000
MODERATION_TIMEOUT_MS=300
npm run start:dev
```

## Tests automatisés

```bash
# Python (seuils + API mockées, sans GPU)
cd moderation-service && pip install -r requirements-dev.txt && pytest

# Backend (filtre léger)
cd backend && npm run test:moderation

# Avec Python :8000 + Nest :3001 démarrés
cd backend && npm run test:moderation:live
```

## Test HTTP direct

```bash
curl -X POST http://localhost:8000/moderate \
  -H "Content-Type: application/json" \
  -d '{"text":"Tu es vraiment stupide"}'

curl -X POST http://localhost:3001/moderation/check \
  -H "Content-Type: application/json" \
  -d '{"text":"message test"}'
```

## Fallback

- **Timeout 300 ms** sur l'appel Detoxify
- Si service down → filtre JS léger (`moderation-light.ts`)
- Variable `MODERATION_FALLBACK_ON_DOWN=warn|allow`

## Cache

- Python : LRU 4096 entrées (texte normalisé)
- NestJS : cache mémoire 60s (`MODERATION_CACHE_TTL_MS`)

## Docker

```bash
docker compose up --build
```

## Évolutions futures

- Modèle multilingue `unbiased` ou fine-tuning FR
- Queue async (Bull/Redis) pour batch modération
- OpenAI modération en seconde passe sur WARN uniquement
- Modération côté messages Supabase persistés (API REST débats)
