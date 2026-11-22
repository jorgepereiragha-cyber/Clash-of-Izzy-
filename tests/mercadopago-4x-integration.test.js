import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {handleMercadoPagoRoute} from "../mercadopago-orders.js";
globalThis.crypto ??= webcrypto;
const SECRET="sandbox-hmac-only-never-real-secret";
const ORDER_ID="ORD-4X-SANDBOX-TEST";
const EXTERNAL="coi_4x_synthetic_checkout";
const requestId="sandbox-idempotency-100";
const quote=(value)=>String(value);
async function makeRequest(valid=true) {
  const ts=String(Math.floor(Date.now()/1000));
  const manifest=`id:${ORDER_ID.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const key=await webcrypto.subtle.importKey("raw",new TextEncoder().encode(SECRET),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const digest=await webcrypto.subtle.sign("HMAC",key,new TextEncoder().encode(manifest));
  const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
  return new Request(`https://staging.invalid/api/webhook/mp?type=order&data.id=${ORDER_ID}`,{
    method:"POST",headers:{"x-request-id":requestId,"x-signature":`ts=${ts},v1=${valid?hex:"0".repeat(64)}`}
  });
}
function dbFixture(){
  const purchase={
    id:31,player_id:77,product_kind:"vip_package",product_id:9,
    product_name:"Apoio Escudeiro",price_brl:3.99,currency:"BRL",status:"pending",
    mp_order_id:ORDER_ID,mp_external_reference:EXTERNAL,gems_amount:500
  };
  const state={purchase,gems:100,orders:new Map(),paymentStatus:null,
    fulfilled:false,sqlCalls:[]};
  function prepare(sql){
    return {bind(...args){return {sql,args,async first(){
      if(sql.includes("FROM purchase_requests WHERE mp_external_reference="))
        return args[0]===EXTERNAL&&args[1]===ORDER_ID?purchase:null;
      if(sql.includes("FROM support_orders"))return null;
      throw new Error("Unexpected SELECT in fixture: "+sql.slice(0,65));
    },async run(){
      if(sql.includes("SET mp_payment_status=")&&sql.includes("purchase_requests")){
        state.paymentStatus=args[0];return {meta:{changes:1}};
      }
      throw new Error("Unexpected D1 run in fixture: "+sql.slice(0,65));
    }};}};
  }
  const DB={
    prepare,
    async batch(stmts){
      let changes=0;
      const results=[];
      for(const stmt of stmts){
        const sql=stmt.sql,args=stmt.args;
        state.sqlCalls.push(sql.slice(0,110));
        if(sql.startsWith("INSERT OR IGNORE INTO mercadopago_orders")){
          const key=quote(args[0]);
          changes=state.orders.has(key)?0:1;
          if(changes)state.orders.set(key,{status:args[5],amount:args[3],fulfilled:false});
        }else if(sql.startsWith("UPDATE purchase_requests SET status='approved'")){
          const allowed=changes===1&&purchase.status==="pending"&&
            args[0]===purchase.id&&args[1]===ORDER_ID&&args[2]===EXTERNAL;
          changes=allowed?1:0;
          if(allowed)purchase.status="approved";
        }else if(sql.startsWith("UPDATE players SET gems=gems+")){
          const allowed=changes===1&&purchase.status==="approved"&&
            args[0]===purchase.id&&args[1]===purchase.player_id;
          changes=allowed?1:0;
          if(allowed)state.gems+=purchase.gems_amount;
        }else if(sql.startsWith("UPDATE mercadopago_orders SET fulfilled_at=")){
          const order=state.orders.get(ORDER_ID);
          changes=order&&purchase.status==="approved"&&!order.fulfilled?1:0;
          if(changes){order.fulfilled=true;state.fulfilled=true;}
        }else{
          throw new Error("Unexpected D1.batch statement in fixture: "+sql.slice(0,90));
        }
        results.push({meta:{changes}});
      }
      return results;
    }
  };
  return {DB,state};
}
function providerOrder(overrides={}){
  return {
    id:ORDER_ID,external_reference:EXTERNAL,total_amount:"3.99",total_paid_amount:"3.99",
    status:"processed",currency:"BRL",transactions:{payments:[{
      id:"PAY-TEST-1",status:"processed",paid_amount:"3.99"
    }]},...overrides
  };
}
const ctx={json(payload,status=200){return new Response(JSON.stringify(payload),{
  status,headers:{"content-type":"application/json"}
});}};
async function withProvider(provider,fn){
  const original=globalThis.fetch;
  let requests=0;
  globalThis.fetch=async(url)=>{
    assert.equal(url,`https://api.mercadopago.com/v1/orders/${ORDER_ID}`);
    requests++;
    return new Response(JSON.stringify(provider),{status:200,headers:{"content-type":"application/json"}});
  };
  try{return await fn(()=>requests);}
  finally{globalThis.fetch=original;}
}
test("webhook autenticado credita gemas UMA vez e ignora repeticao (provedor simulado)",async()=>{
  const fixture=dbFixture(),env={DB:fixture.DB,MP_ACCESS_TOKEN:"TEST-ONLY",MP_WEBHOOK_SECRET:SECRET};
  await withProvider(providerOrder(),async requests=>{
    const first=await handleMercadoPagoRoute(await makeRequest(),env,ctx);
    assert.equal(first.status,200);
    assert.deepEqual(await first.json(),{received:true,processed:true});
    assert.equal(fixture.state.gems,600);
    assert.equal(fixture.state.purchase.status,"approved");
    assert.equal(fixture.state.fulfilled,true);
    const replay=await handleMercadoPagoRoute(await makeRequest(),env,ctx);
    assert.equal(replay.status,200);
    assert.equal(fixture.state.gems,600,"webhook replay credited gems twice");
    assert.equal(fixture.state.orders.size,1,"duplicate ledger order");
    assert.equal(requests(),2);
  });
});
test("webhook com valor divergente nao confirma nem credita gemas",async()=>{
  const fixture=dbFixture(),env={DB:fixture.DB,MP_ACCESS_TOKEN:"TEST-ONLY",MP_WEBHOOK_SECRET:SECRET};
  await withProvider(providerOrder({total_paid_amount:"2.99"}),async()=>{
    const response=await handleMercadoPagoRoute(await makeRequest(),env,ctx);
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{received:true,pending:true});
    assert.equal(fixture.state.gems,100);
    assert.equal(fixture.state.purchase.status,"pending");
    assert.equal(fixture.state.orders.size,0);
  });
});
test("webhook sem HMAC valido nao consulta o provedor nem altera saldos",async()=>{
  const fixture=dbFixture(),env={DB:fixture.DB,MP_ACCESS_TOKEN:"TEST-ONLY",MP_WEBHOOK_SECRET:SECRET};
  await withProvider(providerOrder(),async requests=>{
    const response=await handleMercadoPagoRoute(await makeRequest(false),env,ctx);
    assert.equal(response.status,401);
    assert.equal(requests(),0);
    assert.equal(fixture.state.gems,100);
  });
});
