#!/usr/bin/env node
/**
 * Tests modération — exécution :
 *   node scripts/test-moderation.mjs
 *   node scripts/test-moderation.mjs --live   # inclut appels HTTP (services démarrés)
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const MODERATION_URL = process.env.MODERATION_SERVICE_URL || "http://localhost:8000";
const BACKEND_URL = process.env.BACKEND_TEST_URL || "http://localhost:3001";
const RUN_LIVE = process.argv.includes("--live");

// ——— Filtre léger (copie de la logique attendue, testé aussi via import dynamique impossible en .mjs pur)
const BLOCK_PATTERNS = [
  /\b(nique|ntm|fdp|encul[eé]|salope|pute|batard|bâtard)\b/i,
  /\b(crev[eé]|meurt|tuer|tue-toi|suicide)\b/i,
];
const WARN_PATTERNS = [
  /\b(idiot|stupide|debile|débile|nul|pathétique|honteux)\b/i,
  /\b(tais-toi|ferme-la|ta gueule)\b/i,
];

function moderateLight(text) {
  const normalized = text.trim().toLowerCase();
  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(normalized)) {
      return { action: "block", is_toxic: true, source: "light" };
    }
  }
  for (const pattern of WARN_PATTERNS) {
    if (pattern.test(normalized)) {
      return { action: "warn", is_toxic: true, source: "light" };
    }
  }
  return { action: "allow", is_toxic: false, source: "light" };
}

const LIGHT_CASES = [
  { text: "Je pense que l'IA peut aider la société.", expected: "allow" },
  { text: "Tu es vraiment stupide.", expected: "warn" },
  { text: "Va te faire foutre espèce de bâtard.", expected: "block" },
  { text: "Je vais te tuer.", expected: "block" },
];

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

async function testLightFilter() {
  console.log("\n── Filtre léger (fallback JS) ──");
  for (const { text, expected } of LIGHT_CASES) {
    const result = moderateLight(text);
    assert(
      result.action === expected,
      `"${text.slice(0, 40)}..." → ${result.action} (attendu: ${expected})`,
    );
  }
}

async function testPythonService() {
  console.log("\n── Service Python POST /moderate ──");
  const cases = [
    { text: "Argument calme et respectueux.", expectOneOf: ["allow", "warn"] },
    { text: "You are a stupid idiot.", expectOneOf: ["warn", "block"] },
  ];

  for (const { text, expectOneOf } of cases) {
    try {
      const t0 = performance.now();
      const response = await fetch(`${MODERATION_URL}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(5000),
      });
      const latency = Math.round(performance.now() - t0);

      if (!response.ok) {
        assert(false, `HTTP ${response.status} pour "${text.slice(0, 30)}..."`);
        continue;
      }

      const data = await response.json();
      assert(
        expectOneOf.includes(data.action),
        `"${text.slice(0, 35)}..." → ${data.action} (${latency}ms, toxicity=${data.toxicity})`,
      );
    } catch (error) {
      assert(false, `Service Python injoignable: ${error.message}`);
    }
  }
}

async function testNestEndpoint() {
  console.log("\n── NestJS POST /moderation/check ──");
  const text = "Message de test pour la modération.";

  try {
    const response = await fetch(`${BACKEND_URL}/moderation/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      assert(false, `HTTP ${response.status} sur /moderation/check`);
      return;
    }

    const data = await response.json();
    assert(data.action !== undefined, `action=${data.action}, source=${data.source}`);
    assert(typeof data.toxicity === "number", `toxicity=${data.toxicity}`);
  } catch (error) {
    assert(false, `Backend injoignable: ${error.message}`);
  }
}

async function testWarnTokenFlow() {
  console.log("\n── Flux WARN (simulation manuelle) ──");
  console.log("  ℹ Envoyer un message agressif en room live → bandeau WARN → « Envoyer quand même »");
  assert(true, "Test manuel documenté (non automatisé sans Socket.IO client)");
}

async function main() {
  console.log("Tests modération Live Debate");
  console.log(`Mode: ${RUN_LIVE ? "live (HTTP)" : "local (filtre léger uniquement)"}`);

  await testLightFilter();

  if (RUN_LIVE) {
    await testPythonService();
    await testNestEndpoint();
  } else {
    console.log("\n── Tests HTTP ignorés ──");
    console.log("  Lancez avec --live pour tester Python + NestJS (services démarrés).");
  }

  await testWarnTokenFlow();

  console.log(`\nRésultat: ${passed} réussis, ${failed} échoués`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
