// Fail-closed invite gate. Only active on the separately deployed beta Worker.
// Static assets must use run_worker_first=true in wrangler.beta.jsonc.
const COOKIE_NAME = "__Host-izzy_beta";
const ACCESS_TTL_SECONDS = 7 * 24 * 60 * 60;
const ATTEMPT_WINDOW_SECONDS = 10 * 60;
const MAX_REDEEM_ATTEMPTS = 6;
const CODE_PATTERN = /^IZZY-[A-Z2-7]{20}$/;

function responseJson(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

function newSessionToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeInviteCode(raw) {
  const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return CODE_PATTERN.test(code) ? code : null;
}

export function betaPaymentDisabled(path, method, env) {
  // Payments are NOT activatable by a single flag in this implementation.
  // A future commercial beta requires a separately reviewed payment integration.
  if (env?.ENVIRONMENT !== "beta") return false;
  if (path === "/api/support/checkout" || path === "/api/admin/purchase-requests/review") return true;
  if (path.startsWith("/api/webhook/")) return true;
  if (path.startsWith("/api/store/") && method !== "GET") return true;
  return false;
}

function cookieToken(request) {
  const cookies = (request.headers.get("Cookie") || "").split(";");
  const value = cookies.map(part => part.trim()).find(part => part.startsWith(COOKIE_NAME + "="));
  const token = value?.slice(COOKIE_NAME.length + 1) || "";
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

async function hasValidAccess(request, env) {
  const token = cookieToken(request);
  if (!token) return false;
  const row = await env.DB.prepare(
    "SELECT 1 AS permitted FROM beta_access_sessions s " +
    "JOIN beta_invites i ON i.id=s.invite_id " +
    "WHERE s.session_hash=? AND s.revoked_at IS NULL AND s.expires_at>unixepoch() AND i.disabled=0"
  ).bind(await sha256(token)).first();
  return Boolean(row);
}

async function redeemInvite(request, env, url) {
  if (request.method !== "POST") return responseJson({ error: "Metodo nao permitido." }, 405);
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return responseJson({ error: "Origem nao permitida." }, 403);
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    return responseJson({ error: "Envie JSON." }, 415);
  }
  if (Number(request.headers.get("Content-Length") || 0) > 1024) {
    return responseJson({ error: "Solicitacao muito grande." }, 413);
  }
  // Bound both counted and chunked payloads before parsing.
  let source = "";
  const reader = request.body?.getReader();
  if (reader) {
    const decoder = new TextDecoder();
    let byteCount = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > 1024) {
        await reader.cancel();
        return responseJson({ error: "Solicitacao muito grande." }, 413);
      }
      source += decoder.decode(value, { stream: true });
    }
    source += decoder.decode();
  }
  let input;
  try { input = JSON.parse(source); }
  catch { return responseJson({ error: "JSON invalido." }, 400); }
  // Hash the visitor IP; never persist raw addresses or invite codes.
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const sourceHash = await sha256(ip);
  const bucket = Math.floor(Date.now() / (ATTEMPT_WINDOW_SECONDS * 1000));
  const attempts = await env.DB.prepare(
    "INSERT INTO beta_redeem_attempts(source_hash,time_bucket,hits) VALUES(?,?,1) " +
    "ON CONFLICT(source_hash,time_bucket) DO UPDATE SET hits=hits+1 RETURNING hits"
  ).bind(sourceHash, bucket).first();
  if (Number(attempts?.hits || 0) > MAX_REDEEM_ATTEMPTS) {
    return responseJson({ error: "Muitas tentativas. Tente novamente mais tarde." }, 429, { "Retry-After": "600" });
  }
  const code = normalizeInviteCode(input?.code);
  if (!code) return responseJson({ error: "Convite invalido ou expirado." }, 403);
  const invite = await env.DB.prepare(
    "UPDATE beta_invites SET uses=uses+1 WHERE code_hash=? AND disabled=0 " +
    "AND uses<max_uses AND (expires_at IS NULL OR expires_at>unixepoch()) RETURNING id"
  ).bind(await sha256(code)).first();
  if (!invite) return responseJson({ error: "Convite invalido ou expirado." }, 403);
  const token = newSessionToken();
  await env.DB.prepare(
    "INSERT INTO beta_access_sessions(session_hash,invite_id,expires_at) VALUES(?,?,?)"
  ).bind(await sha256(token), invite.id, Math.floor(Date.now() / 1000) + ACCESS_TTL_SECONDS).run();
  return responseJson({ ok: true, next: "/kingdom.html" }, 200, {
    "Set-Cookie": COOKIE_NAME + "=" + token + "; Path=/; Max-Age=" + ACCESS_TTL_SECONDS + "; Secure; HttpOnly; SameSite=Strict"
  });
}

