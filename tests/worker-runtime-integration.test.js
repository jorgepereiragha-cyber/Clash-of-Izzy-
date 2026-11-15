import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const SESSION_SECRET = "clash-of-izzy-runtime-integration-secret";
const ADMIN_EMAIL = "coi-integration-admin@example.invalid";
const ADMIN_PASSWORD = "coi-integration-admin-password";

function runCli(args, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args], {
      cwd: root,
      env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const append = chunk => {
      output = (output + chunk.toString()).slice(-20_000);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Wrangler ultrapassou o tempo limite.\n" + output));
    }, timeoutMs);
    child.once("error", error => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", code => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error("Wrangler terminou com código " + code + ".\n" + output));
    });
  });
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForWorker(baseUrl, child, getOutput) {
  const deadline = Date.now() + 45_000;
  let lastError = "O Worker ainda não respondeu.";
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("Wrangler encerrou antes de abrir a porta.\n" + getOutput());
    }
    try {
      const response = await fetch(baseUrl + "/api/health", { signal: AbortSignal.timeout(2500) });
      const data = await response.json().catch(() => ({}));
      if (response.status === 200 && data.ok === true) return;
      lastError = "Health respondeu HTTP " + response.status + ": " + JSON.stringify(data);
    } catch (error) {
      lastError = String(error?.message || error);
    }
    await delay(350);
  }
  throw new Error("Worker local não ficou pronto: " + lastError + "\n" + getOutput());
}

function makeApi(baseUrl) {
  return async function api(route, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.token) headers.Authorization = "Bearer " + options.token;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(baseUrl + route, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data, headers: response.headers };
  };
}

function expectStatus(result, expected, label) {
  const accepted = Array.isArray(expected) ? expected : [expected];
  assert.ok(
    accepted.includes(result.status),
    label + " deveria responder " + accepted.join("/") +
      ", recebeu " + result.status + ": " + JSON.stringify(result.data)
  );
  assert.ok(result.status < 500, label + " não pode gerar erro interno: " + JSON.stringify(result.data));
  return result.data;
}

