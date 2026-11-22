// Read-only production infrastructure audit. All requests use HTTP GET.
// Never expose tokens, private account data, or Time Travel bookmarks in logs.
import {readFile,appendFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
const API="https://api.cloudflare.com/client/v4";
const PUBLIC="https://clash-of-izzy.jorgepereiragha.workers.dev";
export function normalizeToken(raw){
  let token=String(raw||"").trim();
  if(token.slice(0,7).toLowerCase()==="bearer ")token=token.slice(7).trim();
  if(token.length>=2&&token[0]===token[token.length-1]&&(token[0]==='"'||token[0]==="'"))token=token.slice(1,-1).trim();
  return /\s/.test(token)?"":token;
}

export function normalizeAccountId(raw){
  let id=String(raw||"").trim();
  if(id.length>=2&&id[0]===id[id.length-1]&&(id[0]==='"'||id[0]==="'"))id=id.slice(1,-1).trim();
  return id.toLowerCase();
}

export function validateIds(prod,preview){
  const p=prod?.d1_databases?.find(x=>x.binding==="DB");
  const t=preview?.d1_databases?.find(x=>x.binding==="PREVIEW_DB");
  if(!p?.database_id||!t?.database_id||p.database_id===t.database_id)
    throw Error("D1 Preview não está separado do D1 de produção.");
  for(const x of [p,t])if(!/^[a-f0-9-]{36}$/i.test(x.database_id))
    throw Error("UUID D1 inválido.");
  return {prod:p,preview:t};
}
async function req(url,{fetchImpl,token=""}={}){
  const res=await fetchImpl(url,{
    method:"GET",redirect:"error",signal:AbortSignal.timeout(15000),
    headers:token?{"Authorization":"Bearer "+token,"Accept":"application/json"}:{"Accept":"application/json"}
  });
  if(!res.ok)throw Error("HTTP "+res.status);
  const value=await res.json();
  if(token&&value?.success!==true)throw Error("API Cloudflare não confirmou sucesso");
  return value;
}
export async function audit({fetchImpl=fetch,production,staging,token="",accountId="",allowPending0030=false,allowPending0033=false,allowPending0034=false}={}){
  const result=[];
  const normalizedAccountId=normalizeAccountId(accountId);
  const run=async(name,fn,required=true)=>{
    try{const detail=await fn();result.push({name,required,ok:true,detail:detail||"OK"});return true}
    catch(err){result.push({name,required,ok:false,detail:err instanceof Error?err.message.slice(0,135):"Falha"});return false}
  };
  let ids;
  const valid=await run("Configuração D1 isolada",()=>{
    ids=validateIds(production,staging);return "UUIDs distintos";
  });
  await run("Worker público e D1",async()=>{
    if(allowPending0030||allowPending0033||allowPending0034){
      // Somente pré-deploy protegido: aceitar uniões exatas das migrações 0030/0033/0034.
      // Nunca relaxar DB, sessão, objetos desconhecidos ou o health pós-deploy.
      const response=await fetchImpl(PUBLIC+"/api/health",{
        method:"GET",redirect:"error",signal:AbortSignal.timeout(15000),
        headers:{Accept:"application/json"}
      });
      if(response.status===503){
        const h=await response.json();
        const pending=[];
        if(allowPending0030)pending.push({id:"0030",tables:["kingdom_dragons","kingdom_mailbox","master_bonus_claims"]});
        if(allowPending0033)pending.push({id:"0033",tables:["google_account_links","google_auth_challenges"]});
        if(allowPending0034)pending.push({id:"0034",tables:["realm_openings"]});
        const actual=Array.isArray(h?.missingTables)?[...h.missingTables].sort():[];
        const combinations=[];
        for(let mask=1;mask<(1<<pending.length);mask++){
          const selected=pending.filter((_,index)=>mask&(1<<index));
          combinations.push({ids:selected.map(x=>x.id).join("+"),tables:selected.flatMap(x=>x.tables).sort()});
        }
        const matching=combinations.find(({tables})=>
          actual.length===tables.length&&actual.every((name,index)=>name===tables[index]));
        if(h?.ok===false&&h?.status==="not_ready"&&h.checks?.database===true&&
           h.checks?.session===true&&h.checks?.schema===false&&matching){
          return "D1 e sessão OK; somente tabelas de "+matching.ids+" pendentes (esperado antes da migration)";
        }
        throw Error("Health 503 contém objetos ou falhas fora de 0030/0033/0034.");
      }
      if(!response.ok)throw Error("HTTP "+response.status);
      const h=await response.json();
      if(h.ok!==true||h.status!=="ready"||h.checks?.database!==true||
         h.checks?.schema!==true||h.checks?.session!==true||
         !Array.isArray(h.missingTables)||h.missingTables.length)throw Error("Health não está pronto.");
      return "Worker, schema e sessão OK";
    }
    const h=await req(PUBLIC+"/api/health",{fetchImpl});
    if(h.ok!==true||h.status!=="ready"||h.checks?.database!==true||
       h.checks?.schema!==true||h.checks?.session!==true||
       !Array.isArray(h.missingTables)||h.missingTables.length)throw Error("Health não está pronto.");
    return "Worker, schema e sessão OK";
  });
  await run("Admin sem sessão",async()=>{
    const r=await fetchImpl(PUBLIC+"/api/admin/health",{method:"GET",redirect:"error",signal:AbortSignal.timeout(15000)});
    if(r.status!==401)throw Error("Esperado 401; retornou "+r.status);
    return "HTTP 401";
  });
  await run("Conta sem sessão",async()=>{
    const r=await fetchImpl(PUBLIC+"/api/account/status",{method:"GET",redirect:"error",signal:AbortSignal.timeout(15000)});
    if(r.status!==401)throw Error("Esperado 401; retornou "+r.status);
    return "HTTP 401";
  });
  const credentials=await run("Secrets GitHub",()=>{
    if(!token.trim())throw Error("CLOUDFLARE_API_TOKEN ausente ou inválido");
    if(!/^[a-f0-9]{32}$/.test(normalizedAccountId))
      throw Error("CLOUDFLARE_ACCOUNT_ID ausente ou inválido (esperados 32 caracteres hexadecimais)");
    return "Configurados";
  });
  let active=false;
  if(credentials)active=await run("API token Cloudflare",async()=>{
    const a=await req(API+"/user/tokens/verify",{fetchImpl,token});
    if(a.result?.status!=="active")throw Error("Token inativo");
    return "Ativo";
  });
  if(valid&&active){
    for(const [label,db] of [["D1 produção",ids.prod],["D1 Preview",ids.preview]]){
      await run(label,async()=>{
        const a=await req(API+"/accounts/"+normalizedAccountId+"/d1/database/"+db.database_id,{fetchImpl,token});
        const d=a.result||{};
        if((d.uuid||d.id)!==db.database_id||(d.name&&d.name!==db.database_name))
          throw Error("UUID/nome não corresponde ao configurado");
        return "UUID remoto correto";
      });
    }
    await run("D1 Time Travel",async()=>{
      const a=await req(API+"/accounts/"+normalizedAccountId+"/d1/database/"+ids.prod.database_id+"/time_travel/bookmark",{fetchImpl,token});
      if(!a.result?.bookmark)throw Error("Bookmark não disponível");
      return "Disponível (bookmark ocultado)";
    });
    await run("Workers Paid - Billing",async()=>{
      const a=await req(API+"/accounts/"+normalizedAccountId+"/subscriptions",{fetchImpl,token});
      const list=Array.isArray(a.result)?a.result:[];
      if(!list.some(s=>/workers/i.test([s.rate_plan?.id,s.rate_plan?.name].join(" "))&&
            /^(paid|active)$/i.test(String(s.state))))throw Error("Assinatura Paid não confirmada pela API.");
      return "Subscription Workers Paid encontrada";
    },false);
  }else{
    for(const label of ["D1 produção","D1 Preview","D1 Time Travel"])
      result.push({name:label,required:true,ok:false,detail:"Sem verificação remota"});
    result.push({name:"Workers Paid - Billing",required:false,ok:false,detail:"Não verificado"});
  }
  return{ready:result.every(x=>x.ok||!x.required),checks:result};
}
export function summary(report){
  const list=["## Clash of Izzy | Auditoria remota (somente leitura)",""];
  for(const c of report.checks)list.push((c.ok?"✅":c.required?"❌":"⚠️")+" **"+c.name+"**: "+c.detail);
  list.push("",report.ready?"Leituras técnicas aprovadas; nenhuma publicação foi autorizada.":"Prontidão remota não comprovada; não publicar.",
    "Sem escrita no Worker, D1, pagamentos ou segredos. Billing não verificado não equivale a Workers Paid.");
  return list.join("\n")+"\n";
}
async function main(){
  let report;
  try{
    const [production,staging]=await Promise.all([
      readFile(new URL("../wrangler.jsonc",import.meta.url),"utf8"),
      readFile(new URL("../wrangler.preview-migrations.jsonc",import.meta.url),"utf8")
    ]);
    report=await audit({production:JSON.parse(production),staging:JSON.parse(staging),
      token:normalizeToken(process.env.CLOUDFLARE_API_TOKEN),accountId:process.env.CLOUDFLARE_ACCOUNT_ID||"",
      allowPending0030:process.env.COI_ALLOW_PENDING_0030==="true",
      allowPending0033:process.env.COI_ALLOW_PENDING_0033==="true",
      allowPending0034:process.env.COI_ALLOW_PENDING_0034==="true"});
  }catch(e){report={ready:false,checks:[{ok:false,required:true,name:"Configuração",detail:e.message}]}};
  const text=summary(report);console.log(text);
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,text);
  if(!report.ready)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
