import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('player portal provides browser game, PWA, Android build and a clearly labelled shop', async () => {
  const [portal, index, navigation, sw] = await Promise.all([
    read('portal.html'), read('index.html'), read('navigation.js'), read('sw.js')
  ]);
  assert.match(portal, /href="\/kingdom\.html"/);
  assert.match(portal, /beforeinstallprompt/);
  assert.match(portal, /actions\/workflows\/android-apk\.yml/);
  assert.match(portal, /APK de teste não equivale/);
  assert.match(portal, /Nubank/);
  assert.match(portal, /Mercado Pago/);
  assert.match(index, /href="\/portal\.html"/);
  assert.match(navigation, /href:"\/portal\.html"/);
  assert.match(sw, /"\/portal\.html"/);
});

test('Nubank Pix cannot be selected until a server flag enables the assisted workflow', async () => {
  const [worker, arena] = await Promise.all([read('worker.js'), read('arena.html')]);
  assert.match(worker, /\/api\/store\/payment-methods/);
  assert.match(worker, /nubankPix:env\.NUBANK_PIX_ENABLED==="true"/);
  assert.match(worker, /requestedPaymentMethod==="pix" && env\.NUBANK_PIX_ENABLED!=="true"/);
  assert.match(worker, /"NUBANK_PIX_NOT_CONFIGURED"/);
  assert.match(arena, /<option value="pix" disabled>/);
  assert.match(arena, /pixOption\.disabled=methods\.nubankPix!==true/);
  assert.match(arena, /if\(paymentMethod==='pix'\)/);
  assert.match(arena, /'Pedido #'/);
  assert.match(arena, /Solicitar cobrança Nubank Pix/);
});

test('Pix requests remain pending and never call Mercado Pago checkout or auto-fulfill', async () => {
  const [worker, mercado, arena] = await Promise.all([
    read('worker.js'), read('mercadopago-orders.js'), read('arena.html')
  ]);
  assert.match(worker, /const paymentMethod=requestedPaymentMethod/);
  assert.match(worker, /INSERT INTO purchase_requests/);
  assert.match(mercado, /order\.payment_method !== "mercadopago_link"/);
  assert.match(arena, /if\(paymentMethod==='pix'\)/);
  const pix = arena.slice(arena.indexOf("if(paymentMethod==='pix'){"), arena.indexOf("notice.textContent='Pedido #'+requestId+' registrado. Gerando checkout individual…'"));
  assert.ok(pix.length > 200);
  assert.doesNotMatch(pix, /store\/checkout|checkoutUrl/);
  assert.doesNotMatch(pix, /NUBANK_PIX_COPY_PASTE|pixKey|chave pix/);
});

test('portal does not hardcode banking details or imply online payment is active', async () => {
  const portal = await read('portal.html');
  assert.doesNotMatch(portal, /(?:\b\d{11}\b|\b\d{14}\b)/);
  assert.match(portal, /cobrança Pix gerada na conta do recebedor/);
  assert.match(portal, /só pode operar depois de habilitada/);
});
