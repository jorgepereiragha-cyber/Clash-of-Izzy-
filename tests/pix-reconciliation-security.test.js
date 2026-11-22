import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizePixEndToEndId, preparePixApproval } from "../pix-reconciliation.js";

const id = "E12345678" + "A".repeat(23);
test("Pix requires a complete bank-statement EndToEndId, never a screenshot or random receipt", () => {
  assert.equal(id.length, 32);
  assert.equal(normalizePixEndToEndId(id), id);
  assert.equal(normalizePixEndToEndId(" "+id.toLowerCase()+" "), id);
  for (const invalid of ["",null,undefined,123456,"comprovante", "E123", "Eabcdefgh"+"A".repeat(23),
    "E12345678"+"A".repeat(24), "E12345678"+"A".repeat(22), "E12345678"+"A".repeat(22)+"!"]) {
    assert.equal(normalizePixEndToEndId(invalid), null, String(invalid));
  }
});

test("Pix approval updates the order and checks duplicate references in one atomic SQL statement", () => {
  let sql, args;
  const db={prepare(q){sql=q;return{bind(...values){args=values;return {sql,args};}}}};
  const approved=preparePixApproval(db, 123, "vip_package", id.toLowerCase());
  assert.equal(approved.sql,sql);
  assert.deepEqual(args,[id,123,"vip_package",id]);
  for(const expected of ["UPDATE purchase_requests", "payment_reference=?", "status='approved'",
    "status='pending'", "payment_method='pix'", "product_kind=?", "currency='BRL'",
    "price_brl>0", "NOT EXISTS", "previous.status='approved'",
    "UPPER(previous.payment_reference)=?"]) assert.ok(sql.includes(expected),expected);
  assert.ok(!sql.includes("bankStatementConfirmed")); // Must be checked in API.
  for(const kind of ["skin","vip_package"]) assert.ok(preparePixApproval(db, 2,kind,id));
  for(const [idValue,kind,ref] of [[-1,"vip_package",id],[1,"other",id],[1,"skin","invalid"]])
    assert.throws(()=>preparePixApproval(db,idValue,kind,ref));
});

test("only verified, uniquely reconciled Pix can trigger item grants", () => {
  const source=readFileSync(new URL("../worker.js",import.meta.url),"utf8");
  const admin=readFileSync(new URL("../admin.html",import.meta.url),"utf8");
  assert.match(source,/body\.bankStatementConfirmed!==true/);
  assert.match(source,/normalizePixEndToEndId\(body\.bankStatementReference\)/);
  assert.match(source,/preparePixApproval\(env\.DB,id,pending\.product_kind,pixReference\)/);
  assert.match(source,/approvalStatement,/);
  assert.match(source,/changes\(\)=1 AND EXISTS\(SELECT 1 FROM purchase_requests/);
  assert.match(source,/if\(!result\[0\]\?\.meta\?\.changes\)return json/);
  assert.match(admin,/EndToEndId Pix recebido no extrato/);
  assert.match(admin,/bankStatementReference\.value\.trim\(\)/);
  assert.match(admin,/bankStatementConfirmed,bankStatementReference/);
});

test("unconfigured Mercado Pago and Nubank can never create player payment orders", () => {
  const server=readFileSync(new URL("../worker.js",import.meta.url),"utf8");
  const arena=readFileSync(new URL("../arena.html",import.meta.url),"utf8");
  assert.match(server,/MP_NOT_CONFIGURED/);
  assert.match(server,/if\(requestedPaymentMethod==="mercadopago_link"&&\(!env\.MP_ACCESS_TOKEN\|\|!env\.MP_WEBHOOK_SECRET\)\)/);
  assert.match(server,/requestedPaymentMethod==="pix" && !nubankPixReady\(env\)/);
  assert.match(arena,/paymentMethodStatus=\{known:false,mercadoPago:false,nubankPix:false\}/);
  assert.match(arena,/methods\.mercadoPago===true/);
  assert.match(arena,/methods\.nubankPix===true/);
  assert.match(arena,/select\.disabled=true/);
});
