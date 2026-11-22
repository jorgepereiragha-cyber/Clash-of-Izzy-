// Google Identity Services verifier for Cloudflare Workers (Web Crypto).
// Never trust browser-supplied e-mail, sub, or unsigned JWT claims.
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export function isGoogleWebClientId(value) {
  return typeof value === "string" && /^[0-9]{6,}-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(value);
}
function decodeBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value) || value.length > 12000) throw Error("invalid_base64");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)), c => c.charCodeAt(0));
}
function decodeJson(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}
export async function verifyGoogleIdToken(jwt, clientId, nonce, fetchKeys = fetch, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!isGoogleWebClientId(clientId) || typeof nonce !== "string" || !/^[0-9a-f-]{73}$/i.test(nonce)
      || typeof jwt !== "string" || jwt.length > 12000) throw Error("invalid_google_token");
  const parts = jwt.split(".");
  if (parts.length !== 3) throw Error("invalid_google_token");
  const [header, claims] = parts.slice(0, 2).map(decodeJson);
  if (!header || header.alg !== "RS256" || typeof header.kid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(header.kid)) throw Error("invalid_google_header");
  if (!claims || !["https://accounts.google.com","accounts.google.com"].includes(claims.iss)
      || claims.aud !== clientId
      // Android may have a different authorized-party client than the Web audience.
      // Google's signed audience remains the authoritative backend check.
      || (claims.azp !== undefined && typeof claims.azp !== "string")
      || claims.nonce !== nonce || !/^[0-9]{6,64}$/.test(String(claims.sub || ""))
      || !Number.isSafeInteger(claims.iat) || claims.iat > nowSeconds + 60 || claims.iat < nowSeconds - 3700
      || !Number.isSafeInteger(claims.exp) || claims.exp <= nowSeconds || claims.exp > nowSeconds + 3700
      || (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > nowSeconds + 60)))
    throw Error("invalid_google_claims");
  const response = await fetchKeys(GOOGLE_JWKS_URL, {headers: {Accept:"application/json"}, signal:AbortSignal.timeout(8000)});
  if (!response.ok) throw Error("google_keys_unavailable");
  const jwks = await response.json();
  if (!Array.isArray(jwks?.keys) || jwks.keys.length > 20) throw Error("invalid_google_keys");
  const jwk = jwks.keys.find(key => key.kid === header.kid && key.kty === "RSA" &&
    (!key.use || key.use === "sig") && (!key.alg || key.alg === "RS256"));
  if (!jwk) throw Error("google_key_not_found");
  const publicKey = await crypto.subtle.importKey("jwk", jwk, {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"}, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, decodeBase64Url(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!valid) throw Error("invalid_google_signature");
  return {sub:String(claims.sub)};
}
