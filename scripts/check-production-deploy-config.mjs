// Shared configuration guard. No network or writes; check the exact checked-out release.
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
export const CLOSED_FLAGS=Object.freeze(["GAME_4X_SYSTEMS_ENABLED","LEVEL_PACKS_ENABLED","LEVEL_PACKS_PUBLIC_ENABLED","LEVEL_PACKS_PROPOSED_PRICES_APPROVED","MASTER_PACK_ENABLED","LIVE_PAYMENTS_APPROVED"]);
export function assertProductionDeployConfig(config){
  if(config?.name!=="clash-of-izzy"||config.main!=="worker.js"||config.vars?.ENVIRONMENT!=="production")
    throw Error("Unexpected production Worker target.");
  const bindings=config.d1_databases;
  if(!Array.isArray(bindings)||bindings.length!==1||bindings[0]?.binding!=="DB"||
    bindings[0].database_name!=="clash-of-izzy-db"||bindings[0].database_id!=="7e63af59-d9ff-4159-a9cf-b02e35b92605"||
    bindings[0].migrations_dir!=="migrations")
    throw Error("Unexpected production D1 binding or migrations directory.");
  const previews=config.previews?.d1_databases;
  if(!Array.isArray(previews)||previews.length!==1||previews[0]?.binding!=="DB"||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(previews[0].database_id||"")||
    previews[0].database_id.toLowerCase()===bindings[0].database_id)
    throw Error("Preview D1 isolation not proven.");
  if(config.vars.INVITE_ONLY!==undefined&&config.vars.INVITE_ONLY!=="false")throw Error("Unexpected production invite gate.");
  for(const flag of CLOSED_FLAGS)if(config.vars[flag]!=="false")throw Error("Unsafe production flag: "+flag);
  return {productionConfigVerified:true,commercialFlagsClosed:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.log(JSON.stringify(assertProductionDeployConfig(JSON.parse(await readFile(new URL("../wrangler.jsonc",import.meta.url),"utf8")))));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
