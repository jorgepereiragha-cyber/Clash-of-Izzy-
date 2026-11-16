(() => {
  if (window.__coiRealtimeClient) return;
  window.__coiRealtimeClient = true;

  let socket = null;
  let retryTimer = null;
  let heartbeatTimer = null;
  let attempts = 0;
  let connecting = false;
  let stopped = false;

  const dispatch = (name, detail) => {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  };
  const readToken = () =>
    localStorage.getItem("coi_game_token") ||
    sessionStorage.getItem("coi_game_token") ||
    "";

  function clearHeartbeat() {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }
  function scheduleReconnect() {
    if (stopped || retryTimer !== null) return;
    const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(attempts, 5)));
    attempts += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  }

  async function connect() {
    if (stopped || connecting || socket?.readyState === WebSocket.OPEN) return;
    const token = readToken();
    if (!token) {
      scheduleReconnect();
      return;
    }
    connecting = true;
    try {
      const response = await fetch("/api/game/realtime-ticket", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ticket) {
        throw new Error(data.error || "Não foi possível iniciar o tempo real.");
      }
      const endpoint = new URL(data.endpoint || "/api/realtime", location.href);
      endpoint.protocol = location.protocol === "https:" ? "wss:" : "ws:";
      endpoint.searchParams.set("ticket", data.ticket);

      const current = new WebSocket(endpoint.toString());
      socket = current;
      current.addEventListener("open", () => {
        if (socket !== current) return;
        attempts = 0;
        connecting = false;
        dispatch("coi:realtime-status", { connected: true });
        clearHeartbeat();
        heartbeatTimer = setInterval(() => {
          if (current.readyState === WebSocket.OPEN) {
            try { current.send("ping"); } catch {}
          }
        }, 25000);
      });
      current.addEventListener("message", event => {
        if (socket !== current || typeof event.data !== "string") return;
        if (event.data === "pong") return;
        try {
          const message = JSON.parse(event.data);
          if (message && message.type === "state_changed") {
            dispatch("coi:realtime", message);
          }
        } catch {
          // Mensagens malformadas são ignoradas; nenhuma ação de jogo é aceita pelo socket.
        }
      });
      current.addEventListener("error", () => {
        try { current.close(); } catch {}
      });
      current.addEventListener("close", () => {
        if (socket === current) socket = null;
        connecting = false;
        clearHeartbeat();
        dispatch("coi:realtime-status", { connected: false });
        scheduleReconnect();
      });
    } catch (error) {
      connecting = false;
      dispatch("coi:realtime-status", {
        connected: false,
        error: String(error?.message || error)
      });
      scheduleReconnect();
    }
  }

  window.addEventListener("online", () => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    connect();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && socket?.readyState !== WebSocket.OPEN) connect();
  });
  window.addEventListener("beforeunload", () => {
    stopped = true;
    if (retryTimer !== null) clearTimeout(retryTimer);
    clearHeartbeat();
    try { socket?.close(1000, "Página encerrada."); } catch {}
  });

  connect();
})();
