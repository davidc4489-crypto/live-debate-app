#!/usr/bin/env node
/**
 * Tests des rooms en mémoire (diffusion allégée, tick, cycle de vie).
 *   npm run build && node scripts/test-rooms.mjs
 */

import { existsSync } from "fs";
import { resolve } from "path";

const distPath = resolve(process.cwd(), "dist/rooms.service.js");
if (!existsSync(distPath)) {
  console.error("dist/ absent — lance d'abord : npm run build");
  process.exit(1);
}
const { RoomsService } = await import(distPath);

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

/** Room avec deux participants, débat validé et tours démarrés. */
function buildLiveRoom() {
  const rooms = new RoomsService();
  const room = rooms.createRoom("Le nucléaire est-il écologique ?", 180, "user-a");
  rooms.joinRoom(room.id, "socket-a", { userId: "user-a", displayName: "Alice" });
  rooms.joinRoom(room.id, "socket-b", { userId: "user-b", displayName: "Bob" });
  rooms.startValidatedDebate(room.id);
  return { rooms, roomId: room.id };
}

console.log("\n[1] Diffusion globale allégée (roomsUpdated)");
{
  const { rooms, roomId } = buildLiveRoom();
  const summaries = rooms.getRoomsSnapshot();
  assert(summaries.length === 1, "une room listée");

  const summary = summaries[0];
  assert(!("messages" in summary), "les messages ne sont plus diffusés à tous les clients");
  assert(typeof summary.messagesCount === "number", "messagesCount fourni à la place");
  assert(summary.id === roomId && summary.title.length > 0, "identité et titre conservés");
  assert(
    summary.participants === 2 && typeof summary.spectators === "number",
    "compteurs conservés pour les écrans de liste",
  );
  assert(Array.isArray(summary.participantRoster), "roster conservé (cartes de débat)");

  const full = rooms.getRoomSnapshot(roomId);
  assert(Array.isArray(full.messages), "la vue room-par-room garde bien les messages");
}

console.log("\n[2] Payload du tick (1 s)");
{
  const { rooms, roomId } = buildLiveRoom();
  const tick = rooms.getTickState(roomId);
  assert(tick !== null, "un tick est produit pour une room en cours");
  assert(
    tick &&
      Object.keys(tick).sort().join(",") ===
        "currentSpeaker,currentSpeakerName,currentSpeakerUserId,remainingSeconds,turnEndsAt",
    "le tick ne transporte que les champs du tour",
  );
  assert(
    tick && tick.currentSpeakerUserId === "user-a",
    "le tick identifie le locuteur (et pas seulement son nom)",
  );

  rooms.finishRoom(roomId, new Date().toISOString(), "user-a");
  assert(rooms.getTickState(roomId) === null, "aucun tick sur un débat terminé");
  assert(rooms.getTickState("room-inexistante") === null, "room inconnue : pas de tick");
}

console.log("\n[3] Garde-fous d'envoi de message");
{
  const { rooms, roomId } = buildLiveRoom();
  const spectator = rooms.joinRoom(roomId, "socket-c", { displayName: "Spectateur" });
  assert(spectator.role === "spectator", "le 3e arrivant est spectateur");

  const refused = rooms.sendMessage("socket-c", "Je veux parler");
  assert(refused.message === null, "un spectateur ne peut pas écrire");

  const speaker = rooms.getRoomSnapshot(roomId).currentSpeaker;
  const tooLong = rooms.sendMessage(speaker, "x".repeat(501));
  assert(tooLong.message === null, "message au-delà de 500 caractères refusé");

  const sent = rooms.sendMessage(speaker, "Le stockage des déchets reste le point faible.");
  assert(sent.message !== null, "le locuteur du tour peut écrire");
  const other = speaker === "socket-a" ? "socket-b" : "socket-a";
  assert(rooms.sendMessage(other, "À mon tour !").message === null, "hors tour : refusé");
  assert(
    rooms.getRoomsSnapshot()[0].messagesCount === 1,
    "le compteur de la liste suit les messages",
  );

  const unknown = rooms.sendMessage("socket-inconnu", "coucou");
  assert(unknown.message === null, "socket sans session refusé");
}


console.log("\n[4] Reprise après pause : les deux participants peuvent la demander");
{
  const { rooms, roomId } = buildLiveRoom();
  rooms.pauseRoom(roomId, "user-a", "Alice", "socket-a", "user-a");

  // Ancien comportement : seul le pauseur pouvait demander la reprise, ce qui
  // enfermait l'adversaire si le pauseur ne revenait jamais.
  const byOpponent = rooms.requestResume(roomId, "user-b");
  assert(byOpponent !== null, "l'adversaire (non pauseur) peut demander la reprise");
  assert(
    rooms.getRoomSnapshot(roomId).resumeRequestedByUserId === "user-b",
    "le demandeur est exposé dans le snapshot",
  );

  assert(
    rooms.requestResume(roomId, "user-a") === null,
    "pas de seconde demande tant que la première est en attente",
  );

  const resumed = rooms.validateResume(roomId, "user-a");
  assert(resumed !== null && resumed.status === "active", "la validation relance le débat");
  assert(
    rooms.getRoomSnapshot(roomId).resumeRequestedByUserId === null,
    "le demandeur est nettoyé après la reprise",
  );
}

console.log("\n[5] Demande de reprise : réservée aux participants");
{
  const { rooms, roomId } = buildLiveRoom();
  rooms.joinRoom(roomId, "socket-c", { userId: "user-c", displayName: "Chloé" });
  rooms.pauseRoom(roomId, "user-a", "Alice", "socket-a", "user-a");

  assert(
    rooms.requestResume(roomId, "user-c") === null,
    "un spectateur ne peut pas demander la reprise",
  );
}

console.log("\n[6] Purge des rooms inertes");
{
  const { rooms, roomId } = buildLiveRoom();

  assert(
    rooms.pruneStaleRooms(0).length === 0,
    "une room avec des sockets connectés n'est jamais purgée",
  );

  rooms.leaveRoom("socket-a");
  rooms.leaveRoom("socket-b");
  assert(rooms.roomExists(roomId), "une room validée survit au départ des sockets");

  assert(
    rooms.pruneStaleRooms(60_000).length === 0,
    "une room récemment active est conservée",
  );

  const removed = rooms.pruneStaleRooms(0);
  assert(removed.includes(roomId), "une room sans socket et inerte quitte la mémoire");
  assert(!rooms.roomExists(roomId), "la room est bien retirée");
  assert(rooms.getRoomsSnapshot().length === 0, "elle ne part plus dans roomsUpdated");
}

console.log("\n[7] Identité de l'auteur portée par le message");
{
  const { rooms, roomId } = buildLiveRoom();
  const speaker = rooms.getRoomSnapshot(roomId).currentSpeaker;
  const sent = rooms.sendMessage(speaker, "Le nucléaire est bas carbone.");
  assert(sent.message !== null, "message accepté");
  assert(
    sent.message.userId === rooms.getSession(speaker).userId,
    "le message porte l'identité de son auteur (attribution des bulles)",
  );
}

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed > 0 ? 1 : 0);
