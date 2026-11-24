(() => {
  "use strict";
  if (window.__COI_ANDROID_RUNTIME__) return;
  window.__COI_ANDROID_RUNTIME__ = true;

  let status = null;
  let statusText = null;
  let hideTimer = 0;

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

  // Closed beta is online-only. Never register the official PWA worker:
  // cached private pages could outlive invitation revocation. Keep network
  // and lifecycle notifications, but leave offline installation disabled.
  appResumed("initial");
})();
