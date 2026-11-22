import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DAILY_REWARDS,nextRewardDay } from "../daily-rewards.js";
import { SUPPORT_TIERS } from "../support-orders.js";

const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("sete dias de recompensas têm valores fixos e sequência UTC determinística",()=>{
  assert.deepEqual(DAILY_REWARDS.map(reward=>reward.day),[1,2,3,4,5,6,7]);
  assert.deepEqual(DAILY_REWARDS.map(reward=>reward.gems),[50,0,100,0,150,0,500]);
  assert.equal(DAILY_REWARDS[6].heroFragments,1);
  assert.equal(nextRewardDay(undefined,0,"2026-11-22"),1);
  assert.equal(nextRewardDay("2026-11-21",1,"2026-11-22"),2);
  assert.equal(nextRewardDay("2026-11-21",7,"2026-11-22"),1);
  assert.equal(nextRewardDay("2026-11-20",3,"2026-11-22"),1);
  assert.equal(nextRewardDay("2026-11-22",3,"2026-11-22"),1);
});

test("ledger de resgates usa chave única e créditos protegidos por changes()",async()=>{
  const [daily,migration,tutorial,onboardingMigration]=await Promise.all([
    read("daily-rewards.js"),read("migrations/0037_daily_login_rewards.sql"),
    read("onboarding-bonus.js"),read("migrations/0038_onboarding_bonus.sql")
  ]);
  assert.match(migration,/PRIMARY KEY\(player_id, claim_date\)/);
  assert.match(daily,/INSERT OR IGNORE INTO daily_reward_claims/);
  assert.match(daily,/UPDATE players SET gems=gems\+CASE/);
  assert.match(daily,/AND changes\(\)=1/);
  assert.match(onboardingMigration,/player_id INTEGER PRIMARY KEY/);
  assert.match(tutorial,/INSERT OR IGNORE INTO onboarding_bonus_claims/);
  assert.match(tutorial,/UPDATE players SET gems=gems\+500 WHERE player_id=\? AND changes\(\)=1/);
  assert.match(tutorial,/queue_type='construction' AND q\.target_key='farm'/);
  assert.match(tutorial,/queue_type='training'/);
});

test("UI de reino e rotas autenticadas estão integradas",async()=>{
  const [html,ui,worker,sw]=await Promise.all([
    read("kingdom.html"),read("player-engagement.js"),read("worker.js"),read("sw.js")
  ]);
  for(const id of ["onboardingPanel","onboardingClaim","dailyRewardsPanel","dailyClaim","onboardingStatus"])
    assert.ok(html.includes('id="'+id+'"'),"missing "+id);
  assert.match(html,/src="\/player-engagement\.js"/);
  assert.match(ui,/Authorization:"Bearer "\s*\+\s*auth/);
  assert.match(ui,/\/api\/game\/analytics/);
  assert.match(worker,/\/api\/game\/onboarding/);
  assert.match(worker,/\/api\/game\/daily-reward/);
  assert.match(sw,/player-engagement\.js/);
  assert.match(sw,/clash-of-izzy-shell-v53/);
});

test("contribuições voluntárias são separadas de pacotes de gemas",async()=>{
  const [module,sql,mp,portal,apoie]=await Promise.all([
    read("support-orders.js"),read("migrations/0039_support_orders.sql"),
    read("mercadopago-orders.js"),read("portal.html"),read("apoie.html")
  ]);
  assert.equal(SUPPORT_TIERS.escudeiro.amountCents,1000);
  assert.equal(SUPPORT_TIERS.cavaleiro.amountCents,5000);
  assert.equal(SUPPORT_TIERS.senhor.amountCents,20000);
  assert.match(sql,/UNIQUE\(player_id, request_key\)/);
  assert.match(module,/mp_checkout_url/);
  assert.match(module,/received===order.amount_cents/);
  assert.match(mp,/finalizeSupportOrder/);
  assert.doesNotMatch(module,/UPDATE players SET gems|INSERT INTO player_skins/);
  assert.match(apoie,/data-voluntary="escudeiro"/);
  assert.match(portal,/api\/public\/stats/);
  assert.doesNotMatch(portal,/1247|8542|clashofizzy@pix\.com/);
});
