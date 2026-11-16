const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;
const MAX_ATTEMPTS = 3;
const RETRY_SECONDS = 15 * 60;

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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function htmlPage(title, message, status = 200) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  return new Response(
    '<!doctype html><html lang="pt-BR"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + safeTitle + '</title>' +
    '<body style="margin:0;background:#100b08;color:#eee5d5;font:16px Georgia,serif;display:grid;min-height:100vh;place-items:center">' +
    '<main style="max-width:560px;margin:24px;padding:28px;border:1px solid #8b6f47;border-radius:16px;background:#24170f">' +
    '<h1 style="color:#ffd700">' + safeTitle + '</h1><p>' + safeMessage + '</p>' +
    '<a style="color:#ffd700" href="/">Voltar ao Clash of Izzy</a></main></body></html>',
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
  );
}

function render(template, variables, html = false) {
  return String(template ?? "").replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key) => {
    const raw = variables[key] === undefined || variables[key] === null ? "" : String(variables[key]);
    return html ? escapeHtml(raw) : raw.replace(/[\r\n]+/g, " ").slice(0, 500);
  });
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function getFrontendUrl(env) {
  try {
    const url = new URL(String(env.FRONTEND_URL || ""));
    if (url.protocol !== "https:" && !(env.ENVIRONMENT === "development" && url.protocol === "http:")) return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

async function sendResend(env, message) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error("email_provider_not_configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.RESEND_API_KEY,
      "Content-Type": "application/json",
      "Idempotency-Key": String(message.idempotencyKey).slice(0, 200)
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: String(message.subject).replace(/[\r\n]+/g, " ").slice(0, 180),
      html: message.html,
      text: message.text
    })
  });
  if (!response.ok) throw new Error("resend_http_" + response.status);
  let payload = {};
  try { payload = await response.json(); } catch {}
  return { id: typeof payload.id === "string" ? payload.id.slice(0, 200) : null };
}

export async function requestEmailVerification(env, externalPlayerId, rawEmail) {
  const email = String(rawEmail ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_REGEX.test(email)) {
    return json({ error: "Informe um endereço de e-mail válido." }, 400);
  }
  const frontendUrl = getFrontendUrl(env);
  if (!frontendUrl || !env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return json({ error: "O serviço de e-mail ainda não está configurado no servidor." }, 503);
  }

  const player = await env.DB.prepare("SELECT id FROM players WHERE player_id=?")
    .bind(externalPlayerId).first();
  if (!player) return json({ error: "Jogador não encontrado." }, 404);

  const existing = await env.DB.prepare(
    "SELECT email,email_verified_at FROM player_email_contacts WHERE player_id=?"
  ).bind(player.id).first();
  if (existing && existing.email.toLowerCase() === email && existing.email_verified_at) {
    return json({ success: true, alreadyVerified: true });
  }

  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);
  try {
    await env.DB.prepare(
      "INSERT INTO player_email_contacts " +
      "(player_id,email,email_verified_at,verification_token_hash,verification_expires_at,updated_at) " +
      "VALUES (?,?,NULL,?,?,?) " +
      "ON CONFLICT(player_id) DO UPDATE SET email=excluded.email,email_verified_at=NULL," +
      "verification_token_hash=excluded.verification_token_hash," +
      "verification_expires_at=excluded.verification_expires_at,updated_at=excluded.updated_at"
    ).bind(player.id, email, tokenHash, now + 1800, now).run();
  } catch (error) {
    if (String(error?.message || error).toLowerCase().includes("unique")) {
      return json({ error: "Este endereço já está vinculado a outra conta." }, 409);
    }
    throw error;
  }

  const verifyUrl = new URL("/api/email/verify", frontendUrl);
  verifyUrl.searchParams.set("token", token);
  const link = escapeHtml(verifyUrl.href);
  const html = '<div style="background:#1a0f08;color:#e0d5c0;padding:28px;font-family:Georgia,serif">' +
    '<h1 style="color:#ffd700">Confirme seu e-mail</h1>' +
    '<p>Confirme que este endereço pertence a você para receber notificações opcionais do Clash of Izzy.</p>' +
    '<p><a style="display:inline-block;background:#4a7c3a;color:#fff;padding:12px 18px;border-radius:8px" href="' + link + '">Confirmar endereço</a></p>' +
    '<p>O link expira em 30 minutos. Se você não solicitou esta confirmação, ignore esta mensagem.</p></div>';
  try {
    await sendResend(env, {
      to: email,
      subject: "Confirme seu e-mail — Clash of Izzy",
      html,
      text: "Confirme seu endereço de e-mail no Clash of Izzy: " + verifyUrl.href +
        "\nO link expira em 30 minutos.",
      idempotencyKey: "verify-" + tokenHash.slice(0, 40)
    });
  } catch (error) {
    await env.DB.prepare(
      "UPDATE player_email_contacts SET verification_token_hash=NULL," +
      "verification_expires_at=NULL,updated_at=? WHERE player_id=? AND verification_token_hash=?"
    ).bind(now, player.id, tokenHash).run();
    console.error("email_verification_delivery_failed", String(error?.message || error));
    return json({ error: "Não foi possível enviar a confirmação. Tente novamente mais tarde." }, 503);
  }
  return json({ success: true, verificationSent: true, expiresInSeconds: 1800 }, 202);
}

