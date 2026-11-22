// Apenas marketing e downloads: sem rotas de jogo, login, pagamentos ou APIs.
// Deploy separado do Worker principal que atende o aplicativo Android.
const PUBLIC_FILES = new Set([
  "/portal", "/portal.html", "/favicon.svg",
  "/styles/coi-theme.css", "/assets/brand/hero-emblem.svg", "/assets/brand/royal-king.webp"
]);
const publicHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Na hospedagem promocional não há WebSocket, API nem métodos de escrita.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Método não permitido no portal de divulgação.", {
        status: 405, headers: { ...publicHeaders, "Allow": "GET, HEAD" }
      });
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const target = new URL("/portal.html", url);
      target.search = url.search; // Preservar parâmetros UTM das campanhas.
      return new Response(null, {
        status: 302,
        headers: { ...publicHeaders, "Location": target.toString() }
      });
    }
    if (!PUBLIC_FILES.has(url.pathname)) {
      return new Response("Página indisponível neste endereço. Instale o app Android pelo portal oficial.", {
        status: 404,
        headers: { ...publicHeaders, "Content-Type": "text/plain; charset=utf-8" }
      });
    }
    return env.ASSETS.fetch(request);
  }
};
