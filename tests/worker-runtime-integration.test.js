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

function rowsFromD1Json(output) {
  let parsed;
  try {
    parsed = JSON.parse(String(output || "").trim());
  } catch {
    const raw = String(output || "");
    const startArray = raw.indexOf("[");
    const startObject = raw.indexOf("{");
    const start = startArray < 0 ? startObject : startObject < 0 ? startArray : Math.min(startArray, startObject);
    if (start < 0) throw new Error("Saída JSON do Wrangler não encontrada: " + raw.slice(0, 500));
    parsed = JSON.parse(raw.slice(start).trim());
  }
  if (Array.isArray(parsed)) {
    return parsed.flatMap(entry => Array.isArray(entry?.results) ? entry.results :
      Array.isArray(entry?.result?.results) ? entry.result.results : []);
  }
  if (Array.isArray(parsed?.results)) return parsed.results;
  if (Array.isArray(parsed?.result?.results)) return parsed.result.results;
  if (Array.isArray(parsed?.result)) return parsed.result;
  return [];
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
      "--test-scheduled",
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

    const valhallaDefault = expectStatus(await api("/api/config/valhalla"), 200, "configuração pública de Valhalla");
    assert.equal(valhallaDefault.active, false, "Ascensão de Valhalla permanece desligada por padrão");
    assert.equal(valhallaDefault.resourceMultiplier, 5);
    assert.equal(valhallaDefault.speedMultiplier, 0.2);
    assert.equal(valhallaDefault.dailyRunesReward, 100);

    expectStatus(await api("/api/game/state"), 401, "estado sem sessão");
    expectStatus(await api("/api/kingdom/status"), 401, "resumo do reino sem sessão");
    expectStatus(await api("/api/game/action", { method: "POST", body: { type: "rename", name: "Sem Token" } }), 401, "ação sem sessão");

    const catalogBefore = expectStatus(await api("/api/store/catalog"), 200, "catálogo público");
    assert.ok(Array.isArray(catalogBefore.skins));
    assert.ok(Array.isArray(catalogBefore.packages));

    const betaWithoutConsent = expectStatus(await api("/api/beta/signup", {
      method: "POST", body: { email: "beta-consent@example.invalid", consent: false },
    }), 400, "lista beta exige consentimento explícito");
    assert.ok(betaWithoutConsent.error);
    const betaSignup = expectStatus(await api("/api/beta/signup", {
      method: "POST", body: { email: "beta-integration@example.invalid", consent: true },
    }), 201, "inscrição beta com consentimento");
    assert.equal(betaSignup.success, true);
    expectStatus(await api("/api/beta/signup", {
      method: "POST", body: { email: "BETA-INTEGRATION@example.invalid", consent: true },
    }), 409, "inscrição beta duplicada");

    const startA = expectStatus(await api("/api/game/start", { method: "POST", body: {} }), 201, "fundação do primeiro reino");
    const startB = expectStatus(await api("/api/game/start", { method: "POST", body: { referrer_code: startA.state.player.player_id } }), 201, "fundação do segundo reino por convite");
    assert.equal(startB.referral_recorded, true, "o convite é atribuído apenas após criar o novo reino");
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
    const coreResourceKeys = ["food", "wood", "stone", "iron", "gold"];
    for (const key of coreResourceKeys) {
      const value = Number(stateA.kingdom?.[key]);
      assert.ok(Number.isFinite(value) && value >= 0,
        "reino inicial retorna recurso numérico válido: " + key);
    }
    for (const building of ["castle", "barracks", "farm", "quarry", "lumber_mill", "iron_mine"]) {
      assert.ok(stateA.buildings.some(item => item.building_type === building),
        "reino inicial contém o edifício " + building);
    }
    assert.ok(stateA.troops.some(unit => unit.unit_type === "militia" && Number(unit.quantity) > 0),
      "reino inicial entrega tropas utilizáveis");
    const kingdomB = Number(startB.state.kingdom.id);
    const kingdomC = Number(startC.state.kingdom.id);
    const playerA = stateA.player.player_id;
    const referralSummary = expectStatus(await api("/api/game/referral/link", { token: tokenA }), 200, "link autenticado de indicação");
    assert.equal(referralSummary.referral_code, playerA);
    assert.equal(referralSummary.referral_count, 1);
    assert.match(referralSummary.referral_url, /\/kingdom\.html\?ref=izzy_[a-f0-9]{32}$/);
    expectStatus(await api("/api/game/referral/link"), 401, "link de indicação sem sessão");

    await t.test("estado, busca, eventos e sessão autenticada", async () => {
      const stateEnvelope = expectStatus(await api("/api/game/state", { token: tokenA }), 200, "estado autenticado");
      const state = stateEnvelope.state;
      assert.ok(state, "o endpoint retorna o estado dentro do envelope state");
      assert.equal(Number(state.kingdom.id), kingdomA);
      const kingdomStatus = expectStatus(await api("/api/kingdom/status", { token: tokenA }), 200, "resumo autenticado do reino");
      assert.equal(kingdomStatus.kingdom.name, state.kingdom.kingdom_name);
      assert.equal(Number(kingdomStatus.kingdom.castleLevel), Number(state.kingdom.castle_level));
      assert.ok(Number.isFinite(Number(kingdomStatus.resources.food)) && Number(kingdomStatus.resources.food) >= 0);
      assert.ok(Number(kingdomStatus.capacities.food) >= Number(kingdomStatus.resources.food));
      assert.ok(Number(kingdomStatus.resources.gems) >= 0);
      assert.equal(Number(kingdomStatus.researchCenterLevel), Number(state.buildings.find(item => item.building_type === "academy")?.level || 0));
      assert.ok(kingdomStatus.researches.some(item => item.id === "economy" && item.unlocked), "economia fica disponível sem requisito de Academia");
      assert.ok(kingdomStatus.researches.some(item => item.id === "defense" && item.requiredAcademyLevel === 1), "defesa expõe o requisito real da Academia");
      assert.ok(kingdomStatus.researches.every(item => Number.isInteger(item.level) && Number.isInteger(item.maxLevel)));
      expectStatus(await api("/api/kingdom/status", { method: "POST", token: tokenA }), 405, "resumo do reino aceita apenas GET");
      assert.ok(state.equipment?.length >= 4, "equipamentos iniciais carregados");
      assert.ok(state.heroInventory?.length >= 1, "herói inicial sincronizado");
      expectStatus(await api("/api/game/analytics", {
        method: "POST", body: { event: "integration.session_started" },
      }), 401, "analytics sem sessão");
      expectStatus(await api("/api/game/feedback", {
        method: "POST", body: { rating: 5, text: "Sem sessão" },
      }), 401, "feedback sem sessão");
      const analytics = expectStatus(await api("/api/game/analytics", {
        method: "POST", token: tokenA,
        body: { event: "integration.session_started", sessionId: "integration-session", data: { screen: "kingdom", source: "test", email: "must-not-be-stored" } },
      }), 201, "evento de analytics autenticado");
      assert.equal(analytics.success, true);
      const kingdomOpened = expectStatus(await api("/api/game/analytics", {
        method: "POST", token: tokenA,
        body: { event: "kingdom.opened", sessionId: "valhalla-active-session", data: { screen: "kingdom", source: "integration" } },
      }), 201, "atividade real de abertura do reino");
      assert.equal(kingdomOpened.success, true);
      expectStatus(await api("/api/game/feedback", {
        method: "POST", token: tokenA, body: { rating: 6, text: "Nota fora do limite" },
      }), 400, "feedback rejeita nota inválida");
      const feedback = expectStatus(await api("/api/game/feedback", {
        method: "POST", token: tokenA, body: { rating: 5, text: "Integração de teste do reino." },
      }), 201, "feedback autenticado");
      assert.equal(feedback.success, true);
      expectStatus(await api("/api/game/players/search?q=Beta", { token: tokenA }), 200, "busca de jogadores");
      expectStatus(await api("/api/game/search?q=Eldoria&kind=all", { token: tokenA }), 200, "busca global do jogo");
      const eventState = expectStatus(await api("/api/game/event", { token: tokenA }), 200, "estado do Anjo da Morte");
      assert.ok(eventState.event?.id, "o calendário cria um evento persistente para o ciclo atual ou seguinte");
      expectStatus(await api("/api/game/event/attack", {
        method: "POST", token: tokenA, body: { requestId: "nao-e-uuid" },
      }), 400, "ataque do evento com identificador inválido");

      const eventRequestId = "11111111-1111-4111-8111-111111111111";
      const initialMilitia = state.troops.find(unit => unit.unit_type === "militia" && Number(unit.tier) === 1);
      assert.ok(initialMilitia && Number(initialMilitia.quantity) >= 1, "reino inicial possui milícia para o evento");
      if (eventState.event.status === "active" && Number(eventState.event.boss_hp_remaining) > 0) {
        const attack = expectStatus(await api("/api/game/event/attack", {
          method: "POST", token: tokenA,
          body: { requestId: eventRequestId, units: { militia_1: 1 } },
        }), 200, "ataque válido ao Anjo da Morte");
        assert.equal(attack.success, true);
        assert.ok(Number(attack.damage) > 0, "ataque registra dano positivo");
        assert.ok(Number(attack.troopsLost) >= 0 && Number(attack.troopsLost) <= 1);

        const retry = expectStatus(await api("/api/game/event/attack", {
          method: "POST", token: tokenA,
          body: { requestId: eventRequestId, units: { militia_1: 1 } },
        }), 200, "repetição idempotente do ataque");
        assert.equal(retry.duplicate, true);
        assert.equal(retry.damage, attack.damage);
        assert.equal(retry.troopsLost, attack.troopsLost);

        const afterAttack = expectStatus(await api("/api/game/state", { token: tokenA }), 200, "estado após ataque do evento");
        const remainingMilitia = afterAttack.state.troops.find(unit => unit.unit_type === "militia" && Number(unit.tier) === 1);
        assert.equal(Number(initialMilitia.quantity) - Number(remainingMilitia.quantity), Number(attack.troopsLost),
          "repetir o mesmo requestId não aplica baixas permanentes duas vezes");
      } else {
        expectStatus(await api("/api/game/event/attack", {
          method: "POST", token: tokenA,
          body: { requestId: eventRequestId, units: { militia_1: 1 } },
        }), 409, "ataque ao Anjo da Morte fora da janela ativa");
      }
      expectStatus(await api("/api/store/purchase-request", {
        method: "POST", token: tokenA,
        body: { kind: "invalid", itemId: 1, requestKey: "invalid-request-key-01" },
      }), 400, "pedido de compra inválido");
    });

    await t.test("Ascensão de Valhalla: configuração, x5 de produção, filas aceleradas e runas diárias idempotentes", async () => {
      const initial = expectStatus(await api("/api/game/state", { token: tokenA }), 200, "estado antes do modo Valhalla");
      const runesBefore = Number(initial.state.kingdom.destiny_runes || 0);

      await runCli([
        "--config", "wrangler.jsonc", "d1", "execute", "clash-of-izzy-db",
        "--local", "--persist-to", persistDir,
        "--command", "UPDATE game_config SET value='1' WHERE key='valhalla_mode_active';",
      ]);

      try {
        const activeConfig = expectStatus(await api("/api/config/valhalla"), 200, "Valhalla ativado no D1 local");
        assert.equal(activeConfig.active, true);
        assert.equal(activeConfig.resourceMultiplier, 5);
        assert.equal(activeConfig.speedMultiplier, 0.2);

        const scheduledOnce = await fetch(baseUrl + "/cdn-cgi/local/scheduled?format=json", {
          signal: AbortSignal.timeout(20_000),
        });
        assert.equal(scheduledOnce.status, 200, "Cron local deve executar o handler agendado");
        const scheduledResult = await scheduledOnce.json();
        assert.equal(scheduledResult.outcome, "ok");

        const afterDailyReward = expectStatus(await api("/api/game/state", { token: tokenA }), 200, "estado após runas diárias");
        assert.equal(Number(afterDailyReward.state.kingdom.destiny_runes), runesBefore + 100,
          "reino que abriu o jogo nas últimas 24 horas recebe 100 Runas do Destino");

        const scheduledTwice = await fetch(baseUrl + "/cdn-cgi/local/scheduled?format=json", {
          signal: AbortSignal.timeout(20_000),
        });
        assert.equal(scheduledTwice.status, 200);
        const afterDuplicateCron = expectStatus(await api("/api/game/state", { token: tokenA }), 200, "estado após repetição do Cron");
        assert.equal(Number(afterDuplicateCron.state.kingdom.destiny_runes), runesBefore + 100,
          "repetir o Cron no mesmo dia não duplica a recompensa");

        // The public game identity maps through players.id to kingdoms.id; never query
        // seasonal balances or troop ownership from players / permanent army tables.
        expectStatus(await api("/api/game/valhalla-shop/catalog"), 401, "loja Valhalla sem sessão");
        await runCli([
          "--config", "wrangler.jsonc", "d1", "execute", "clash-of-izzy-db",
          "--local", "--persist-to", persistDir,
          "--command", "UPDATE kingdoms SET destiny_runes=30000 WHERE id=" + kingdomA + ";",
        ]);

        const shopCatalog = expectStatus(await api("/api/game/valhalla-shop/catalog", { token: tokenA }), 200, "catálogo sazonal autenticado");
        assert.equal(shopCatalog.active, true);
        assert.equal(shopCatalog.player_runes, 30000);
        assert.ok(shopCatalog.catalog.some(item => item.id === "einherjar_pack_10"));
        assert.ok(shopCatalog.catalog.some(item => item.id === "fenrir_pack_1"));
        expectStatus(await api("/api/game/valhalla-shop/buy", {
          method: "POST", token: tokenA, body: { catalog_id: "einherjar_pack_10" },
        }), 400, "request_key obrigatório na compra");

        const buy = (token, catalog_id, request_key) => api("/api/game/valhalla-shop/buy", {
          method: "POST", token, body: { catalog_id, request_key },
        });
        const einherjarKey = "valhalla-shop-einherjar-0001";
        const einherjar = expectStatus(await buy(tokenA, "einherjar_pack_10", einherjarKey), 201, "compra do pacote Einherjar");
        assert.equal(einherjar.success, true);
        assert.equal(einherjar.replayed, false);
        assert.equal(einherjar.new_runes_balance, 29500);
        const einherjarRetry = expectStatus(await buy(tokenA, "einherjar_pack_10", einherjarKey), 200, "retry idempotente da compra");
        assert.equal(einherjarRetry.replayed, true);
        assert.equal(einherjarRetry.new_runes_balance, 29500);
        expectStatus(await buy(tokenB, "fenrir_pack_1", einherjarKey), 409, "chave de compra reutilizada por outro reino");

        for (let index = 1; index <= 3; index++) {
          const result = expectStatus(
            await buy(tokenA, "fenrir_pack_1", "valhalla-fenrir-pack-" + index + "-0001"),
            201,
            "compra limitada de Fenrir " + index
          );
          assert.equal(result.success, true);
        }
        const catalogAfterFenrir = expectStatus(await api("/api/game/valhalla-shop/catalog", { token: tokenA }), 200, "estoque de Fenrir atualizado");
        assert.equal(catalogAfterFenrir.catalog.find(item => item.id === "fenrir_pack_1").remaining_stock, 0);
        expectStatus(await buy(tokenA, "fenrir_pack_1", "valhalla-fenrir-pack-4-0001"), 409, "limite de três Fenrir por reino");

        const odin = expectStatus(await buy(tokenA, "hero_odin_awakened", "valhalla-hero-odin-0001"), 201, "compra do herói Odin");
        assert.equal(odin.reward.hero, "odin_awakened");
        const odinRow = await runCli([
          "--config", "wrangler.jsonc", "d1", "execute", "clash-of-izzy-db",
          "--local", "--persist-to", persistDir,
          "--json",
          "--command", "SELECT h.hero_key,h.rarity,h.level,hi.rarity AS inventory_rarity FROM heroes h JOIN hero_inventory hi ON hi.kingdom_id=h.kingdom_id AND hi.hero_key=h.hero_key WHERE h.kingdom_id=" + kingdomA + " AND h.hero_key='odin_awakened';",
        ]);
        const odinState = expectStatus(await api("/api/game/state", { token: tokenA }), 200, "inventário após compra de Odin");
        const odinHero = odinState.state.heroes.find(hero => hero.hero_key === "odin_awakened");
        const odinInventory = odinState.state.heroInventory.find(hero => hero.hero_key === "odin_awakened");
        assert.ok(odinHero && odinInventory, "Odin deve existir nas tabelas de heróis e inventário");
        assert.equal(odinHero.rarity, "mythic");
        assert.equal(odinInventory.rarity, "purple");

        await buy(tokenA, "buff_odin_blessing", "valhalla-buff-odin-0001").then(result => expectStatus(result, 201, "compra de buff de ataque"));
        await buy(tokenA, "buff_freya_charm", "valhalla-buff-freya-0001").then(result => expectStatus(result, 201, "compra de buff de produção"));
        await buy(tokenA, "skin_rune_armor", "valhalla-skin-rune-0001").then(result => expectStatus(result, 201, "compra de cosmético sazonal"));
        await buy(tokenA, "title_valhalla_champion", "valhalla-title-champion-01").then(result => expectStatus(result, 201, "compra de título sazonal"));
        const shopHistory = expectStatus(await api("/api/game/valhalla-shop/history", { token: tokenA }), 200, "histórico de compras Valhalla");
        assert.equal(shopHistory.history.length, 9);
        const postShop = expectStatus(await api("/api/game/valhalla-shop/catalog", { token: tokenA }), 200, "saldo após compras");
        assert.equal(postShop.player_runes, 6400);

        const ledger = await runCli([
          "--config", "wrangler.jsonc", "d1", "execute", "clash-of-izzy-db",
          "--local", "--persist-to", persistDir,
          "--json",
          "--command", "SELECT COUNT(*) AS purchases,COALESCE(SUM(amount),0) AS spent FROM valhalla_rune_ledger WHERE kingdom_id=" + kingdomA + " AND entry_type='debit' AND reason='shop_purchase';",
        ]);
        const ledgerSummary = rowsFromD1Json(ledger)[0];
        assert.equal(Number(ledgerSummary.purchases), 9);
        assert.equal(Number(ledgerSummary.spent), 23600);

        const troopHoldings = await runCli([
          "--config", "wrangler.jsonc", "d1", "execute", "clash-of-izzy-db",
          "--local", "--persist-to", persistDir,
          "--json",
          "--command", "SELECT unit_type,quantity FROM valhalla_troops WHERE kingdom_id=" + kingdomA + " ORDER BY unit_type;",
        ]);
        const holdings = rowsFromD1Json(troopHoldings);
        assert.equal(Number(holdings.find(row => row.unit_type === "einherjar")?.quantity || 0), 10);
        assert.equal(Number(holdings.find(row => row.unit_type === "fenrir_beast")?.quantity || 0), 3);

        const cosmetics = await runCli([
          "--config", "wrangler.jsonc", "d1", "execute", "clash-of-izzy-db",
          "--local", "--persist-to", persistDir,
          "--json",
          "--command", "SELECT item_id,kind FROM kingdom_cosmetics WHERE kingdom_id=" + kingdomA + " AND item_id IN ('troop_skin_rune_armor','valhalla_champion') ORDER BY item_id;",
        ]);
        const cosmeticRows = rowsFromD1Json(cosmetics);
        assert.equal(cosmeticRows.length, 2);
        const titleState = await runCli([
          "--config", "wrangler.jsonc", "d1", "execute", "clash-of-izzy-db",
          "--local", "--persist-to", persistDir,
          "--json",
          "--command", "SELECT valhalla_title FROM kingdoms WHERE id=" + kingdomA + ";",
        ]);
        assert.equal(rowsFromD1Json(titleState)[0]?.valhalla_title, "valhalla_champion");

        const buffState = await runCli([
          "--config", "wrangler.jsonc", "d1", "execute", "clash-of-izzy-db",
          "--local", "--persist-to", persistDir,
          "--json",
          "--command", "SELECT buff_key,MAX(multiplier) AS multiplier FROM valhalla_buffs WHERE kingdom_id=" + kingdomA + " AND expires_at>unixepoch() GROUP BY buff_key ORDER BY buff_key;",
        ]);
        const buffRows = rowsFromD1Json(buffState);
        assert.ok(buffRows.some(row => row.buff_key === "attack_power" && Number(row.multiplier) === 1.5));
        assert.ok(buffRows.some(row => row.buff_key === "resource_production" && Number(row.multiplier) === 3));

        await runCli([
          "--config", "wrangler.jsonc", "d1", "execute", "clash-of-izzy-db",
          "--local", "--persist-to", persistDir,
          "--command", "UPDATE kingdoms SET destiny_runes=1 WHERE id=" + kingdomB + ";",
        ]);
        expectStatus(await buy(tokenB, "einherjar_pack_10", "valhalla-insufficient-runic-01"), 402, "bloqueio de runas insuficientes");
        
        const woodBeforeProduction = Number(afterDuplicateCron.state.kingdom.wood || 0);
        await runCli([
          "--config", "wrangler.jsonc", "d1", "execute", "clash-of-izzy-db",
          "--local", "--persist-to", persistDir,
          "--command", "UPDATE kingdoms SET last_production_at=datetime('now','-3600 seconds') WHERE id=" + kingdomA + ";",
        ]);
        const produced = expectStatus(await api("/api/game/state", { token: tokenA }), 200, "produção com multiplicador Valhalla");
        const woodGained = Number(produced.state.kingdom.wood || 0) - woodBeforeProduction;
        assert.ok(woodGained >= 120,
          "uma hora de produção de madeira recebe o multiplicador sazonal x5 e o buff de Freya x3");

        expectStatus(await api("/api/game/action", { method: "POST", token: tokenC, body: { type: "upgrade", building: "castle" } }), 200, "construção acelerada Valhalla");
        expectStatus(await api("/api/game/action", { method: "POST", token: tokenC, body: { type: "train", unit: "mage", quantity: 1 } }), 200, "treinamento acelerado Valhalla");
        expectStatus(await api("/api/game/action", { method: "POST", token: tokenC, body: { type: "research", research: "economy" } }), 200, "pesquisa acelerada Valhalla");

        const acceleratedState = expectStatus(await api("/api/game/state", { token: tokenC }), 200, "filas do reino de teste");
        const running = acceleratedState.state.queues.filter(queue => queue.status === "running");
        const secondsFor = type => {
          const queue = running.find(item => item.queue_type === type);
          assert.ok(queue, "fila " + type + " deve estar em andamento");
          return Math.round((Date.parse(queue.completes_at) - Date.parse(queue.started_at)) / 1000);
        };
        assert.equal(secondsFor("construction"), 12, "construção de 60s vira 12s");
        assert.equal(secondsFor("training"), 10, "treinamento respeita o piso seguro de 10s");
        assert.equal(secondsFor("research"), 36, "pesquisa de 180s vira 36s");
      } finally {
        await runCli([
          "--config", "wrangler.jsonc", "d1", "execute", "clash-of-izzy-db",
          "--local", "--persist-to", persistDir,
          "--command", "UPDATE game_config SET value='0' WHERE key='valhalla_mode_active';",
        ]);
      }

      const disabledAgain = expectStatus(await api("/api/config/valhalla"), 200, "Valhalla desligado após testes locais");
      assert.equal(disabledAgain.active, false);
    });

    const adminLogin = expectStatus(await api("/api/admin/login", {
      method: "POST", body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    }), 200, "login Master");
    assert.ok(adminLogin.token);
    const adminToken = adminLogin.token;
    const admin = (route, body) => api(route, { method: "POST", token: adminToken, body });
    const adminGet = route => api(route, { method: "GET", token: adminToken });

    await t.test("controle Master da Ascensão de Valhalla", async () => {
      expectStatus(await api("/api/valhalla-admin/status"), 401, "Valhalla admin exige sessão Master");
      const initial = expectStatus(await adminGet("/api/valhalla-admin/status"), 200, "status Valhalla Master");
      assert.equal(initial.active, false, "evento começa desligado");
      assert.equal(initial.valhalla_resource_multiplier, 5);
      assert.equal(initial.valhalla_speed_multiplier, 0.2);
      assert.equal(initial.valhalla_daily_runes_reward, 100);

      const statsBeforeGrant = expectStatus(await adminGet("/api/valhalla-admin/stats"), 200, "estatísticas antes do crédito Master");
      const runesSpentBeforeGrant = Number(statsBeforeGrant.total_runes_spent || 0);
      const beforeGrantState = expectStatus(await api("/api/game/state", { token: tokenA }), 200, "saldo antes da distribuição manual");
      const expectedNewBalance = Number(beforeGrantState.state.kingdom.destiny_runes || 0) + 500;
      const grantBody = {
        player_id: playerA,
        amount: 500,
        reason: "Premiação de teste de integração",
        request_key: "admin-valhalla-rune-grant-0001",
      };
      const grant = expectStatus(await admin("/api/valhalla-admin/distribute-runes", grantBody), 200, "distribuição manual de runas");
      assert.equal(grant.success, true);
      assert.equal(grant.reused, false);
      assert.equal(grant.new_balance, expectedNewBalance);

      const retry = expectStatus(await admin("/api/valhalla-admin/distribute-runes", grantBody), 200, "retry idempotente de runas");
      assert.equal(retry.reused, true);
      assert.equal(retry.new_balance, expectedNewBalance, "retry não credita runas novamente");
      expectStatus(await admin("/api/valhalla-admin/distribute-runes", {
        ...grantBody, amount: 501,
      }), 409, "chave idempotente não pode ser reutilizada com outro valor");
      expectStatus(await admin("/api/valhalla-admin/distribute-runes", {
        ...grantBody, player_id: "jogador-inexistente-izzy", request_key: "admin-valhalla-missing-0001",
      }), 404, "jogador inexistente não recebe runas");
      expectStatus(await admin("/api/valhalla-admin/distribute-runes", {
        ...grantBody, request_key: "x",
      }), 400, "chave idempotente inválida");

      const stats = expectStatus(await adminGet("/api/valhalla-admin/stats"), 200, "estatísticas Valhalla");
      assert.ok(stats.players_with_runes >= 1);
      assert.ok(stats.total_runes_distributed >= 500);
      assert.ok(stats.total_runes_in_circulation >= expectedNewBalance);
      assert.equal(stats.total_runes_spent, runesSpentBeforeGrant);
      assert.ok(Array.isArray(stats.top_items));

      const leaderboard = expectStatus(await adminGet("/api/valhalla-admin/leaderboard"), 200, "leaderboard Valhalla");
      assert.ok(leaderboard.leaderboard.length >= 1);
      assert.ok(leaderboard.leaderboard.some(row => Number(row.destiny_runes) === expectedNewBalance));

      expectStatus(await admin("/api/valhalla-admin/update-config", {
        resource_multiplier: 10, speed_multiplier: 0.1, daily_runes_reward: 250,
      }), 200, "atualização de configuração Valhalla");
      const updatedConfig = expectStatus(await adminGet("/api/valhalla-admin/status"), 200, "configuração atualizada");
      assert.equal(updatedConfig.valhalla_resource_multiplier, 10);
      assert.equal(updatedConfig.valhalla_speed_multiplier, 0.1);
      assert.equal(updatedConfig.valhalla_daily_runes_reward, 250);

      expectStatus(await admin("/api/valhalla-admin/update-config", {
        resource_multiplier: 100,
      }), 400, "multiplicador acima do limite");
      expectStatus(await admin("/api/valhalla-admin/update-config", {
        speed_multiplier: 0.01,
      }), 400, "velocidade abaixo do piso do runtime");
      expectStatus(await admin("/api/valhalla-admin/update-config", {
        daily_runes_reward: 0,
      }), 400, "recompensa diária fora do intervalo");

      try {
        const activated = expectStatus(await admin("/api/valhalla-admin/toggle", {
          action: "activate",
        }), 200, "ativação do modo Valhalla");
        assert.equal(activated.success, true);
        assert.equal(activated.duration_days, 14);
        const publicConfig = expectStatus(await api("/api/config/valhalla"), 200, "modo público ativado");
        assert.equal(publicConfig.active, true);
        const activeStatus = expectStatus(await adminGet("/api/valhalla-admin/status"), 200, "status Valhalla ativo");
        assert.equal(activeStatus.active, true);
        assert.ok(activeStatus.time_remaining_seconds > 0);
        expectStatus(await admin("/api/valhalla-admin/toggle", {
          action: "not-an-action",
        }), 400, "ação de alternância inválida");
      } finally {
        expectStatus(await admin("/api/valhalla-admin/toggle", {
          action: "deactivate",
        }), 200, "desativação e limpeza do modo Valhalla");
        expectStatus(await admin("/api/valhalla-admin/update-config", {
          resource_multiplier: 5, speed_multiplier: 0.2, daily_runes_reward: 100,
        }), 200, "restauração da configuração padrão");
      }

      const finalStatus = expectStatus(await adminGet("/api/valhalla-admin/status"), 200, "status Valhalla restaurado");
      assert.equal(finalStatus.active, false);
      assert.equal(finalStatus.valhalla_resource_multiplier, 5);
      assert.equal(finalStatus.valhalla_speed_multiplier, 0.2);
      assert.equal(finalStatus.valhalla_daily_runes_reward, 100);
    });

    await t.test("painel Master, catálogo e pedidos de compra", async () => {
      expectStatus(await admin("/api/admin/player-search", { query: playerA }), 200, "busca administrativa de jogador");
      expectStatus(await admin("/api/admin/gems", { playerId: playerA, amount: 10 }), 200, "crédito administrativo de gemas");
      expectStatus(await admin("/api/admin/gems", { playerId: playerA, amount: 0 }), 400, "bloqueio de crédito inválido");

      expectStatus(await admin("/api/admin/vip-packages", {
        name: "Pacote de integração", price: 1, gems: 100,
      }), 200, "criação de pacote VIP");
      expectStatus(await admin("/api/admin/skins", {
        name: "Skin inválida", price: 10,
      }), 400, "bloqueio de preço de skin inválido");
      expectStatus(await admin("/api/admin/skins", {
        name: "Skin além do limite", price: 50,
      }), 409, "limite de 200 skins do catálogo");
      expectStatus(await admin("/api/admin/skins", {
        name: "Skin inválida", price: 10,
      }), 400, "bloqueio de preço de skin inválido");

      const catalog = expectStatus(await api("/api/store/catalog"), 200, "catálogo atualizado");
      const vip = catalog.packages.find(item => item.name === "Pacote de integração");
      const skin = catalog.skins[0];
      assert.ok(vip?.id, "pacote VIP aparece no catálogo");
      assert.ok(skin?.id && skin?.name, "skin existente aparece no catálogo");

      expectStatus(await admin("/api/admin/unlock-skin", {
        playerId: playerA, skin: skin.name,
      }), 200, "desbloqueio Master de skin");
      expectStatus(await admin("/api/admin/unlock-skin", {
        playerId: playerA, skin: "Skin inexistente",
      }), 404, "skin inexistente não é liberada");

      expectStatus(await api("/api/store/purchase-request", {
        method: "POST", token: tokenA,
        body: {
          kind: "vip_package", itemId: vip.id,
          requestKey: "integration-vip-request-01",
          paymentMethod: "pix",
        },
      }), 400, "bloqueio do PIX direto");

      const purchase = expectStatus(await api("/api/store/purchase-request", {
        method: "POST", token: tokenA,
        body: {
          kind: "vip_package", itemId: vip.id,
          requestKey: "integration-vip-request-01",
          paymentMethod: "mercadopago_link", paymentReference: "TESTE-NAO-PAGO",
        },
      }), 201, "criação de pedido VIP");
      assert.ok(purchase.request?.id);
      assert.equal(purchase.request.status, "pending");
      assert.equal(purchase.request.payment_method, "mercadopago_link");

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
          paymentMethod: "mercadopago_link",
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

    await t.test("duas filas simultâneas, capacidade de tropas e marchas", async () => {
      stateA = (await api("/api/game/state", { token: tokenA })).data.state;
      const resourcesBeforeQueues = Object.fromEntries(coreResourceKeys.map(key => [key, Number(stateA.kingdom[key])]));
      const troopCount = (type, snapshot = stateA) => snapshot.troops
        .filter(unit => unit.unit_type === type)
        .reduce((sum, unit) => sum + Number(unit.quantity || 0), 0);
      const mageBeforeTraining = troopCount("mage");
      const archerBeforeTraining = troopCount("archer");
      const farmLevelBefore = Number(stateA.buildings.find(item => item.building_type === "farm")?.level || 0);
      const barracksLevelBefore = Number(stateA.buildings.find(item => item.building_type === "barracks")?.level || 0);
      await action(tokenA, { type: "upgrade", building: "building_invalid" }, 400);
      await action(tokenA, { type: "upgrade", building: "castle" }, 200);

      // Conclui o upgrade inicial localmente para liberar melhorias secundárias.
      await runCli([
        "--config", "wrangler.jsonc", "d1", "execute", "clash-of-izzy-db",
        "--local", "--persist-to", persistDir,
        "--command", "UPDATE kingdom_queues SET started_at=datetime('now','-2 seconds'),completes_at=datetime('now','-1 seconds') WHERE kingdom_id=" + kingdomA + " AND queue_type='construction' AND target_key='castle' AND status='running';",
      ]);
      stateA = (await api("/api/game/state", { token: tokenA })).data.state;
      assert.ok(stateA.buildings.find(building => building.building_type === "castle")?.level >= 2,
        "castelo conclui antes das melhorias secundárias");
      await action(tokenA, { type: "upgrade", building: "farm" }, 200, "primeira melhoria secundária");
      await action(tokenA, { type: "upgrade", building: "barracks" }, 200, "segunda construção simultânea");
      await action(tokenA, { type: "upgrade", building: "quarry" }, 409, "terceira construção com as duas filas ocupadas");

      await action(tokenA, { type: "train", unit: "unit_invalid", quantity: 1 }, 400);
      await action(tokenA, { type: "train", unit: "mage", quantity: 1 }, 200);
      await action(tokenA, { type: "train", unit: "archer", quantity: 1 }, 200, "segunda fila de treinamento simultânea");
      await action(tokenA, { type: "train", unit: "crossbowman", quantity: 1 }, 409, "terceiro treinamento com as duas filas ocupadas");

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
      assert.ok(stateA.queues.filter(item => item.status === "running" && item.queue_type === "construction").length === 2,
        "duas construções simultâneas permanecem persistidas");
      assert.ok(stateA.queues.filter(item => item.status === "running" && item.queue_type === "training").length === 2,
        "dois treinamentos simultâneos permanecem persistidos");
      assert.ok(stateA.queues.some(item => item.status === "running" && item.queue_type === "research"));

      const resourcesAfterDebit = Object.fromEntries(coreResourceKeys.map(key => [key, Number(stateA.kingdom[key])]));
      assert.ok(coreResourceKeys.some(key => resourcesAfterDebit[key] < resourcesBeforeQueues[key]),
        "iniciar melhorias e treinamentos debita recursos do reino");

      // A conclusão é forçada somente no D1 local isolado do teste; o Worker
      // continua sendo responsável por processar a fila no próximo GET /state.
      await runCli([
        "--config", "wrangler.jsonc", "d1", "execute", "clash-of-izzy-db",
        "--local", "--persist-to", persistDir,
        "--command", "UPDATE kingdom_queues SET started_at=datetime('now','-2 seconds'),completes_at=datetime('now','-1 seconds') WHERE kingdom_id=" + kingdomA + " AND status='running' AND queue_type IN ('construction','training');",
      ]);
      stateA = (await api("/api/game/state", { token: tokenA })).data.state;
      assert.ok(Number(stateA.buildings.find(item => item.building_type === "farm")?.level || 0) > farmLevelBefore,
        "construção da fazenda é aplicada ao concluir a fila");
      assert.ok(Number(stateA.buildings.find(item => item.building_type === "barracks")?.level || 0) > barracksLevelBefore,
        "melhoria do quartel é aplicada ao concluir a fila");
      assert.ok(troopCount("mage", stateA) >= mageBeforeTraining + 1,
        "tropa treinada entra no exército após a conclusão");
      assert.ok(troopCount("archer", stateA) >= archerBeforeTraining + 1,
        "segunda tropa treinada também entra no exército");
      assert.equal(stateA.queues.filter(item => item.status === "running" && ["construction", "training"].includes(item.queue_type)).length, 0,
        "filas de construção e treinamento são encerradas após a conclusão");
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