export async function verifyEmailToken(env, rawToken) {
  const token = String(rawToken ?? "");
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) {
    return htmlPage("Link inválido", "Solicite uma nova confirmação nas configurações do jogo.", 400);
  }
  const tokenHash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);
  const contact = await env.DB.prepare(
    "SELECT player_id FROM player_email_contacts " +
    "WHERE verification_token_hash=? AND verification_expires_at>?"
  ).bind(tokenHash, now).first();
  if (!contact) return htmlPage("Link expirado ou inválido", "Solicite uma nova confirmação nas configurações do jogo.", 410);

  const updated = await env.DB.prepare(
    "UPDATE player_email_contacts SET email_verified_at=?," +
    "verification_token_hash=NULL,verification_expires_at=NULL,updated_at=? " +
    "WHERE player_id=? AND verification_token_hash=? AND verification_expires_at>?"
  ).bind(now, now, contact.player_id, tokenHash, now).run();
  if (!updated.meta?.changes) return htmlPage("Link já utilizado", "Este link já foi utilizado ou expirou.", 409);
  return htmlPage("E-mail confirmado", "Seu endereço foi confirmado. Agora você pode ativar os tipos de notificação desejados nas configurações do jogo.");
}

async function getInternalPlayerId(env, externalPlayerId) {
  const player = await env.DB.prepare("SELECT id FROM players WHERE player_id=?")
    .bind(externalPlayerId).first();
  return player?.id ?? null;
}

function maskEmail(email) {
  const parts = String(email || "").split("@");
  if (parts.length !== 2) return "";
  return parts[0].slice(0, 1) + "***@" + parts[1];
}

export async function getEmailPreferences(env, externalPlayerId) {
  const playerId = await getInternalPlayerId(env, externalPlayerId);
  if (!playerId) return json({ error: "Jogador não encontrado." }, 404);
  const row = await env.DB.prepare(
    "SELECT email,email_verified_at,marketing_opt_in,event_alerts_opt_in,attack_alerts_opt_in " +
    "FROM player_email_contacts WHERE player_id=?"
  ).bind(playerId).first();
  return json({
    configured: Boolean(row),
    emailVerified: Boolean(row?.email_verified_at),
    maskedEmail: row ? maskEmail(row.email) : null,
    preferences: {
      marketing: Boolean(row?.marketing_opt_in),
      events: Boolean(row?.event_alerts_opt_in),
      attackAlerts: Boolean(row?.attack_alerts_opt_in)
    }
  });
}

