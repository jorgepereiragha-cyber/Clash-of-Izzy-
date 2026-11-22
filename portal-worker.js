// Apenas marketing e downloads: sem rotas de jogo, login, pagamentos ou APIs.
// Deploy separado do Worker principal que atende o aplicativo Android.
const PUBLIC_FILES = new Set([
  "/portal", "/portal.html", "/support", "/support.html", "/favicon.svg",
  "/styles/coi-theme.css", "/assets/brand/hero-emblem.svg", "/assets/brand/royal-king.webp"
]);
const publicHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

// A única integração financeira da página promocional é um link externo
// de contribuição voluntária configurado pelo responsável do projeto.
// Não há D1, checkout autenticado, crédito de gemas ou alteração de jogadores.
function approvedPaymentLink(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const link = new URL(value);
    const host = link.hostname.toLowerCase();
    const validHost = host === "mercadopago.com.br"
      || host.endsWith(".mercadopago.com.br")
      || host === "mercadopago.com"
      || host.endsWith(".mercadopago.com");
    if (link.protocol !== "https:" || !validHost || link.username || link.password || link.port
      || link.hash || link.pathname === "/" || link.pathname.includes("..")) return null;
    return link.href;
  } catch {
    return null;
  }
}

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
    if (url.pathname === "/support-link.json") {
      // Never expose tokens, bank details or direct Pix keys in the portal.
      const paymentUrl = approvedPaymentLink(env.SUPPORT_PAYMENT_URL);
      const body = request.method === "HEAD" ? null : JSON.stringify(
        paymentUrl ? { enabled: true, url: paymentUrl } : { enabled: false }
      );
      return new Response(body, {
        status: 200,
        headers: { ...publicHeaders, "Content-Type": "application/json; charset=utf-8" }
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
