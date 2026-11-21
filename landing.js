(() => {
  "use strict";

  const TOKEN_KEY = "coi_game_token";
  const modal = document.getElementById("install-modal");
  const installContent = document.getElementById("install-content");
  const installButton = document.getElementById("install-button");
  const shareButton = document.getElementById("share-game-button");
  const shareStatus = document.getElementById("share-game-status");
  const referralInput = document.getElementById("referral-link");
  const referralButton = document.getElementById("copy-referral");
  const referralStatus = document.getElementById("referral-status");
  const playLink = document.getElementById("play-now");
  let deferredInstallPrompt = null;

  function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function isStandalone() {
    return window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  function referralAwarePlayLink() {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (!playLink || !code || !/^izzy_[a-f0-9]{32}$/.test(code)) return;
    playLink.href = "/kingdom.html?ref=" + encodeURIComponent(code);
  }

  function installInstructions() {
    const ua = navigator.userAgent || "";
    if (/iphone|ipad|ipod/i.test(ua)) {
      return {
        title: "Instalar no iPhone ou iPad",
        intro: "Adicione o Clash of Izzy à tela inicial pelo navegador.",
        steps: [
          "Abra esta página no Safari.",
          "Toque em Compartilhar.",
          "Escolha “Adicionar à Tela de Início” e confirme."
        ]
      };
    }
    if (/android/i.test(ua)) {
      return {
        title: "Instalar no Android",
        intro: "Use o menu do navegador para adicionar o jogo ao aparelho.",
        steps: [
          "Abra esta página no Chrome ou navegador compatível.",
          "Toque no menu ⋮ e escolha “Instalar app” ou “Adicionar à tela inicial”.",
          "Confirme a instalação quando o navegador oferecer essa opção."
        ]
      };
    }
    return {
      title: "Instalar no computador",
      intro: "O navegador pode oferecer a instalação do jogo como aplicativo.",
      steps: [
        "Procure o ícone de instalação na barra de endereço.",
        "Selecione “Instalar” e confirme.",
        "Quando a instalação não estiver disponível, use o jogo diretamente no navegador."
      ]
    };
  }

  function showInstallGuide() {
    if (!modal || !installContent) return;
    const guide = installInstructions();
    const list = guide.steps.map(step => "<li>" + step + "</li>").join("");
    installContent.innerHTML =
      "<h2 id=\"install-title\">" + guide.title + "</h2>" +
      "<p>" + guide.intro + "</p><ol>" + list + "</ol>" +
      "<p>É necessário abrir o jogo em uma conexão segura (HTTPS). A instalação depende do suporte do navegador e do aparelho.</p>" +
      "<button class=\"landing-button\" id=\"install-confirm\" type=\"button\">Entendi</button>";
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    modal.querySelector(".install-close")?.focus();
    document.getElementById("install-confirm")?.addEventListener("click", closeInstallGuide);
  }

  function closeInstallGuide() {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    try { localStorage.setItem("coi_install_guide_dismissed", "1"); } catch {}
    installButton?.focus();
  }

  async function handleInstallClick() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice.catch(() => null);
      deferredInstallPrompt = null;
      if (choice?.outcome === "accepted") {
        installButton.textContent = "Instalação solicitada";
        return;
      }
    }
    showInstallGuide();
  }

  async function shareGame() {
    const shareTarget = new URL("/", window.location.origin);
    const referralCode = new URLSearchParams(window.location.search).get("ref");
    if (referralCode && /^izzy_[a-f0-9]{32}$/.test(referralCode)) {
      shareTarget.searchParams.set("ref", referralCode);
    }
    const shareUrl = shareTarget.href;
    const payload = {
      title: "Clash of Izzy",
      text: "Construa seu reino, fortaleça seu exército e conquiste territórios.",
      url: shareUrl
    };
    if (shareButton) shareButton.disabled = true;
    if (shareStatus) shareStatus.textContent = "Preparando link de compartilhamento…";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share(payload);
        if (shareStatus) shareStatus.textContent = "Link compartilhado.";
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        if (shareStatus) shareStatus.textContent = "Link copiado. Cole em uma conversa do WhatsApp, Facebook ou outro aplicativo.";
        return;
      }
      const whatsappUrl = "https://wa.me/?text=" + encodeURIComponent(payload.text + " " + shareUrl);
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      if (shareStatus) shareStatus.textContent = "Abrindo o WhatsApp para compartilhar o link.";
    } catch (error) {
      if (error?.name === "AbortError") {
        if (shareStatus) shareStatus.textContent = "Compartilhamento cancelado.";
      } else if (shareStatus) {
        shareStatus.textContent = "Não foi possível abrir o menu de compartilhamento. Copie o endereço do navegador.";
      }
    } finally {
      if (shareButton) shareButton.disabled = false;
    }
  }

  async function loadReferralLink() {
    if (!referralInput || !referralStatus || !referralButton) return;
    let token = safeStorageGet(TOKEN_KEY);
    if (!token) { try { token = sessionStorage.getItem(TOKEN_KEY); } catch {} }
    if (!token) {
      referralInput.value = "Entre no reino para gerar seu convite";
      referralStatus.textContent = "Depois de criar seu reino, volte aqui para obter um link pessoal.";
      referralButton.disabled = true;
      return;
    }
    try {
      const response = await fetch("/api/game/referral/link", {
        headers: { Authorization: "Bearer " + token }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível gerar o convite.");
      referralInput.value = result.referral_url;
      referralButton.disabled = false;
      referralStatus.textContent = "Convites registrados: " + Number(result.referral_count || 0) +
        ". O sistema registra novos reinos; recompensas ainda não são creditadas automaticamente.";
    } catch {
      referralInput.value = "Abra seu reino e tente novamente";
      referralStatus.textContent = "Não foi possível validar sua sessão. Seu progresso não foi alterado.";
      referralButton.disabled = true;
    }
  }

  async function copyReferralLink() {
    if (!referralInput || referralButton.disabled || !referralInput.value.startsWith("http")) return;
    const original = referralButton.textContent;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralInput.value);
      } else {
        referralInput.focus();
        referralInput.select();
        if (!document.execCommand("copy")) throw new Error("copy unavailable");
      }
      referralButton.textContent = "Copiado!";
      referralStatus.textContent = "Link de convite copiado. Compartilhe com seus amigos.";
    } catch {
      referralStatus.textContent = "Selecione e copie o link manualmente.";
      referralInput.focus();
      referralInput.select();
    }
    window.setTimeout(() => { referralButton.textContent = original; }, 1800);
  }

  async function submitBetaSignup(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.getElementById("beta-signup-status");
    const button = form.querySelector("button[type=submit]");
    const email = String(form.elements.email.value || "").trim();
    const consent = form.elements.consent.checked;
    if (!consent) {
      status.textContent = "Confirme o consentimento para receber convites e atualizações do beta.";
      return;
    }
    button.disabled = true;
    status.textContent = "Enviando inscrição...";
    try {
      const response = await fetch("/api/beta/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir a inscrição.");
      status.textContent = result.message || "Inscrição confirmada.";
      form.reset();
    } catch (error) {
      status.textContent = error.message || "Falha de conexão. Tente novamente.";
    } finally {
      button.disabled = false;
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installButton) installButton.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    if (installButton) installButton.textContent = "Aplicativo instalado";
    try { localStorage.setItem("coi_install_guide_dismissed", "1"); } catch {}
  });

  installButton?.addEventListener("click", handleInstallClick);
  shareButton?.addEventListener("click", shareGame);
  document.querySelector(".install-close")?.addEventListener("click", closeInstallGuide);
  modal?.addEventListener("click", event => {
    if (event.target === modal) closeInstallGuide();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modal && !modal.hidden) closeInstallGuide();
  });
  referralButton?.addEventListener("click", copyReferralLink);
  document.getElementById("beta-signup-form")?.addEventListener("submit", submitBetaSignup);

  referralAwarePlayLink();
  void loadReferralLink();

  if (!isStandalone() && !safeStorageGet("coi_install_guide_dismissed")) {
    window.setTimeout(() => {
      if (!isStandalone() && modal?.hidden !== false) showInstallGuide();
    }, 10000);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

  window.showInstallGuide = showInstallGuide;
  window.closeInstallGuide = closeInstallGuide;
})();