export async function updateEmailPreferences(env, externalPlayerId, preferences) {
  const playerId = await getInternalPlayerId(env, externalPlayerId);
  if (!playerId) return json({ error: "Jogador não encontrado." }, 404);
  const row = await env.DB.prepare(
    "SELECT email_verified_at FROM player_email_contacts WHERE player_id=?"
  ).bind(playerId).first();
  if (!row?.email_verified_at) {
    return json({ error: "Confirme um endereço de e-mail antes de alterar as preferências." }, 409);
  }
  const fields = [
    ["marketing", "marketing_opt_in"],
    ["events", "event_alerts_opt_in"],
    ["attackAlerts", "attack_alerts_opt_in"]
  ];
  if (fields.some(([key]) => typeof preferences?.[key] !== "boolean")) {
    return json({ error: "Informe marketing, events e attackAlerts como true ou false." }, 400);
  }
  await env.DB.prepare(
    "UPDATE player_email_contacts SET marketing_opt_in=?,event_alerts_opt_in=?," +
    "attack_alerts_opt_in=?,updated_at=? WHERE player_id=? AND email_verified_at IS NOT NULL"
  ).bind(
    preferences.marketing ? 1 : 0,
    preferences.events ? 1 : 0,
    preferences.attackAlerts ? 1 : 0,
    Math.floor(Date.now() / 1000),
    playerId
  ).run();
  return json({ success: true });
}

export async function getEmailHistory(env, externalPlayerId) {
  const playerId = await getInternalPlayerId(env, externalPlayerId);
  if (!playerId) return json({ error: "Jogador não encontrado." }, 404);
  const rows = await env.DB.prepare(
    "SELECT id,template_id,subject,status,sent_at FROM email_history " +
    "WHERE player_id=? ORDER BY sent_at DESC,id DESC LIMIT 50"
  ).bind(playerId).all();
  return json({ history: rows.results || [] });
}

export async function queueEmailForInternalPlayer(env, internalPlayerId, templateId, variables, options = {}) {
  const category = options.category || "transactional";
  const idempotencyKey = String(options.idempotencyKey || "").slice(0, 180);
  if (!Number.isSafeInteger(Number(internalPlayerId)) || Number(internalPlayerId) < 1 ||
      !["transactional", "events", "attack_alerts", "marketing"].includes(category) ||
      !/^[A-Za-z0-9:_-]{8,180}$/.test(idempotencyKey)) {
    return { success: false, reason: "invalid_request" };
  }
  const [contact, template] = await Promise.all([
    env.DB.prepare(
      "SELECT email,email_verified_at,marketing_opt_in,event_alerts_opt_in,attack_alerts_opt_in " +
      "FROM player_email_contacts WHERE player_id=?"
    ).bind(Number(internalPlayerId)).first(),
    env.DB.prepare(
      "SELECT id FROM email_templates WHERE id=? AND active=1"
    ).bind(templateId).first()
  ]);
  if (!contact?.email_verified_at) return { success: false, reason: "email_not_verified" };
  if (!template) return { success: false, reason: "template_unavailable" };
  const preferenceColumn = {
    events: "event_alerts_opt_in",
    attack_alerts: "attack_alerts_opt_in",
    marketing: "marketing_opt_in"
  }[category];
  if (preferenceColumn && Number(contact[preferenceColumn]) !== 1) {
    return { success: false, reason: "preference_disabled" };
  }
  const safeVariables = JSON.stringify(variables && typeof variables === "object" ? variables : {});
  if (safeVariables.length > 8192) return { success: false, reason: "variables_too_large" };
  const inserted = await env.DB.prepare(
    "INSERT OR IGNORE INTO email_queue " +
    "(player_id,recipient_email,template_id,category,variables_json,idempotency_key) " +
    "VALUES (?,?,?,?,?,?)"
  ).bind(Number(internalPlayerId), contact.email, templateId, category, safeVariables, idempotencyKey).run();
  return { success: true, queued: Number(inserted.meta?.changes || 0) === 1 };
}

