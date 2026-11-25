// Fail-closed schema preflight for Worker-only deploys. Never mutate remote D1.
import {readdir} from "node:fs/promises";
import {pathToFileURL} from "node:url";

const PRODUCTION_DATABASE_ID="7e63af59-d9ff-4159-a9cf-b02e35b92605";
export const HISTORY_SQL="SELECT name FROM d1_migrations ORDER BY id";
export async function verifyWorkerOnlySchema({accountId,token,migrationFiles,fetchImpl=fetch}={}){
  if(!/^[a-fA-F0-9]{32}$/.test(String(accountId||""))||!token)
    throw Error("Cloudflare credentials missing or invalid; Worker-only deploy blocked.");
  if(!Array.isArray(migrationFiles)||!migrationFiles.length||migrationFiles.some(name=>typeof name!=="string"||!/^\d{4}_[a-zA-Z0-9_-]+\.sql$/.test(name))||new Set(migrationFiles).size!==migrationFiles.length)
    throw Error("Local migration manifest invalid; Worker-only deploy blocked.");
  const expected=new Set(migrationFiles);
  const endpoint="https://api.cloudflare.com/client/v4/accounts/"+accountId+"/d1/database/"+PRODUCTION_DATABASE_ID+"/query";
  const response=await fetchImpl(endpoint,{
    method:"POST",redirect:"error",signal:AbortSignal.timeout(30000),
    headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({sql:HISTORY_SQL})
  });
  if(!response.ok)throw Error("Read-only D1 history query failed; Worker-only deploy blocked.");
  const payload=await response.json();
  const result=payload?.result?.[0];
  if(payload?.success!==true||result?.success!==true||!Array.isArray(result.results)||
     result.results.some(row=>typeof row?.name!=="string"||!/^\d{4}_[a-zA-Z0-9_-]+\.sql$/.test(row.name)))
    throw Error("Invalid D1 history response; Worker-only deploy blocked.");
  const names=result.results.map(row=>row.name), observed=new Set(names);
  const missing=[...expected].filter(name=>!observed.has(name)).sort();
  const unexpected=[...observed].filter(name=>!expected.has(name)).sort();
  if(missing.length||unexpected.length||observed.size!==names.length)
    throw Error("D1 history incompatible with candidate; Worker-only deploy blocked. Missing: "+missing.join(", ")+"; unexpected: "+unexpected.join(", ")+"; duplicate entries: "+(names.length-observed.size)+".");
  return {schemaHistoryVerified:true,appliedMigrations:names.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const files=(await readdir(new URL("../migrations/",import.meta.url))).filter(name=>name.endsWith(".sql"));
    const result=await verifyWorkerOnlySchema({accountId:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN,migrationFiles:files});
    console.log(JSON.stringify(result));
  }catch(error){
    // Only our validation messages are safe; unexpected errors may contain request details.
    console.error(error instanceof Error && /Worker-only deploy blocked\./.test(error.message)?error.message:"D1 compatibility check failed; Worker-only deploy blocked.");
    process.exitCode=1;
  }
}
