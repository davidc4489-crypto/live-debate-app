# Modération & analyse de débat (v2)

## Vue d'ensemble

```
[Next.js] --WebSocket--> [NestJS] --HTTP--> [FastAPI + modèles Hugging Face]
                            |  |                    |
                            |  |                    +-- Detoxify multilingue (principal)
                            |  |                    +-- lexique FR/EN (catégories + repli)
                            |  |                    +-- sentiment / zero-shot (optionnels)
                            |  |
                            |  +--> garde anti-spam (local, sans modèle)
                            +-----> Supabase `message_flags`
```

Trois filtres successifs, du moins cher au plus cher :

| Ordre | Filtre | Coût | Rôle |
|-------|--------|------|------|
| 1 | `SpamGuard` (NestJS) | 0 ms | flood, répétition, mur de caractères |
| 2 | Lexique FR/EN (Python + port JS) | < 1 ms | insultes/menaces explicites, obfuscation (`c0nn4rd`, `c.o.n.n.a.r.d`) |
| 3 | Detoxify multilingue (XLM-RoBERTa) | ~40 ms | toxicité contextuelle, 7 catégories |

Le verdict final prend le **maximum par catégorie** entre lexique et modèle : le
modèle rattrape ce que le lexique ne connaît pas, le lexique rattrape ce que le
modèle laisse passer (obfuscation, service indisponible).

## Pourquoi le checkpoint `multilingual`

L'application est francophone ; le checkpoint `original` de Detoxify est
entraîné sur l'anglais. Mesuré sur la même phrase française :

| Message | `original` (EN) | `citizenlab/distilbert-multilingual` | **`multilingual`** |
|---------|-----------------|--------------------------------------|--------------------|
| « Tu es vraiment un imbécile, ferme ta gueule. » | faible | 0.55 (warn) | **0.99 (block)** |
| « Je vais te retrouver et te casser la gueule. » | faible | — | **0.95 (block)** |
| « L'énergie nucléaire réduit les émissions… » | — | 0.007 | **0.002 (allow)** |

`multilingual` renvoie en plus les 7 catégories (toxicity, severe_toxicity,
obscene, threat, insult, identity_attack, sexual_explicit), contrairement aux
classifieurs binaires. C'est donc le modèle par défaut.

Latence mesurée en local (CPU) : **30–50 ms** par message, largement sous le
budget de 300 ms.

## Seuils

| Condition | Action |
|-----------|--------|
| `threat >= 0.70` | BLOCK |
| `identity_hate >= 0.70` | BLOCK |
| `severe_toxicity >= 0.50` | BLOCK |
| `insult >= 0.80` | BLOCK |
| `sexual_explicit >= 0.85` | BLOCK |
| `toxicity >= 0.75` | BLOCK |
| `insult + identity_hate >= 0.45` (combiné) | WARN |
| `insult + threat >= 0.45` (combiné) | WARN |
| `toxicity >= 0.50` | WARN |
| toute catégorie `>= 0.50` | WARN |

Chaque verdict renvoie aussi `categories`, `severity` (0-1, pondérée par
gravité) et `suggestion` — un conseil de reformulation affiché à l'auteur.

## API du service Python

| Méthode | Route | Rôle |
|---------|-------|------|
| POST | `/moderate` | modération d'un message |
| POST | `/moderate/batch` | modération par lot (une seule passe modèle) |
| POST | `/analyze` | indice de qualité argumentative + ton |
| POST | `/classify` | classification thématique zero-shot |
| GET | `/health` | état du service et du warmup |
| GET | `/models` | modèles chargés, échecs, temps de chargement |
| GET | `/metrics` | volumétrie, taux de blocage, latences p50/p95/p99 |
| GET | `/thresholds` | seuils effectifs |
| POST | `/cache/clear` | vide le cache LRU |

Exemple :

```bash
curl -X POST http://localhost:8000/moderate \
  -H "Content-Type: application/json" \
  -d '{"text":"Tu es vraiment un imbécile"}'
```

```json
{
  "toxicity": 0.99, "insult": 0.72, "threat": 0.04, "identity_hate": 0.0,
  "action": "block", "reason": "Toxicité élevée",
  "categories": ["insult"], "severity": 0.99,
  "suggestion": "Critique l'idée plutôt que la personne…",
  "language": "fr", "models": ["lexicon:fr-en", "detoxify:multilingual"],
  "degraded": false, "cached": false, "latency_ms": 42.1
}
```

## API côté NestJS

| Méthode | Route | Rôle |
|---------|-------|------|
| POST | `/moderation/check` | modération d'un texte (debug) |
| POST | `/moderation/batch` | modération par lot |
| POST | `/moderation/analyze` | analyse qualitative |
| POST | `/moderation/classify` | thème suggéré pour un sujet |
| GET | `/moderation/stats` | compteurs NestJS (actions, latence, circuit) |
| GET | `/moderation/health` | disponibilité du service Python |