export async function processEmailQueue(env, batchSize = 10) {
  if (!env.DB || !env.RESEND_API_KEY || !env.EMAIL_FROM) return { processed: 0, skipped: true };
  const now = Math.floor(Date.now() / 1000);
  const limit = Math.max(1, Math.min(25, Math.floor(Number(batchSize) || 10)));

  // Reclaim leases left behind by an interrupted Worker invocation.
  await env.DB.prepare(
    "UPDATE email_queue SET status='pending',locked_at=NULL," +
    "scheduled_at=MIN(scheduled_at,?) WHERE status='sending' AND locked_at<? AND attempts<3"
  ).bind(now, now - 900).run();
  await env.DB.prepare(
    "UPDATE email_queue SET status='failed',locked_at=NULL,last_error='delivery_attempts_exhausted' " +
    "WHERE status='sending' AND locked_at<? AND attempts>=3"
  ).bind(now - 900).run();

  const pending = await env.DB.prepare(
    "SELECT id FROM email_queue WHERE status='pending' AND scheduled_at<=? " +
    "AND attempts<3 ORDER BY scheduled_at,id LIMIT ?"
  ).bind(now, limit).all();

  let processed = 0;
  for (const item of pending.results || []) {
    const claimed = await env.DB.prepare(
      "UPDATE email_queue SET status='sending',locked_at=?,attempts=attempts+1 " +
      "WHERE id=? AND status='pending' AND scheduled_at<=? AND attempts<3"
    ).bind(now, item.id, now).run();
    if (!claimed.meta?.changes) continue;

    const current = await env.DB.prepare(
      "SELECT q.*,t.subject,t.html_template,t.text_template," +
      "c.email_verified_at,c.marketing_opt_in,c.event_alerts_opt_in,c.attack_alerts_opt_in " +
      "FROM email_queue q JOIN email_templates t ON t.id=q.template_id " +
      "LEFT JOIN player_email_contacts c ON c.player_id=q.player_id " +
      "WHERE q.id=? AND q.status='sending'"
    ).bind(item.id).first();
    if (!current) continue;

    const prefAllowed = current.category === "transactional" ||
      (current.category === "events" && Number(current.event_alerts_opt_in) === 1) ||
      (current.category === "attack_alerts" && Number(current.attack_alerts_opt_in) === 1) ||
      (current.category === "marketing" && Number(current.marketing_opt_in) === 1);
    if (!current.email_verified_at || !prefAllowed ||
        String(current.recipient_email).toLowerCase() !== String(current.email || "").toLowerCase()) {
      await env.DB.prepare(
        "UPDATE email_queue SET status='failed',locked_at=NULL," +
        "last_error='recipient_unverified_or_opted_out' WHERE id=? AND status='sending'"
      ).bind(item.id).run();
      processed += 1;
      continue;
    }

    try {
      const variables = JSON.parse(current.variables_json || "{}");
      const subject = render(current.subject, variables, false);
      const html = render(current.html_template, variables, true);
      const text = render(current.text_template, variables, false);
      const providerResult = await sendResend(env, {
        to: current.recipient_email,
        subject,
        html,
        text,
        idempotencyKey: current.idempotency_key
      });
      const sentAt = Math.floor(Date.now() / 1000);
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE email_queue SET status='sent',sent_at=?,locked_at=NULL,last_error=NULL " +
          "WHERE id=? AND status='sending'"
        ).bind(sentAt, item.id),
        env.DB.prepare(
          "INSERT INTO email_history " +
          "(player_id,template_id,recipient_email,subject,status,provider_message_id,sent_at) " +
          "SELECT ?,?,?,?,'sent',?,? WHERE EXISTS(" +
          "SELECT 1 FROM email_queue WHERE id=? AND status='sent' AND sent_at=?)"
        ).bind(current.player_id, current.template_id, current.recipient_email,
          subject, providerResult.id, sentAt, item.id, sentAt)
      ]);
    } catch (error) {
      const attempts = Number(current.attempts || 0);
      const message = String(error?.message || error).replace(/[^A-Za-z0-9_:-]/g, "_").slice(0, 120);
      if (attempts >= MAX_ATTEMPTS) {
        await env.DB.prepare(
          "UPDATE email_queue SET status='failed',locked_at=NULL,last_error=? " +
          "WHERE id=? AND status='sending'"
        ).bind(message, item.id).run();
      } else {
        await env.DB.prepare(
          "UPDATE email_queue SET status='pending',locked_at=NULL,scheduled_at=?,last_error=? " +
          "WHERE id=? AND status='sending'"
        ).bind(now + RETRY_SECONDS, message, item.id).run();
      }
      console.error("email_delivery_failed", item.id, message);
    }
    processed += 1;
  }
  return { processed, skipped: false };
}