test("Worker + D1: rotas, autenticação e 34 ações do jogo em fluxos reais", { timeout: 240_000 }, async t => {
  const persistDir = await mkdtemp(path.join(os.tmpdir(), "coi-d1-runtime-"));
  let workerProcess = null;
  let workerOutput = "";
  try {
    await runCli([
      "--config", "wrangler.jsonc",
      "d1", "migrations", "apply", "clash-of-izzy-db",
      "--local", "--persist-to", persistDir,
    ]);

    const port = await freePort();
    const baseUrl = "http://127.0.0.1:" + port;
    workerProcess = spawn(process.execPath, [
      wrangler,
      "--config", "wrangler.jsonc",
      "dev",
      "--local",
      "--persist-to", persistDir,
      "--ip", "127.0.0.1",
      "--port", String(port),
      "--var",
      "SESSION_SECRET:" + SESSION_SECRET,
      "ADMIN_EMAIL:" + ADMIN_EMAIL,
      "ADMIN_PASSWORD:" + ADMIN_PASSWORD,
      "--log-level", "error",
    ], {
      cwd: root,
      env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const append = chunk => {
      workerOutput = (workerOutput + chunk.toString()).slice(-30_000);
    };
    workerProcess.stdout.on("data", append);
    workerProcess.stderr.on("data", append);

    await waitForWorker(baseUrl, workerProcess, () => workerOutput);
    const api = makeApi(baseUrl);

    const health = await api("/api/health");
    const healthData = expectStatus(health, 200, "health da API");
    assert.equal(healthData.ok, true);
    assert.deepEqual(healthData.missingTables, []);
    assert.equal(health.headers.get("x-frame-options"), "DENY");

    const adminHealth = expectStatus(await api("/api/admin/health"), 200, "health administrativo");
    assert.equal(adminHealth.hasDB, true);
    assert.equal(adminHealth.hasSESSION_SECRET, true);
    assert.equal(adminHealth.hasADMIN_EMAIL, true);
    assert.equal(adminHealth.hasADMIN_PASSWORD, true);

    expectStatus(await api("/api/game/state"), 401, "estado sem sessão");
    expectStatus(await api("/api/game/action", { method: "POST", body: { type: "rename", name: "Sem Token" } }), 401, "ação sem sessão");

    const catalogBefore = expectStatus(await api("/api/store/catalog"), 200, "catálogo público");
    assert.ok(Array.isArray(catalogBefore.skins));
    assert.ok(Array.isArray(catalogBefore.packages));

    const startA = expectStatus(await api("/api/game/start", { method: "POST", body: {} }), 201, "fundação do primeiro reino");
    const startB = expectStatus(await api("/api/game/start", { method: "POST", body: {} }), 201, "fundação do segundo reino");
    const startC = expectStatus(await api("/api/game/start", { method: "POST", body: {} }), 201, "fundação do terceiro reino");
    for (const [label, started] of [["A", startA], ["B", startB], ["C", startC]]) {
      assert.ok(started.token, "reino " + label + " recebeu token");
      assert.ok(started.state?.kingdom?.id, "reino " + label + " foi persistido");
      assert.ok(Array.isArray(started.state?.buildings));
      assert.ok(Array.isArray(started.state?.troops));
      assert.ok(Array.isArray(started.state?.territories));
      assert.ok(Array.isArray(started.state?.queues));
    }
    const tokenA = startA.token, tokenB = startB.token, tokenC = startC.token;
    let stateA = startA.state;
    const kingdomA = Number(stateA.kingdom.id);
    const kingdomB = Number(startB.state.kingdom.id);
    const kingdomC = Number(startC.state.kingdom.id);
    const playerA = stateA.player.player_id;

    await t.test("estado, busca, eventos e sessão autenticada", async () => {
      const state = expectStatus(await api("/api/game/state", { token: tokenA }), 200, "estado autenticado");
      assert.equal(Number(state.kingdom.id), kingdomA);
      assert.ok(state.equipment?.length >= 4, "equipamentos iniciais carregados");
      assert.ok(state.heroInventory?.length >= 1, "herói inicial sincronizado");
      expectStatus(await api("/api/game/players/search?q=Beta", { token: tokenA }), 200, "busca de jogadores");
      expectStatus(await api("/api/game/search?q=Eldoria&kind=all", { token: tokenA }), 200, "busca global do jogo");
      expectStatus(await api("/api/game/event", { token: tokenA }), 200, "estado do Anjo da Morte");
      expectStatus(await api("/api/game/event/attack", {
        method: "POST", token: tokenA, body: { requestId: "nao-e-uuid" },
      }), 400, "ataque do evento com identificador inválido");
      expectStatus(await api("/api/store/purchase-request", {
        method: "POST", token: tokenA,
        body: { kind: "invalid", itemId: 1, requestKey: "invalid-request-key-01" },
      }), 400, "pedido de compra inválido");
    });

    const adminLogin = expectStatus(await api("/api/admin/login", {
      method: "POST", body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    }), 200, "login Master");
    assert.ok(adminLogin.token);
    const adminToken = adminLogin.token;
    const admin = (route, body) => api(route, { method: "POST", token: adminToken, body });

    await t.test("painel Master, catálogo e pedidos de compra", async () => {
      expectStatus(await admin("/api/admin/player-search", { query: playerA }), 200, "busca administrativa de jogador");
      expectStatus(await admin("/api/admin/gems", { playerId: playerA, amount: 10 }), 200, "crédito administrativo de gemas");
      expectStatus(await admin("/api/admin/gems", { playerId: playerA, amount: 0 }), 400, "bloqueio de crédito inválido");

      expectStatus(await admin("/api/admin/vip-packages", {
        name: "Pacote de integração", price: 1, gems: 100,
      }), 200, "criação de pacote VIP");
      expectStatus(await admin("/api/admin/skins", {
        name: "Skin de integração", price: 50,
      }), 200, "criação de skin");
      expectStatus(await admin("/api/admin/skins", {
        name: "Skin inválida", price: 10,
      }), 400, "bloqueio de preço de skin inválido");

      const catalog = expectStatus(await api("/api/store/catalog"), 200, "catálogo atualizado");
      const vip = catalog.packages.find(item => item.name === "Pacote de integração");
      const skin = catalog.skins.find(item => item.name === "Skin de integração");
      assert.ok(vip?.id, "pacote VIP aparece no catálogo");
      assert.ok(skin?.id, "skin aparece no catálogo");

      expectStatus(await admin("/api/admin/unlock-skin", {
        playerId: playerA, skin: skin.name,
      }), 200, "desbloqueio Master de skin");
      expectStatus(await admin("/api/admin/unlock-skin", {
        playerId: playerA, skin: "Skin inexistente",
      }), 404, "skin inexistente não é liberada");

      const purchase = expectStatus(await api("/api/store/purchase-request", {
        method: "POST", token: tokenA,
        body: {
          kind: "vip_package", itemId: vip.id,
          requestKey: "integration-vip-request-01",
          paymentMethod: "pix", paymentReference: "TESTE-NAO-PAGO",
        },
      }), 201, "criação de pedido VIP");
      assert.ok(purchase.request?.id);
      assert.equal(purchase.request.status, "pending");

      const pending = expectStatus(await admin("/api/admin/purchase-requests", {}), 200, "fila Master de pedidos");
      assert.ok(pending.requests.some(item => Number(item.id) === Number(purchase.request.id)));

      expectStatus(await admin("/api/admin/purchase-requests/review", {
        requestId: purchase.request.id, decision: "approve",
      }), 200, "aprovação idempotente do pedido");
      expectStatus(await admin("/api/admin/purchase-requests/review", {
        requestId: purchase.request.id, decision: "approve",
      }), 409, "bloqueio de aprovação duplicada");

      const skinPurchase = expectStatus(await api("/api/store/purchase-request", {
        method: "POST", token: tokenB,
        body: {
          kind: "skin", itemId: skin.id,
          requestKey: "integration-skin-request-01",
          paymentMethod: "manual",
        },
      }), 201, "pedido de skin de outro jogador");
      expectStatus(await admin("/api/admin/purchase-requests/review", {
        requestId: skinPurchase.request.id, decision: "reject",
      }), 200, "recusa de pedido de skin");
    });

    const executedActions = new Set();
    async function action(token, payload, expected = 200, label = payload.type) {
      executedActions.add(payload.type);
      const result = await api("/api/game/action", { method: "POST", token, body: payload });
      return expectStatus(result, expected, "ação " + label);
    }

    await t.test("nickname, cosméticos, loja e fusão", async () => {
      await action(tokenA, { type: "set_nickname", nickname: "AlphaLord" }, 200);
      await action(tokenB, { type: "set_nickname", nickname: "BetaLord" }, 200);
      await action(tokenC, { type: "set_nickname", nickname: "GammaLord" }, 200);
      await action(tokenA, { type: "set_nickname", nickname: "x" }, 400, "nickname inválido");
      await action(tokenA, { type: "rename", name: "Reino Alfa" }, 200);

      await action(tokenA, { type: "cosmetic_claim", collection: "col_medieval" }, 200);
      await action(tokenA, { type: "cosmetic_claim", collection: "col_medieval" }, 409, "recompensa de coleção duplicada");
      await action(tokenA, { type: "cosmetic_buy", skin: "c7" }, 200);
      await action(tokenA, { type: "skin_fuse", inputs: ["c1", "c2", "c3"] }, 200);
      await action(tokenA, { type: "skin_fuse", inputs: ["c1", "c1", "c2"] }, 400, "fusão com skins repetidas");
      await action(tokenA, { type: "shop_buy", item: "acc_5min", source: "shop" }, 200);
      await action(tokenA, { type: "seasonal_buy", skin: "s1" }, 409, "compra sazonal sem gemas suficientes");
      await action(tokenA, { type: "cosmetic_buy", skin: "skin_inexistente" }, 400, "skin cosmética inválida");
    });

    await t.test("equipamentos, heróis, dragão e combate", async () => {
      stateA = (await api("/api/game/state", { token: tokenA })).data.state;
      const heroId = Number(stateA.heroes?.[0]?.id);
      assert.ok(heroId > 0, "herói inicial tem identidade persistente");

      await action(tokenA, { type: "equipment_upgrade", itemId: "espada_guerreiro" }, 200);
      await action(tokenA, { type: "equipment_equip", itemId: "espada_guerreiro", heroId }, 200);
      await action(tokenA, { type: "equipment_unequip", itemId: "espada_guerreiro", heroId }, 200);
      await action(tokenA, { type: "equipment_lock", itemId: "espada_guerreiro" }, 200);
      await action(tokenA, { type: "equipment_lock", itemId: "espada_guerreiro" }, 200);
      await action(tokenA, { type: "equipment_craft", itemId: "rune_spear" }, [400, 409], "forja com pré-requisitos não concluídos");
      await action(tokenA, { type: "equipment_equip", itemId: "item_inexistente", heroId }, 400, "equipamento inexistente");

      await action(tokenA, { type: "dragon_upgrade" }, 200);
      await action(tokenA, { type: "hero_train", hero: "kael_sunwarden" }, 200);
      await action(tokenA, { type: "hero_summon", quantity: 1 }, 200);
      await action(tokenA, { type: "hero_evolve", hero: "heroi_inexistente" }, 404);
      await action(tokenA, { type: "prestige" }, 409, "prestígio sem castelo nível 30");
      await action(tokenA, { type: "battle" }, 200, "batalha PvE");
    });

    await t.test("filas independentes, validação de tropas e marchas", async () => {
      await action(tokenA, { type: "upgrade", building: "building_invalid" }, 400);
      await action(tokenA, { type: "upgrade", building: "farm" }, 200);
      await action(tokenA, { type: "upgrade", building: "market" }, 409, "segunda construção na mesma fila");

      await action(tokenA, { type: "train", unit: "unit_invalid", quantity: 1 }, 400);
      await action(tokenA, { type: "train", unit: "mage", quantity: 1 }, 200);
      await action(tokenA, { type: "train", unit: "archer", quantity: 1 }, 409, "segundo treinamento na mesma fila");

      await action(tokenA, { type: "research", research: "research_invalid" }, 400);
      await action(tokenA, { type: "research", research: "economy" }, 200);
      await action(tokenA, { type: "research", research: "military" }, 409, "segunda pesquisa na mesma fila");

      stateA = (await api("/api/game/state", { token: tokenA })).data.state;
      const neutral = stateA.territories.find(item => !item.owner_kingdom_id && !item.alliance_id);
      assert.ok(neutral?.id, "mapa possui território neutro para marcha");
      await action(tokenA, { type: "march", targetId: -1, marchType: "gather", units: { militia: 1 } }, 400);
      await action(tokenA, { type: "march", targetId: neutral.id, marchType: "gather", units: { militia: 1 } }, 200);
      stateA = (await api("/api/game/state", { token: tokenA })).data.state;
      assert.ok(stateA.marches.some(item => item.status === "marching"), "marcha fica persistida no servidor");
      assert.ok(stateA.queues.some(item => item.status === "running" && item.queue_type === "construction"));
      assert.ok(stateA.queues.some(item => item.status === "running" && item.queue_type === "training"));
      assert.ok(stateA.queues.some(item => item.status === "running" && item.queue_type === "research"));
    });

    await t.test("alianças: criar, convidar, entrar, promover, doar, ajudar, expulsar, guerra e território", async () => {
      await action(tokenB, { type: "rename", name: "Reino Beta" }, 200);
      await action(tokenA, { type: "alliance_create", name: "Guardioes Alfa", tag: "ALFA" }, 200);
      await action(tokenA, { type: "alliance_invite", targetName: "Reino Beta" }, 200);

      let stateB = (await api("/api/game/state", { token: tokenB })).data.state;
      const invite = stateB.pendingInvites?.[0];
      assert.ok(invite?.id, "convite chegou ao reino destinatário");
      await action(tokenB, { type: "alliance_accept_invite", inviteId: invite.id }, 200);
      await action(tokenA, { type: "alliance_promote", targetKingdomId: kingdomB, rank: "oficial" }, 200);
      await action(tokenB, { type: "alliance_chat", message: "Teste de comunicação entre aliados" }, 200);
      await action(tokenA, { type: "alliance_donate", resource: "food", amount: 1000 }, 200);
      await action(tokenA, { type: "alliance_donate", resource: "wood", amount: 1000 }, 200);
      await action(tokenA, { type: "alliance_help", targetKingdomId: kingdomB }, 200);
      await action(tokenA, { type: "alliance_kick", targetKingdomId: kingdomB }, 200);

      await action(tokenB, { type: "alliance_create", name: "Guardioes Beta", tag: "BETA" }, 200);
      await action(tokenA, { type: "alliance_war_declare", targetTag: "BETA" }, 200);

      stateA = (await api("/api/game/state", { token: tokenA })).data.state;
      const claimable = stateA.territories.find(item => !item.alliance_id && !item.owner_kingdom_id);
      assert.ok(claimable?.id, "há território disponível para reivindicação");
      await action(tokenA, { type: "alliance_claim_territory", territoryId: claimable.id }, 200);

      await action(tokenC, { type: "alliance_join", tag: "ALFA" }, 200);
      await action(tokenA, { type: "alliance_help", targetKingdomId: kingdomC }, 200);
      await action(tokenC, { type: "alliance_leave" }, 200);
    });

    await t.test("todas as rotas de administração rejeitam dados inválidos sem erro interno", async () => {
      expectStatus(await admin("/api/admin/player-search", {}), 400, "busca administrativa vazia");
      expectStatus(await admin("/api/admin/gems", { playerId: playerA, amount: 0 }), 400, "gemas administrativas inválidas");
      expectStatus(await admin("/api/admin/unlock-skin", { playerId: playerA, skin: "não cadastrada" }), 404, "skin não cadastrada");
      expectStatus(await admin("/api/admin/purchase-requests/review", { requestId: -1, decision: "approve" }), 400, "revisão de pedido inválida");
      expectStatus(await admin("/api/admin/skins", { name: "Preço inválido", price: 0 }), 400, "cadastro de skin inválido");
      expectStatus(await admin("/api/admin/vip-packages", { name: "", price: 0, gems: -1 }), 400, "cadastro de VIP inválido");
      expectStatus(await api("/api/admin/purchase-requests", { method: "POST", body: {} }), 401, "fila Master sem sessão");
    });

    await t.test("todas as 34 ações previstas foram alcançadas no fluxo de integração", async () => {
      const actionTypes = [
        "set_nickname","equipment_craft","equipment_upgrade","equipment_equip","equipment_unequip","equipment_lock",
        "cosmetic_buy","cosmetic_claim","seasonal_buy","skin_fuse","shop_buy","alliance_create","alliance_join",
        "alliance_invite","alliance_accept_invite","alliance_promote","alliance_kick","alliance_donate","alliance_help",
        "alliance_chat","alliance_war_declare","alliance_claim_territory","alliance_leave","dragon_upgrade","hero_summon",
        "hero_evolve","hero_train","prestige","upgrade","train","research","march","battle","rename",
      ];
      assert.equal(actionTypes.length, 34);
      assert.deepEqual([...executedActions].sort(), [...actionTypes].sort(),
        "cada um dos 34 tipos de ação deve ter sido enviado ao Worker autenticado");
    });
  } finally {
    if (workerProcess && workerProcess.exitCode === null) {
      workerProcess.kill("SIGTERM");
      await Promise.race([
        new Promise(resolve => workerProcess.once("close", resolve)),
        delay(5000),
      ]);
      if (workerProcess.exitCode === null) workerProcess.kill("SIGKILL");
    }
    await rm(persistDir, { recursive: true, force: true });
  }
});
