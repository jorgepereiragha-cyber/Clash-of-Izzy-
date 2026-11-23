import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('isolated portal markets Android only without game routes or PWA', async () => {
  const [portal, index, navigation, sw] = await Promise.all([
    read('portal.html'), read('index.html'), read('navigation.js'), read('sw.js')
  ]);
  assert.match(portal, /id="download-apk"/);
  assert.doesNotMatch(portal, /id="play-browser"|kingdom\.html/);
  assert.match(portal, /id="download-apk-final" aria-disabled="true"/);
  assert.match(portal, /releases\/latest/);
  assert.match(portal, /clash-of-izzy-android\.apk/);
  assert.match(portal, /\.sha256/);
  assert.match(portal, /aria-disabled="true"/);
  assert.match(portal, /asset\.state !== "uploaded"/);
  assert.match(portal, /url\.hostname === "github\.com"/);
  assert.doesNotMatch(portal, /href="\/(?:kingdom|world|arena|events|alliance)\.html"/);
  assert.doesNotMatch(portal, /beforeinstallprompt|install-pwa|href="\/manifest\.json"/);
  assert.match(index, /http-equiv="refresh" content="0;url=\/portal\.html"/);
  assert.match(index, /href="\/portal\.html"/);
  assert.doesNotMatch(index, /href="\/(?:kingdom|world|arena|events|alliance)\.html"/);
  assert.match(navigation, /path === "\/index\.html" \|\| path === "\/portal\.html"/);
  assert.match(sw, /"\/portal\.html"/);
});

test('Nubank Pix cannot be selected until a server flag enables the assisted workflow', async () => {
  const [worker, arena] = await Promise.all([read('worker.js'), read('arena.html')]);
  assert.match(worker, /\/api\/store\/payment-methods/);
  assert.match(worker, /visiblePaymentMethods\(env,nubankPixReady\(env\)\)/);
  assert.match(worker, /requestedPaymentMethod==="pix" && !nubankPixReady\(env\)/);
  assert.match(worker, /"NUBANK_PIX_NOT_CONFIGURED"/);
  assert.match(arena, /<option value="pix" disabled>/);
  assert.match(arena, /pixOption\.disabled=!paymentMethodStatus\.nubankPix/);
  assert.match(arena, /paymentMethodStatus=\{known:true,mercadoPago:methods\.mercadoPago===true,nubankPix:methods\.nubankPix===true\}/);
  assert.match(arena, /mpOption\.disabled=!paymentMethodStatus\.mercadoPago/);
  assert.match(arena, /if\(paymentMethod==='pix'\)/);
  assert.match(arena, /'Pedido #'/);
  assert.match(arena, /Solicitar cobrança Nubank Pix/);
});

test('Pix requests remain pending and never call Mercado Pago checkout or auto-fulfill', async () => {
  const [worker, mercado, arena] = await Promise.all([
    read('worker.js'), read('mercadopago-orders.js'), read('arena.html')
  ]);
  assert.match(worker, /requestedPaymentMethod==="pix"\?"pix":"manual"/);
  assert.match(worker, /INSERT INTO purchase_requests/);
  assert.match(mercado, /order\.payment_method !== "mercadopago_link"/);
  assert.match(worker, /body\.bankStatementConfirmed!==true/);
  const admin = await read('admin.html');
  assert.match(admin, /Conferi no extrato Nubank/);
  assert.match(arena, /if\(paymentMethod==='pix'\)/);
  const pix = arena.slice(arena.indexOf("if(paymentMethod==='pix'){"), arena.indexOf("const checkoutResponse=await fetch(API_BASE+'/store/checkout'"));
  assert.ok(pix.length > 200);
  assert.doesNotMatch(pix, /store\/checkout|checkoutUrl/);
  assert.match(pix, /store\/pix-instructions/);
  assert.doesNotMatch(pix, /NUBANK_PIX_COPY_PASTE|chave pix hardcoded/i);
});

test('public portal does not publish account details, banking data or payment controls', async () => {
  const portal = await read('portal.html');
  assert.doesNotMatch(portal, /(?:\b\d{11}\b|\b\d{14}\b)/);
  assert.doesNotMatch(portal, /NUBANK_PIX_ENABLED|MP_ACCESS_TOKEN|chave pix|Pix copia e cola/i);
  assert.doesNotMatch(portal, /href="\/arena\.html"|checkout|beforeinstallprompt/i);
  assert.match(portal, /Baixar APK Android/);
});

test('Nubank CPF recipient key is never hardcoded and is returned only to an authenticated pending-order owner',async()=>{
 const worker=await read('worker.js');
 const arena=await read('arena.html');
 assert.match(worker,/NUBANK_PIX_KEY/);
 assert.match(worker,/NUBANK_PIX_RECEIVER_VERIFIED/);
 assert.match(worker,/function nubankPixReady\(env\)/);
 assert.match(worker,/\/api\/store\/pix-instructions/);
 assert.match(worker,/player_id=\(SELECT id FROM players WHERE player_id=\?\)/);
 assert.match(worker,/payment_method='pix' AND status='pending'/);
 assert.match(worker,/rateLimitDecision\(env,"pix-instructions-player"/);
 assert.match(arena,/id="pixKeyValue" readonly/);
 assert.match(arena,/navigator\.clipboard\.writeText\(key\)/);
 const portal=await read('portal.html');
 assert.doesNotMatch(portal,/NUBANK_PIX_KEY|pixKeyValue|paymentMethod/);
});
