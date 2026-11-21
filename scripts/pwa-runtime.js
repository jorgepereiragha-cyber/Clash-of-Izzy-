(() => {
  "use strict";
  if (window.__COI_ANDROID_RUNTIME__) return;
  window.__COI_ANDROID_RUNTIME__ = true;

  let status = null;
  let statusText = null;
  let updateButton = null;
  let hideTimer = 0;
  let hadController = Boolean(navigator.serviceWorker?.controller);

  function ensureStatus() {
    if (status) return status;
    status = document.createElement("div");
    status.id = "coi-runtime-status";
    status.hidden = true;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    statusText = document.createElement("span");
    statusText.id = "coi-runtime-status-text";
    status.append(statusText);
    document.body.append(status);
    return status;
  }

  function announce(message, kind = "info", persistent = false) {
    const node = ensureStatus();
    window.clearTimeout(hideTimer);
    node.dataset.kind = kind;
    statusText.textContent = message;
    node.hidden = false;
    if (!persistent) hideTimer = window.setTimeout(() => { node.hidden = true; }, 3200);
  }

  function appResumed(reason) {
    window.dispatchEvent(new CustomEvent("coi:app-resume", { detail: { reason } }));
  }

  function updateReady() {
    const node = ensureStatus();
    window.clearTimeout(hideTimer);
    node.dataset.kind = "update";
    statusText.textContent = "Nova versão pronta. Atualize quando terminar sua ação.";
    if (!updateButton) {
      updateButton = document.createElement("button");
      updateButton.type = "button";
      updateButton.textContent = "Atualizar";
      updateButton.addEventListener("click", () => window.location.reload());
    }
    if (!updateButton.isConnected) node.append(updateButton);
    node.hidden = false;
  }

  window.addEventListener("offline", () => {
    announce("Sem conexão. O reino precisa de internet para sincronizar; evite ações até reconectar.", "offline", true);
  });
  window.addEventListener("online", () => {
    announce("Conexão restabelecida. Sincronizando o estado do reino…", "online");
    appResumed("online");
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) appResumed("visibility");
  });
  window.addEventListener("pageshow", event => {
    if (event.persisted) appResumed("pageshow-bfcache");
  });

  if (!navigator.onLine) {
    announce("Sem conexão. O reino precisa de internet para sincronizar; evite ações até reconectar.", "offline", true);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController) updateReady();
      hadController = true;
    });
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(error => console.warn("Clash of Izzy: registro PWA indisponível.", error));
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }
  appResumed("initial");
})();
