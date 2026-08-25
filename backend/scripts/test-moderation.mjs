#!/usr/bin/env node
/**
 * Tests modération — exécution :
 *   npm run build && node scripts/test-moderation.mjs
 *   node scripts/test-moderation.mjs --live   # + appels HTTP (services démarrés)
 *
 * Le filtre lexical est importé depuis `dist/` : on teste le vrai code, pas une
 * copie qui dérive.
 */

import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const MODERATION_URL = process.env.MODERATION_SERVICE_URL || "http://localhost:8000";
const BACKEND_URL = process.env.BACKEND_TEST_URL || "http://localhost:3001";
const RUN_LIVE = process.argv.includes("--live");

const distPath = resolve(process.cwd(), "dist/moderation/moderation-light.js");
if (!existsSync(distPath)) {
  console.error("dist/ absent — lance d'abord : npm run build");
  process.exit(1);
}
const { moderateLight } = await import(distPath);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${message}`);
  }
}

// ---------------------------------------------------------------- filtre local

const LIGHT_CASES = [
  { text: "Je pense que l'IA peut aider la société.", expected: "allow" },
  { text: "Ton raisonnement ignore le coût réel du stockage.", expected: "allow" },
  { text: "Tu es vraiment stupide.", expected: "warn" },
  { text: "Va te faire foutre espèce de bâtard.", expected: "block" },
  { text: "Je vais te tuer.", expected: "block" },
  { text: "espèce de c0nn4rd", expected: "block" },
  { text: "C.O.N.N.A.R.D", expected: "block" },
  { text: "Retourne dans ton pays.", expected: "block" },
];

console.log("\n[1] Filtre lexical local (dist/moderation/moderation-light.js)");
for (const { text, expected } of LIGHT_CASES) {
  const result = moderateLight(text);
  assert(
    result.action === expected,
    `"${text.slice(0, 38)}" → ${result.action} (attendu ${expected})`,
  );
}

console.log("\n[2] Contrat de sortie du filtre local");
const sample = moderateLight("Tu es un imbécile");
assert(Array.isArray(sample.categories) && sample.categories.length > 0, "categories renseignées");
assert(typeof sample.severity === "number", "severity numérique");
assert(sample.suggestion !== null, "conseil de reformulation fourni");
assert(sample.degraded === true, "résultat marqué comme dégradé");

// ------------------------------------------------------------- garde anti-spam

const { SpamGuard } = await import(resolve(process.cwd(), "dist/moderation/spam-guard.js"));

console.log("\n[3] Garde anti-spam (dist/moderation/spam-guard.js)");
{
  const guard = new SpamGuard();
  const author = "user-test";
  const results = [];
  for (let i = 0; i < 7; i += 1) {
    results.push(guard.check(author, `message unique numero ${i}`));
  }
  const firstBlocked = results.findIndex((verdict) => verdict.blocked);
  assert(firstBlocked === 5, `rafale bloquée au 6e message (index ${firstBlocked})`);
  assert(results[firstBlocked].code === "RATE_LIMIT", "code RATE_LIMIT renvoyé");
  assert(results[firstBlocked].retryAfterMs > 0, "délai de réessai fourni");

  const other = new SpamGuard();
  other.check("u2", "même message");
  other.check("u2", "même message");
  const duplicate = other.check("u2", "MÊME message  ");
  assert(duplicate.blocked && duplicate.code === "DUPLICATE", "répétition détectée (casse/espaces ignorés)");

  const wall = new SpamGuard();
  const flood = wall.check("u3", "a".repeat(200));
  assert(flood.blocked && flood.code === "FLOOD_CHARS", "mur de caractères bloqué");

  const clean = new SpamGuard();
  assert(!clean.check("u4", "Un argument tout à fait normal.").blocked, "message normal accepté");
}

// --------------------------------------------------- indicateurs de débat

const { DebateInsightsService } = await import(
  resolve(process.cwd(), "dist/moderation/debate-insights.service.js")
);

console.log("\n[4] Indicateurs de débat (dist/moderation/debate-insights.service.js)");
{
  const fakeModeration = {
    analyzeText: async (text) => ({
      quality_score: text.length > 60 ? 80 : 20,
      quality_label: text.length > 60 ? "argumenté" : "faible",
      breakdown: { words: 10, structure: 0.5, evidence: 0.5, civility: 1, nuance: 1, signals: [] },
      tips: [],
      sentiment: null,
      language: "fr",
    }),
  };
  const insights = new DebateInsightsService(fakeModeration);
  const long = "Je pense que le nucléaire complète le renouvelable car il produit peu de CO2 selon le GIEC.";

  const first = await insights.analyzeMessage("room-1", "m1", long, { toxicity: 0.02, severity: 0.02 });
  assert(first?.forRoom.qualityScore === 80, `qualité agrégée = ${first?.forRoom.qualityScore}`);
  assert(first?.forRoom.civilityScore === 98, `civilité = ${first?.forRoom.civilityScore}`);

  await insights.analyzeMessage("room-1", "m2", "court", { toxicity: 0.9, severity: 0.9 });
  const room = insights.getRoomInsight("room-1");
  assert(room.qualityScore === 50, `moyenne de qualité recalculée = ${room.qualityScore}`);
  assert(room.civilityScore === 54, `civilité dégradée par le message toxique = ${room.civilityScore}`);
  assert(room.messagesAnalyzed === 2, "compteur de messages analysés");

  insights.forgetRoom("room-1");
  assert(insights.getRoomInsight("room-1") === null, "état du débat purgé à la fin");
}

// ------------------------------------------------------------------- live HTTP

async function postJson(url, body, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { ok: response.ok, status: response.status, data: await response.json() };
  } finally {
    clearTimeout(timer);
  }
}

if (RUN_LIVE) {
  console.log(`\n[5] Service Python (${MODERATION_URL})`);
  const PY_CASES = [
    { text: "Le nucléaire est une solution bas carbone.", expected: "allow" },
    { text: "Tu es vraiment un imbécile, ferme ta gueule.", expected: "block" },
    { text: "Je vais te retrouver et te casser la gueule.", expected: "block" },
  ];
  try {
    for (const { text, expected } of PY_CASES) {
      const { ok, status, data } = await postJson(`${MODERATION_URL}/moderate`, { text });
      if (!ok) {
        assert(false, `HTTP ${status} pour "${text.slice(0, 30)}..."`);
        continue;
      }
      assert(
        data.action === expected,
        `"${text.slice(0, 34)}" → ${data.action} (tox=${data.toxicity}, lang=${data.language}, ${data.latency_ms}ms)`,
      );
    }

    const batch = await postJson(`${MODERATION_URL}/moderate/batch`, {
      texts: ["message neutre sur le climat", "espèce de connard"],
    });
    assert(batch.ok && batch.data.count === 2, "batch : 2 résultats renvoyés");
    assert(
      batch.data.results[0].action === "allow" && batch.data.results[1].action === "block",
      "batch : actions correctes",
    );

    const analyze = await postJson(`${MODERATION_URL}/analyze`, {
      text: "Je pense que le nucléaire est utile car il émet peu de CO2, selon le GIEC 12 g/kWh.",
    });
    assert(analyze.ok && analyze.data.quality_score >= 60, `analyse : score ${analyze.data?.quality_score}`);

    const health = await fetch(`${MODERATION_URL}/health`).then((r) => r.json());
    assert(health.status === "ok", `health : warmup=${health.warmup}, modèle=${health.model_loaded}`);
  } catch (error) {
    assert(false, `Service Python injoignable: ${error.message}`);
  }

  console.log(`\n[6] Backend NestJS (${BACKEND_URL})`);
  try {
    const { ok, status, data } = await postJson(`${BACKEND_URL}/moderation/check`, {
      text: "Tu es vraiment un imbécile.",
    });
    assert(ok, `POST /moderation/check → HTTP ${status}`);
    assert(data.action !== undefined, `action=${data.action}, source=${data.source}`);
    assert(typeof data.toxicity === "number", `toxicity=${data.toxicity}`);

    const stats = await fetch(`${BACKEND_URL}/moderation/stats`).then((r) => r.json());
    assert(typeof stats.requests === "number", `stats : ${stats.requests} requêtes, circuit=${stats.circuitOpen}`);

    const serviceHealth = await fetch(`${BACKEND_URL}/moderation/health`).then((r) => r.json());
    assert(
      typeof serviceHealth.reachable === "boolean",
      `health relayé : reachable=${serviceHealth.reachable}`,
    );
  } catch (error) {
    assert(false, `Backend injoignable: ${error.message}`);
  }
} else {
  console.log("\n[5-6] Tests HTTP ignorés (relancer avec --live)");
}

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed > 0 ? 1 : 0);