## Événements Socket.IO

| Événement | Sens | Contenu |
|-----------|------|---------|
| `moderationWarn` | serveur → auteur | texte, `warnToken`, catégories, gravité, suggestion |
| `errorMessage` (`code: MODERATION_BLOCK`) | serveur → auteur | message + catégories + suggestion |
| `errorMessage` (`code: RATE_LIMIT` / `DUPLICATE` / `FLOOD_CHARS`) | serveur → auteur | garde anti-spam |
| `messageInsight` | serveur → auteur | score d'argumentation, signaux, conseils |
| `debateInsights` | serveur → room | civilité et qualité moyennes du débat, tendance |

## Résilience

- **Circuit breaker** : après `MODERATION_CIRCUIT_FAILURES` échecs consécutifs
  (3 par défaut), NestJS cesse d'appeler le service pendant
  `MODERATION_CIRCUIT_RESET_MS` (15 s) — sans lui, chaque message paierait le
  timeout de 300 ms. Le circuit se referme tout seul à la première réussite.
- **Repli lexical** : `moderation-light.ts` est le port JS du lexique Python —
  mêmes règles, mêmes catégories, mêmes conseils. L'expérience ne change pas.
- **Politique de repli** : `MODERATION_FALLBACK_ON_DOWN=warn|allow`.
- **Mode dégradé signalé** : `degraded: true` quand seul le lexique a répondu.
- **Warmup asynchrone** : le service répond dès le démarrage ; les poids se
  chargent en tâche de fond, le lexique assure l'intérim.

## Cache

- Python : LRU (`MOD_CACHE_SIZE`, 4096 par défaut) sur `langue + texte normalisé`.
- NestJS : cache mémoire 60 s (`MODERATION_CACHE_TTL_MS`).

## Analyse qualitative (`/analyze`)

Indice 0-100 déterministe et explicable, sans modèle :

| Dimension | Poids | Mesure |
|-----------|-------|--------|
| Structure | 32 % | longueur utile + connecteurs logiques (`parce que`, `donc`, `en revanche`) |
| Preuves | 23 % | chiffres, pourcentages, années, `selon`, `étude`, liens |
| Civilité | 30 % | attaque ad hominem, toxicité lexicale, majuscules, ponctuation |
| Nuance | 15 % | généralisations abusives vs modalisation (`je pense`, `il me semble`) |

Le score est pondéré par la longueur : un message poli mais vide ne peut pas
être « bien argumenté ». Il alimente `messageInsight` (retour privé à l'auteur)
et `debateInsights` (climat du débat, affiché à tous).

## Modèles optionnels

Désactivés par défaut (téléchargements supplémentaires) :

```env
MOD_ENABLE_SENTIMENT=true   # cardiffnlp/twitter-xlm-roberta-base-sentiment
MOD_ENABLE_ZEROSHOT=true    # MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7
MOD_ENABLE_FRENCH_HATE=true # Hate-speech-CNERG/dehatebert-mono-french
MOD_ENABLE_SECONDARY=true   # citizenlab/distilbert-base-multilingual-cased-toxicity
```

Chacun est chargé paresseusement : un échec de téléchargement est journalisé et
le service continue sans lui.

## Démarrage local

```bash
# Terminal 1 — service de modération
cd moderation-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Sans télécharger de modèle (dev rapide, lexique seul) :
MOD_BACKEND=heuristic uvicorn app.main:app --reload --port 8000

# Terminal 2 — backend (backend/.env)
MODERATION_SERVICE_URL=http://localhost:8000
npm run start:dev
```

## Tests

```bash
# Python : seuils, lexique, langues, API mockée — aucun modèle téléchargé
cd moderation-service && pip install -r requirements-dev.txt && pytest        # 45 tests

# Backend : filtre lexical, anti-spam, indicateurs (depuis dist/)
cd backend && npm run build && npm run test:moderation                        # 24 assertions

# Avec les deux services démarrés (Python :8000 + Nest :3001)
cd backend && npm run test:moderation:live                                    # 36 assertions
```

## Base de données

`supabase/migrations/00014_moderation_v2.sql` ajoute à `message_flags` :
`action`, `categories`, `severity`, `language`, `models`, `quality_score`, plus
la vue `moderation_overview` (volumétrie par jour / action / langue).

Si la migration n'est pas appliquée, `MessageFlagsService` détecte l'erreur une
fois et retombe sur le schéma d'origine — rien ne casse.

## Pistes suivantes

- Fine-tuning FR sur les messages réellement signalés (`message_flags` sert de
  jeu d'entraînement : texte, verdict, catégories).
- File asynchrone (Bull/Redis) pour re-scorer l'historique via `/moderate/batch`.
- Tableau de bord de modération alimenté par `moderation_overview` et `/metrics`.
- Appels/quantification ONNX pour descendre sous 20 ms par message.
