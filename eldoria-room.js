// Sala realtime compartilhada de Eldoria. A autoridade do jogo e os dados persistentes continuam no Worker + D1.
export class EldoriaRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    const playerId = String(request.headers.get("X-COI-Player-Id") || "");
    if (!/^izzy_[a-f0-9]{32}$/.test(playerId)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const sockets = this.ctx.getWebSockets();
    if (sockets.length >= 200) {
      return new Response("Eldoria realtime capacity reached", { status: 503 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId });
    server.send(JSON.stringify({ type: "connected", room: "eldoria" }));
    this.broadcastPresence();

    return new Response(null, { status: 101, webSocket: client });
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

  async webSocketClose() {
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
