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
      account: { username: account.username, email: account.email }
    });
  }

  if (url.pathname === "/api/account/status" && request.method === "GET") {
    const playerId = await ctx.gameIdentity(request, env);
    if (!playerId) return ctx.json({ error: "Sessão do jogador inválida." }, 401);
    const account = await env.DB.prepare(
      "SELECT a.username,a.email,a.created_at FROM player_accounts a " +
      "JOIN players p ON p.id=a.player_id WHERE p.player_id=?"
    ).bind(playerId).first();
    return ctx.json({ hasAccount: Boolean(account), account: account ? {
      username: account.username, email: account.email, created_at: account.created_at
    } : null });
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
    try {
      await env.DB.prepare(
        "INSERT INTO player_accounts(player_id,username,username_key,email,email_key,password_salt,password_hash,password_iterations) " +
        "VALUES(?,?,?,?,?,?,?,?)"
      ).bind(player.id, username.display, username.key, email.display, email.key, record.salt, record.hash, record.iterations).run();
    } catch (error) {
      const message = String(error?.message || error);
      if (message.includes("UNIQUE")) return ctx.json({ error: "Este nome de usuário ou e-mail já está em uso." }, 409);
      console.error("account_register_failed", message);
      return ctx.json({ error: "Não foi possível proteger este reino com uma conta." }, 500);
    }

    // A versão de sessão passa a exigir o claim av; tokens anônimos antigos deixam de autenticar este reino.
    const token = await issueGameToken(String(player.player_id), 1, env.SESSION_SECRET);
    return ctx.json({ success: true, token, account: { username: username.display, email: email.display } }, 201);
  }

  if (url.pathname === "/api/account/logout" && request.method === "POST") {
    const playerId = await ctx.gameIdentity(request, env);
    if (!playerId) return ctx.json({ error: "Sessão do jogador inválida." }, 401);
    await env.DB.prepare(
      "UPDATE player_accounts SET session_version=session_version+1,updated_at=CURRENT_TIMESTAMP " +
      "WHERE player_id=(SELECT id FROM players WHERE player_id=?)"
    ).bind(playerId).run();
    return ctx.json({ success: true });
  }

  return ctx.json({ error: "Rota de conta não encontrada." }, 404);
}
