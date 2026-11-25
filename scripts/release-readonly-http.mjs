// Node-only, GET-only release preflight. All target URLs are fixed by callers.
// No request body, credentials, redirects or writes are permitted.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 150;
function sanitizedNetworkCode(error) {
  const raw = error?.cause?.code ?? error?.code;
  return typeof raw === "string" && /^[A-Z0-9_]{1,32}$/.test(raw) ? raw : "UNKNOWN";
}
function safePath(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
      parsed.search || parsed.hash) {
    throw new Error("Endpoint do gate de release inválido.");
  }
  return parsed.pathname;
}
export async function readReleaseJson(fetchImpl, url) {
  const path = safePath(url);
  if (typeof fetchImpl !== "function") throw new TypeError("fetch indisponível.");
  let response;
  for (let index = 0; index < MAX_ATTEMPTS; index++) {
    try {
      response = await fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12000)
      });
      break;
    } catch (error) {
      // Only transport exceptions on idempotent GET are retried; never HTTP
      // statuses, redirects, invalid responses, or business rule failures.
      if (index + 1 === MAX_ATTEMPTS) {
        throw new Error("GET " + path + ": falha de transporte após " +
          MAX_ATTEMPTS + " tentativas (código " + sanitizedNetworkCode(error) + ").");
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (index + 1)));
    }
  }
  if (response?.type === "opaqueredirect" ||
      (Number.isInteger(response?.status) && response.status >= 300 && response.status < 400)) {
    throw new Error("Redirecionamento HTTP bloqueado no gate GET " + path +
      " (status " + String(response?.status ?? 0) + ").");
  }
  if (!response || response.status !== 200) {
    throw new Error("API pública indisponível em " + path +
      " (HTTP " + String(response?.status ?? 0) + ").");
  }
  const value = await response.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Resposta JSON inválida em " + path + ".");
  }
  return { value, status: response.status };
}
