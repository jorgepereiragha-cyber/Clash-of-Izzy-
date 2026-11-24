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
    const dragon = await actionFor(cookie,start.data.token,{type:"dragon_upgrade"});
    assert.equal(dragon.status,200,"dragon progression: " + JSON.stringify(dragon.data).slice(0,300));
    assert.equal(Number(dragon.data.state.dragon.level),Number(legacyBefore.dragon.level)+1);
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
    const repeated=await getStateFor(claimedCookie,second.data.token);
    assert.equal(repeated.battleReports.filter(r=>!previousReports.has(r.id)).length,1);
    assert.equal(militiaCount(repeated),militiaCount(resolvedAttack));
    console.log("Beta PvE attack passed: real combat resolution, one report, conserved troops and no duplicate return.");


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
