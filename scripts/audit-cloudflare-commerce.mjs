// Inspects names/types only. Never logs Worker secret values or bank identifiers.
import {appendFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
const ENDPOINT="https://api.cloudflare.com/client/v4";
export const BINDINGS_TO_AUDIT=Object.freeze([
  Object.freeze({name:"DB",kind:"d1_database"}),
  Object.freeze({name:"SESSION_SECRET",kind:"present"}),
  Object.freeze({name:"MP_ACCESS_TOKEN",kind:"present"}),
  Object.freeze({name:"MP_WEBHOOK_SECRET",kind:"present"}),
  Object.freeze({name:"NUBANK_PIX_KEY",kind:"present"}),
  Object.freeze({name:"NUBANK_PIX_ENABLED",kind:"true"}),
  Object.freeze({name:"NUBANK_PIX_RECEIVER_VERIFIED",kind:"true"}),
  Object.freeze({name:"MASTER_PACK_ENABLED",kind:"true"}),
  Object.freeze({name:"GOOGLE_WEB_CLIENT_ID",kind:"present"})
]);
function normalize(raw){
  let s=String(raw||"").trim();
  if(s.slice(0,7).toLowerCase()==="bearer ")s=s.slice(7).trim();
  if(s.length>1&&s[0]===s.at(-1)&&["'",'"'].includes(s[0]))s=s.slice(1,-1).trim();
  return s;
}
export function evaluateCommercialBindings(bindings){
  if(!Array.isArray(bindings))throw Error("A API não retornou lista de bindings verificável.");
  const index=new Map(bindings.filter(x=>typeof x?.name==="string").map(x=>[x.name,x]));
  return BINDINGS_TO_AUDIT.map(expected=>{
    const entry=index.get(expected.name);
    let state="AUSENTE";
    if(entry){
      if(expected.kind==="true"){
        state=entry.type==="plain_text"?(entry.text==="true"?"ATIVO":"DESATIVADO"):"PRESENTE, VALOR NÃO VERIFICÁVEL";
      }else if(expected.kind==="d1_database"){
        state=entry.type==="d1"?"CONFIGURADO":"TIPO INCOMPATÍVEL";
      }else{
        state=["secret_text","plain_text"].includes(entry.type)?"CONFIGURADO":"TIPO INCOMPATÍVEL";
      }
    }
    return {name:expected.name,state,ok:["ATIVO","CONFIGURADO"].includes(state)};
  });
}
export async function auditCommercialBindings({fetchImpl=fetch,accountId,token}={}){
  const id=normalize(accountId).toLowerCase();
  const normalizedToken=normalize(token);
  if(!/^[a-f0-9]{32}$/.test(id)||!normalizedToken||/\s/.test(normalizedToken)){
    throw Error("Credenciais Cloudflare de auditoria ausentes ou inválidas no GitHub Actions.");
  }
  const response=await fetchImpl(ENDPOINT+"/accounts/"+id+"/workers/scripts/clash-of-izzy/settings",{
    method:"GET",redirect:"error",headers:{
      Authorization:"Bearer "+normalizedToken,Accept:"application/json"
    },signal:AbortSignal.timeout(15000)
  });
  if(!response?.ok)throw Error("Leitura de configurações do Worker indisponível (HTTP "+String(response?.status||0)+"). Verifique a permissão Workers Scripts Read.");
  const body=await response.json().catch(()=>null);
  if(body?.success!==true)throw Error("Cloudflare não confirmou a leitura segura das configurações.");
  return evaluateCommercialBindings(body?.result?.bindings);
}
export function reportCommercialBindings(rows){
  const lines=["## Auditoria de configuração comercial no Cloudflare (somente leitura)","",
    "Apenas presença, tipo e flags são avaliados. Os valores secretos, Pix e token jamais são registrados.","",
    "| Binding | Situação |","|---|---|"];
  for(const row of rows)lines.push("| "+row.name+" | "+row.state+" |");
  lines.push("","Configurações marcadas como ATIVO/CONFIGURADO não provam recebimento financeiro ou reconciliação.",
    "Não foram criados pedidos, alteradas contas, executadas migrações ou publicadas versões.");
  return lines.join("\n")+"\n";
}
async function main(){
  try{
    const rows=await auditCommercialBindings({
      accountId:process.env.CLOUDFLARE_ACCOUNT_ID,
      token:process.env.CLOUDFLARE_API_TOKEN
    });
    const report=reportCommercialBindings(rows);
    console.log(report);
    if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,report);
    if(rows.some(x=>!x.ok))process.exitCode=1;
  }catch(error){
    const message=String(error?.message||"Falha de leitura").slice(0,220);
    console.error("Auditoria comercial não confirmada: "+message);
    if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,
      "## Auditoria de configuração comercial\n\nLeitura não confirmada: "+message+"\n");
    process.exitCode=1;
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