export async function betaAccessGuard(request, env) {
  if (env?.ENVIRONMENT !== "beta") return null; // Existing production behavior is untouched.
  if (!env.DB || env.INVITE_ONLY !== "true") {
    return responseJson({ error: "Beta nao configurado com isolamento seguro." }, 503);
  }
  const url = new URL(request.url);
  const path = url.pathname;
  // One operational health endpoint; no player data or paid endpoints are exposed.
  if (path === "/api/health" && request.method === "GET") return null;
  try {
    if (path === "/api/beta/invite/redeem") return await redeemInvite(request, env, url);
    if (path === "/beta-access.html" && request.method === "GET") return null;
    // The public marketing portal and legacy beta sign-up are not part of this realm.
    if (path === "/api/beta/signup") {
      return responseJson({ error: "Use o convite do beta fechado.", code: "BETA_LEGACY_SIGNUP_DISABLED" }, 404);
    }
    if (path === "/api/beta/access/status" && request.method === "GET") {
      const permitted = await hasValidAccess(request, env);
      return responseJson({ authorized: permitted }, permitted ? 200 : 401);
    }
    if (path === "/api/beta/access/logout") {
      if (request.method !== "POST") return responseJson({ error: "Metodo nao permitido." }, 405);
      if (request.headers.get("Origin") !== url.origin) return responseJson({ error: "Origem nao permitida." }, 403);
      const token = cookieToken(request);
      if (token) {
        await env.DB.prepare(
          "UPDATE beta_access_sessions SET revoked_at=unixepoch() WHERE session_hash=? AND revoked_at IS NULL"
        ).bind(await sha256(token)).run();
      }
      return responseJson({ ok: true }, 200, {
        "Set-Cookie": COOKIE_NAME + "=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict"
      });
    }
    const hasAccess = await hasValidAccess(request, env);
    if (path === "/" || path === "/portal.html") {
      return new Response(null, {
        status: 302,
        headers: {
          Location: new URL(hasAccess ? "/kingdom.html" : "/beta-access.html", url).href,
          "Cache-Control": "private, no-store"
        }
      });
    }
    if (!hasAccess) {
      if (path.startsWith("/api/")) return responseJson({ error: "Convite beta necessario.", code: "BETA_INVITE_REQUIRED" }, 403);
      return new Response(null, {
        status: 302,
        headers: { Location: new URL("/beta-access.html", url).href, "Cache-Control": "no-store" }
      });
    }
    if (path === "/sw.js" && request.method === "GET") {
      // The production PWA precaches protected HTML; never install it for beta.
      // A no-fetch SW also removes prior same-origin Clash caches upon activation.
      const script = [
        "self.addEventListener('install', () => self.skipWaiting());",
        "self.addEventListener('activate', event => event.waitUntil((async () => {",
        "const keys = await caches.keys();",
        "await Promise.all(keys.filter(key => key.startsWith('clash-of-izzy-')).map(key => caches.delete(key)));",
        "await self.clients.claim();",
        "})()));"
      ].join("\n");
      return new Response(script, {
        status: 200,
        headers: {
          "Content-Type": "text/javascript; charset=utf-8",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }
    if (path === "/api/store/payment-methods" && request.method === "GET") {
      return responseJson({ mercadoPago: false, nubankPix: false });
    }
    if (betaPaymentDisabled(path, request.method, env)) {
      return responseJson({ error: "Pagamento real indisponivel neste beta.", code: "BETA_PAYMENTS_DISABLED" }, 503);
    }
    return null;
  } catch {
    // D1 schema missing or unavailable: never grant access on an error.
    return responseJson({ error: "Controle de acesso beta temporariamente indisponivel." }, 503);
  }
}
