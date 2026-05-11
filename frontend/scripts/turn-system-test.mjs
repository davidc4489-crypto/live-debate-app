import { io } from "socket.io-client";

const url = "http://localhost:3001";

function wait(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${event}`)), timeout);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function waitRoomUpdate(socket, roomId, predicate, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("roomUpdated", handler);
      reject(new Error("timeout roomUpdated"));
    }, timeout);

    function handler(payload) {
      if (payload?.id === roomId && predicate(payload)) {
        clearTimeout(timer);
        socket.off("roomUpdated", handler);
        resolve(payload);
      }
    }

    socket.on("roomUpdated", handler);
  });
}

const a = io(url, { transports: ["websocket"] });
const b = io(url, { transports: ["websocket"] });

try {
  await Promise.all([wait(a, "connected"), wait(b, "connected")]);

  a.emit("createRoom", { title: "Turn Test", turnDuration: 180 });
  const created = await wait(a, "roomCreated");
  const roomId = created.id;

  a.emit("joinRoom", { roomId });
  b.emit("joinRoom", { roomId });
  const joinedA = await wait(a, "joinedRoom");
  const joinedB = await wait(b, "joinedRoom");

  if (joinedA.role !== "participantA" || joinedB.role !== "participantB") {
    throw new Error("Role assignment invalide");
  }

  a.emit("sendMessage", { roomId, text: "A1" });
  const afterA = await waitRoomUpdate(a, roomId, (payload) => payload.messages.length >= 1);
  if (afterA.currentSpeakerName !== "Participant B") {
    throw new Error("Le tour ne passe pas a B apres message de A");
  }
  if (afterA.remainingSeconds < 170) {
    throw new Error("Le timer ne repart pas correctement apres message de A");
  }

  const aBlocked = wait(a, "errorMessage");
  a.emit("sendMessage", { roomId, text: "A2" });
  const blockedError = await aBlocked;
  if (!String(blockedError?.message || "").includes("tour")) {
    throw new Error("A n'est pas bloque apres son message");
  }

  b.emit("sendMessage", { roomId, text: "B1" });
  const afterB = await waitRoomUpdate(b, roomId, (payload) => payload.messages.length >= 2);
  if (afterB.currentSpeakerName !== "Participant A") {
    throw new Error("Le tour ne revient pas a A apres message de B");
  }
  if (afterB.remainingSeconds < 170) {
    throw new Error("Le timer ne repart pas correctement apres message de B");
  }

  console.log("TURN TEST OK");
  console.log(`roomId=${roomId}`);
  console.log(`afterA.remaining=${afterA.remainingSeconds}`);
  console.log(`afterB.remaining=${afterB.remainingSeconds}`);
  process.exit(0);
} catch (error) {
  console.error("TURN TEST FAILED");
  console.error(error?.message || error);
  process.exit(1);
} finally {
  a.disconnect();
  b.disconnect();
}
