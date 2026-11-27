import { LEVEL_PACKS, publicLevelPack } from "../level-packs.js";
import { MASTER_PACK_NAME, MASTER_PACK_PRICE_BRL, MASTER_PACK_GEMS, MASTER_PACK_BONUSES } from "../master-pack.js";

export function betaProgressionPreview(env){
 if(env?.ENVIRONMENT!=="beta")return null;
 return {previewOnly:true,purchaseEnabled:false,packages:[
  ...LEVEL_PACKS.map(pack=>({name:pack.name,price_brl:pack.priceCents/100,gems:pack.gems,levelPack:publicLevelPack(pack,env)})),
  {name:MASTER_PACK_NAME,price_brl:MASTER_PACK_PRICE_BRL,gems:MASTER_PACK_GEMS,bonus:MASTER_PACK_BONUSES,oneTime:true}
 ]};
}
