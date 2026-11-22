import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LEVEL_PACKS,getLevelPackByName,getPackForLevel,publicLevelPack,levelPackMatchesOrder,levelPackGrantStatements,levelPacksEnabledForPlayer,levelPackPriceApproved } from "../level-packs.js";
const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("P1-P8 possuem precos positivos, recompensas deterministicas e limites 10-80", () => {
  assert.deepEqual(LEVEL_PACKS.map(x => x.level),[10,20,30,40,50,60,70,80]);
  assert.deepEqual(LEVEL_PACKS.map(x => x.phase),["P1","P2","P3","P4","P5","P6","P7","P8"]);
  for(const pack of LEVEL_PACKS){
    assert.equal(Number.isSafeInteger(pack.priceCents),true);
    assert.ok(pack.priceCents > 0 && pack.gems > 0);
    assert.equal(Object.values(pack.resources).every(n => Number.isSafeInteger(n) && n >= 0),true);
    assert.equal(getLevelPackByName(pack.name),pack);
    assert.equal(publicLevelPack(pack).oneTime,true);
  }
  assert.equal(levelPackPriceApproved({},LEVEL_PACKS[2]),true);
  assert.equal(levelPackPriceApproved({},LEVEL_PACKS[3]),false);
  assert.equal(levelPackPriceApproved({LEVEL_PACKS_PROPOSED_PRICES_APPROVED:"true"},LEVEL_PACKS[7]),true);
  assert.equal(publicLevelPack(LEVEL_PACKS[3],{}).priceProvisional,true);
  assert.equal(getPackForLevel(9),null);
  assert.equal(getPackForLevel("20").phase,"P2");
  assert.equal(getPackForLevel(80).phase,"P8");
  assert.equal(getPackForLevel(-1),null);
  assert.equal(getPackForLevel(12.5),null);
});

test("a flag de rollout nao vende a todos sem autorizacao publica",()=>{
  const env={LEVEL_PACKS_ENABLED:"true",GAME_4X_SYSTEMS_ENABLED:"true",LEVEL_PACKS_TEST_PLAYER_IDS:"izzy_a,izzy_b"};
  assert.equal(levelPacksEnabledForPlayer(env,"izzy_a"),true);
  assert.equal(levelPacksEnabledForPlayer(env,"izzy_c"),false);
  assert.equal(levelPacksEnabledForPlayer({...env,LEVEL_PACKS_PUBLIC_ENABLED:"true"},null),true);
  assert.equal(levelPacksEnabledForPlayer({...env,GAME_4X_SYSTEMS_ENABLED:"false"},"izzy_a"),false);
  assert.equal(levelPacksEnabledForPlayer({...env,LEVEL_PACKS_ENABLED:"false"},"izzy_a"),false);
  assert.equal(levelPacksEnabledForPlayer({},null),false);
});

test("pacote somente combina com pedido originado no servidor, incluindo preco e gemas",()=>{
  const pack=LEVEL_PACKS[0];
  const order={ product_kind:"vip_package",product_name:pack.name,product_id:11,gems_amount:500,price_brl:9.9 };
  assert.equal(levelPackMatchesOrder(pack,order),true);
  assert.equal(levelPackMatchesOrder(pack,{...order,price_brl:0.01}),false);
  assert.equal(levelPackMatchesOrder(pack,{...order,gems_amount:99999}),false);
  assert.equal(levelPackMatchesOrder(pack,{...order,product_kind:"skin"}),false);
});

test("concessao por pacote fica num mesmo batch com ledger exclusivo e changes condicionais",()=>{
  const calls=[];
  const db={prepare(sql){return {bind(...args){calls.push({sql,args});return {sql,args};}};}};
  const stmts=levelPackGrantStatements(db,200,12,LEVEL_PACKS[1]);
  assert.equal(stmts.length,3);
  assert.match(stmts[0].sql,/INSERT OR IGNORE INTO level_pack_claims/);
  assert.match(stmts[0].sql,/status='approved'/);
  assert.match(stmts[1].sql,/UPDATE players SET gems=gems\+\?/);
  assert.match(stmts[1].sql,/changes\(\)=1/);
  assert.match(stmts[2].sql,/UPDATE kingdoms SET wood=wood\+\?/);
  assert.match(stmts[2].sql,/changes\(\)=1/);
  assert.equal(calls[0].args[0],20);
});

test("migracao e integracao proíbem compra sem progresso e mantêm habilitacao fechada",async()=>{
  const migration=await read("migrations/0042_level_packs_p1_p8.sql");
  const worker=await read("worker.js");
  const mp=await read("mercadopago-orders.js");
  const arena=await read("arena.html");
  assert.match(migration,/UNIQUE \(kingdom_id,pack_level\)/);
  assert.match(worker,/levelPacksEnabledForPlayer/);
  assert.match(worker,/getKingdomProgression\(env,kingdom.id\)/);
  assert.match(worker,/progression.level < levelPack.level/);
  assert.match(worker,/FROM level_pack_claims WHERE kingdom_id=\? AND pack_level=\?/);
  assert.match(mp,/levelPackGrantStatements/);
  assert.match(mp,/levelPackMatchesOrder/);
  assert.match(mp,/levelPacksEnabledForPlayer/);
  assert.match(arena,/item.levelPack/);
});

test("catalogo P1-P8 segue os valores solicitados e migracao 0043 nao substitui IDs",async()=>{
  const expected=[
    [10,990,500,5000,5000,0,0,0],
    [20,2990,2000,20000,0,10000,5000,0],
    [30,5990,5000,50000,0,30000,15000,5000],
    [40,9990,10000,100000,50000,50000,25000,10000],
    [50,14990,20000,200000,100000,100000,50000,20000],
    [60,19990,35000,350000,150000,150000,75000,30000],
    [70,29990,60000,500000,250000,250000,100000,50000],
    [80,49990,100000,1000000,500000,500000,200000,100000]
  ];
  assert.deepEqual(LEVEL_PACKS.map(p=>[
    p.level,p.priceCents,p.gems,p.resources.wood,p.resources.food,
    p.resources.stone,p.resources.iron,p.resources.gold
  ]),expected);
  const sql=await read("migrations/0043_align_level_pack_catalog.sql");
  assert.match(sql,/UPDATE vip_packages SET/);
  assert.doesNotMatch(sql,/^\s*(?:INSERT|REPLACE|DELETE|DROP|ALTER)\b/im);
  for(const p of LEVEL_PACKS.slice(3)){
    assert.match(sql,new RegExp("WHEN '"+p.name+"' THEN "+(p.priceCents/100).toFixed(2).replace(".","\\.")));
    assert.match(sql,new RegExp("WHEN '"+p.name+"' THEN "+p.gems+"\\b"));
  }
  assert.equal(levelPackPriceApproved({},LEVEL_PACKS[7]),false);
});
