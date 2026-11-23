// Cliente de presença: não altera estado de jogo e não expõe o token Bearer ao WebSocket.
const TICKET_PATTERN = /^[a-f0-9-]{72}$/i;
const MAX_RETRIES = 5;

export function readGameToken(storageA, storageB) {
  for (const storage of [storageA, storageB]) {
    try {
      const token = storage?.getItem("coi_game_token");
      if (typeof token === "string" && token.trim()) return token;
    } catch {}
  }
  return "";
}

export function readRealtimePacket(raw) {
  if (typeof raw !== "string" || raw.length > 512) return null;
  try {
    const packet = JSON.parse(raw);
    if (packet?.type === "presence" && packet.room === "eldoria" &&
        Number.isSafeInteger(packet.online) && packet.online >= 0 && packet.online <= 200) {
      return { type: "presence", online: packet.online };
    }
    if (packet?.type === "connected") return { type: "connected" };
    if (packet?.type === "pong") return { type: "pong" };
  } catch {}
  return null;
}

export async function requestRealtimeTicket({ token, fetchImpl = fetch, signal } = {}) {
  if (typeof token !== "string" || !token.trim()) throw new Error("missing-session");
  const response = await fetchImpl("/api/realtime/eldoria/ticket", {
    method: "POST",
    cache: "no-store",
    redirect: "error",
    credentials: "same-origin",
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/json",
      "X-COI-Shard-Support": "1"
    },
    signal
  });
  if (response.status !== 201) throw new Error("ticket-unavailable");
  const data = await response.json();
  if (!TICKET_PATTERN.test(String(data.ticket || ""))) throw new Error("invalid-ticket");
  const room = data.room === undefined ? null : data.room;
  if (room !== null && (!Number.isSafeInteger(room) || room < 0 || room >= 8)) {
    throw new Error("invalid-room");
  }
  return { ticket: data.ticket, room };
}

export function startRealtimePresence({
  documentRef = document,
  windowRef = window,
  fetchImpl = fetch,
  WebSocketImpl = WebSocket,
} = {}) {
  const status = documentRef.getElementById("eldoriaPresence");
  if (!status) return () => {};
  let active = true;
  let socket = null;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let attempts = 0;
  let pendingTicketController = null;
  const update = message => { status.textContent = message; };

  function clearTimers() {
    if (reconnectTimer !== null) clearTimeout(reconnectTimer);
    if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
    reconnectTimer = null;
    heartbeatTimer = null;
  }

  function disconnect() {
    clearTimers();
    // Invalidate any pending ticket, even when a mocked fetch ignores abort.
    const pending = pendingTicketController;
    pendingTicketController = null;
    if (pending) pending.abort();
    if (socket) {
      const previous = socket;
      socket = null;
      try { previous.close(1000, "Cliente em pausa"); } catch {}
    }
  }

  function retry() {
    if (!active || documentRef.hidden || !windowRef.navigator.onLine || attempts >= MAX_RETRIES) {
      if (attempts >= MAX_RETRIES) update("Tempo real indisponível; atualize para tentar novamente.");
      return;
    }
    attempts++;
    const delay = Math.min(30000, 1000 * (2 ** (attempts - 1)));
    reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, delay);
  }

  async function connect() {
    if (!active || documentRef.hidden || !windowRef.navigator.onLine || socket || pendingTicketController) return;
    if (windowRef.location.protocol !== "https:") {
      update("Tempo real requer HTTPS.");
      return;
    }
    const token = readGameToken(windowRef.localStorage, windowRef.sessionStorage);
    if (!token) {
      update("Entre na conta para usar o tempo real.");
      return;
    }
    update("Conectando ao tempo real…");
    const controller = new AbortController();
    pendingTicketController = controller;
    try {
      const { ticket, room } = await requestRealtimeTicket({ token, fetchImpl, signal: controller.signal });
      if (pendingTicketController !== controller || !active || documentRef.hidden || !windowRef.navigator.onLine) return;
      const address = "wss://" + windowRef.location.host + "/api/realtime/eldoria" +
        (room === null ? "" : "?room=" + room);
      const client = new WebSocketImpl(address, ["coi-eldoria", "coi-ticket." + ticket]);
      socket = client;
      client.addEventListener("open", () => {
        if (!active || socket !== client) return;
        attempts = 0;
        update("Tempo real conectado; aguardando presença.");
        heartbeatTimer = setInterval(() => {
          if (client.readyState === WebSocketImpl.OPEN) {
            client.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      });
      client.addEventListener("message", event => {
        if (socket !== client) return;
        const packet = readRealtimePacket(event.data);
        if (packet?.type === "presence") {
          update("Presença na sala: " + packet.online + " conexões");
        }
      });
      client.addEventListener("close", () => {
        if (socket !== client) return;
        socket = null;
        if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        update("Tempo real desconectado.");
        retry();
      });
      client.addEventListener("error", () => { update("Falha na conexão em tempo real."); });
    } catch {
      if (pendingTicketController === controller && active && !controller.signal.aborted) {
        update("Tempo real temporariamente indisponível.");
        retry();
      }
    } finally {
      if (pendingTicketController === controller) pendingTicketController = null;
    }
  }

  const visibility = () => {
    if (documentRef.hidden) disconnect();
    else { attempts = 0; connect(); }
  };
  const online = () => { attempts = 0; connect(); };
  const offline = () => { attempts = 0; disconnect(); update("Tempo real offline."); };
  const pagehide = () => { active = false; disconnect(); };
  const pageshow = event => {
    // A bfcache restores the same JS realm after pagehide: resume explicitly.
    if (event.persisted) { active = true; attempts = 0; connect(); }
  };
  documentRef.addEventListener("visibilitychange", visibility);
  windowRef.addEventListener("online", online);
  windowRef.addEventListener("offline", offline);
  windowRef.addEventListener("pagehide", pagehide);
  windowRef.addEventListener("pageshow", pageshow);
  connect();
  return () => {
    active = false;
    disconnect();
    documentRef.removeEventListener("visibilitychange", visibility);
    windowRef.removeEventListener("online", online);
    windowRef.removeEventListener("offline", offline);
    windowRef.removeEventListener("pagehide", pagehide);
    windowRef.removeEventListener("pageshow", pageshow);
  };
}
