import { pathToFileURL } from "node:url";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Read-only forensic probe for the public account-status endpoint.
 * Captures one GET response so status, headers and body belong to the same request.
 * Set-cookie is intentionally excluded from logs.
 */
export async function diagnoseProductionEndpoint({
  url = process.env.PRODUCTION_DIAGNOSTIC_URL,
  fetchImpl = fetch,
  logger = console,
  timeoutMs = 12_000,
} = {}) {
  assert(typeof url === "string" && url.trim(), "PRODUCTION_DIAGNOSTIC_URL não foi informado.");

  const endpoint = new URL(url);
  assert(endpoint.protocol === "https:", "O endpoint de diagnóstico deve usar HTTPS.");
  assert(!endpoint.username && !endpoint.password, "A URL de diagnóstico não pode conter credenciais.");

  const response = await fetchImpl(endpoint, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: "application/json",
      "User-Agent": "Clash-of-Izzy-production-forensic-diagnostic/1.0",
    },
  });

  const responseHeaders = {};
  for (const [name, value] of response.headers.entries()) {
    if (name.toLowerCase() !== "set-cookie") responseHeaders[name] = value;
  }

  const body = await response.text();
  const maxBodyChars = 4_000;
  const diagnostic = {
    request: {
      method: "GET",
      url: endpoint.toString(),
    },
    response: {
      status: response.status,
      statusText: response.statusText || "",
      finalUrl: response.url || null,
      redirected: Boolean(response.redirected),
      type: response.type || null,
      headers: responseHeaders,
      bodyLength: body.length,
      bodyPreview: body.length > maxBodyChars
        ? body.slice(0, maxBodyChars) + "\n[CORPO TRUNCADO APÓS 4000 CARACTERES]"
        : body,
    },
  };

  logger.log(
    "=== DIAGNÓSTICO FORENSE DO ENDPOINT DE CONTA (SOMENTE LEITURA) ===\n" +
    JSON.stringify(diagnostic, null, 2)
  );

  return diagnostic;
}

async function main() {
  try {
    const result = await diagnoseProductionEndpoint();
    if (result.response.status !== 401) {
      console.error(
        "O endpoint não retornou o 401 esperado; o status foi registrado acima para investigação."
      );
    }
  } catch (error) {
    console.error(
      "Falha ao executar diagnóstico: " +
      String(error?.name || "Error") +
      ": " +
      String(error?.message || error)
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
