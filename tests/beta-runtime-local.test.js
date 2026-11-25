// Offline runtime smoke: deploys nothing and never connects to Cloudflare.
// Runs the actual Worker and beta-only D1 migrations using Wrangler's local emulator.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const testUuid = "0ef0ef0e-0000-4000-8000-000000000001"; // synthetic, local only
const testInvite = "IZZY-" + "A".repeat(20);
const concurrentInvite = "IZZY-" + "B".repeat(20);

async function command(args, deadlineMs = 120_000) {
  // Explicit local-only argument policy. A failed check aborts before any CLI is called.
  if (args.some(arg => /--remote|deploy|secret|publish|delete|create/i.test(String(arg)))) {
    throw new Error("Remote, deployment or destructive command forbidden in beta smoke");
  }
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args], {
      cwd: root,
      env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const capture = bytes => { output = (output + String(bytes)).slice(-25000); };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    const timer = setTimeout(() => child.kill("SIGKILL"), deadlineMs);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("close", code => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error("Local Wrangler failed (code " + code + "): " + output));
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
async function ready(base, child, output) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("Local Worker exited early: " + output());
    try {
      const res = await fetch(base + "/api/health", { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      if (res.status === 200 && data.status === "ready") return data;
      if (res.status === 503) throw new Error("Beta local schema not ready: " + JSON.stringify(data));
    } catch (e) {
      if (String(e.message || "").includes("schema not ready")) throw e;
    }
    await delay(300);
  }
  throw new Error("Local beta Worker did not start: " + output());
}
async function http(base, endpoint, { method = "GET", body, cookie, bearer, origin, redirect = "manual" } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (bearer) headers.Authorization = "Bearer " + bearer;
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(base + endpoint, {
    method, headers, redirect,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000)
  });
  return { status: response.status, headers: response.headers,
    data: await response.json().catch(() => ({})) };
}

