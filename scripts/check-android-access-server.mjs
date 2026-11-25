import { pathToFileURL } from "node:url";
export const HEALTH_URL = "https://clash-of-izzy-beta.jorgepereiragha.workers.dev/api/health";
export async function checkAccessServer(fetchImpl = fetch) {
  const response = await fetchImpl(HEALTH_URL, {redirect:"error",cache:"no-store",headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)});
  const body = await response.json().catch(() => null);
  if (response.status !== 200 || body?.ok !== true || body.status !== "ready" ||
      body.androidApiContract !== "eldoria-android-v1" ||
      !["database","session","schema"].every(k => body.checks?.[k] === true) ||
      !Array.isArray(body.missingTables) || body.missingTables.length !== 0 ||
      !Array.isArray(body.missingTriggers) || body.missingTriggers.length !== 0)
    throw new Error("Servidor por convite indisponível ou incompleto: distribuição bloqueada.");
  const access = await fetchImpl(new URL("/kingdom.html", HEALTH_URL).href,{redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(15000)});
  if (![302,303,307,308].includes(access.status) ||
      new URL(access.headers.get("location") || "/",HEALTH_URL).href !== new URL("/beta-access.html",HEALTH_URL).href)
    throw new Error("Proteção de acesso por convite não confirmada.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await checkAccessServer(); console.log("Servidor e convite validados."); }
  catch(e) { console.error(e.message); process.exitCode = 1; }
}
