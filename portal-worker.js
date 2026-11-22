// Portal de marketing isolado: sem gameplay, autenticacao, D1 ou checkout.
// A unica rota API permitida retorna metadados PUBLICOS de uma release oficial.
const PUBLIC_FILES = new Set([
  "/portal", "/portal.html", "/apoie", "/apoie.html", "/favicon.svg",
  "/styles/coi-theme.css", "/assets/brand/hero-emblem.svg", "/assets/brand/royal-king.webp"
]);
const publicHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const REPOSITORY = "jorgepereiragha-cyber/Clash-of-Izzy-";
const GITHUB_RELEASE_API = "https://api.github.com/repos/" + REPOSITORY + "/releases/latest";
const APK_FILENAME = "clash-of-izzy-android.apk";
const DOWNLOAD_PREFIX = "/" + REPOSITORY + "/releases/download/";

export function validateOfficialRelease(release) {
  if (!release || release.draft !== false || release.prerelease !== false ||
      !/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(release.tag_name) || !Array.isArray(release.assets)) return null;
  const expectedPath = name => DOWNLOAD_PREFIX + release.tag_name + "/" + name;
  const validAsset = name => release.assets.find(asset => {
    if (!asset || asset.name !== name || asset.state !== "uploaded" ||
        !Number.isSafeInteger(asset.size) || asset.size <= 0) return false;
    try {
      const url = new URL(asset.browser_download_url);
      return url.protocol === "https:" && url.hostname === "github.com" &&
        url.pathname === expectedPath(name) && url.search === "" && url.hash === "";
    } catch { return false; }
  });
  const apk = validAsset(APK_FILENAME);
  const checksum = validAsset(APK_FILENAME + ".sha256");
  if (!apk || !checksum) return null;
  // Nao encaminhar outros campos da API do GitHub ou URLs nao aprovadas.
  return {
    draft: false, prerelease: false, tag_name: release.tag_name,
    assets: [apk, checksum].map(asset => ({
      name: asset.name, state: "uploaded", size: asset.size,
      browser_download_url: asset.browser_download_url
    }))
  };
}

export async function readOfficialRelease(fetchImpl = fetch) {
  try {
    const upstream = await fetchImpl(GITHUB_RELEASE_API, {
      method: "GET",
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": "Clash-of-Izzy-Portal-ReadOnly"
      },
      signal: AbortSignal.timeout(8000),
      redirect: "error"
    });
    if (upstream.status === 404) return { status: 404, body: { available: false } };
    if (upstream.status !== 200) return { status: 503, body: { available: false } };
    const release = validateOfficialRelease(await upstream.json());
    if (!release) return { status: 404, body: { available: false } };
    return { status: 200, body: release };
  } catch {
    return { status: 503, body: { available: false } };
  }
}
export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    // Nunca aceitar mutacoes, inclusive na consulta da release.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Método não permitido no portal de divulgação.", {
        status: 405, headers: { ...publicHeaders, "Allow": "GET, HEAD" }
      });
    }
    if (url.pathname === "/api/android/latest") {
      if (url.search) return new Response('{"available":false}', {
        status: 400, headers: { ...publicHeaders, "Content-Type": "application/json" }
      });
      // Cache positivo na borda por 60 segundos, nunca cachear erros/ausencia.
      const cache = globalThis.caches?.default;
      const key = new Request(url.origin + url.pathname);
      try {
        const cached = await cache?.match(key);
        if (cached) return request.method === "HEAD"
          ? new Response(null, {status: cached.status, headers: cached.headers})
          : cached;
      } catch { /* Ambiente local pode nao disponibilizar cache. */ }
      const {status, body} = await readOfficialRelease();
      const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": status === 200 ? "public, max-age=60" : status === 404 ? "public, max-age=30" : "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-COI-Release-Proxy": "v1"
      };
      const result = new Response(request.method === "HEAD" ? null : JSON.stringify(body), {status, headers});
      if ((status === 200 || status === 404) && cache && context?.waitUntil) {
        const cacheResponse = new Response(JSON.stringify(body), {status, headers});
        context.waitUntil(cache.put(key, cacheResponse).catch(() => {}));
      }
      return result;
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const target = new URL("/portal.html", url);
      target.search = url.search;
      return new Response(null, {status: 302, headers: {...publicHeaders, "Location": target.toString()}});
    }
    if (!PUBLIC_FILES.has(url.pathname)) {
      return new Response("Página indisponível neste endereço. Instale o app Android pelo portal oficial.", {
        status: 404,
        headers: {...publicHeaders, "Content-Type": "text/plain; charset=utf-8"}
      });
    }
    return env.ASSETS.fetch(request);
  }
};
