import { isGoogleWebClientId, verifyGoogleIdToken } from "./google-identity.js";
const DEFAULT_ITERATIONS = 310000;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;
const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}

function constantTimeEqual(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export function validateAccountUsername(value) {
  const username = String(value || "").normalize("NFKC").trim();
  if (!/^[A-Za-z0-9_.-]{3,24}$/.test(username)) return null;
  return { display: username, key: username.toLowerCase() };
}

export async function derivePasswordHash(password, salt, iterations = DEFAULT_ITERATIONS) {
  const secret = String(password);
  if (secret.length < MIN_PASSWORD_LENGTH || secret.length > MAX_PASSWORD_LENGTH) {
    throw new Error("A senha deve ter entre 12 e 128 caracteres.");
  }
  const saltBytes = salt instanceof Uint8Array ? salt : fromBase64Url(salt);
  const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    material,
    256
  );
  return toBase64Url(new Uint8Array(bits));
}

export async function createPasswordRecord(password, iterations = DEFAULT_ITERATIONS) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = toBase64Url(saltBytes);
  const hash = await derivePasswordHash(password, saltBytes, iterations);
  return { salt, hash, iterations };
}

export async function verifyPasswordRecord(password, record) {
  if (!record || !record.password_salt || !record.password_hash) return false;
  const iterations = Number(record.password_iterations);
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;
  let actual;
  try {
    actual = fromBase64Url(await derivePasswordHash(password, record.password_salt, iterations));
    return constantTimeEqual(actual, fromBase64Url(record.password_hash));
  } catch {
    return false;
  }
}

function normalizeEmail(value) {
  const email = String(value || "").normalize("NFKC").trim().toLowerCase();
  if (!email) return { display: null, key: null };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)) return null;
  return { display: email, key: email };
}

export function maskAccountEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim();
  const separator = email.lastIndexOf("@");
  if (separator <= 0 || separator !== email.indexOf("@") || separator === email.length - 1) return null;
  const localPart = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  const firstCharacter = Array.from(localPart)[0];
  if (!firstCharacter || !domain) return null;
  return firstCharacter + "***@" + domain;
}

function issueGameToken(playerId, sessionVersion, secret) {
  return signPayload(
    { sub: playerId, scope: "game", exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365, av: sessionVersion },
    secret
  );
}

async function signPayload(payload, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return body + "." + toBase64Url(new Uint8Array(signature));
}

async function limited(ctx, env, scope, identity, limit, windowSeconds) {
  return ctx.rateLimitDecision(env, scope, identity, limit, windowSeconds);
}

