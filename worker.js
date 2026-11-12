const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors }
  });
}
function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return body + "." + b64url(sig);
}
async function verify(token, secret) {
  try {
    const [body, signature] = token.split(".");
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const bytes = Uint8Array.from(atob(signature.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(body));
    if (!valid) return false;
    const payload = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }
    if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
    if (!env.DB) return json({ error: "Banco D1 não vinculado ao Worker." }, 503);

    const body = await readBody(request);

    if (url.pathname === "/api/admin/login") {
      if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
        return json({ error: "Configure ADMIN_EMAIL, ADMIN_PASSWORD e SESSION_SECRET nos segredos do Worker." }, 503);
      }
      if (body.email !== env.ADMIN_EMAIL || body.password !== env.ADMIN_PASSWORD) {
        return json({ error: "E-mail ou senha incorretos." }, 401);
      }
      const token = await sign({ sub: "admin", exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 }, env.SESSION_SECRET);
      return json({ token, expiresIn: 28800 });
    }

    const authorization = request.headers.get("Authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!env.SESSION_SECRET || !(await verify(token, env.SESSION_SECRET))) {
      return json({ error: "Sessão inválida ou expirada. Entre novamente." }, 401);
    }

    try {
      if (url.pathname === "/api/admin/player-search") {
        const id = String(body.playerId || "").trim();
        if (!id) return json({ error: "Informe o ID do jogador." }, 400);
        const player = await env.DB.prepare(
          "SELECT id, player_id, name, gems, created_at FROM players WHERE player_id = ?"
        ).bind(id).first();
        return player ? json({ player }) : json({ error: "Jogador não encontrado no banco." }, 404);
      }

      if (url.pathname === "/api/admin/gems") {
        const id = String(body.playerId || "").trim();
        const amount = Number(body.amount);
        if (!id || !Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000) {
          return json({ error: "ID ou quantidade de gemas inválida." }, 400);
        }
        const result = await env.DB.prepare(
          "UPDATE players SET gems = gems + ? WHERE player_id = ?"
        ).bind(amount, id).run();
        if (!result.meta.changes) return json({ error: "Jogador não encontrado." }, 404);
        const player = await env.DB.prepare("SELECT player_id, gems FROM players WHERE player_id = ?").bind(id).first();
        return json({ success: true, player });
      }

      if (url.pathname === "/api/admin/unlock-skin") {
        const id = String(body.playerId || "").trim();
        const name = String(body.skin || "").trim();
        if (!id || !name) return json({ error: "Informe o ID do jogador e a skin." }, 400);
        const player = await env.DB.prepare("SELECT id FROM players WHERE player_id = ?").bind(id).first();
        if (!player) return json({ error: "Jogador não encontrado." }, 404);
        const skin = await env.DB.prepare("SELECT id FROM skins WHERE name = ?").bind(name).first();
        if (!skin) return json({ error: "Skin não cadastrada no catálogo." }, 404);
        await env.DB.prepare(
          "INSERT OR IGNORE INTO player_skins (player_id, skin_id) VALUES (?, ?)"
        ).bind(player.id, skin.id).run();
        return json({ success: true, message: "Skin liberada para o jogador." });
      }

      if (url.pathname === "/api/admin/vip-packages") {
        const name = String(body.name || "").trim();
        const price = Number(body.price);
        const gems = Number(body.gems);
        if (!name || !Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(gems) || gems < 0) {
          return json({ error: "Dados do pacote VIP inválidos." }, 400);
        }
        await env.DB.prepare(
          "INSERT INTO vip_packages (name, price_brl, gems) VALUES (?, ?, ?)"
        ).bind(name, price, gems).run();
        return json({ success: true, message: "Pacote VIP cadastrado." });
      }

      if (url.pathname === "/api/admin/skins") {
        const name = String(body.name || "").trim();
        const price = Number(body.price);
        if (!name || !Number.isFinite(price) || price < 50 || price > 1000) {
          return json({ error: "Informe nome e preço entre R$ 50 e R$ 1.000." }, 400);
        }
        const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM skins").first();
        if (count.total >= 200) return json({ error: "Limite de 200 skins atingido." }, 409);
        await env.DB.prepare(
          "INSERT INTO skins (name, price_brl) VALUES (?, ?)"
        ).bind(name, price).run();
        return json({ success: true, message: "Skin cadastrada no catálogo." });
      }

      return json({ error: "Rota não encontrada." }, 404);
    } catch (error) {
      return json({ error: "Erro interno ao processar a solicitação." }, 500);
    }
  }
};
