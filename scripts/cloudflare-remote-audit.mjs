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
export async function audit({fetchImpl=fetch,production,staging,token="",accountId="",allowPending0030=false}={}){
  const result=[];
  const run=async(name,fn,required=true)=>{
    try{const detail=await fn();result.push({name,required,ok:true,detail:detail||"OK"});return true}
    catch(err){result.push({name,required,ok:false,detail:err instanceof Error?err.message.slice(0,135):"Falha"});return false}
  };
  let ids;
  const valid=await run("Configuração D1 isolada",()=>{
    ids=validateIds(production,staging);return "UUIDs distintos";
  });
  await run("Worker público e D1",async()=>{
    if(allowPending0030){
      // Somente o deploy protegido pode aceitar as 3 tabelas novas ainda ausentes.
      // Um 503 por segredo, DB, outras migrations ou erro do Worker continua bloqueado.
      const response=await fetchImpl(PUBLIC+"/api/health",{
        method:"GET",redirect:"error",signal:AbortSignal.timeout(15000),
        headers:{Accept:"application/json"}
      });
      if(response.status===503){
        const h=await response.json();
        const expected=["kingdom_dragons","kingdom_mailbox","master_bonus_claims"].sort();
        const actual=Array.isArray(h?.missingTables)?[...h.missingTables].sort():[];
        const exact=actual.length===expected.length&&actual.every((name,index)=>name===expected[index]);
        if(h?.ok===false&&h?.status==="not_ready"&&h.checks?.database===true&&
           h.checks?.session===true&&h.checks?.schema===false&&exact){
          return "D1 e sessão OK; somente as 3 tabelas de 0030 pendentes (esperado antes da migration)";
        }
        throw Error("Health 503 não corresponde exclusivamente à migration 0030 pendente.");
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
    if(!token.trim()||!/^[a-f0-9]{32}$/i.test(accountId))
      throw Error("CLOUDFLARE_API_TOKEN ou CLOUDFLARE_ACCOUNT_ID ausente/inválido");
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
        const a=await req(API+"/accounts/"+accountId+"/d1/database/"+db.database_id,{fetchImpl,token});
        const d=a.result||{};
        if((d.uuid||d.id)!==db.database_id||(d.name&&d.name!==db.database_name))
          throw Error("UUID/nome não corresponde ao configurado");
        return "UUID remoto correto";
      });
    }
    await run("D1 Time Travel",async()=>{
      const a=await req(API+"/accounts/"+accountId+"/d1/database/"+ids.prod.database_id+"/time_travel/bookmark",{fetchImpl,token});
      if(!a.result?.bookmark)throw Error("Bookmark não disponível");
      return "Disponível (bookmark ocultado)";
    });
    await run("Workers Paid - Billing",async()=>{
      const a=await req(API+"/accounts/"+accountId+"/subscriptions",{fetchImpl,token});
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
      allowPending0030:process.env.COI_ALLOW_PENDING_0030==="true"});
  }catch(e){report={ready:false,checks:[{ok:false,required:true,name:"Configuração",detail:e.message}]}};
  const text=summary(report);console.log(text);
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,text);
  if(!report.ready)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
