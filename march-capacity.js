// Capacidade autoritativa de marcha do Clash of Izzy.
// Progressão inspirada em RPGs de estratégia: castelo + academia + herói + pesquisa.
// Não inclui bônus pagos ou inventados, nem altera atributo de batalha.
export const MAX_MARCH_CAPACITY=200000;
export const MARCH_RARITY_BONUS=Object.freeze({white:0,blue:4,purple:8,gold:14});
export function marchCapacity({castleLevel=1,academyLevel=0,militaryResearchLevel=0,hero=null}={}){
  const level=Math.min(30,Math.max(1,Math.floor(Number(castleLevel)||1)));
  const academy=Math.min(30,Math.max(0,Math.floor(Number(academyLevel)||0)));
  const military=Math.min(30,Math.max(0,Math.floor(Number(militaryResearchLevel)||0)));
  const heroLevel=Math.min(100,Math.max(0,Math.floor(Number(hero?.level)||0)));
  const stars=Math.min(8,Math.max(0,Math.floor(Number(hero?.stars)||0)));
  const rarity=Object.hasOwn(MARCH_RARITY_BONUS,hero?.rarity)?hero.rarity:"white";
  const castle=400+level*2000;
  const academyBonus=academy*200;
  const heroPercent=heroLevel>0?(MARCH_RARITY_BONUS[rarity]+heroLevel*.15+stars):0;
  const researchPercent=military*1.5;
  const maximum=Math.min(MAX_MARCH_CAPACITY,Math.floor((castle+academyBonus)*(1+(heroPercent+researchPercent)/100)));
  return {maximum,castleBonus:castle,academyBonus,heroBonusPercent:Number(heroPercent.toFixed(2)),
    researchBonusPercent:Number(researchPercent.toFixed(2)),
    heroName:hero?.name||null,heroRarity:heroLevel?rarity:null};
}
export function countTroops(troops){
  if(!troops||typeof troops!=="object"||Array.isArray(troops))return 0;
  let total=0;
  for(const quantity of Object.values(troops)){
    if(!Number.isSafeInteger(quantity)||quantity<1)return -1;
    total+=quantity;
    if(!Number.isSafeInteger(total))return -1;
  }
  return total;
}
export function withinMarchCapacity(troops,capacity){
  const total=countTroops(troops);
  return total>0&&total<=Number(capacity);
}
export async function marchCapacityForKingdom(db,kingdomId){
  const [kingdom,academy,research,hero]=await Promise.all([
    db.prepare("SELECT castle_level FROM kingdoms WHERE id=?").bind(kingdomId).first(),
    db.prepare("SELECT level FROM kingdom_buildings WHERE kingdom_id=? AND building_type='academy'").bind(kingdomId).first(),
    db.prepare("SELECT level FROM research WHERE kingdom_id=? AND research_key='military'").bind(kingdomId).first(),
    db.prepare("SELECT hi.level,hi.stars,hi.rarity,COALESCE(v.hero_name,hi.hero_key) AS name "+
      "FROM hero_inventory hi LEFT JOIN valhalla_hero_catalog v ON v.hero_key=hi.hero_key "+
      "WHERE hi.kingdom_id=? ORDER BY "+
      "CASE hi.rarity WHEN 'gold' THEN 4 WHEN 'purple' THEN 3 WHEN 'blue' THEN 2 ELSE 1 END DESC,"+
      " hi.level DESC,hi.stars DESC,hi.hero_key LIMIT 1").bind(kingdomId).first()
  ]);
  if(!kingdom)throw Error("Reino não encontrado");
  return marchCapacity({castleLevel:kingdom.castle_level,academyLevel:academy?.level||0,
    militaryResearchLevel:research?.level||0,hero});
}
