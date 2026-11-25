import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {scienceEnabled} from "../castle-science.js";
import {hospitalEnabled} from "../hospital-policy.js";
import {specialCityEnabled} from "../city-layout-rules.js";
import {betaAccessGuard} from "../beta-access.js";
test("production candidate enables only gameplay and preserves production isolation",async()=>{
 const config=JSON.parse(await readFile(new URL("../wrangler.jsonc",import.meta.url),"utf8"));
 assert.equal(config.vars.ENVIRONMENT,"production");
 assert.equal(config.d1_databases[0].database_name,"clash-of-izzy-db");
 assert.notEqual(config.d1_databases[0].database_id,config.previews.d1_databases[0].database_id);
 for(const flag of ["LEVEL_PACKS_ENABLED","LEVEL_PACKS_PUBLIC_ENABLED","LEVEL_PACKS_PROPOSED_PRICES_APPROVED","MASTER_PACK_ENABLED"])assert.equal(config.vars[flag],"false");
 assert.equal(config.vars.INVITE_ONLY,undefined);
 for(const gate of [scienceEnabled,hospitalEnabled,specialCityEnabled]){
  assert.equal(gate(config.vars),true);
  assert.equal(gate({...config.vars,GAME_4X_SYSTEMS_ENABLED:"false"}),false);
  assert.equal(gate({...config.vars,ENVIRONMENT:"unknown"}),false);
 }
 assert.equal(await betaAccessGuard(new Request("https://example.com/kingdom.html"),config.vars),null);
 const ignore=await readFile(new URL("../.assetsignore",import.meta.url),"utf8");
 for(const name of ["beta-access.js","castle-science.js","hospital-policy.js","city-special-buildings.js","equipment-enhancement.js"])assert.ok(ignore.split("\n").includes(name));
 assert.ok(!ignore.split("\n").includes("index.html"));
});
