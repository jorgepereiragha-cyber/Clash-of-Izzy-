// Sala realtime compartilhada de Eldoria. D1/Worker continuam autoritativos para o estado do jogo.
const MAX_CONNECTIONS = 200;
const REALTIME_TICKET_TTL_MS = 30_000;
const PLAYER_ID_PATTERN = /^izzy_[a-f0-9]{32}$/;
const TICKET_PATTERN = /^[a-f0-9-]{72}$/i;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export class EldoriaRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    // Exact application heartbeat: keep idle sockets hibernated when supported.
    if (typeof ctx.setWebSocketAutoResponse === "function" && typeof globalThis.WebSocketRequestResponsePair === "function") {
      ctx.setWebSocketAutoResponse(new globalThis.WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'));
    }
  }

  async issueTicket(request) {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    const playerId = String(request.headers.get("X-COI-Player-Id") || "");
    if (!PLAYER_ID_PATTERN.test(playerId)) return new Response("Unauthorized", { status: 401 });

    // Two UUIDs provide an opaque, high-entropy, short-lived single-use ticket.
    const ticket = crypto.randomUUID() + crypto.randomUUID();
    const expiresAt = Date.now() + REALTIME_TICKET_TTL_MS;
    await this.ctx.storage.put("realtime-ticket:" + ticket, { playerId, expiresAt });

    const currentAlarm = await this.ctx.storage.getAlarm();
    if (currentAlarm === null || currentAlarm > expiresAt) {
      await this.ctx.storage.setAlarm(expiresAt);
    }
    return json({ ticket, expiresAt }, 201);
  }

  async consumeTicket(ticket) {
    if (!TICKET_PATTERN.test(ticket)) return null;
    const key = "realtime-ticket:" + ticket;
    // Read-and-delete in one storage transaction prevents ticket replay.
    return await this.ctx.storage.transaction(async txn => {
      const stored = await txn.get(key);
      if (!stored) return null;
      await txn.delete(key);
      if (!Number.isFinite(Number(stored.expiresAt)) || Number(stored.expiresAt) <= Date.now()) return null;
      if (!PLAYER_ID_PATTERN.test(String(stored.playerId || ""))) return null;
      return stored;
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/ticket") return this.issueTicket(request);
    if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    const offeredProtocols = String(request.headers.get("Sec-WebSocket-Protocol") || "")
      .split(",").map(value => value.trim()).filter(Boolean);
    if (!offeredProtocols.includes("coi-eldoria")) {
      return new Response("Realtime subprotocol required", { status: 400 });
    }

    const sockets = this.ctx.getWebSockets();
    if (sockets.length >= MAX_CONNECTIONS) {
      return new Response("Eldoria realtime capacity reached", { status: 503 });
    }

    const ticket = String(request.headers.get("X-COI-Realtime-Ticket") || "");
    const ticketData = await this.consumeTicket(ticket);
    if (!ticketData) return new Response("Unauthorized", { status: 401 });
    // Recheck after the asynchronous ticket transaction; another handshake may have filled the room.
    // No await between this check and acceptWebSocket.
    if (this.ctx.getWebSockets().length >= MAX_CONNECTIONS) {
      return new Response("Eldoria realtime capacity reached", { status: 503 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId: ticketData.playerId });
    server.send(JSON.stringify({ type: "connected", room: "eldoria" }));
    this.broadcastPresence();

    // Only the non-secret protocol is negotiated back to the browser.
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { "Sec-WebSocket-Protocol": "coi-eldoria" }
    });
  }

  async alarm() {
    const now = Date.now();
    const tickets = await this.ctx.storage.list({ prefix: "realtime-ticket:" });
    let nextExpiry = null;
    for (const [key, value] of tickets) {
      const expiresAt = Number(value?.expiresAt || 0);
      if (!expiresAt || expiresAt <= now) {
        await this.ctx.storage.delete(key);
      } else {
        nextExpiry = nextExpiry === null ? expiresAt : Math.min(nextExpiry, expiresAt);
      }
    }
    if (nextExpiry !== null) await this.ctx.storage.setAlarm(nextExpiry);
  }

  async webSocketMessage(socket, message) {
    if (typeof message !== "string" || message.length > 1024) {
      try { socket.close(1009, "Message too large or invalid"); } catch {}
      return;
    }
    let packet;
    try { packet = JSON.parse(message); }
    catch {
      socket.send(JSON.stringify({ type: "error", code: "invalid_json" }));
      return;
    }
    if (packet?.type === "ping") {
      socket.send(JSON.stringify({ type: "pong", at: Date.now() }));
      return;
    }
    socket.send(JSON.stringify({ type: "error", code: "unsupported_message" }));
  }

  async webSocketClose(socket, code, reason) {
    // Acknowledge the peer's Close frame when using the Hibernation WebSocket API.
    // Reserved/abnormal codes must not be sent back as a status code.
    const validCode = Number.isInteger(code)
      && code >= 1000
      && code < 5000
      && ![1004, 1005, 1006, 1015].includes(code);
    try {
      if (validCode) socket.close(code, String(reason || ""));
      else socket.close();
    } catch {
      try { socket.close(); } catch {}
    }
    this.broadcastPresence();
  }

  async webSocketError(socket) {
    try { socket.close(1011, "Realtime connection error"); } catch {}
    this.broadcastPresence();
  }

  broadcastPresence() {
    const sockets = this.ctx.getWebSockets();
    const message = JSON.stringify({ type: "presence", online: sockets.length, room: "eldoria" });
    for (const socket of sockets) {
      try { socket.send(message); } catch {}
    }
  }
}
