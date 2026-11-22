// Centro de lançamento: consultas imutáveis, nunca altera D1, flags, pedidos ou tokens.
const json=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const PORTAL="https://clash-of-izzy-portal.jorgepereiragha.workers.dev";
const tableNames=["players","kingdoms","battle_reports","alliances","purchase_requests","mercadopago_orders","support_orders","d1_migrations"];

export function launchGate(checks){
  // Infraestrutura publica e evidencias do release sao distintas de conciliacao bancaria.
  const blockers=[];
  if(!checks.coreSchema) blockers.push("Esquema D1 essencial incompleto");
  if(!checks.supportSchema) blockers.push("Tabela financeira de apoios indisponível");
  if(!checks.paymentConfigured) blockers.push("Meios de recebimento desabilitados");
  if(!checks.apkPublished) blockers.push("APK oficial não publicado ou não verificável");
  blockers.push("Sandbox financeiro ponta a ponta não atestado neste painel");
  blockers.push("Instalação e atualização em Android físico não atestadas neste painel");
  blockers.push("Plano Cloudflare Paid e migrações remotas exigem conferência operacional");
  return {status:"NO_GO",blockers};
}

export async function readLaunchCenter(env,{fetchImpl=fetch}={}){
  if(!env?.DB) return json({error:"Banco D1 indisponível."},503);
  const raw=await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ("+
    tableNames.map(()=>"?").join(",")+")"
  ).bind(...tableNames).all();
  const tables=new Set((raw.results||[]).map(r=>String(r.name)));
  const coreSchema=["players","kingdoms","battle_reports","alliances","purchase_requests"].every(name=>tables.has(name));
  const supportSchema=tables.has("support_orders");
  const payments={
    mercadoPago:Boolean(env.MP_ACCESS_TOKEN&&env.MP_WEBHOOK_SECRET),
    nubankPix:Boolean(env.NUBANK_PIX_KEY&&String(env.NUBANK_PIX_ENABLED)==="true"&&String(env.NUBANK_PIX_RECEIVER_VERIFIED)==="true")
  };
  const flags=Object.fromEntries([
    "GAME_4X_SYSTEMS_ENABLED","LEVEL_PACKS_ENABLED","LEVEL_PACKS_PUBLIC_ENABLED",
    "LEVEL_PACKS_PROPOSED_PRICES_APPROVED","MASTER_PACK_ENABLED"
  ].map(name=>[name,String(env[name])==="true"]));
  let pending=null,recordedApproved=null;
  if(tables.has("purchase_requests")){
    const row=await env.DB.prepare(
      "SELECT "+
      "SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS total_pending,"+
      "SUM(CASE WHEN status='pending' AND payment_method='pix' THEN 1 ELSE 0 END) AS pix_pending,"+
      "SUM(CASE WHEN status='pending' AND (payment_method='mercadopago_link' OR mp_order_id IS NOT NULL) THEN 1 ELSE 0 END) AS mp_pending,"+
      "SUM(CASE WHEN status='approved' AND reviewed_at>=datetime('now','-1 day') THEN ROUND(price_brl*100) ELSE 0 END) AS nominal_day_cents,"+
      "SUM(CASE WHEN status='approved' AND reviewed_at>=datetime('now','-7 days') THEN ROUND(price_brl*100) ELSE 0 END) AS nominal_week_cents "+
      "FROM purchase_requests"
    ).first();
    pending={total:Number(row?.total_pending||0),pix:Number(row?.pix_pending||0),mercadoPago:Number(row?.mp_pending||0)};
    // Apenas total nominal em pedidos marcados aprovados, nao faturamento liquido.
    recordedApproved={nominalDayCents:Number(row?.nominal_day_cents||0),nominalWeekCents:Number(row?.nominal_week_cents||0),verifiedSettlement:false};
  }
  let latestMigration=null;
  if(tables.has("d1_migrations")){
    try {
      const migration=await env.DB.prepare("SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1").first();
      latestMigration=typeof migration?.name==="string"?migration.name:null;
    } catch { latestMigration=null; }
  }
  // Sem acesso a auditoria Cloudflare de custos/migrations: jamais apresentar status GO presumido.
  let apkPublished=false,apkSource="indisponível";
  try{
    const response=await fetchImpl(PORTAL+"/api/android/latest",{
      method:"GET",redirect:"error",signal:AbortSignal.timeout(5000),
      headers:{Accept:"application/json"}
    });
    if(response.status===200 && response.headers?.get("X-COI-Release-Proxy")==="v1"){
      const data=await response.json();
      const names=new Set((data.assets||[]).map(a=>a?.name));
      apkPublished=data.draft===false&&data.prerelease===false&&
        names.has("clash-of-izzy-android.apk")&&names.has("clash-of-izzy-android.apk.sha256");
      if(apkPublished)apkSource=String(data.tag_name||"release oficial");
    }
  }catch{ /* API do portal indisponivel nao prova release. */ }
  const checks={coreSchema,supportSchema,paymentConfigured:payments.mercadoPago||payments.nubankPix,apkPublished};
  return json({
    observedAt:new Date().toISOString(),
    ...launchGate(checks),
    schema:{coreSchema,supportSchema,latestMigration,pendingMigrations:null,
      note:"Somente metadados do D1; pendências reais são confirmadas no Cloudflare Paid Readiness."},
    payments,flags,pending,recordedApproved,
    webhookFailures:null,
    apk:{published:apkPublished,source:apkSource},
    billingVerified:null,
    sandboxVerified:null,
    androidPhysicalVerified:null
  });
}

export async function handleAdminLaunchCenter(env,actor,options={}){
  if(actor?.scope!=="admin"||actor?.sub!=="admin")return json({error:"Sessão administrativa inválida ou expirada."},401);
  return readLaunchCenter(env,options);
}
