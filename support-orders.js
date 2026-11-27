// Apoio voluntário ao desenvolvimento. Sem gemas/itens: pacotes pagos permanecem na loja oficial.
import { commercialSalesEnabled, mercadoPagoNewCheckoutEnabled } from "./payment-activation.js";
export const SUPPORT_TIERS=Object.freeze({
  escudeiro:{label:"Escudeiro",amountCents:1000},
  cavaleiro:{label:"Cavaleiro",amountCents:5000},
  senhor:{label:"Senhor Feudal",amountCents:20000}
});
const cents=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0?Math.round(n*100):0;};
const trustedCheckoutUrl=value=>{
  try{
    const url=new URL(String(value));
    return url.protocol==="https:" && (url.hostname==="mercadopago.com.br" || url.hostname.endsWith(".mercadopago.com.br") ||
      url.hostname==="mercadopago.com" || url.hostname.endsWith(".mercadopago.com")) &&
      !url.username&&!url.password;
  }catch{return false;}
};
const getSupportOrderSql=`SELECT s.*,p.player_id AS public_player_id FROM support_orders s
  JOIN players p ON p.id=s.player_id WHERE s.id=? AND p.player_id=?`;

export async function createSupportCheckout(request,env,ctx){
  if(request.method!=="POST")return ctx.json({error:"Método não permitido."},405);
  if (!commercialSalesEnabled(env)) return ctx.json({error:"Vendas temporariamente desativadas.",code:"COMMERCIAL_SALES_DISABLED"},503);
  if(!mercadoPagoNewCheckoutEnabled(env))return ctx.json({error:"Mercado Pago ainda não está homologado para contribuições."},503);
  const playerId=await ctx.gameIdentity(request,env);
  if(!playerId)return ctx.json({error:"Abra o jogo e entre no seu reino antes de apoiar."},401);
  const limited=await ctx.rateLimitDecision(env,"support-checkout-player",playerId,5,3600);
  if(limited)return limited;
  const body=await ctx.readBody(request,4096);
  if(body.__bodyError)return ctx.json({error:"Solicitação inválida."},400);
  const tier=String(body.tier||""), selected=SUPPORT_TIERS[tier],requestKey=String(body.requestKey||"");
  if(!selected || !/^[a-zA-Z0-9_-]{12,80}$/.test(requestKey))return ctx.json({error:"Opção de apoio ou chave da solicitação inválida."},400);
  const extRef="coi_support_"+crypto.randomUUID().replaceAll("-","");
  const idem=crypto.randomUUID();
  await env.DB.prepare(`INSERT OR IGNORE INTO support_orders(player_id,tier,amount_cents,request_key,external_reference,idempotency_key)
    SELECT id,?,?,?,?,? FROM players WHERE player_id=?`)
    .bind(tier,selected.amountCents,requestKey,extRef,idem,playerId).run();
  const row=await env.DB.prepare(`SELECT s.* FROM support_orders s JOIN players p ON p.id=s.player_id WHERE p.player_id=? AND s.request_key=?`).bind(playerId,requestKey).first();
  if(!row)return ctx.json({error:"Não foi possível identificar o reino."},404);
  if(row.tier!==tier||Number(row.amount_cents)!==selected.amountCents)return ctx.json({error:"Esta chave pertence a outra contribuição."},409);
  if(row.status!=="pending")return ctx.json({error:"Essa contribuição já foi confirmada ou encerrada."},409);
  if(row.mp_order_id&&row.mp_checkout_url){
    if(!trustedCheckoutUrl(row.mp_checkout_url))return ctx.json({error:"Link de checkout não confiável."},502);
    return ctx.json({success:true,checkoutUrl:row.mp_checkout_url,orderId:row.mp_order_id,reused:true});
  }
  const lockToken=crypto.randomUUID(),now=Math.floor(Date.now()/1000);
  const lock=await env.DB.prepare(`UPDATE support_orders SET lock_token=?,lock_expires_at=?
    WHERE id=? AND status='pending' AND mp_checkout_url IS NULL
    AND (lock_token IS NULL OR COALESCE(lock_expires_at,0)<=?)`)
    .bind(lockToken,now+120,row.id,now).run();
  if(!lock.meta?.changes)return ctx.json({error:"Esta contribuição já está sendo preparada. Consulte novamente."},409);
  try{
    const amount=(selected.amountCents/100).toFixed(2);
    const response=await fetch("https://api.mercadopago.com/v1/orders",{
      method:"POST",headers:{"Authorization":"Bearer "+env.MP_ACCESS_TOKEN,
        "Content-Type":"application/json","Accept":"application/json","X-Idempotency-Key":row.idempotency_key},
      body:JSON.stringify({
        type:"online",processing_mode:"manual",capture_mode:"automatic_async",total_amount:amount,
        external_reference:row.external_reference,
        description:"Contribuição opcional Clash of Izzy — "+selected.label,
        items:[{title:"Apoio "+selected.label,quantity:1,unit_price:amount,external_code:"support_"+tier}]
      })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.id||!trustedCheckoutUrl(data.checkout_url)){
      console.error("support_order_provider_failed",response.status);
      return ctx.json({error:"O Mercado Pago não disponibilizou o checkout."},502);
    }
    const saved=await env.DB.prepare(`UPDATE support_orders SET mp_order_id=?,mp_checkout_url=?,mp_payment_status=?,
       lock_token=NULL,lock_expires_at=NULL WHERE id=? AND status='pending' AND lock_token=?`)
      .bind(String(data.id),String(data.checkout_url),String(data.status||"created"),row.id,lockToken).run();
    if(saved.meta?.changes!==1)return ctx.json({error:"A contribuição mudou de estado. Consulte seu histórico."},409);
    return ctx.json({success:true,checkoutUrl:String(data.checkout_url),orderId:String(data.id)});
  }catch(error){
    console.error("support_checkout_failed",String(error?.message||error).slice(0,160));
    return ctx.json({error:"Falha na preparação do checkout."},502);
  }finally{
    await env.DB.prepare("UPDATE support_orders SET lock_token=NULL,lock_expires_at=NULL WHERE id=? AND lock_token=?")
      .bind(row.id,lockToken).run().catch(()=>{});
  }
}
export async function finalizeSupportOrder(env,orderId,providerOrder,ctx){
  const order=await env.DB.prepare(`SELECT * FROM support_orders WHERE mp_order_id=? AND external_reference=?`)
    .bind(orderId,String(providerOrder.external_reference||"")).first();
  if(!order)return ctx.json({received:true,ignored:true});
  if(order.status==="approved")return ctx.json({received:true,processed:true,reused:true});
  const payments=Array.isArray(providerOrder.transactions?.payments)?providerOrder.transactions.payments:[];
  const approved=payments.filter(p=>["processed","approved"].includes(String(p.status||"").toLowerCase())&&cents(p.paid_amount??p.amount)>0);
  const received=approved.reduce((total,p)=>total+cents(p.paid_amount??p.amount),0);
  const valid=String(providerOrder.status||"").toLowerCase()==="processed" &&
    String(providerOrder.currency||providerOrder.currency_id||"")==="BRL" &&
    Number(order.amount_cents)>0 && cents(providerOrder.total_amount)===order.amount_cents &&
    cents(providerOrder.total_paid_amount)===order.amount_cents &&
    approved.length>0 && received===order.amount_cents;
  if(!valid){
    await env.DB.prepare("UPDATE support_orders SET mp_payment_status=? WHERE id=? AND status='pending'")
      .bind(String(providerOrder.status||"unknown").slice(0,80),order.id).run();
    return ctx.json({received:true,pending:true});
  }
  const done=await env.DB.prepare(`UPDATE support_orders
    SET status='approved',mp_payment_status='processed',confirmed_at=CURRENT_TIMESTAMP
    WHERE id=? AND status='pending' AND mp_order_id=? AND external_reference=?`)
    .bind(order.id,orderId,order.external_reference).run();
  return ctx.json({received:true,processed:true,reused:done.meta?.changes!==1});
}
