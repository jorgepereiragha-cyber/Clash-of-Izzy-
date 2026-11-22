import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {DAILY_PACKAGES,DAILY_PACKAGE_COOLDOWN_HOURS,isDailyPackage} from "../daily-package-offers.js";
const read=async path=>readFile(new URL("../"+path,import.meta.url),"utf8");
test("Three paid tiers are 3.99, 9.99, 49.99 BRL with unique names and increasing gems",()=>{
  assert.equal(DAILY_PACKAGES.length,3);
  assert.deepEqual(DAILY_PACKAGES.map(item=>item.priceBRL),[3.99,9.99,49.99]);
  assert.deepEqual(DAILY_PACKAGES.map(item=>item.gems),[35,100,600]);
  assert.equal(new Set(DAILY_PACKAGES.map(item=>item.name)).size,3);
  assert.equal(DAILY_PACKAGE_COOLDOWN_HOURS,24);
  for(const item of DAILY_PACKAGES)assert.equal(isDailyPackage(item.name),true);
  assert.equal(isDailyPackage("VIP Ouro"),false);
});
test("Migrations seed prices once and never grant value without a confirmed purchase",async()=>{
  const first=await read("migrations/0031_entry_package_399.sql");
  const second=await read("migrations/0032_daily_packages.sql");
  assert.match(first,/Pacote Inicial de Eldoria', 3\.99, 35/);
  assert.match(second,/Pacote Diário de Eldoria',9\.99,100/);
  assert.match(second,/Pacote Premium Diário de Eldoria',49\.99,600/);
  assert.match(second,/INSERT OR IGNORE INTO vip_packages/);
  assert.doesNotMatch(second,/UPDATE players|INSERT INTO players|INSERT INTO player_skins/i);
});
test("Daily purchase guard is atomic in D1 and checks only approved orders from rolling last 24h",async()=>{
  const worker=await read("worker.js"),arena=await read("arena.html");
  assert.match(worker,/const dailyPurchase=kind==="vip_package"&&isDailyPackage\(item\.name\)/);
  assert.match(worker,/SELECT \?,\?,\?,\?,\?,\?,'BRL',\?,\?,\?,\? WHERE NOT EXISTS/);
  assert.match(worker,/status='approved' AND COALESCE\(reviewed_at,created_at\)>=datetime\('now','-24 hours'\)/);
  assert.match(worker,/DAILY_PACKAGE_LIMIT/);
  assert.match(worker,/dailyLimitHours:DAILY_PACKAGE_COOLDOWN_HOURS/);
  assert.match(arena,/limite: 1 compra a cada 24 horas/);
});
