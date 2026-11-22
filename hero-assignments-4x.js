// Alocações 4X usam heroes.assigned_to (presente desde 0002_world).
// Nenhuma coluna nova nem segundo banco de verdade para os heróis.
export const HERO_4X_SLOTS=Object.freeze({
  "industry:mill":Object.freeze({label:"Moinho",types:Object.freeze(["suporte"])}),
  "defense:tower":Object.freeze({label:"Torres do reino",types:Object.freeze(["arqueiro","infantaria"])})
});
const heroLevel=value=>Number.isSafeInteger(Number(value))
  ?Math.max(1,Math.min(100,Number(value))):1;
export function millHeroMultiplier(level){
  return level==null?1:1+Math.min(0.15,(5+0.5*heroLevel(level))/100);
}
export function towerHeroMultiplier(level){
  return level==null?1:1+Math.min(0.20,(10+0.5*heroLevel(level))/100);
}
export async function assigned4xHeroLevel(env,kingdomId,slot){
  if(!Object.hasOwn(HERO_4X_SLOTS,slot))return null;
  const row=await env.DB.prepare(
    "SELECT hi.level FROM heroes h JOIN hero_inventory hi ON hi.kingdom_id=h.kingdom_id AND hi.hero_key=h.hero_key "+
    "WHERE h.kingdom_id=? AND h.assigned_to=? ORDER BY h.id LIMIT 1"
  ).bind(kingdomId,slot).first();
  return row?heroLevel(row.level):null;
}
export async function assign4xHero(env,kingdomId,heroKey,slot,heroType){
  if(!Object.hasOwn(HERO_4X_SLOTS,slot)||!HERO_4X_SLOTS[slot].types.includes(heroType))
    return {ok:false,status:400,error:"Herói sem especialidade para este posto 4X."};
  if(typeof heroKey!=="string"||heroKey.length<1||heroKey.length>100||!/^[a-z0-9_-]+$/.test(heroKey))
    return {ok:false,status:400,error:"Identificador de herói inválido."};
  // Guardas no próprio UPDATE: outra requisição não pode ocupar o mesmo posto.
  const facility=slot==="industry:mill"
    ?" AND EXISTS(SELECT 1 FROM kingdom_buildings WHERE kingdom_id=? AND building_type='farm') "+
      "AND EXISTS(SELECT 1 FROM intermediate_resources WHERE kingdom_id=?)"
    :" AND EXISTS(SELECT 1 FROM city_defenses WHERE kingdom_id=? AND defense_type='tower')";
  const params=slot==="industry:mill"?[kingdomId,kingdomId]:[kingdomId];
  const statement=env.DB.prepare(
    "UPDATE heroes SET assigned_to=? WHERE kingdom_id=? AND hero_key=? "+
    "AND EXISTS(SELECT 1 FROM hero_inventory hi WHERE hi.kingdom_id=heroes.kingdom_id AND hi.hero_key=heroes.hero_key) "+
    "AND NOT EXISTS(SELECT 1 FROM heroes occupied WHERE occupied.kingdom_id=? AND occupied.assigned_to=? AND occupied.hero_key<>?) "+
    facility
  ).bind(slot,kingdomId,heroKey,kingdomId,slot,heroKey,...params);
  const result=await statement.run();
  return Number(result?.meta?.changes)===1
    ?{ok:true,heroKey,slot}
    :{ok:false,status:409,error:"Posto ocupado, edifício indisponível ou herói não pertence ao reino."};
}
export async function unassign4xHero(env,kingdomId,heroKey){
  if(typeof heroKey!=="string"||heroKey.length<1||heroKey.length>100)
    return {ok:false,status:400,error:"Identificador de herói inválido."};
  const result=await env.DB.prepare(
    "UPDATE heroes SET assigned_to=NULL WHERE kingdom_id=? AND hero_key=? AND assigned_to IN ('industry:mill','defense:tower')"
  ).bind(kingdomId,heroKey).run();
  return Number(result?.meta?.changes)===1
    ?{ok:true,heroKey}
    :{ok:false,status:409,error:"Herói não está alocado a um posto 4X deste reino."};
}
