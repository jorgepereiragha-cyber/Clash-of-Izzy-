// Clash of Izzy: march SIZE, separate from total army/training capacity.
// Server-authoritative: never trust percentages, hero levels or troop limit from a client.
// Inspired by the strategy-genre pattern of castle + garrison + research + hero leadership.
export const MAX_MARCH_SIZE=16000;
const RARITY_BONUS=Object.freeze({white:0,blue:180,purple:420,gold:800});
const clampInt=(value,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Math.floor(Number(value)):min));
const normalizeRarity=value=>({
 common:"white",rare:"blue",epic:"purple",legendary:"gold",mythic:"gold"
}[value]||value||"white");

export function heroLeadershipBonus(hero){
  if(!hero)return 0;
  const rarity=normalizeRarity(String(hero.rarity||"white"));
  const level=clampInt(hero.level,1,100);
  const stars=clampInt(hero.stars,1,5);
  return level*18+stars*90+(RARITY_BONUS[rarity]||0);
}
export function calculateMarchCapacity({castleLevel=1,barracksLevel=1,academyLevel=1,
  militaryLevel=0,heroes=[],heroKey=null}={}){
  const levels={
    castle:clampInt(castleLevel,1,30),
    barracks:clampInt(barracksLevel,1,30),
    academy:clampInt(academyLevel,1,30),
    military:clampInt(militaryLevel,0,30)
  };
  const owned=Array.isArray(heroes)?heroes.filter(h=>h&&typeof h.hero_key==="string"&&h.hero_key.length>0):[];
  let chosen=null;
  if(heroKey!==null&&heroKey!==undefined&&heroKey!==""){
    if(typeof heroKey!=="string"||heroKey.length>96)throw new RangeError("Herói selecionado inválido");
    chosen=owned.find(h=>h.hero_key===heroKey)||null;
    if(!chosen)throw new RangeError("Herói não pertence ao seu reino");
  }else{
    chosen=[...owned].sort((a,b)=>
      heroLeadershipBonus(b)-heroLeadershipBonus(a)||
      a.hero_key.localeCompare(b.hero_key))[0]||null;
  }
  const components={
    base:150,
    castle:levels.castle*100,
    barracks:levels.barracks*80,
    academy:levels.academy*25,
    military:levels.military*110,
    hero:heroLeadershipBonus(chosen)
  };
  const raw=Object.values(components).reduce((sum,x)=>sum+x,0);
  const capacity=Math.min(MAX_MARCH_SIZE,raw);
  return {capacity,maxCapacity:MAX_MARCH_SIZE,heroKey:chosen?.hero_key||null,
    heroName:chosen?.hero_name||chosen?.name||null,components,levels};
}
export function troopTotal(units){
  if(!units||typeof units!=="object"||Array.isArray(units))throw new RangeError("Formação inválida");
  let total=0;
  for(const value of Object.values(units)){
    if(!Number.isSafeInteger(value)||value<0)throw new RangeError("Quantidade de tropas inválida");
    total+=value;
    if(!Number.isSafeInteger(total))throw new RangeError("Tropas demais");
  }
  return total;
}
export function assertWithinMarchCapacity(units,limit){
  const total=troopTotal(units);
  if(total<1)throw new RangeError("Selecione pelo menos uma tropa");
  if(!Number.isSafeInteger(limit)||limit<1||total>limit)
    throw new RangeError("Capacidade de marcha excedida: "+total+" / "+limit+" tropas");
  return total;
}

// Fetch all contributing dimensions directly from D1, never from request payload.
export async function loadMarchCapacity(env,kingdomId,heroKey=null){
  if(!Number.isSafeInteger(Number(kingdomId))||Number(kingdomId)<1)
    throw new RangeError("Reino inválido");
  const [levels,heroRows]=await Promise.all([
    env.DB.prepare(
      "SELECT k.castle_level AS castleLevel,"+
      "COALESCE((SELECT level FROM kingdom_buildings WHERE kingdom_id=k.id AND building_type='barracks'),1) AS barracksLevel,"+
      "COALESCE((SELECT level FROM kingdom_buildings WHERE kingdom_id=k.id AND building_type='academy'),1) AS academyLevel,"+
      "COALESCE((SELECT level FROM research WHERE kingdom_id=k.id AND research_key='military'),0) AS militaryLevel "+
      "FROM kingdoms k WHERE k.id=?"
    ).bind(kingdomId).first(),
    env.DB.prepare(
      "SELECT hi.hero_key,COALESCE(h.hero_name,hi.hero_key) AS hero_name,"+
      "hi.level,hi.stars,hi.rarity FROM hero_inventory hi "+
      "LEFT JOIN heroes h ON h.kingdom_id=hi.kingdom_id AND h.hero_key=hi.hero_key "+
      "WHERE hi.kingdom_id=?"
    ).bind(kingdomId).all()
  ]);
  if(!levels)throw new RangeError("Reino não encontrado");
  return calculateMarchCapacity({...levels,heroes:heroRows.results||[],heroKey});
}


// The number of simultaneous expeditions grows with the kingdom. Includes no
// premium or pay-to-win extras, and is independent of troop capacity per march.
export function calculateMarchSlots({castleLevel=1,militaryLevel=0,activeMarches=0}={}){
  if(!Number.isSafeInteger(Number(activeMarches))||Number(activeMarches)<0)
    throw new RangeError("Quantidade de marchas ativas inválida");
  const castle=clampInt(castleLevel,1,30);
  const military=clampInt(militaryLevel,0,30);
  const max=Math.min(5,1+
    (castle>=5?1:0)+(castle>=15?1:0)+(military>=5?1:0)+(military>=15?1:0));
  const active=Number(activeMarches);
  return {max,active,available:Math.max(0,max-active)};
}
