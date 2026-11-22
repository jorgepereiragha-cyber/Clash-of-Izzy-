// Cadeia Fazenda -> Trigo -> Moinho -> Farinha -> Padaria -> Comida.
// A economia anterior continua operando quando a flag 4X está desligada.
export const INTERMEDIATE_STORAGE_CAP=100000;
export function advanced4xEnabled(env){return env?.GAME_4X_SYSTEMS_ENABLED==="true";}
const nonnegative=n=>Math.max(0,Math.floor(Number(n)||0));
const level=n=>Math.max(1,Math.min(30,nonnegative(n)||1));
export function calculateChainProduction({elapsedSeconds=0,farmLevel=1,millLevel=1,bakeryLevel=1,wheat=0,flour=0,foodFreeSpace=0,multiplier=1,millMultiplier=1,remainders={}}={}){
  const seconds=Math.max(0,Math.min(7*86400,nonnegative(elapsedSeconds)));
  // Um multiplicador zero deve interromper a produção, não ativar o padrão 1.
  const requestedFactor=multiplier==null?1:Number(multiplier);
  const factor=Number.isFinite(requestedFactor)?Math.max(0,Math.min(50,requestedFactor)):1;
  const millRequested=millMultiplier==null?1:Number(millMultiplier);
  const millFactor=Number.isFinite(millRequested)?Math.max(0,Math.min(2,millRequested)):1;
  const remainder=k=>Math.max(0,Math.min(3599,Number(remainders[k])||0));
  const potential=(l,k,extra=1)=>{const t=12*level(l)*factor*extra*seconds+remainder(k);return {units:Math.floor(t/3600),remainder:t%3600};};
  const grown=potential(farmLevel,"wheat");
  const milled=potential(millLevel,"mill",millFactor);
  const baked=potential(bakeryLevel,"bakery");
  const stockWheat=Math.min(INTERMEDIATE_STORAGE_CAP,nonnegative(wheat));
  const stockFlour=Math.min(INTERMEDIATE_STORAGE_CAP,nonnegative(flour));
  const wheatAdded=Math.min(grown.units,INTERMEDIATE_STORAGE_CAP-stockWheat);
  const millQuantity=Math.min(milled.units,stockWheat+wheatAdded,INTERMEDIATE_STORAGE_CAP-stockFlour);
  const flourAvailable=stockFlour+millQuantity;
  const foodQuantity=Math.min(baked.units,flourAvailable,nonnegative(foodFreeSpace));
  return Object.freeze({
    wheat:stockWheat+wheatAdded-millQuantity,
    flour:flourAvailable-foodQuantity,
    food:foodQuantity,
    processedWheat:millQuantity,harvestedWheat:wheatAdded,
    remainders:{
      wheat:wheatAdded<grown.units?0:grown.remainder,
      mill:millQuantity<milled.units?0:milled.remainder,
      bakery:foodQuantity<baked.units?0:baked.remainder
    }
  });
}
export async function ensureIntermediateResources(env,kingdomId){
  await env.DB.prepare("INSERT OR IGNORE INTO intermediate_resources(kingdom_id) VALUES(?)").bind(kingdomId).run();
  return await env.DB.prepare("SELECT wheat,flour,mill_level,bakery_level,updated_at FROM intermediate_resources WHERE kingdom_id=?").bind(kingdomId).first();
}
export async function upgradeIndustry(env,kingdomId,kind){
  if(kind!=="mill"&&kind!=="bakery")return {ok:false,status:400,error:"Indústria inválida."};
  const row=await ensureIntermediateResources(env,kingdomId);
  const column=kind==="mill"?"mill_level":"bakery_level";
  const current=Number(row[column])||1;
  if(current>=30)return {ok:false,status:409,error:"Indústria já está no nível máximo."};
  const wood=120*(current+1),stone=80*(current+1);
  const result=await env.DB.batch([
    env.DB.prepare("UPDATE kingdoms SET wood=wood-?,stone=stone-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND wood>=? AND stone>=? AND castle_level>=? AND EXISTS(SELECT 1 FROM intermediate_resources WHERE kingdom_id=? AND "+column+"=?)")
      .bind(wood,stone,kingdomId,wood,stone,current+1,kingdomId,current),
    env.DB.prepare("UPDATE intermediate_resources SET "+column+"="+column+"+1,updated_at=CURRENT_TIMESTAMP WHERE kingdom_id=? AND "+column+"=? AND changes()=1").bind(kingdomId,current)
  ]);
  if(result[0]?.meta?.changes!==1||result[1]?.meta?.changes!==1)return {ok:false,status:409,error:"Recursos insuficientes, castelo abaixo do nível exigido ou indústria desatualizada."};
  return {ok:true,kind,level:current+1,spent:{wood,stone}};
}
