// Read-only preflight for production gameplay promotion. Never log account/player records.
import {pathToFileURL} from "node:url";
export const DRAGON_INTEGRITY_SQL="SELECT COUNT(*) AS invalid FROM dragons d LEFT JOIN kingdom_dragons kd ON kd.kingdom_id=d.kingdom_id AND kd.dragon_key=d.dragon_key WHERE kd.kingdom_id IS NULL OR typeof(d.level)<>'integer' OR d.level NOT BETWEEN 1 AND 100 OR typeof(d.experience)<>'integer' OR d.experience<0 OR typeof(d.bond)<>'integer' OR d.bond NOT BETWEEN 1 AND 100";
export async function verifyProductionDragonIntegrity({accountId,token,fetchImpl=fetch}={}){
 if(!accountId||!token)throw Error("Cloudflare credentials missing; production promotion blocked.");
 const database="7e63af59-d9ff-4159-a9cf-b02e35b92605";
 const endpoint="https://api.cloudflare.com/client/v4/accounts/"+encodeURIComponent(accountId)+"/d1/database/"+database+"/query";
 const response=await fetchImpl(endpoint,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({sql:DRAGON_INTEGRITY_SQL}),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error("Read-only dragon integrity query failed; promotion blocked.");
 const data=await response.json(),row=data?.result?.[0]?.results?.[0];
 if(data.success!==true||data.result[0].success!==true||!Number.isSafeInteger(row?.invalid)||row.invalid!==0)throw Error("Legacy dragon ownership/progress not verified; resolve before production migration.");
 return {dragonIntegrityVerified:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 verifyProductionDragonIntegrity({accountId:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