test("actual beta Worker, D1 schema, invitation, kingdom and payment lock run locally", { timeout: 300_000 }, async () => {
  const persist = await mkdtemp(path.join(os.tmpdir(), "coi-beta-runtime-"));
  const cfgFile = path.join(root, "wrangler.beta.local-smoke.jsonc");
  let processWorker;
  let output = "";
  try {
    const original = JSON.parse(await readFile(path.join(root, "wrangler.beta.jsonc"), "utf8"));
    const production = JSON.parse(await readFile(path.join(root, "wrangler.jsonc"), "utf8"));
    assert.equal(original.name, "clash-of-izzy-beta");
    assert.equal(original.vars.ENVIRONMENT, "beta");
    assert.equal(original.vars.INVITE_ONLY, "true");
    assert.equal(original.vars.BETA_LIVE_PAYMENTS_APPROVED, "false");
    assert.equal(original.triggers, undefined);
    assert.notEqual(testUuid, production.d1_databases[0].database_id);
    assert.notEqual(testUuid, production.previews.d1_databases[0].database_id);
    // The placeholder is replaced ONLY in this disposable local config.
    original.d1_databases[0].database_id = testUuid;
    await writeFile(cfgFile, JSON.stringify(original, null, 2));

    const config = path.basename(cfgFile);
    const common = ["--config", config, "d1"];
    await command([...common, "migrations", "apply", "clash-of-izzy-beta-db", "--local", "--persist-to", persist]);
    await command([...common, "execute", "clash-of-izzy-beta-db", "--local",
      "--persist-to", persist, "--file", "beta/schema.sql"]);
    const inviteHash = createHash("sha256").update(testInvite).digest("hex");
    const insert = "INSERT INTO beta_invites(code_hash,max_uses) VALUES('" + inviteHash + "',1)";
    await command([...common, "execute", "clash-of-izzy-beta-db", "--local",
      "--persist-to", persist, "--command", insert]);
    const concurrentHash = createHash("sha256").update(concurrentInvite).digest("hex");
    await command([...common, "execute", "clash-of-izzy-beta-db", "--local",
      "--persist-to", persist, "--command",
      "INSERT INTO beta_invites(code_hash,max_uses) VALUES('" + concurrentHash + "',1)"]);

    const browserInvite = "IZZY-" + "C".repeat(20);
    if (process.env.BETA_BROWSER_SMOKE === "1") {
      const browserHash = createHash("sha256").update(browserInvite).digest("hex");
      await command([...common, "execute", "clash-of-izzy-beta-db", "--local",
        "--persist-to", persist, "--command",
        "INSERT INTO beta_invites(code_hash,max_uses) VALUES('" + browserHash + "',1)"]);
    }

    const port = await freePort();
    const base = "http://127.0.0.1:" + port;
    processWorker = spawn(process.execPath, [wrangler,
      "--config", config, "dev", "--local", "--test-scheduled", "--persist-to", persist,
      "--ip", "127.0.0.1", "--port", String(port),
      "--var", "SESSION_SECRET:beta-runtime-local-testing-secret-not-for-release",
      "--log-level", "error"
    ], { cwd: root, env: { ...process.env, CI: "1",
      WRANGLER_SEND_METRICS: "false", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"] });
    const append = chunk => { output = (output + String(chunk)).slice(-30000); };
    processWorker.stdout.on("data", append);
    processWorker.stderr.on("data", append);
    const health = await ready(base, processWorker, () => output);
    assert.equal(health.checks.database, true);
    assert.equal(health.checks.session, true);
    assert.equal(health.checks.schema, true);
    assert.deepEqual(health.missingTriggers, []);
    assert.deepEqual(health.missingTables, []);

    const blocked = await http(base, "/api/game/state");
    assert.equal(blocked.status, 403, "API private before invite");
    assert.equal(blocked.data.code, "BETA_INVITE_REQUIRED");
    const blockedRealtime = await http(base, "/api/realtime/eldoria/ticket", {method:"POST",body:{}});
    assert.equal(blockedRealtime.status, 403, "realtime tickets require an invitation");
    const blockedJourney = await http(base, "/scripts/royal-journey.js");
    assert.equal(blockedJourney.status, 302, "journey module is private before invitation");
    const blockedScript = await http(base, "/scripts/kingdom-3d.js");
    assert.equal(blockedScript.status, 302, "3D scripts are private before invitation");

    const initial = await http(base, "/kingdom.html");
    assert.equal(initial.status, 302, "kingdom page requires invite");
    assert.equal(new URL(initial.headers.get("location")).pathname, "/beta-access.html");
    const login = await http(base, "/beta-access.html");
    assert.equal(login.status, 200, "invitation page is served");

    const joined = await http(base, "/api/beta/invite/redeem", {
      method: "POST", body: {code:testInvite}, origin:base
    });
    assert.equal(joined.status, 200, "invitation grants beta cookie: " + JSON.stringify(joined.data));
    const cookie = joined.headers.get("set-cookie")?.split(";")[0];
    assert.match(cookie || "", /^__Host-izzy_beta=[a-f0-9]{64}$/);
    const reused = await http(base, "/api/beta/invite/redeem", {
      method: "POST", body:{code:testInvite}, origin:base
    });
    assert.equal(reused.status, 403, "single-use invitation cannot be redeemed twice");

    // Hit the real Worker simultaneously, not just the isolated SQL fixture.
    const concurrentAttempts = await Promise.all([
      http(base, "/api/beta/invite/redeem", {method:"POST",body:{code:concurrentInvite},origin:base}),
      http(base, "/api/beta/invite/redeem", {method:"POST",body:{code:concurrentInvite},origin:base})
    ]);
    assert.deepEqual(concurrentAttempts.map(attempt => attempt.status).sort((a,b)=>a-b), [200,403],
      "an atomic invite claims only one session under concurrent redemption");
    const claimedCookie = concurrentAttempts.find(attempt=>attempt.status===200)?.headers.get("set-cookie")?.split(";")[0];
    assert.match(claimedCookie || "", /^__Host-izzy_beta=[a-f0-9]{64}$/);
    const claimedStatus = await http(base, "/api/beta/access/status", {cookie:claimedCookie});
    assert.equal(claimedStatus.status, 200, "winning session remains usable");

    const privatePage = await http(base, "/kingdom.html", {cookie});
    assert.equal(privatePage.status, 200, "authorized player can open kingdom");
    // The beta asset directory is filtered by .assetsignore. A 200 for HTML
    // alone is insufficient: a missing module or GLB leaves the city unusable.
    // Compare real HTTP payloads against the exact local source files.
    const checkAsset = async (assetPath, contentType) => {
      const response = await fetch(base + assetPath, {
        headers: { Cookie: cookie }, redirect: "manual",
        signal: AbortSignal.timeout(20_000)
      });
      assert.equal(response.status, 200, assetPath + " must be served after invite");
      assert.match(response.headers.get("cache-control") || "", /\bno-store\b/i, assetPath + " must not be cached");
      assert.match(response.headers.get("cache-control") || "", /\bprivate\b/i);
      if (contentType) assert.match(response.headers.get("content-type") || "", contentType, assetPath + " MIME");
      const bytes = Buffer.from(await response.arrayBuffer());
      const expected = await readFile(path.join(root, assetPath.slice(1)));
      assert.ok(bytes.length > 0, assetPath + " must not be empty");
      assert.equal(createHash("sha256").update(bytes).digest("hex"),
        createHash("sha256").update(expected).digest("hex"), assetPath + " HTTP bytes differ from repository");
    };
    await checkAsset("/kingdom.html", /text\/html/i);
    await checkAsset("/styles/kingdom-4x-systems.css", /text\/css/i);
    await checkAsset("/scripts/kingdom-3d.js", /javascript/i);
    await checkAsset("/scripts/kingdom-army-visual.js", /javascript/i);
    await checkAsset("/scripts/kingdom-dragon-visual.js", /javascript/i);
    await checkAsset("/scripts/royal-journey.js", /javascript/i);
    await checkAsset("/scripts/royal-journey-state.js", /javascript/i);
    await checkAsset("/styles/royal-journey.css", /text\/css/i);
    await checkAsset("/scripts/kingdom-quality.js", /javascript/i);
    await checkAsset("/vendor/three/build/three.module.js", /javascript/i);
    await checkAsset("/vendor/three/examples/jsm/loaders/GLTFLoader.js", /javascript/i);
    await checkAsset("/assets/3d/manifest.json", /json/i);
    const legacyManifest = await http(base, "/manifest.json", {cookie});
    assert.equal(legacyManifest.status, 404, "official PWA manifest remains disabled");
    assert.equal(legacyManifest.data.code, "BETA_LEGACY_PWA_DISABLED");

    const manifest = JSON.parse(await readFile(path.join(root, "assets/3d/manifest.json"), "utf8"));
    for (const category of ["models", "props", "units"]) {
      const representative = manifest[category].find(asset => asset.enabled);
      if (representative) {
        assert.match(representative.src, /^\/assets\/3d\/[^?#]+\.glb$/i);
        await checkAsset(representative.src);
      }
    }

    const capabilities = await http(base, "/api/beta/capabilities", {cookie});
    assert.equal(capabilities.status, 200);
    assert.equal(capabilities.data.enabled.advanced4x, true);
    assert.equal(capabilities.data.realMoneyPayments, false);

    const start = await http(base, "/api/game/start", { method:"POST", body:{}, cookie });
    assert.equal(start.status, 201, "game start: " + JSON.stringify(start.data).slice(0,1800));
    assert.ok(start.data.token, "a new kingdom issues a game token");
    assert.ok(start.data.state?.kingdom?.id, "new kingdom persisted");
    const state = await http(base, "/api/game/state", { cookie, bearer:start.data.token });
    assert.equal(state.status, 200, "state responds after game start");
    assert.equal(state.data.state?.kingdom?.id, start.data.state.kingdom.id);
    assert.equal(state.data.state?.advanced4xEnabled, true);

    const badIndustry = await http(base, "/api/game/action", {
      method:"POST", body:{type:"industry_upgrade",industry:"not-a-real-industry"},
      cookie, bearer:start.data.token
    });
    assert.equal(badIndustry.status, 400, "real 4X industry handler validates input");
    const badDefense = await http(base, "/api/game/action", {
      method:"POST", body:{type:"city_defense_place",defense:"tower",gridX:999,gridZ:999},
      cookie, bearer:start.data.token
    });
    assert.equal(badDefense.status, 400, "real 4X defense handler validates map bounds");

    const resume = await http(base, "/api/game/start", {
      method:"POST", body:{}, cookie, bearer:start.data.token
    });
    assert.equal(resume.status, 200, "existing kingdom is resumed");
    assert.equal(resume.data.state?.kingdom?.id, start.data.state.kingdom.id);

    // Prove a real first-gameplay progression, not only invalid 4X inputs.
    // The castle starts at level 1; upgrading it enables mill level 2.
    const beginCastleUpgrade = await http(base, "/api/game/action", {
      method:"POST", body:{type:"upgrade",building:"castle"}, cookie, bearer:start.data.token
    });
    assert.equal(beginCastleUpgrade.status, 200,
      "the new kingdom can start its first castle upgrade: " + JSON.stringify(beginCastleUpgrade.data).slice(0,1000));
    const castleQueue = beginCastleUpgrade.data.state?.queues?.find(
      row => row.queue_type === "construction" && row.target_key === "castle" && row.status === "running"
    );
    assert.ok(castleQueue, "the castle construction is persisted in a queue");

    const duplicateCastleUpgrade = await http(base, "/api/game/action", {
      method:"POST", body:{type:"upgrade",building:"castle"}, cookie, bearer:start.data.token
    });
    assert.equal(duplicateCastleUpgrade.status, 409, "duplicate upgrade cannot charge resources again");

    // Advance only disposable local D1 clock state; NEVER change a remote database.
    await command([...common, "execute", "clash-of-izzy-beta-db", "--local",
      "--persist-to", persist, "--command",
      "UPDATE kingdom_queues SET started_at=datetime('now','-2 minutes'), completes_at=datetime('now','-1 minute') WHERE kingdom_id=" +
      Number(start.data.state.kingdom.id) +
      " AND queue_type='construction' AND target_key='castle' AND status='running'"]);

    // The deployed closed beta deliberately has no cron. A returning player must
    // receive completed construction from the GET state path alone.
    const withoutCron = await http(base, "/api/game/state", {cookie,bearer:start.data.token});
    assert.equal(withoutCron.status, 200, "state works without a scheduled trigger");
    assert.equal(Number(withoutCron.data.state?.kingdom?.castle_level), 2,
      "a due castle upgrade completes when the player returns, without remote cron");
    assert.equal(withoutCron.data.state?.queues?.filter(
      row => row.queue_type === "construction" && row.target_key === "castle" && row.status === "running"
    ).length, 0, "due construction no longer occupies a slot after state reload");

    // Scheduled processing, if run later, must remain idempotent.
    // Wrangler exposes a local-only scheduled handler probe, without registering a remote cron.
    const cronResponse = await fetch(base + "/cdn-cgi/local/scheduled?format=json", {
      signal:AbortSignal.timeout(30_000)
    });
    assert.equal(cronResponse.status, 200, "scheduled handler can be invoked offline");
    const cronResult = await cronResponse.json();
    assert.equal(cronResult.outcome, "ok", "scheduled handler returns a successful execution outcome");

    const completedCastle = await http(base, "/api/game/state", {cookie,bearer:start.data.token});
    assert.equal(completedCastle.status, 200);
    assert.equal(Number(completedCastle.data.state?.kingdom?.castle_level), 2,
      "scheduled processing completes first castle upgrade and persists level 2");
    assert.equal(completedCastle.data.state?.queues?.filter(
      row => row.queue_type === "construction" && row.target_key === "castle" && row.status === "running"
    ).length, 0, "the completed construction leaves no active duplicate queue");

    const millUpgrade = await http(base, "/api/game/action", {
      method:"POST", body:{type:"industry_upgrade",industry:"mill"}, cookie, bearer:start.data.token
    });
    assert.equal(millUpgrade.status, 200,
      "a real 4X industry upgrade succeeds after castle level 2: " + JSON.stringify(millUpgrade.data).slice(0,1000));
    assert.equal(Number(millUpgrade.data.state?.intermediateResources?.mill_level), 2,
      "4X mill level 2 is present in the returned state");
    const persistedMill = await http(base, "/api/game/state", {cookie,bearer:start.data.token});
    assert.equal(persistedMill.status, 200);
    assert.equal(Number(persistedMill.data.state?.intermediateResources?.mill_level), 2,
      "4X mill upgrade persists across subsequent reads");

    // The beta has no remote cron. A real scout march must return exactly once
    // when the player resumes, including concurrent state requests.
    const militiaCount = state => Number(state.troops.find(
      unit => unit.unit_type === "militia" && Number(unit.tier) === 1
    )?.quantity || 0);
    const scoutStart = persistedMill.data.state;
    const scoutTarget = scoutStart.territories.find(t => !t.owner_kingdom_id &&
      t.territory_kind !== "castle" && t.territory_kind !== "throne" &&
      !String(t.territory_key).startsWith("royal_throne_"));
    assert.ok(scoutTarget, "world has a neutral territory to scout");
    const initialMilitia = militiaCount(scoutStart);
    assert.ok(initialMilitia >= 3, "starter realm has troops");
    const scout = await http(base, "/api/game/action", {
      method:"POST", body:{type:"march",marchType:"scout",targetId:scoutTarget.id,units:{militia:3}},
      cookie,bearer:start.data.token
    });
    assert.equal(scout.status, 200, "scout march starts: " + JSON.stringify(scout.data).slice(0,1000));
    const outbound = scout.data.state;
    const activeScout = outbound.marches.find(m => m.status === "marching" &&
      m.march_type === "scout" && Number(m.target_territory_id) === Number(scoutTarget.id));
    assert.ok(activeScout, "scout march is persisted");
    assert.equal(militiaCount(outbound), initialMilitia - 3, "field troops are debited");
    const scoutId = Number(activeScout.id);
    assert.ok(Number.isSafeInteger(scoutId) && scoutId > 0);
    await command([...common, "execute", "clash-of-izzy-beta-db", "--local",
      "--persist-to", persist, "--command",
      "UPDATE marches SET arrives_at=datetime('now','-1 minute') WHERE id=" + scoutId +
      " AND kingdom_id=" + Number(start.data.state.kingdom.id) + " AND status='marching'"]);
    const scoutReturns = await Promise.all(Array.from({length:2}, () =>
      http(base, "/api/game/state", {cookie,bearer:start.data.token})));
    for (const result of scoutReturns) assert.equal(result.status, 200, "concurrent state read succeeds");
    const returned = await http(base, "/api/game/state", {cookie,bearer:start.data.token});
    assert.equal(returned.status, 200);
    assert.equal(militiaCount(returned.data.state), initialMilitia, "scout returns troops exactly once");
    assert.ok(!returned.data.state.marches.some(m => Number(m.id) === scoutId && m.status === "marching"));
    assert.equal(militiaCount((await http(base, "/api/game/state", {cookie,bearer:start.data.token})).data.state),
      initialMilitia, "another refresh cannot duplicate returned troops");
    console.log("Beta scout march passed: dispatch, local deadline, concurrent return and no duplicate troops.");

    // Reuse legacy gameplay already shipped in the beta rather than copying
    // old production code. Exercise real state mutations with synthetic realms.
    const actionFor = (sessionCookie, gameToken, body) =>
      http(base, "/api/game/action", {method:"POST",body,cookie:sessionCookie,bearer:gameToken});
    const getStateFor = async (sessionCookie, gameToken) => {
      const result = await http(base, "/api/game/state", {cookie:sessionCookie,bearer:gameToken});
      assert.equal(result.status,200,"legacy gameplay state is readable");
      return result.data.state;
    };
    const legacyBefore = await getStateFor(cookie,start.data.token);
    const starterHero = legacyBefore.heroes.find(hero => hero.hero_key === "kael_sunwarden");
    assert.ok(starterHero,"legacy starter hero exists");
    const hero = await actionFor(cookie,start.data.token,{type:"hero_train",hero:starterHero.hero_key});
    assert.equal(hero.status,200,"hero training: " + JSON.stringify(hero.data).slice(0,300));
    assert.equal(Number(hero.data.state.heroes.find(h=>h.hero_key===starterHero.hero_key).level),
      Number(starterHero.level)+1);
    const dragonAction={type:"dragon_upgrade",dragonKey:legacyBefore.dragon.dragon_key,expectedLevel:Number(legacyBefore.dragon.level)};
    assert.equal((await actionFor(cookie,start.data.token,{type:"dragon_upgrade"})).status,400);
    assert.equal((await actionFor(cookie,start.data.token,{...dragonAction,dragonKey:"mist_talon"})).status,409);
    assert.equal((await actionFor(cookie,start.data.token,{type:"dragon_unlock",dragonKey:"__proto__"})).status,404);
    assert.equal((await actionFor(cookie,start.data.token,{type:"dragon_equip",dragonKey:"constructor"})).status,404);
    const dragonRace=await Promise.all([actionFor(cookie,start.data.token,dragonAction),actionFor(cookie,start.data.token,dragonAction)]);
    assert.deepEqual(dragonRace.map(x=>x.status).sort((a,b)=>a-b),[200,409]);
    const dragon=dragonRace.find(x=>x.status===200);
    assert.equal(Number(dragon.data.state.dragon.level),Number(legacyBefore.dragon.level)+1);
    assert.equal((await actionFor(cookie,start.data.token,dragonAction)).status,409,"dragon replay cannot charge again");
    assert.equal(Number((await getStateFor(cookie,start.data.token)).dragon.level),Number(legacyBefore.dragon.level)+1);
    const welcome = legacyBefore.mailbox.find(mail=>mail.reward_key==="welcome_v1"&&!mail.claimed_at);
    assert.ok(welcome,"starter mail exists");
    const claimed = await actionFor(cookie,start.data.token,{type:"mail_claim",mailId:welcome.id});
    assert.equal(claimed.status,200,"starter mail reward can be claimed");
    assert.equal((await actionFor(cookie,start.data.token,{type:"mail_claim",mailId:welcome.id})).status,409,
      "starter reward cannot be duplicated");
    const legacyState = await getStateFor(cookie,start.data.token);
    assert.equal(Number(legacyState.heroes.find(h=>h.hero_key===starterHero.hero_key).level),Number(starterHero.level)+1);
    assert.equal(Number(legacyState.dragon.level),Number(legacyBefore.dragon.level)+1);
    console.log("Beta legacy progression passed: hero, dragon and one-time mailbox reward.");

    const second = await http(base,"/api/game/start",{method:"POST",body:{},cookie:claimedCookie});
    assert.equal(second.status,201,"independent second realm starts");
    assert.ok(second.data.token);
    assert.notEqual(second.data.state.kingdom.id,start.data.state.kingdom.id);
    const candidates = [{name:"Beta Test Guild A",tag:"BTA"},{name:"Beta Test Guild B",tag:"BTB"}];
    const creations = await Promise.all(candidates.map(candidate =>
      actionFor(cookie,start.data.token,{type:"alliance_create",...candidate})));
    assert.deepEqual(creations.map(result=>result.status).sort((a,b)=>a-b),[200,409],
      "one realm cannot concurrently found two alliances");
    const winner = creations.findIndex(result=>result.status===200);
    const tag = candidates[winner].tag;
    const rejectedTag = candidates[1-winner].tag;
    const createdAlliance = creations[winner];
    assert.equal(createdAlliance.data.state.alliance.tag,tag);
    assert.equal(createdAlliance.data.state.alliance.members.length,1);
    assert.equal(createdAlliance.data.state.alliance.members[0].rank,"lider");
    assert.equal((await actionFor(claimedCookie,second.data.token,{type:"alliance_join",tag:rejectedTag})).status,404,
      "the rejected concurrent alliance must not leave a ghost record");
    const message = "Synthetic beta guild message";
    const refused = await actionFor(claimedCookie,second.data.token,{type:"alliance_chat",message});
    assert.equal(refused.status,409,"outsider cannot post to guild chat");
    assert.equal((await getStateFor(claimedCookie,second.data.token)).alliance,null);
    const joinedAlliance = await actionFor(claimedCookie,second.data.token,{type:"alliance_join",tag});
    assert.equal(joinedAlliance.status,200,"second realm joins existing guild");
    assert.equal(joinedAlliance.data.state.alliance.tag,tag);
    assert.equal(joinedAlliance.data.state.alliance.members.length,2);
    assert.equal((await actionFor(claimedCookie,second.data.token,{type:"alliance_chat",message})).status,200);
    const guild = (await getStateFor(cookie,start.data.token)).alliance;
    assert.equal(guild.members.length,2);
    assert.ok(guild.chat.some(row=>row.message===message),"leader receives member chat");
    console.log("Beta legacy alliance passed: two independent kingdoms, membership gate and shared chat.");

    // Exercise the previously untested attack branch with the second realm.
    const attackerBefore = await getStateFor(claimedCookie,second.data.token);
    const powerCrystalCount = state => {
      assert.ok(Array.isArray(state.inventoryItems), "server inventory is present");
      const quantity = Number(state.inventoryItems.find(item => item.item_key === "power_crystal")?.quantity ?? 0);
      assert.ok(Number.isSafeInteger(quantity) && quantity >= 0, "valid crystal balance");
      return quantity;
    };
    const fragmentBalances=state=>Object.fromEntries(Object.entries(state.equipmentFragments).map(([rarity,row])=>[rarity,Number(row.balance)]));
    const fragmentsBefore=fragmentBalances(attackerBefore);
    const crystalsBefore = powerCrystalCount(attackerBefore);
    const neutral = attackerBefore.territories.find(t => !t.owner_kingdom_id &&
      t.territory_kind !== "castle" && t.territory_kind !== "throne" &&
      !String(t.territory_key).startsWith("royal_throne_"));
    assert.ok(neutral,"PvE target exists");
    const attackArmy = 10;
    const attack = await actionFor(claimedCookie,second.data.token,
      {type:"march",marchType:"attack",targetId:neutral.id,units:{militia:attackArmy}});
    assert.equal(attack.status,200,"PvE attack dispatch");
    const activeAttack = attack.data.state.marches.find(m=>m.status==="marching"&&m.march_type==="attack");
    assert.ok(activeAttack,"PvE march exists");
    assert.equal(militiaCount(attack.data.state),militiaCount(attackerBefore)-attackArmy);
    const attackId=Number(activeAttack.id);
    assert.ok(Number.isSafeInteger(attackId)&&attackId>0);
    await command([...common,"execute","clash-of-izzy-beta-db","--local",
      "--persist-to",persist,"--command",
      "UPDATE marches SET arrives_at=datetime('now','-1 minute') WHERE id="+attackId+
      " AND kingdom_id="+Number(second.data.state.kingdom.id)+" AND status='marching'"]);
    await Promise.all([getStateFor(claimedCookie,second.data.token),getStateFor(claimedCookie,second.data.token)]);
    const resolvedAttack = await getStateFor(claimedCookie,second.data.token);
    assert.ok(!resolvedAttack.marches.some(m=>Number(m.id)===attackId&&m.status==="marching"));
    const previousReports=new Set(attackerBefore.battleReports.map(r=>r.id));
    const newReports=resolvedAttack.battleReports.filter(r=>!previousReports.has(r.id));
    assert.equal(newReports.length,1,"concurrent resolution creates exactly one battle report");
    const report=newReports[0];
    assert.equal(report.battle_type,"territory_pve");
    const losses=JSON.parse(report.losses_json||"{}");
    const lost=Number(losses.militia||0);
    assert.ok(Number.isInteger(lost)&&lost>=0&&lost<=attackArmy);
    assert.equal(militiaCount(resolvedAttack),militiaCount(attackerBefore)-lost,
      "survivors return once and casualties are conserved");
    const rewards=JSON.parse(report.rewards_json||"{}");
    assert.equal(typeof rewards.territoryCaptured,"boolean");
    assert.ok(Number.isInteger(rewards.criticalHits)&&rewards.criticalHits>=0);
    assert.equal(powerCrystalCount(resolvedAttack), crystalsBefore + (rewards.territoryCaptured ? 1 : 0),
      "only a successful capture grants exactly one power crystal");
    const expectedFragments={...fragmentsBefore};
    if(rewards.territoryCaptured){
      const level=Number(neutral.level),rarity=level>=20?"lendario":level>=12?"epico":level>=6?"raro":"comum";
      assert.deepEqual(rewards.equipmentFragments,{rarity,quantity:1});
      expectedFragments[rarity]+=1;
    }else assert.equal(rewards.equipmentFragments,undefined);
    assert.deepEqual(fragmentBalances(resolvedAttack),expectedFragments,"only actual capture awards its fragment");
    const repeated=await getStateFor(claimedCookie,second.data.token);
    assert.deepEqual(fragmentBalances(repeated),expectedFragments,"replay does not award another fragment");
    assert.equal(repeated.battleReports.filter(r=>!previousReports.has(r.id)).length,1);
    assert.equal(militiaCount(repeated),militiaCount(resolvedAttack));
    assert.equal(powerCrystalCount(repeated), powerCrystalCount(resolvedAttack),
      "repeated state reads cannot grant another crystal");
    console.log("Beta PvE attack passed: real combat resolution, one report, conserved troops and no duplicate return.");

    // Regression: a historical victory must not pay for a newly cancelled march.
    // Seed only the disposable local D1, using a different realm and neutral target.
    const cancelBefore = await getStateFor(cookie,start.data.token);
    const cancelTarget = cancelBefore.territories.find(t => !t.owner_kingdom_id &&
      Number(t.id) !== Number(neutral.id) && t.territory_kind !== "castle" &&
      t.territory_kind !== "throne" && !String(t.territory_key).startsWith("royal_throne_"));
    assert.ok(cancelTarget, "second neutral territory exists");
    assert.ok(militiaCount(cancelBefore) >= 1);
    const cancelKingdom = Number(cancelBefore.kingdom.id);
    const otherKingdom = Number(second.data.state.kingdom.id);
    const cancelTargetId = Number(cancelTarget.id);
    const sourceReportId = Number(report.id);
    for (const id of [cancelKingdom, otherKingdom, cancelTargetId, sourceReportId]) {
      assert.ok(Number.isSafeInteger(id) && id > 0);
    }
    const cancelDispatch = await actionFor(cookie,start.data.token,
      {type:"march",marchType:"attack",targetId:cancelTarget.id,units:{militia:1}});
    assert.equal(cancelDispatch.status,200);
    const cancelMarch = cancelDispatch.data.state.marches.find(m =>
      m.status === "marching" && m.march_type === "attack");
    assert.ok(cancelMarch);
    const cancelMarchId = Number(cancelMarch.id);
    assert.ok(Number.isSafeInteger(cancelMarchId) && cancelMarchId > 0);
    assert.equal(militiaCount(cancelDispatch.data.state),militiaCount(cancelBefore)-1);
    // Historical report and newly occupied target simulate a contested territory.
    await command([...common,"execute","clash-of-izzy-beta-db","--local","--persist-to",persist,"--command",
      "INSERT INTO battle_reports(attacker_kingdom_id,winner_kingdom_id,territory_id,battle_type,attacker_power,defender_power,losses_json,rewards_json,battle_log,replay_json) "+
      "SELECT "+cancelKingdom+","+cancelKingdom+","+cancelTargetId+",battle_type,attacker_power,defender_power,'{}',json_object('territoryCaptured',json('true'),'criticalHits',0),'[]','{}' "+
      "FROM battle_reports WHERE id="+sourceReportId+"; "+
      "UPDATE world_territories SET owner_kingdom_id="+otherKingdom+" WHERE id="+cancelTargetId+" AND owner_kingdom_id IS NULL;"]);
    const seeded = await getStateFor(cookie,start.data.token);
    const oldIds = new Set(cancelBefore.battleReports.map(r=>r.id));
    const historical = seeded.battleReports.filter(r=>!oldIds.has(r.id));
    assert.equal(historical.length,1,"exactly one synthetic historical victory");
    assert.equal(Number(historical[0].winner_kingdom_id),cancelKingdom);
    assert.equal(Number(seeded.territories.find(t=>Number(t.id)===cancelTargetId).owner_kingdom_id),otherKingdom);
    assert.equal(powerCrystalCount(seeded),powerCrystalCount(cancelBefore));
    await command([...common,"execute","clash-of-izzy-beta-db","--local","--persist-to",persist,"--command",
      "UPDATE marches SET arrives_at=datetime('now','-1 minute') WHERE id="+cancelMarchId+
      " AND kingdom_id="+cancelKingdom+" AND status='marching'"]);
    await Promise.all([getStateFor(cookie,start.data.token),getStateFor(cookie,start.data.token)]);
    const cancelled = await getStateFor(cookie,start.data.token);
    const seededIds = new Set(seeded.battleReports.map(r=>r.id));
    const cancelledReports = cancelled.battleReports.filter(r=>!seededIds.has(r.id));
    assert.equal(cancelledReports.length,1,"cancelled attack resolves exactly once");
    assert.equal(cancelledReports[0].winner_kingdom_id,null);
    assert.deepEqual(JSON.parse(cancelledReports[0].rewards_json),
      {territoryCaptured:false,criticalHits:0});
    assert.equal(powerCrystalCount(cancelled),powerCrystalCount(cancelBefore),
      "historical victory cannot grant a crystal for this cancelled attack");
    assert.equal(militiaCount(cancelled),militiaCount(cancelBefore),"cancelled troops return once");
    assert.ok(!cancelled.marches.some(m=>Number(m.id)===cancelMarchId&&m.status==="marching"));
    assert.deepEqual(fragmentBalances(cancelled),fragmentBalances(cancelBefore),"cancelled attack cannot grant fragments");
    const cancelledAgain = await getStateFor(cookie,start.data.token);
    assert.deepEqual(fragmentBalances(cancelledAgain),fragmentBalances(cancelBefore));
    assert.equal(powerCrystalCount(cancelledAgain),powerCrystalCount(cancelled));
    assert.equal(militiaCount(cancelledAgain),militiaCount(cancelled));
    console.log("Beta historical victory regression passed: cancelled attack returns troops without credit.");

    // Gathering credits must agree with the persistent resource ledger, not passive income.
    const gatherBefore = await getStateFor(cookie,start.data.token);
    const gatherTarget = gatherBefore.territories.find(t =>
      !t.owner_kingdom_id && t.territory_kind !== "castle" &&
      !String(t.territory_key).startsWith("royal_throne_") &&
      ["food","wood","stone","iron"].includes(t.resource_type));
    assert.ok(gatherTarget,"neutral gathering node exists");
    const gatherKingdom = Number(gatherBefore.kingdom.id);
    assert.ok(Number.isSafeInteger(gatherKingdom)&&gatherKingdom>0);
    const gatherRate = Math.max(1,Number(gatherTarget.resource_rate)||90);
    const readGatherLedger = async () => {
      const raw = await command([...common,"execute","clash-of-izzy-beta-db","--local",
        "--persist-to",persist,"--json","--command",
        "SELECT COUNT(*) AS entries, COALESCE(SUM(amount),0) AS total FROM resource_ledger "+
        "WHERE kingdom_id="+gatherKingdom+" AND resource='"+gatherTarget.resource_type+
        "' AND reason='coleta por marcha'"]);
      const output=JSON.parse(raw.trim());
      assert.equal(output.length,1);
      assert.equal(output[0].success,true);
      return output[0].results[0];
    };
    const ledgerBefore=await readGatherLedger();
    const gather=await actionFor(cookie,start.data.token,
      {type:"march",marchType:"gather",targetId:gatherTarget.id,units:{militia:1}});
    assert.equal(gather.status,200);
    const gatherMarch=gather.data.state.marches.find(m=>m.status==="marching"&&m.march_type==="gather");
    assert.ok(gatherMarch);
    const gatherId=Number(gatherMarch.id);
    assert.ok(Number.isSafeInteger(gatherId)&&gatherId>0);
    assert.equal(militiaCount(gather.data.state),militiaCount(gatherBefore)-1);
    await command([...common,"execute","clash-of-izzy-beta-db","--local",
      "--persist-to",persist,"--command",
      "UPDATE marches SET arrives_at=datetime('now','-1 minute') WHERE id="+gatherId+
      " AND kingdom_id="+gatherKingdom+" AND status='marching'"]);
    await Promise.all([getStateFor(cookie,start.data.token),getStateFor(cookie,start.data.token)]);
    const gathered=await getStateFor(cookie,start.data.token);
    assert.equal(militiaCount(gathered),militiaCount(gatherBefore));
    assert.equal(powerCrystalCount(gathered),powerCrystalCount(gatherBefore)+1);
    assert.ok(!gathered.marches.some(m=>Number(m.id)===gatherId&&m.status==="marching"));
    const ledgerAfter=await readGatherLedger();
    assert.equal(Number(ledgerAfter.entries),Number(ledgerBefore.entries)+1);
    assert.equal(Number(ledgerAfter.total),Number(ledgerBefore.total)+gatherRate);
    const gatheredAgain=await getStateFor(cookie,start.data.token);
    assert.equal(powerCrystalCount(gatheredAgain),powerCrystalCount(gathered));
    assert.equal(militiaCount(gatheredAgain),militiaCount(gathered));
    assert.deepEqual(await readGatherLedger(),ledgerAfter,"repeated reads cannot duplicate ledger credit");
    console.log("Beta gathering passed: exact ledger credit, one crystal and returned troops.");

    // A neutral resource node can be captured while a gathering march is in flight.
    const occupiedBefore=await getStateFor(cookie,start.data.token);
    const occupiedGather=await actionFor(cookie,start.data.token,
      {type:"march",marchType:"gather",targetId:gatherTarget.id,units:{militia:1}});
    assert.equal(occupiedGather.status,200);
    const occupiedMarch=occupiedGather.data.state.marches.find(m=>m.status==="marching"&&m.march_type==="gather");
    assert.ok(occupiedMarch);
    const occupiedMarchId=Number(occupiedMarch.id);
    const occupiedTargetId=Number(gatherTarget.id);
    for(const id of [occupiedMarchId,occupiedTargetId,otherKingdom])assert.ok(Number.isSafeInteger(id)&&id>0);
    await command([...common,"execute","clash-of-izzy-beta-db","--local",
      "--persist-to",persist,"--command",
      "UPDATE world_territories SET owner_kingdom_id="+otherKingdom+" WHERE id="+occupiedTargetId+
      " AND owner_kingdom_id IS NULL; UPDATE marches SET arrives_at=datetime('now','-1 minute') WHERE id="+occupiedMarchId+
      " AND kingdom_id="+gatherKingdom+" AND status='marching'"]);
    await Promise.all([getStateFor(cookie,start.data.token),getStateFor(cookie,start.data.token)]);
    const occupiedAfter=await getStateFor(cookie,start.data.token);
    assert.equal(Number(occupiedAfter.territories.find(t=>Number(t.id)===occupiedTargetId).owner_kingdom_id),otherKingdom);
    assert.equal(militiaCount(occupiedAfter),militiaCount(occupiedBefore),"troops return from occupied gathering node");
    assert.equal(powerCrystalCount(occupiedAfter),powerCrystalCount(occupiedBefore),"occupied node grants no crystal");
    assert.deepEqual(await readGatherLedger(),ledgerAfter,"occupied node grants no resource credit");
    assert.ok(!occupiedAfter.marches.some(m=>Number(m.id)===occupiedMarchId&&m.status==="marching"));
    console.log("Beta occupied gathering regression passed: no foreign territory credit, troops returned.");





    // Exercise competing queue mutations against the real local Worker and D1.
    // Only the disposable realm is funded; production and beta remote D1 are untouched.
    const queueRealm = Number(start.data.state.kingdom.id);
    assert.ok(Number.isSafeInteger(queueRealm) && queueRealm > 0);
    const localSql = async sql => command([...common,"execute","clash-of-izzy-beta-db","--local",
      "--persist-to",persist,"--command",sql]);
    // Synthetic ownership only in the disposable D1: verify progress follows the individual dragon.
    const dragonBeforeSwitch=await getStateFor(cookie,start.data.token);
    const originalDragon=dragonBeforeSwitch.dragon;
    await localSql("INSERT INTO kingdom_dragons(kingdom_id,dragon_key,source) VALUES("+queueRealm+",'mist_talon','game')");
    const switchTo=key=>actionFor(cookie,start.data.token,{type:"dragon_equip",dragonKey:key});
    const swapped=await switchTo("mist_talon");
    assert.equal(swapped.status,200);
    assert.equal(Number(swapped.data.state.dragon.level),1);
    assert.equal(Number(swapped.data.state.dragon.bond),1);
    assert.equal(Number(swapped.data.state.dragonCollection.find(x=>x.key===originalDragon.dragon_key).level),Number(originalDragon.level));
    const staleDragon=await actionFor(cookie,start.data.token,{type:"dragon_upgrade",dragonKey:originalDragon.dragon_key,expectedLevel:Number(originalDragon.level)});
    assert.equal(staleDragon.status,409);
    const restored=await switchTo(originalDragon.dragon_key);
    assert.equal(restored.status,200);
    assert.equal(Number(restored.data.state.dragon.level),Number(originalDragon.level));
    assert.equal(Number(restored.data.state.dragon.bond),Number(originalDragon.bond));
    assert.equal(Number(restored.data.state.dragon.experience),Number(originalDragon.experience));
    // Real API collection returns the passive for each individually persisted creature.
    assert.equal(restored.data.state.dragonCollection.find(x=>x.key===originalDragon.dragon_key).elementalSkill.rank,0);
    assert.equal(swapped.data.state.dragonCollection.find(x=>x.key==="mist_talon").elementalSkill.nextMilestone,20);
    console.log("Beta individual dragon progression passed: switch and restore without transferring progress.");
    const siteBefore=await getStateFor(cookie,start.data.token);
    const sitePos={type:"city_special_position",building:"dragon_nest",gridX:22,gridZ:22,fromX:null,fromZ:null};
    const siteRace=await Promise.all([actionFor(cookie,start.data.token,sitePos),actionFor(cookie,start.data.token,{...sitePos,building:"summon_altar"})]);
    assert.deepEqual(siteRace.map(x=>x.status).sort((a,b)=>a-b),[200,409]);
    const siteAfter=await getStateFor(cookie,start.data.token);
    assert.equal(siteAfter.specialCityBuildings.length,1);
    const site=siteAfter.specialCityBuildings[0],farm=siteAfter.buildings.find(x=>x.building_type==="farm");
    assert.equal((await actionFor(cookie,start.data.token,{type:"city_layout_move",building:"farm",gridX:22,gridZ:22,fromX:Number(farm.position_x),fromZ:Number(farm.position_z)})).status,409);
    assert.equal((await actionFor(cookie,start.data.token,{...sitePos,building:site.building_type,gridX:23})).status,400);
    assert.equal((await actionFor(cookie,start.data.token,{...sitePos,building:site.building_type,gridX:-25,gridZ:-25,fromX:22,fromZ:22})).status,200);
    assert.equal((await actionFor(cookie,start.data.token,{...sitePos,building:site.building_type,gridX:0,gridZ:0,fromX:22,fromZ:22})).status,409);
    assert.equal((await getStateFor(claimedCookie,second.data.token)).specialCityBuildings.length,0);
    console.log("Beta special city placements passed: concurrent collision, normal building guard, CAS and ownership.");
    const countEvents = async type => {
      assert.ok(["research_started","research_upgraded","troop_training_started","troops_trained"].includes(type));
      const raw = await command([...common,"execute","clash-of-izzy-beta-db","--local",
        "--persist-to",persist,"--json","--command",
        "SELECT COUNT(*) AS n FROM kingdom_events WHERE kingdom_id="+queueRealm+" AND event_type='"+type+"'"]);
      const result = JSON.parse(raw.trim());
      assert.equal(result[0].success,true);
      return Number(result[0].results[0].n);
    };
    await localSql("UPDATE kingdoms SET wood=10000,food=10000,stone=10000,iron=10000 WHERE id="+queueRealm);
    const researchLevel = state => Number(state.research.find(row=>row.research_key==="economy")?.level||0);
    const initialResearch = await getStateFor(cookie,start.data.token);
    const researchStarts = await countEvents("research_started");
    const researchFinishes = await countEvents("research_upgraded");
    const researchRace = await Promise.all(Array.from({length:2},()=>actionFor(cookie,start.data.token,
      {type:"research",research:"economy"})));
    assert.deepEqual(researchRace.map(x=>x.status).sort((a,b)=>a-b),[200,409],
      "only one competing research action may reserve the single slot");
    const researchQueued = await getStateFor(cookie,start.data.token);
    const researchQueue = researchQueued.queues.filter(q=>q.queue_type==="research"&&q.status==="running");
    assert.equal(researchQueue.length,1);
    assert.equal(researchQueue[0].target_key,"economy");
    assert.equal(await countEvents("research_started"),researchStarts+1);
    await localSql("UPDATE kingdom_queues SET started_at='2000-01-01T00:00:00.000Z',completes_at='2000-01-01T00:01:00.000Z' WHERE kingdom_id="+queueRealm+
      " AND queue_type='research' AND status='running'");
    await Promise.all([getStateFor(cookie,start.data.token),getStateFor(cookie,start.data.token)]);
    const researchDone = await getStateFor(cookie,start.data.token);
    assert.equal(researchLevel(researchDone),researchLevel(initialResearch)+1);
    assert.equal(await countEvents("research_upgraded"),researchFinishes+1);
    assert.equal(researchDone.queues.filter(q=>q.queue_type==="research"&&q.status==="running").length,0);
    assert.equal(researchLevel(await getStateFor(cookie,start.data.token)),researchLevel(researchDone));
    assert.equal(await countEvents("research_upgraded"),researchFinishes+1);

    // New science requires completed economy and exact level, with the existing single research slot.
    const scienceBefore=await getStateFor(cookie,start.data.token);
    const scholarship=scienceBefore.academyScience.find(x=>x.key==="scholarship");
    assert.equal(scholarship.available,true);assert.equal(scholarship.level,0);
    assert.equal((await actionFor(cookie,start.data.token,{type:"research",research:"field_logistics",expectedLevel:0})).status,409);
    const study={type:"research",research:"scholarship",expectedLevel:0};
    const scienceRace=await Promise.all([actionFor(cookie,start.data.token,study),actionFor(cookie,start.data.token,study)]);
    assert.deepEqual(scienceRace.map(x=>x.status).sort((a,b)=>a-b),[200,409]);
    await localSql("UPDATE kingdom_queues SET started_at='2000-01-01T00:00:00.000Z',completes_at='2000-01-01T00:01:00.000Z' WHERE kingdom_id="+queueRealm+" AND queue_type='research' AND status='running'");
    const scienceDone=await getStateFor(cookie,start.data.token);
    assert.equal(scienceDone.academyScience.find(x=>x.key==="scholarship").bonusPercent,1.5);
    assert.equal((await actionFor(cookie,start.data.token,study)).status,409);
    const lockedImperial=scienceDone.academyScience.find(x=>x.key==="imperial_attack");
    assert.equal(lockedImperial.unlockedMax,0);
    assert.equal(lockedImperial.available,false);
    assert.equal((await actionFor(cookie,start.data.token,{type:"research",research:"imperial_attack",expectedLevel:0})).status,409);
    const initialTraining = await getStateFor(cookie,start.data.token);
    assert.ok(Number(initialTraining.troopCapacity)-Number(initialTraining.armyCount)>=6,
      "synthetic kingdom has room for two small training batches");
    const trainingStarts = await countEvents("troop_training_started");
    const trainingFinishes = await countEvents("troops_trained");
    const trainingRace = await Promise.all(Array.from({length:3},()=>actionFor(cookie,start.data.token,
      {type:"train",unit:"militia",quantity:3})));
    const accepted = trainingRace.filter(x=>x.status===200).length;
    assert.ok(accepted>=1&&accepted<=2,"one or two slots can be reserved, never three");
    assert.ok(trainingRace.every(x=>[200,409].includes(x.status)),"all conflicting requests fail safely");
    const trainingQueued = await getStateFor(cookie,start.data.token);
    const activeTraining = trainingQueued.queues.filter(q=>q.queue_type==="training"&&q.status==="running");
    assert.equal(activeTraining.length,accepted);
    assert.equal(new Set(activeTraining.map(q=>q.queue_slot)).size,accepted);
    assert.equal(activeTraining.reduce((n,q)=>n+Number(q.quantity),0),accepted*3);
    assert.equal(await countEvents("troop_training_started"),trainingStarts+accepted);
    await localSql("UPDATE kingdom_queues SET started_at='2000-01-01T00:00:00.000Z',completes_at='2000-01-01T00:01:00.000Z' WHERE kingdom_id="+queueRealm+
      " AND queue_type='training' AND status='running'");
    await Promise.all([getStateFor(cookie,start.data.token),getStateFor(cookie,start.data.token)]);
    const trainingDone = await getStateFor(cookie,start.data.token);
    assert.equal(militiaCount(trainingDone),militiaCount(initialTraining)+accepted*3);
    assert.equal(trainingDone.queues.filter(q=>q.queue_type==="training"&&q.status==="running").length,0);
    assert.equal(await countEvents("troops_trained"),trainingFinishes+accepted);
    assert.equal(militiaCount(await getStateFor(cookie,start.data.token)),militiaCount(trainingDone));
    assert.equal(await countEvents("troops_trained"),trainingFinishes+accepted);
    console.log("Beta queue races passed: research once, training slot bounds and exactly-once completion.");

    // Real D1/Worker path: free fragment forge, compare-and-swap reinforcement and replay.
    await localSql("UPDATE kingdoms SET gold=10000,iron=10000 WHERE id="+queueRealm);
    const gearBefore=await getStateFor(cookie,start.data.token);
    const sword=gearBefore.equipment.find(e=>e.id==="iron_sword");
    assert.equal(sword.enhancement,0);
    const shardBefore=gearBefore.equipmentFragments.comum.balance;
    const forged=await actionFor(cookie,start.data.token,{type:"equipment_fragment_forge",rarity:"comum"});
    assert.equal(forged.status,200);
    assert.equal(forged.data.state.equipmentFragments.comum.balance,shardBefore+10);
    const enhance=()=>actionFor(cookie,start.data.token,{type:"equipment_enhance",itemId:"iron_sword",expectedEnhancement:0});
    const enhancementRace=await Promise.all([enhance(),enhance()]);
    assert.deepEqual(enhancementRace.map(x=>x.status).sort((a,b)=>a-b),[200,409]);
    const gearAfter=await getStateFor(cookie,start.data.token);
    const reinforced=gearAfter.equipment.find(e=>e.id==="iron_sword");
    assert.equal(reinforced.enhancement,1);
    assert.equal(reinforced.level,sword.level);
    assert.equal(reinforced.stats.attack,Number((sword.stats.attack*1.025).toFixed(4)));
    assert.equal(gearAfter.equipmentFragments.comum.balance,shardBefore);
    assert.equal((await enhance()).status,409,"replay cannot charge again");
    assert.equal((await getStateFor(cookie,start.data.token)).equipmentFragments.comum.balance,shardBefore);
    console.log("Beta equipment reinforcement passed: free forge, concurrent CAS, persisted stat and replay.");

    // Normal equipment level is separate from reinforcement and must also reject replay.
    const normalBefore=await getStateFor(cookie,start.data.token);
    const normalSword=normalBefore.equipment.find(e=>e.id==="iron_sword");
    const heroId=Number(normalBefore.heroes[0]?.id);
    assert.ok(Number.isSafeInteger(heroId)&&heroId>0,"starter hero available");
    assert.equal((await actionFor(cookie,start.data.token,{type:"equipment_upgrade",itemId:"iron_sword"})).status,400);
    const upgrade=()=>actionFor(cookie,start.data.token,{type:"equipment_upgrade",itemId:"iron_sword",expectedLevel:normalSword.level});
    const equip=()=>actionFor(cookie,start.data.token,{type:"equipment_equip",itemId:"iron_sword",heroId});
    const [upgradeA,upgradeB,equipped]=await Promise.all([upgrade(),upgrade(),equip()]);
    assert.deepEqual([upgradeA.status,upgradeB.status].sort((a,b)=>a-b),[200,409]);
    assert.equal(equipped.status,200);
    assert.equal((await upgrade()).status,409,"sequential replay must be rejected");
    const normalAfter=await getStateFor(cookie,start.data.token);
    const finalSword=normalAfter.equipment.find(e=>e.id==="iron_sword");
    assert.equal(finalSword.level,normalSword.level+1);
    assert.equal(finalSword.enhancement,normalSword.enhancement);
    const binding=normalAfter.heroEquipment.find(e=>e.item_key==="iron_sword");
    assert.equal(Number(binding?.hero_id),heroId);
    assert.equal(Number(binding?.level),finalSword.level);
    console.log("Beta normal equipment level and concurrent hero equip passed.");

    // Synthetic fragments only: the production inventory is never touched.
    await localSql("UPDATE hero_inventory SET stars=1,fragments=100 WHERE kingdom_id="+queueRealm+" AND hero_key='kael_sunwarden'");
    const heroStars=state=>state.heroInventory.find(h=>h.hero_key==="kael_sunwarden");
    const beforeStars=heroStars(await getStateFor(cookie,start.data.token));
    assert.equal(beforeStars.stars,1);
    assert.equal(beforeStars.talent.rank,0);
    assert.equal(beforeStars.talent.role,"infantaria");
    assert.equal(beforeStars.talent.nextMilestone.stars,2);
    assert.equal(beforeStars.fragments_to_next,10);
    assert.equal(beforeStars.can_evolve,true);
    assert.equal((await actionFor(cookie,start.data.token,{type:"hero_evolve",hero:"kael_sunwarden"})).status,400);
    const evolve=()=>actionFor(cookie,start.data.token,{type:"hero_evolve",hero:"kael_sunwarden",expectedStars:1});
    const starRace=await Promise.all([evolve(),evolve()]);
    assert.deepEqual(starRace.map(x=>x.status).sort((a,b)=>a-b),[200,409]);
    assert.equal((await evolve()).status,409,"old star requests cannot debit again");
    const afterStars=heroStars(await getStateFor(cookie,start.data.token));
    assert.equal(afterStars.stars,2);
    assert.equal(afterStars.fragments,90);
    assert.equal(afterStars.fragments_to_next,20);
    assert.ok(afterStars.stats.attack>beforeStars.stats.attack);
    const maxStars=Number(afterStars.max_stars);
    assert.ok(Number.isSafeInteger(maxStars)&&maxStars>=2&&maxStars<=8);
    await localSql("UPDATE hero_inventory SET stars="+maxStars+",fragments=1000 WHERE kingdom_id="+queueRealm+" AND hero_key='kael_sunwarden'");
    const capped=heroStars(await getStateFor(cookie,start.data.token));
    assert.equal(capped.can_evolve,false);
    assert.equal(capped.fragments_to_next,null);
    assert.equal((await actionFor(cookie,start.data.token,{type:"hero_evolve",hero:"kael_sunwarden",expectedStars:maxStars})).status,409);
    assert.equal(heroStars(await getStateFor(cookie,start.data.token)).fragments,1000);
    console.log("Beta hero stars passed: exact cost, concurrent CAS, replay, stat increase and rarity cap.");
    // Disposable D1 fixture: move five active militia to wounded, not new troops.
    await localSql("UPDATE kingdoms SET food=10000 WHERE id="+queueRealm);
    await localSql("UPDATE army_units SET quantity=quantity-5,wounded=wounded+5 WHERE kingdom_id="+queueRealm+" AND unit_type='militia' AND tier=1 AND quantity>=5");
    const beforeHeal=await getStateFor(cookie,start.data.token);
    const patient=beforeHeal.hospital.patients.find(x=>x.unit==="militia"&&x.tier===1);
    assert.ok(patient&&patient.wounded>=5);
    const heal={type:"hospital_heal",unit:"militia",tier:1,quantity:5,expectedWounded:patient.wounded};
    const healRace=await Promise.all([actionFor(cookie,start.data.token,heal),actionFor(cookie,start.data.token,heal)]);
    assert.deepEqual(healRace.map(x=>x.status).sort((a,b)=>a-b),[200,409]);
    assert.equal((await actionFor(cookie,start.data.token,heal)).status,409);
    const afterHeal=await getStateFor(cookie,start.data.token);
    assert.equal(afterHeal.hospital.wounded,beforeHeal.hospital.wounded-5);
    assert.equal(afterHeal.totalTroops,beforeHeal.totalTroops+5);
    assert.equal(afterHeal.armyCount,beforeHeal.armyCount);
    console.log("Beta hospital recovery passed: wounded to active, capacity conserved and replay rejected.");

    const methods = await http(base, "/api/store/payment-methods", {cookie});
    assert.equal(methods.status, 200);
    assert.deepEqual(methods.data, {mercadoPago:false,nubankPix:false});
    const checkout = await http(base, "/api/store/checkout", {method:"POST",body:{},cookie});
    assert.equal(checkout.status, 503);
    assert.equal(checkout.data.code, "BETA_PAYMENTS_DISABLED");
    const world = await http(base, "/world.html", {cookie});
    assert.equal(world.status, 200, "world map from legacy game is available");
    const market = await http(base, "/market.html", {cookie});
    assert.equal(market.status, 200, "free resource market is available");

    // Use a real browser with a fresh synthetic invite; never contact external services.
    if (process.env.BETA_BROWSER_SMOKE === "1") {
      const { chromium, devices } = await import("@playwright/test");
      const browser = await chromium.launch({
        headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
      });
      try {
        const context = await browser.newContext({
          ...devices["Pixel 5"], serviceWorkers: "allow"
        });
        await context.route("**/*", route => {
          const url = new URL(route.request().url());
          return url.origin === base ? route.continue() : route.abort();
        });
        const pwaRegistrationAttempts = [];
        await context.exposeBinding("__betaRecordServiceWorkerRegistration", (_source, url) => {
          pwaRegistrationAttempts.push(String(url));
        });
        await context.addInitScript(() => {
          if (!navigator.serviceWorker) return;
          const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
          navigator.serviceWorker.register = (...args) => {
            window.__betaRecordServiceWorkerRegistration(args[0]);
            return register(...args);
          };
        });
        const page = await context.newPage();
        const localAssetErrors = [];
        page.on("response", response => {
          const url = new URL(response.url());
          if (url.origin === base && response.status() >= 400 &&
              (url.pathname.endsWith(".js") || url.pathname.endsWith(".css") ||
               url.pathname.startsWith("/assets/3d/") || url.pathname.startsWith("/vendor/three/"))) {
            localAssetErrors.push(response.status() + " " + url.pathname);
          }
        });
        await page.goto(base + "/kingdom.html");
        await page.waitForURL(base + "/beta-access.html");
        await page.evaluate(() => localStorage.setItem("coi_graphics_preference", "2d"));
        await page.locator("#code").fill(browserInvite);
        await page.locator("#submit").click();
        await page.waitForURL(base + "/kingdom.html");
        await page.locator("#game").waitFor({state:"visible", timeout:45_000});
        await page.waitForFunction(() => document.querySelector("#status")?.textContent.includes("Reino sincronizado"));
        await page.waitForFunction(() => window.__coiKingdomQuality?.tier === "2d");
        const firstToken = await page.evaluate(() => localStorage.getItem("coi_game_token"));
        assert.ok(firstToken, "browser persists the realm session");
        assert.ok(await page.locator("#city .building").count() > 0, "city controls render in lightweight mode");
        await page.waitForFunction(() => ["castle", "castle-running", "army", "army-running", "world", "alliance"].includes(document.querySelector("#coiJourneyAction")?.dataset.phase));
        assert.ok(await page.locator("#coiRoyalJourney").isVisible(), "server-backed journey is visible in the beta");
        await page.reload();
        await page.locator("#game").waitFor({state:"visible", timeout:45_000});
        await page.waitForFunction(() => document.querySelector("#status")?.textContent.includes("Reino sincronizado"));
        const sameToken = await page.evaluate(() => localStorage.getItem("coi_game_token"));
        assert.ok(sameToken === firstToken, "reloading must resume the same realm without creating a new one");

        // Authenticate with the actual browser session, then exercise the real training API.
        const auth = {Authorization:"Bearer " + firstToken, Origin:base};
        const readBrowserState = async () => {
          const response = await context.request.get(base + "/api/game/state", {headers:auth});
          assert.equal(response.status(), 200, "browser kingdom state is readable");
          return (await response.json()).state;
        };
        const nestResponse=await context.request.post(base+"/api/game/action",{headers:auth,data:{type:"city_special_position",building:"dragon_nest",gridX:22,gridZ:22,fromX:null,fromZ:null}});
        assert.equal(nestResponse.status(),200,"browser realm nest persisted");
        const altarResponse=await context.request.post(base+"/api/game/action",{headers:auth,data:{type:"city_special_position",building:"summon_altar",gridX:17,gridZ:22,fromX:null,fromZ:null}});
        assert.equal(altarResponse.status(),200,"browser realm altar persisted");
        const beforeTraining = await readBrowserState();
        const realmId = Number(beforeTraining.kingdom.id);
        assert.ok(Number.isSafeInteger(realmId) && realmId > 0);
        const archerCount = state => Number(state.troops.find(
          unit => unit.unit_type === "archer" && Number(unit.tier) === 1
        )?.quantity || 0);
        const beforeArchers = archerCount(beforeTraining);
        const training = await context.request.post(base + "/api/game/action", {
          headers:auth, data:{type:"train",unit:"archer",quantity:3}
        });
        assert.equal(training.status(), 200, "archer training succeeds in a new kingdom");
        const queued = (await training.json()).state;
        assert.ok(queued.queues.some(row => row.queue_type === "training" &&
          row.target_key === "archer" && row.status === "running" && Number(row.quantity) === 3));
        assert.equal(archerCount(queued), beforeArchers, "queued troops are not granted early");
        // Advance the queue only in the disposable local D1, using the same clock fixture
        // as the construction test. The real Worker, not SQL, awards the troops.
        await command([...common, "execute", "clash-of-izzy-beta-db", "--local",
          "--persist-to", persist, "--command",
          "UPDATE kingdom_queues SET started_at=datetime('now','-2 minutes'), completes_at=datetime('now','-1 minute') WHERE kingdom_id=" +
          realmId + " AND queue_type='training' AND target_key='archer' AND status='running'"]);
        const completedTraining = await readBrowserState();
        assert.equal(archerCount(completedTraining), beforeArchers + 3);
        assert.equal(archerCount(await readBrowserState()), beforeArchers + 3,
          "repeated state reads cannot award the same training twice");
        await page.reload();
        await page.locator("#game").waitFor({state:"visible",timeout:45_000});
        await page.waitForFunction(expected => window.__coiKingdomTroops?.some(
          row => row.unit_type === "archer" && Number(row.quantity) === expected
        ), beforeArchers + 3);
        console.log("Beta training passed: 3 archers awarded once and persisted in browser state.");

        await page.locator("#coiGraphicsPreset").selectOption("balanced");
        await page.locator("#coiGraphicsApply").click();
        await page.waitForFunction(() => window.__coiKingdomDiagnostics?.()?.available === true,
          null, {timeout:45_000});
        await page.locator("#game").waitFor({state:"visible", timeout:45_000});
        assert.equal(await page.locator("#kingdom3d").count(), 1, "real WebGL canvas is attached");
        await page.locator("#coiCityCameraControls").waitFor({state:"visible",timeout:45_000});
        const zoomReset = page.locator('[data-city-zoom="reset"]');
        await zoomReset.click();
        assert.ok(await page.locator("#coiRoyalJourney").isVisible(), "journey coexists with WebGL camera");
        assert.ok(await page.locator("#city .building:not([hidden])").count() > 0, "visible city controls after camera reset");
        // A canvas may be present while the renderer silently uses fallback models.
        // Require actual decoded GLB templates before recording visual evidence.
        await page.waitForFunction(() => {
          const info = window.__coiKingdomDiagnostics?.();
          return info?.available && info.loadedGlbTemplates?.buildings >= 2 &&
            info.loadedGlbTemplates?.props >= 2 && info.loadedGlbTemplates?.units >= 1 &&
            info.pendingGlbLoads === 0 &&
            info.drawCalls > 0 && info.triangles > 0;
        }, null, {timeout:45_000});
        const refreshCounts = await page.evaluate(async () => {
          const before = window.__coiKingdomDiagnostics().optionalSceneRefreshes;
          window.dispatchEvent(new CustomEvent("coi:kingdom-render", {detail:{
            buildings:window.__coiKingdomBuildings,
            troops:window.__coiKingdomTroops,
            defenses:window.__coiKingdomDefenses,
            heroes:window.__coiKingdomHeroAssignments,
            castleSkinId:window.__coiKingdomCastleSkin,
            castleVipLevel:window.__coiKingdomCastleVipLevel
          }}));
          // The manifest promise is already resolved; flush its continuation
          // and the former empty Promise.all continuation before sampling.
          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();
          return {before,after:window.__coiKingdomDiagnostics().optionalSceneRefreshes};
        });
        assert.ok(refreshCounts.before >= 1, "initial optional models refresh the scene");
        assert.equal(refreshCounts.after,refreshCounts.before,
          "unchanged kingdom state must not trigger an extra optional model rebuild");
        const diagnostics = await page.evaluate(() => window.__coiKingdomDiagnostics());
        assert.ok(diagnostics.troopFigures.some(x=>x.type==="archer"&&!x.procedural),"trained archers use the decoded GLB");
        assert.ok(diagnostics.troopFigures.length<=8,"balanced figure budget");
        const equippedDragon=await page.evaluate(()=>window.__coiKingdomDragon);
        assert.ok(equippedDragon?.dragon_key,"server-backed equipped dragon");
        assert.equal(diagnostics.dragonVisual?.key,equippedDragon.dragon_key,"only equipped dragon is represented");
        assert.equal(diagnostics.dragonVisual.animated,false,"balanced profile keeps dragon static");
        assert.deepEqual(diagnostics.specialLandmarks.map(x=>x.type).sort(),["dragon_nest","summon_altar"]);
        for(const model of diagnostics.specialLandmarks)assert.ok(Number.isFinite(model.x)&&Number.isFinite(model.z));
        const evidence = path.join(root, "test-results", "beta-visual");
        await mkdir(evidence, {recursive:true});
        await page.locator("#city").screenshot({path:path.join(evidence,"kingdom-3d.png")});
        await writeFile(path.join(evidence,"renderer.json"), JSON.stringify(diagnostics,null,2));
        console.log("Decoded beta GLB templates: " + JSON.stringify(diagnostics.loadedGlbTemplates));
        assert.deepEqual(localAssetErrors, [], "browser must not encounter missing graphics/script/style assets");
        // Trigger a real GPU context loss (not a synthetic DOM event).
        const simulatedLoss = await page.evaluate(() => {
          const canvas = document.querySelector("#kingdom3d");
          const gl = canvas?.getContext("webgl2");
          const extension = gl?.getExtension("WEBGL_lose_context");
          if (!extension) return false;
          extension.loseContext();
          return true;
        });
        assert.equal(simulatedLoss,true,"software WebGL supports deliberate context loss");
        await page.waitForFunction(() => !document.querySelector("#kingdom3d") &&
          !document.querySelector("#city").classList.contains("has-3d") &&
          document.querySelector("#coiGraphicsStatus").textContent.includes("Modo 2D ativo"));
        assert.ok(await page.locator("#city .building").first().isVisible(),"2D building controls remain usable");
        assert.equal(await page.locator("#coiCityCameraControls").isVisible(),false,"camera controls hidden after GPU loss");
        assert.ok(await page.locator("#city .building:not([hidden])").count() <= 9,"2D fallback retains at most nine controls");
        assert.ok(await page.locator("#coiRoyalJourney").isVisible(),"journey remains available in fallback");
        assert.equal(await page.locator("#coiGraphicsPreset").inputValue(),"balanced");
        assert.equal(await page.locator("#coiGraphicsApply").isEnabled(),true,"same graphics profile can be retried");
        assert.equal(await page.evaluate(() => localStorage.getItem("coi_game_token")),firstToken);
        await page.locator("#city").screenshot({path:path.join(evidence,"kingdom-2d-fallback.png")});
        await page.locator("#coiGraphicsApply").click();
        await page.waitForFunction(() => window.__coiKingdomDiagnostics?.()?.available === true,
          null,{timeout:45_000});
        await page.locator("#game").waitFor({state:"visible",timeout:45_000});
        await page.waitForFunction(() => window.__coiKingdomDiagnostics?.()?.loadedGlbTemplates?.units >= 1,
          null,{timeout:45_000});
        assert.equal(await page.evaluate(() => localStorage.getItem("coi_game_token")),firstToken);
        assert.deepEqual(localAssetErrors, [], "graphics recovery must not lose private assets");
        console.log("Beta WebGL recovery passed: actual context loss, playable 2D fallback, same-profile retry and persisted troops.");
        // A real temporary network outage must not hide the existing kingdom.
        await context.setOffline(true);
        await page.waitForFunction(() => !navigator.onLine);
        await page.locator("#refresh").click();
        await page.waitForFunction(() => document.querySelector("#status").classList.contains("error"));
        assert.equal(await page.locator("#game").isVisible(),true,"last known kingdom stays visible offline");
        const resumedState = page.waitForResponse(response =>
          new URL(response.url()).pathname === "/api/game/state" && response.status() === 200);
        await context.setOffline(false);
        await resumedState;
        await page.waitForFunction(() => document.querySelector("#status").textContent.includes("Reino sincronizado"));
        assert.equal(await page.evaluate(() => localStorage.getItem("coi_game_token")),firstToken);
        assert.equal(await page.evaluate(() => window.__coiKingdomTroops.find(row =>
          row.unit_type === "archer" && Number(row.tier) === 1)?.quantity), beforeArchers + 3);
        // A separate anonymous tab loses its creation response. Never repeat the
        // uncertain POST automatically when an online event is received.
        const guestContext = await browser.newContext({ ...devices["Pixel 5"], serviceWorkers:"block" });
        try {
          await guestContext.addCookies(await context.cookies());
          await guestContext.addInitScript(() => localStorage.setItem("coi_graphics_preference","2d"));
          let startAttempts = 0;
          let createdStatus = null;
          let createdRealm = null;
          await guestContext.route("**/*", async route => {
            const url = new URL(route.request().url());
            if (url.origin !== base) return route.abort();
            if (url.pathname === "/api/game/start" && route.request().method() === "POST") {
              startAttempts += 1;
              // Let the real Worker commit before discarding its response.
              // Never forward or log the synthetic realm's returned token.
              const response = await route.fetch({maxRedirects:0,maxRetries:0});
              try {
                createdStatus = response.status();
                createdRealm = (await response.json()).state?.kingdom?.id;
              } finally {
                await response.dispose();
                await route.abort("connectionreset");
              }
              return;
            }
            return route.continue();
          });
          const guest = await guestContext.newPage();
          await guest.goto(base + "/kingdom.html");
          await guest.waitForFunction(() => document.querySelector("#loading").textContent.includes("A criação pode ter sido processada"));
          assert.equal(startAttempts,1,"first creation response was lost");
          assert.equal(createdStatus,201,"Worker successfully created the realm before the response was lost");
          assert.ok(Number(createdRealm)>0,"a real realm was committed");
          await guest.evaluate(() => window.dispatchEvent(new Event("online")));
          await guest.waitForFunction(() => document.querySelector("#status").textContent.includes("A criação anterior pode ter sido processada"));
          assert.equal(startAttempts,1,"reconnection cannot duplicate uncertain guest creation");
          assert.equal(await guest.locator("#retryConnection").count(),0);
        } finally {
          await guestContext.close();
        }
        console.log("Beta connection recovery passed: preserved realm, successful resync, no duplicate anonymous creation.");
        await page.goto(base + "/world.html");
        assert.equal(new URL(page.url()).pathname, "/world.html");
        await page.waitForLoadState("load");
        assert.deepEqual(pwaRegistrationAttempts, [], "closed beta must not attempt official service worker registration");
        assert.equal(await page.evaluate(async () =>
          (await navigator.serviceWorker.getRegistrations()).length), 0,
          "closed beta has no installed service worker in a fresh browser");
        console.log("Beta online-only runtime passed: service workers enabled in browser, no registration attempts.");
        console.log("Mobile Chromium beta passed: real invite, playable 2D realm, persisted session, WebGL initialization, world navigation.");
      } finally {
        await browser.close();
      }
    }

    const logout = await http(base, "/api/beta/access/logout",
      {method:"POST",cookie,origin:base});
    assert.equal(logout.status, 200);
    const after = await http(base, "/api/game/state", {cookie,bearer:start.data.token});
    assert.equal(after.status, 403, "logged-out beta cookie blocks former game token");
    const revokedJourney = await http(base, "/scripts/royal-journey.js", {cookie});
    assert.equal(revokedJourney.status, 302, "revoked invitation blocks the journey module");
    const revokedAsset = await http(base, "/scripts/kingdom-3d.js", {cookie});
    assert.equal(revokedAsset.status, 302, "revoked invite cannot reload private renderer");
    assert.equal(new URL(revokedAsset.headers.get("location")).pathname, "/beta-access.html");
    console.log("Offline beta runtime passed: health, invites, castle upgrade and scheduled completion, 4X mill persistence, kingdom, world, free market, payment lock, logout.");
  } finally {
    if (processWorker) {
      processWorker.kill("SIGTERM");
      await Promise.race([new Promise(resolve => processWorker.once("close", resolve)),
        delay(3000)]).catch(() => {});
      if (processWorker.exitCode === null) processWorker.kill("SIGKILL");
    }
    await rm(cfgFile, { force:true });
    await rm(persist, { recursive:true, force:true });
  }
});