export async function handlePlayerAccountRoute(request, env, ctx) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/account/")) return null;
  if (!env.DB || !env.SESSION_SECRET) return ctx.json({ error: "Contas indisponíveis no momento." }, 503);

  if (url.pathname === "/api/account/google/config" && request.method === "GET") {
    const clientId = isGoogleWebClientId(env.GOOGLE_WEB_CLIENT_ID) ? env.GOOGLE_WEB_CLIENT_ID : null;
    return ctx.json({ enabled: Boolean(clientId), clientId });
  }

  if (url.pathname === "/api/account/google/challenge" && request.method === "POST") {
    if (!isGoogleWebClientId(env.GOOGLE_WEB_CLIENT_ID)) return ctx.json({error:"Google ainda não configurado para este jogo."},503);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipLimit = await limited(ctx, env, "google-challenge-ip", ip, 12, 900);
    if (ipLimit) return ipLimit;
    const body = await ctx.readBody(request, 2048);
    if (body.__bodyError || !["link","login"].includes(body.purpose)) return ctx.json({error:"Finalidade de autenticação inválida."},400);
    let player = null;
    if (body.purpose === "link") {
      const playerId = await ctx.gameIdentity(request, env);
      if (!playerId) return ctx.json({error:"Entre no reino existente antes de vincular o Google."},401);
      const playerLimit = await limited(ctx,env,"google-link-player",playerId,5,3600);
      if (playerLimit) return playerLimit;
      player = await env.DB.prepare("SELECT id FROM players WHERE player_id=?").bind(playerId).first();
      if (!player) return ctx.json({error:"Reino não encontrado."},404);
    }
    const nonce = crypto.randomUUID() + "-" + crypto.randomUUID();
    const expiresAt = Math.floor(Date.now()/1000) + 300;
    await env.DB.prepare(
      "INSERT INTO google_auth_challenges(nonce,purpose,player_id,expires_at) VALUES(?,?,?,?)"
    ).bind(nonce,body.purpose,player?.id || null,expiresAt).run();
    return ctx.json({nonce,expiresAt,clientId:env.GOOGLE_WEB_CLIENT_ID},201);
  }

  if (url.pathname === "/api/account/google/complete" && request.method === "POST") {
    if (!isGoogleWebClientId(env.GOOGLE_WEB_CLIENT_ID)) return ctx.json({error:"Google ainda não configurado."},503);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipLimit = await limited(ctx,env,"google-complete-ip",ip,12,900);
    if (ipLimit) return ipLimit;
    const body = await ctx.readBody(request, 16384);
    if (body.__bodyError || !["link","login"].includes(body.purpose)
        || typeof body.nonce !== "string" || !/^[0-9a-f-]{73}$/i.test(body.nonce)
        || typeof body.idToken !== "string") return ctx.json({error:"Credencial Google inválida."},400);
    let player = null;
    if (body.purpose === "link") {
      const playerId = await ctx.gameIdentity(request,env);
      if (!playerId) return ctx.json({error:"Sessão do reino inválida. Não é possível vincular."},401);
      player = await env.DB.prepare("SELECT id,player_id,name FROM players WHERE player_id=?").bind(playerId).first();
      if (!player) return ctx.json({error:"Reino não encontrado."},404);
    }
    let verified;
    try {
      verified = await verifyGoogleIdToken(body.idToken,env.GOOGLE_WEB_CLIENT_ID,body.nonce);
    } catch (error) {
      if (String(error?.message||"").includes("keys_unavailable")) return ctx.json({error:"Google temporariamente indisponível."},503);
      return ctx.json({error:"Falha na validação segura da conta Google."},401);
    }
    const now = Math.floor(Date.now()/1000);
    // One-use challenge consumed atomically; another request cannot replay a valid ID token.
    const consumed = await env.DB.prepare(
      "UPDATE google_auth_challenges SET consumed_at=? WHERE nonce=? AND purpose=? AND consumed_at IS NULL AND expires_at>? AND " +
      "((purpose='login' AND player_id IS NULL) OR (purpose='link' AND player_id=?))"
    ).bind(now,body.nonce,body.purpose,now,player?.id || null).run();
    if (consumed.meta?.changes !== 1) return ctx.json({error:"Confirmação Google expirada ou já utilizada. Tente novamente."},409);
    const owner = await env.DB.prepare(
      "SELECT l.player_id,p.player_id AS public_player_id,p.name FROM google_account_links l " +
      "JOIN players p ON p.id=l.player_id WHERE l.google_sub=?"
    ).bind(verified.sub).first();
    if (body.purpose === "login") {
      if (!owner) return ctx.json({error:"Esta conta Google ainda não está vinculada a um reino. Abra o reino original e escolha Vincular Google.",code:"GOOGLE_NOT_LINKED"},404);
      player = {id:owner.player_id,player_id:owner.public_player_id,name:owner.name};
    } else {
      if (owner && owner.player_id !== player.id) return ctx.json({error:"Esta conta Google já protege outro reino. Faça login na conta correta."},409);
      const existing = await env.DB.prepare("SELECT google_sub FROM google_account_links WHERE player_id=?").bind(player.id).first();
      if (existing && existing.google_sub !== verified.sub) return ctx.json({error:"Este reino já está vinculado a outra conta Google."},409);
      if (!existing) await env.DB.prepare("INSERT OR IGNORE INTO google_account_links(player_id,google_sub) VALUES(?,?)")
        .bind(player.id,verified.sub).run();
      const linked = await env.DB.prepare("SELECT google_sub FROM google_account_links WHERE player_id=?").bind(player.id).first();
      if (!linked || linked.google_sub !== verified.sub) return ctx.json({error:"O vínculo Google não foi concluído. Nenhum reino foi substituído."},409);
    }
    const account = await env.DB.prepare("SELECT session_version FROM player_accounts WHERE player_id=?").bind(player.id).first();
    const google = await env.DB.prepare("SELECT session_version FROM google_account_links WHERE player_id=? AND google_sub=?")
      .bind(player.id,verified.sub).first();
    if (!google) return ctx.json({error:"Vínculo Google não encontrado."},409);
    const sessionVersion = Number(account?.session_version ?? google.session_version);
    const token = await issueGameToken(String(player.player_id),sessionVersion,env.SESSION_SECRET);
    return ctx.json({success:true,token,googleLinked:true,player:{player_id:player.player_id,name:player.name}});
  }

  if (url.pathname === "/api/account/login" && request.method === "POST") {
    const body = await ctx.readBody(request, 8192);
    if (body.__bodyError) return ctx.json({ error: "Solicitação de login inválida." }, 400);
    const identifier = String(body.identifier || body.username || "").normalize("NFKC").trim().toLowerCase();
    const password = String(body.password || "");
    if (!identifier || identifier.length > 254 || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      return ctx.json({ error: "Usuário/e-mail ou senha inválidos." }, 400);
    }
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipLimit = await limited(ctx, env, "account-login-ip", ip, 12, 900);
    if (ipLimit) return ipLimit;
    const accountLimit = await limited(ctx, env, "account-login-identifier", identifier, 8, 900);
    if (accountLimit) return accountLimit;

    const account = await env.DB.prepare(
      "SELECT a.username,a.email,a.password_salt,a.password_hash,a.password_iterations,a.session_version,p.player_id,p.name " +
      "FROM player_accounts a JOIN players p ON p.id=a.player_id " +
      "WHERE a.username_key=? OR a.email_key=? LIMIT 1"
    ).bind(identifier, identifier).first();
    const valid = account ? await verifyPasswordRecord(password, account) : false;
    if (!valid) return ctx.json({ error: "Usuário/e-mail ou senha inválidos." }, 401);

    const token = await issueGameToken(String(account.player_id), Number(account.session_version), env.SESSION_SECRET);
    return ctx.json({
      success: true,
      token,
      player: { player_id: account.player_id, name: account.name },
      account: { username: account.username, emailMasked: maskAccountEmail(account.email) }
    });
  }

  if (url.pathname === "/api/account/status" && request.method === "GET") {
    const playerId = await ctx.gameIdentity(request, env);
    if (!playerId) return ctx.json({ error: "Sessão do jogador inválida." }, 401);
    const account = await env.DB.prepare(
      "SELECT a.username,a.email,a.created_at FROM player_accounts a " +
      "JOIN players p ON p.id=a.player_id WHERE p.player_id=?"
    ).bind(playerId).first();
    const googleLink = await env.DB.prepare(
      "SELECT l.linked_at FROM google_account_links l JOIN players p ON p.id=l.player_id WHERE p.player_id=?"
    ).bind(playerId).first();
    return ctx.json({ hasAccount: Boolean(account || googleLink), googleLinked: Boolean(googleLink), account: account ? {
      username: account.username, emailMasked: maskAccountEmail(account.email), created_at: account.created_at,
      googleLinked: Boolean(googleLink)
    } : googleLink ? {username:null,emailMasked:null,created_at:googleLink.linked_at,googleLinked:true} : null });
  }

  if (url.pathname === "/api/account/register" && request.method === "POST") {
    const playerId = await ctx.gameIdentity(request, env);
    if (!playerId) return ctx.json({ error: "Entre no reino existente antes de vincular sua conta." }, 401);
    const body = await ctx.readBody(request, 8192);
    if (body.__bodyError) return ctx.json({ error: "Cadastro inválido." }, 400);
    const username = validateAccountUsername(body.username);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (!username) return ctx.json({ error: "Use um nome de usuário de 3 a 24 caracteres: letras, números, ponto, hífen ou sublinhado." }, 400);
    if (!email) return ctx.json({ error: "Informe um e-mail válido ou deixe o campo vazio." }, 400);
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      return ctx.json({ error: "A senha deve ter entre 12 e 128 caracteres." }, 400);
    }
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipLimit = await limited(ctx, env, "account-register-ip", ip, 5, 3600);
    if (ipLimit) return ipLimit;
    const playerLimit = await limited(ctx, env, "account-register-player", playerId, 3, 3600);
    if (playerLimit) return playerLimit;

    const player = await env.DB.prepare("SELECT id,player_id FROM players WHERE player_id=?").bind(playerId).first();
    if (!player) return ctx.json({ error: "Jogador não encontrado." }, 404);
    const existing = await env.DB.prepare("SELECT id FROM player_accounts WHERE player_id=?").bind(player.id).first();
    if (existing) return ctx.json({ error: "Este reino já está vinculado a uma conta." }, 409);

    const record = await createPasswordRecord(password);
    let sessionVersion;
    try {
      // Password accounts take precedence over Google links in gameIdentity.
      // Never reset the effective version: previously revoked Google tokens
      // could otherwise become valid again when a password is registered.
      const inserted = await env.DB.prepare(
        "INSERT INTO player_accounts(player_id,username,username_key,email,email_key,password_salt,password_hash,password_iterations,session_version) " +
        "SELECT ?,?,?,?,?,?,?,?,COALESCE((SELECT session_version FROM google_account_links WHERE player_id=?),0)+1 " +
        "RETURNING session_version"
      ).bind(player.id, username.display, username.key, email.display, email.key, record.salt, record.hash, record.iterations, player.id).first();
      sessionVersion = Number(inserted?.session_version);
      if (!Number.isSafeInteger(sessionVersion) || sessionVersion < 1) throw new Error("Invalid account session version");
    } catch (error) {
      const message = String(error?.message || error);
      if (message.includes("UNIQUE")) return ctx.json({ error: "Este nome de usuário ou e-mail já está em uso." }, 409);
      console.error("account_register_failed", message);
      return ctx.json({ error: "Não foi possível proteger este reino com uma conta." }, 500);
    }

    // A versão de sessão passa a exigir o claim av; tokens anônimos antigos deixam de autenticar este reino.
    const token = await issueGameToken(String(player.player_id), sessionVersion, env.SESSION_SECRET);
    return ctx.json({ success: true, token, account: { username: username.display, emailMasked: maskAccountEmail(email.display) } }, 201);
  }

  if (url.pathname === "/api/account/logout" && request.method === "POST") {
    const playerId = await ctx.gameIdentity(request, env);
    if (!playerId) return ctx.json({ error: "Sessão do jogador inválida." }, 401);
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE player_accounts SET session_version=session_version+1,updated_at=CURRENT_TIMESTAMP " +
        "WHERE player_id=(SELECT id FROM players WHERE player_id=?)"
      ).bind(playerId),
      env.DB.prepare(
        "UPDATE google_account_links SET session_version=session_version+1 " +
        "WHERE player_id=(SELECT id FROM players WHERE player_id=?)"
      ).bind(playerId)
    ]);
    return ctx.json({ success: true });
  }

  return ctx.json({ error: "Rota de conta não encontrada." }, 404);
}
