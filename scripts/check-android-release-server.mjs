import { pathToFileURL } from "node:url";
import { readReleaseJson } from "./release-readonly-http.mjs";

export const LIVE_API_URL = "https://clash-of-izzy.jorgepereiragha.workers.dev/api/health";
export const REQUIRED_ANDROID_CONTRACT = "eldoria-android-v1";

export function assertAndroidReleaseServer(health, httpStatus) {
  if (httpStatus !== 200 || !health || typeof health !== "object") {
    throw new Error("API de produção indisponível ou resposta inválida: release Android bloqueada.");
  }
  if (health.androidApiContract !== REQUIRED_ANDROID_CONTRACT) {
    throw new Error("O Worker de produção ainda não contém o contrato de Eldoria requerido pelo aplicativo.");
  }
  const checks = health.checks || {};
  if (health.ok !== true || health.status !== "ready" ||
      checks.database !== true || checks.session !== true || checks.schema !== true) {
    throw new Error("Backend ou banco D1 de produção não está pronto para o APK oficial.");
  }
  if (!Array.isArray(health.missingTables) || health.missingTables.length !== 0) {
    throw new Error("Há tabelas D1 ausentes no backend de produção.");
  }
  return { compatible: true, contract: REQUIRED_ANDROID_CONTRACT };
}

export async function checkAndroidReleaseServer(fetchImpl = fetch) {
  const {value:health,status} = await readReleaseJson(fetchImpl,LIVE_API_URL);
  return assertAndroidReleaseServer(health,status);
}

async function main() {
  try {
    const result = await checkAndroidReleaseServer();
    console.log("Backend Android pronto: " + result.contract + " / schema D1 validado.");
  } catch (error) {
    console.error("APK oficial não publicado: " + String(error?.message || error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
