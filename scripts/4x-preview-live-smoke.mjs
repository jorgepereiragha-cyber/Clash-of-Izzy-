// Exercita o Worker real contra D1 Preview, nunca o banco de producao.
// Somente utilizado no workflow de homologacao com Wrangler dev --remote.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const config=JSON.parse(await readFile(process.env.STAGING_CONFIG_PATH||"wrangler.4x-smoke.generated.jsonc","utf8"));
const PREVIEW_ID="6674c0ac-3636-4e57-bff8-23cf60ab9637";
const PROD_ID="7e63af59-d9ff-4159-a9cf-b02e35b92605";
assert.equal(config.d1_databases?.[0]?.database_id,PREVIEW_ID);
assert.notEqual(config.d1_databases?.[0]?.database_id,PROD_ID);
assert.equal(config.vars?.GAME_4X_SYSTEMS_ENABLED,"true");
assert.equal(config.name,"clash-of-izzy-4x-api-smoke");
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const cloudToken=process.env.CLOUDFLARE_API_TOKEN;
assert.match(account||"",/^[0-9a-fA-F]{32}$/);
assert.ok(cloudToken?.length>10);
const cloudUrl=`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${PREVIEW_ID}/query`;
async function db(sql,params=[]){
  assert.ok(/^\s*(SELECT|UPDATE|DELETE)\b/i.test(sql),"D1 smoke statement denied");
  const response=await fetch(cloudUrl,{method:"POST",headers:{
    Authorization:"Bearer "+cloudToken,"Content-Type":"application/json"
  },body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(30000)});
  const value=await response.json();
  assert.equal(value.success,true,"Cloudflare Preview D1 rejected synthetic test SQL");
  return value.result?.[0]?.results||[];
}
const gameUrl=process.env.GAME_SMOKE_BASE||"http://127.0.0.1:8787";
assert.equal(new URL(gameUrl).hostname,"127.0.0.1");
let playerId=null,kingdomId=null,gameToken=null;
const actions=[];
async function game(path,method="GET",body=null){
  const headers={"accept":"application/json"};
  if(method==="POST")headers["content-type"]="application/json";
  if(gameToken)headers.authorization="Bearer "+gameToken;
  const response=await fetch(gameUrl+path,{method,headers,
    body:body===null?undefined:JSON.stringify(body),signal:AbortSignal.timeout(55000)});
  let data;try{data=await response.json()}catch{data={error:"invalid json"}}
  return {status:response.status,data};
}
const report=(name,ok)=>{actions.push(name);assert.ok(ok,name);console.log("PASS_4X_SMOKE="+name);};
try{
  const before=await db("SELECT COUNT(*) AS n FROM players");
  assert.equal(Number(before[0]?.n),0,"Preview is not isolated: players already exist");
  const created=await game("/api/game/start","POST",{});
  assert.equal(created.status,201,"Preview game/start failed: "+JSON.stringify(created.data?.error));
  gameToken=created.data?.token;playerId=created.data?.state?.player?.player_id;
  assert.match(playerId||"",/^izzy_[a-f0-9]{32}$/);
  assert.ok(typeof gameToken==="string"&&gameToken.length>20);
  report("synthetic-game-start",true);
  const owned=await db("SELECT id FROM kingdoms WHERE player_id=(SELECT id FROM players WHERE player_id=?)",[playerId]);
  assert.equal(owned.length,1);
  kingdomId=Number(owned[0].id);
  assert.ok(Number.isSafeInteger(kingdomId)&&kingdomId>0);
  let state=created.data.state;
  report("4x-state-enabled",state?.advanced4xEnabled===true&&state.playerProgression?.phase==="P1"&&state.castleVip);
  const catalog=state.defenseCatalog;
  assert.equal(catalog.tower.width,2);
  const initialDefense=await game("/api/game/action","POST",{type:"city_defense_place",defense:"tower",gridX:20,gridZ:20});
  report("server-denies-tower-before-castle-5",initialDefense.status===409);
  await db("UPDATE kingdoms SET castle_level=7 WHERE id=?",[kingdomId]);
  await db("UPDATE kingdom_buildings SET level=7 WHERE kingdom_id=? AND building_type='castle'",[kingdomId]);
  state=(await game("/api/game/state")).data.state;
  const beforeWood=Number(state.kingdom.wood);
  const beforeStone=Number(state.kingdom.stone);
  const placed=await game("/api/game/action","POST",{type:"city_defense_place",defense:"tower",gridX:20,gridZ:20});
  assert.equal(placed.status,200,JSON.stringify(placed.data?.error));
  report("tower-in-preview-d1",placed.data.state?.cityDefenses?.some(d=>d.defense_type==="tower"&&d.grid_x===20&&d.grid_z===20));
  state=placed.data.state;
  report("server-debits-tower-cost-once",beforeWood-Number(state.kingdom.wood)===catalog.tower.wood&&
    beforeStone-Number(state.kingdom.stone)===catalog.tower.stone);
  const duplicate=await game("/api/game/action","POST",{type:"city_defense_place",defense:"trap",gridX:20,gridZ:20});
  report("overlapping-defense-rejected",duplicate.status===409);
  const afterOverlap=(await game("/api/game/state")).data.state;
  report("overlap-does-not-debit",Number(afterOverlap.kingdom.wood)===Number(state.kingdom.wood)&&
    Number(afterOverlap.kingdom.stone)===Number(state.kingdom.stone));
  const starterHero=state.heroInventory?.find(h=>h.hero_key==="kael_sunwarden");
  report("starter-hero-owned",starterHero?.type==="infantaria");
  const wronglySpecialized=await game("/api/game/action","POST",{
    type:"assign_hero_to_building",building:"mill",heroKey:"kael_sunwarden"
  });
  report("wrong-hero-specialty-rejected",wronglySpecialized.status===400);
  const beforeAssignmentPower=Number(afterOverlap.kingdom.defense_power);
  const heroAssigned=await game("/api/game/action","POST",{
    type:"assign_hero_to_defense",defense:"tower",heroKey:"kael_sunwarden"
  });
  assert.equal(heroAssigned.status,200,JSON.stringify(heroAssigned.data?.error));
  report("owned-hero-assigned-to-tower",heroAssigned.data.state?.heroes?.some(h=>
    h.hero_key==="kael_sunwarden"&&h.assigned_to==="defense:tower"));
  report("assigned-hero-raises-only-tower-defense",Number(heroAssigned.data.state?.kingdom?.defense_power)>beforeAssignmentPower);
  const repeated=await game("/api/game/action","POST",{
    type:"assign_hero_to_defense",defense:"tower",heroKey:"kael_sunwarden"
  });
  report("repeat-hero-assignment-not-stacked",repeated.status===200&&
    Number(repeated.data.state?.kingdom?.defense_power)===Number(heroAssigned.data.state?.kingdom?.defense_power));
  const unassigned=await game("/api/game/action","POST",{
    type:"unassign_hero_4x",heroKey:"kael_sunwarden"
  });
  report("hero-unassign-restores-defense",unassigned.status===200&&
    Number(unassigned.data.state?.kingdom?.defense_power)===beforeAssignmentPower);
  await db("UPDATE heroes SET level=10 WHERE kingdom_id=? AND hero_key='kael_sunwarden'",[kingdomId]);
  await db("UPDATE hero_inventory SET level=10 WHERE kingdom_id=? AND hero_key='kael_sunwarden'",[kingdomId]);
  const stagedHero=await game("/api/game/action","POST",{
    type:"assign_hero_to_defense",defense:"tower",heroKey:"kael_sunwarden"
  });
  report("hero-level-10-visible-in-4x-state",stagedHero.status===200&&
    stagedHero.data.state?.heroes?.some(h=>h.hero_key==="kael_sunwarden"&&Number(h.level)>=10));
  const mill=await game("/api/game/action","POST",{type:"industry_upgrade",industry:"mill"});
  assert.equal(mill.status,200,JSON.stringify(mill.data?.error));
  report("mill-level-2",Number(mill.data.state?.intermediateResources?.mill_level)===2);
  const preFood=Number(mill.data.state?.kingdom.food);
  await db("UPDATE kingdoms SET last_production_at=datetime('now','-1 hour') WHERE id=?",[kingdomId]);
  const produced=await game("/api/game/state");
  assert.equal(produced.status,200,JSON.stringify(produced.data?.error));
  const food=Number(produced.data.state?.kingdom.food);
  report("wheat-to-flour-to-food",food-preFood>=11&&food-preFood<=13);
  const again=await game("/api/game/state");
  report("second-tick-no-duplicated-food",Number(again.data.state?.kingdom.food)-food<=1);
  const queued=await game("/api/game/action","POST",{type:"upgrade",building:"farm"});
  assert.equal(queued.status,200,JSON.stringify(queued.data?.error));
  const rows=await db("SELECT id FROM kingdom_queues WHERE kingdom_id=? AND queue_type='construction' AND target_key='farm' AND status='running'",[kingdomId]);
  assert.equal(rows.length,1);
  await db("UPDATE kingdom_queues SET started_at=datetime('now','-120 minutes'),completes_at=datetime('now','-60 minutes') WHERE id=?",[rows[0].id]);
  const completed=await game("/api/game/state");
  assert.equal(completed.status,200,JSON.stringify(completed.data?.error));
  const xp=Number(completed.data.state?.playerProgression?.xp||0);
  report("legitimate-completion-grants-xp",xp>=200);
  const replay=await game("/api/game/state");
  report("xp-idempotent-after-repeat",Number(replay.data.state?.playerProgression?.xp||0)===xp);
  const vip=replay.data.state.castleVip;
  report("legacy-vip-preserved",vip&&Number(vip.level||0)===0);
  if(process.env.RUN_4X_BROWSER_SMOKE==="true"){
    const {chromium}=await import("@playwright/test");
    const {mkdir}=await import("node:fs/promises");
    const browser=await chromium.launch({headless:true});
    try{
      const context=await browser.newContext({viewport:{width:390,height:844},
        deviceScaleFactor:2,isMobile:true,hasTouch:true});
      await context.addInitScript(token=>{
        localStorage.setItem("coi_game_token",token);
        sessionStorage.setItem("coi_game_token",token);
      },gameToken);
      const page=await context.newPage();
      const jsErrors=[];
      page.on("pageerror",error=>jsErrors.push(String(error.message||error)));
      await page.goto(gameUrl+"/kingdom.html",{waitUntil:"domcontentloaded",timeout:60000});
      const panel=page.locator("#coiFourXPanel");
      await panel.waitFor({state:"visible",timeout:60000});
      const fourX=await page.evaluate(()=>window.__coiCityLayoutState?.()?.advanced4xEnabled);
      report("mobile-preview-4x-panel-visible",fourX===true);
      const stock=await page.locator("#coiIndustryStock").textContent();
      report("mobile-preview-industry-stock",stock?.includes("Trigo:")&&stock?.includes("Farinha:"));
      const progression=await page.locator("#coiProgressionStatus").textContent();
      report("mobile-preview-progression",progression?.includes("P1")&&progression?.includes("XP"));
      report("mobile-preview-defense-catalog",(await page.locator("#coiDefenseType option").count())===3);
      await page.locator("#coiHeroRole").selectOption("defense:tower");
      const summary=await page.locator("#coiHeroSummary").textContent();
      report("mobile-preview-assigned-hero",summary?.includes("Kael")&&await page.locator("#coiHeroUnassign").isEnabled());
      await page.locator("#coiDefenseType").selectOption("tower");
      await page.locator("#coiDefenseX").fill("20");
      await page.locator("#coiDefenseZ").fill("20");
      report("mobile-preview-overlap-rejected",await page.locator("#coiDefensePlace").isDisabled());
      await page.locator("#coiDefenseX").fill("22");
      await page.locator("#coiDefenseZ").fill("22");
      report("mobile-preview-free-plot-enabled",await page.locator("#coiDefensePlace").isEnabled());
      await mkdir("test-results/4x-mobile-preview",{recursive:true});
      await panel.screenshot({path:"test-results/4x-mobile-preview/controls.png",timeout:30000});
      await page.screenshot({path:"test-results/4x-mobile-preview/viewport.png",timeout:30000});
      report("mobile-preview-no-fatal-javascript",jsErrors.length===0);
      console.log("PREVIEW_4X_MOBILE_UI=success; screenshots from synthetic Preview account");
    }finally{await browser.close();}
  }
  console.log("PREVIEW_HTTP_SMOKE_RESULT=success; no production queries or writes");
}finally{
  if(playerId&&/^izzy_[a-f0-9]{32}$/.test(playerId)){
    try{
      if(kingdomId){
        await db("DELETE FROM world_territories WHERE territory_key=? AND owner_kingdom_id=?",
          ["kingdom_castle_"+kingdomId,kingdomId]);
      }
      await db("DELETE FROM players WHERE player_id=?",[playerId]);
      const remaining=await db("SELECT COUNT(*) AS n FROM players WHERE player_id=?",[playerId]);
      assert.equal(Number(remaining[0]?.n),0,"Synthetic test player cleanup failed");
      console.log("PREVIEW_SYNTHETIC_PLAYER_CLEANUP=success");
    }catch(error){
      console.error("PREVIEW_SYNTHETIC_PLAYER_CLEANUP=failed",String(error?.message||error));
      process.exitCode=1;
    }
  }
}
