const RATE_LIMIT_SQL = `
INSERT INTO api_rate_limits(rate_key,window_started_at,request_count,expires_at)
VALUES(?,?,1,?)
ON CONFLICT(rate_key) DO UPDATE SET
  request_count=CASE
    WHEN api_rate_limits.window_started_at=excluded.window_started_at
    THEN api_rate_limits.request_count+1
    ELSE 1
  END,
  window_started_at=excluded.window_started_at,
  expires_at=excluded.expires_at
WHERE api_rate_limits.window_started_at<=excluded.window_started_at
RETURNING request_count,window_started_at
`;

const encoder = new TextEncoder();

async function digestKey(secret, scope, identity) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(scope + ":" + String(identity).slice(0, 256))
  );
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Atomically consumes one request from a fixed UTC window.
 * Only a keyed digest is persisted; raw IP addresses and account identifiers are not stored.
 */
export async function consumeRateLimit({
  db,
  secret,
  scope,
  identity,
  limit,
  windowSeconds,
  nowSeconds = Math.floor(Date.now() / 1000)
}) {
  if (!db || !secret) throw new Error("Rate limiting requires D1 and SESSION_SECRET.");
  const safeLimit = Math.max(1, Math.min(100000, Math.floor(Number(limit) || 1)));
  const safeWindow = Math.max(1, Math.min(86400, Math.floor(Number(windowSeconds) || 1)));
  const now = Math.max(0, Math.floor(Number(nowSeconds) || 0));
  const windowStartedAt = Math.floor(now / safeWindow) * safeWindow;
  const rateKey = await digestKey(secret, String(scope || "default").slice(0, 64), identity);
  const row = await db.prepare(RATE_LIMIT_SQL)
    .bind(rateKey, windowStartedAt, windowStartedAt + safeWindow * 2)
    .first();
  if (!row) {
    // A delayed request from an older window must not roll the counter backwards.
    // Treat that stale request as blocked; the next request uses the current window.
    const current = await db.prepare(
      "SELECT request_count,window_started_at FROM api_rate_limits WHERE rate_key=?"
    ).bind(rateKey).first();
    if (!current || !Number.isSafeInteger(Number(current.request_count))) {
      throw new Error("Rate limit storage returned an invalid counter.");
    }
    const resetAt = Number(current.window_started_at) + safeWindow;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, resetAt - now),
      resetAt
    };
  }
  if (!Number.isSafeInteger(Number(row.request_count))) {
    throw new Error("Rate limit storage returned an invalid counter.");
  }
  return {
    allowed: Number(row.request_count) <= safeLimit,
    remaining: Math.max(0, safeLimit - Number(row.request_count)),
    retryAfterSeconds: Math.max(1, windowStartedAt + safeWindow - now),
    resetAt: windowStartedAt + safeWindow
  };
}
