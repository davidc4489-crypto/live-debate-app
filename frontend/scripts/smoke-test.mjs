import { io } from "socket.io-client";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

function waitForEvent(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeoutMs);

    function onEvent(payload) {
      clearTimeout(timer);
      resolve(payload);
    }

    socket.once(event, onEvent);
  });
}

function waitForCondition(socket, event, predicate, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timeout waiting for condition on ${event}`));
    }, timeoutMs);

    function onEvent(payload) {
      if (predicate(payload)) {
        clearTimeout(timer);
        socket.off(event, onEvent);
        resolve(payload);
      }
    }

    socket.on(event, onEvent);
  });
}

async function run() {
  const healthResponse = await fetch(`${BACKEND_URL}/rooms`);
  if (!healthResponse.ok) {
    throw new Error(`GET /rooms failed: ${healthResponse.status}`);
  }

  const a = io(BACKEND_URL, { transports: ["websocket"] });
  const b = io(BACKEND_URL, { transports: ["websocket"] });
  const s = io(BACKEND_URL, { transports: ["websocket"] });

  try {
    await Promise.all([
      waitForEvent(a, "connected"),
      waitForEvent(b, "connected"),
      waitForEvent(s, "connected"),
    ]);

    a.emit("createRoom", { title: "Smoke Test Room" });
    const createdRoom = await waitForEvent(a, "roomCreated");
    const roomId = createdRoom.id;

    const joinedA = waitForEvent(a, "joinedRoom");
    a.emit("joinRoom", { roomId, username: "alpha" });
    const roleA = await joinedA;

    const joinedB = waitForEvent(b, "joinedRoom");
    b.emit("joinRoom", { roomId, username: "beta" });
    const roleB = await joinedB;

    const joinedS = waitForEvent(s, "joinedRoom");
    s.emit("joinRoom", { roomId, username: "viewer" });
    const roleS = await joinedS;

    if (roleA.role !== "participantA") {
      throw new Error(`Expected participantA, got ${roleA.role}`);
    }
    if (roleB.role !== "participantB") {
      throw new Error(`Expected participantB, got ${roleB.role}`);
    }
    if (roleS.role !== "spectator") {
      throw new Error(`Expected spectator, got ${roleS.role}`);
    }

    const roomWithMessage = waitForCondition(
      a,
      "roomUpdated",
      (payload) => payload.id === roomId && payload.messages.length >= 1,
    );
    a.emit("sendMessage", { roomId, text: "Bonjour test temps réel" });
    const updatedAfterSend = await roomWithMessage;
    if (!updatedAfterSend.messages[0]?.id) {
      throw new Error("No message id after participant send");
    }

    const spectatorBlocked = waitForEvent(s, "errorMessage");
    s.emit("sendMessage", { roomId, text: "Je suis spectateur" });
    const spectatorError = await spectatorBlocked;
    if (!String(spectatorError.message || "").includes("Seuls les participants")) {
      throw new Error("Spectator was not blocked correctly");
    }

    const finalRooms = await fetch(`${BACKEND_URL}/rooms`).then((response) => response.json());
    const testedRoom = finalRooms.find((room) => room.id === roomId);
    if (!testedRoom) {
      throw new Error("Room missing in final snapshot");
    }
    if (testedRoom.participants !== 2 || testedRoom.spectators !== 1) {
      throw new Error("Unexpected participant/spectator counts");
    }
    if (testedRoom.messages.length < 1) {
      throw new Error("Expected at least one message in room");
    }

    console.log("SMOKE TEST OK");
    console.log(`roomId=${roomId}`);
    console.log("roles=participantA,participantB,spectator");
    console.log("messageFlow=send->broadcast->delete");
  } finally {
    a.disconnect();
    b.disconnect();
    s.disconnect();
  }
}

run().catch((error) => {
  console.error("SMOKE TEST FAILED");
  console.error(error?.message || error);
  process.exit(1);
});
