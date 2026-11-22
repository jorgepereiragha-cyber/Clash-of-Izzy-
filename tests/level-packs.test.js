import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LEVEL_PACKS,getLevelPackByName,getPackForLevel,publicLevelPack,levelPackMatchesOrder,levelPackGrantStatements } from "../level-packs.js";
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
  assert.equal(getPackForLevel(9),null);
  assert.equal(getPackForLevel("20").phase,"P2");
  assert.equal(getPackForLevel(80).phase,"P8");
  assert.equal(getPackForLevel(-1),null);
  assert.equal(getPackForLevel(12.5),null);
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
  assert.match(worker,/LEVEL_PACKS_ENABLED/);
  assert.match(worker,/getKingdomProgression\(env,kingdom.id\)/);
  assert.match(worker,/progression.level < levelPack.level/);
  assert.match(worker,/FROM level_pack_claims WHERE kingdom_id=\? AND pack_level=\?/);
  assert.match(mp,/levelPackGrantStatements/);
  assert.match(mp,/levelPackMatchesOrder/);
  assert.match(mp,/LEVEL_PACKS_ENABLED/);
  assert.match(arena,/item.levelPack/);
});
