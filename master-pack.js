import { MASTER_DRAGON_KEYS } from "./dragon-catalog.js";
export const MASTER_PACK_NAME="Pacote Master de Eldoria";
export const MASTER_PACK_PRICE_BRL=399;
export const MASTER_PACK_GEMS=10000;
export const MASTER_PACK_RESOURCES=Object.freeze({food:50000,wood:50000,stone:40000,iron:20000,gold:15000});
export const MASTER_PACK_BONUSES=Object.freeze({dragons:MASTER_DRAGON_KEYS,resources:MASTER_PACK_RESOURCES,gems:MASTER_PACK_GEMS,oneTime:true});
// Build a single transactional D1 batch AFTER a trusted provider confirmation.
// One ledger row per kingdom prevents another order from duplicating resources.
export function masterGrantStatements(db,requestId){
 const grant=db.prepare("INSERT OR IGNORE INTO master_bonus_claims(request_id,kingdom_id) SELECT id,kingdom_id FROM purchase_requests WHERE id=? AND status='approved' AND product_kind='vip_package' AND product_name=? AND changes()=1 AND EXISTS(SELECT 1 FROM kingdoms k WHERE k.id=purchase_requests.kingdom_id AND k.player_id=purchase_requests.player_id)").bind(requestId,MASTER_PACK_NAME);
 const diamonds=db.prepare("UPDATE players SET gems=gems+(SELECT gems_amount FROM purchase_requests WHERE id=?) WHERE id=(SELECT player_id FROM purchase_requests WHERE id=?) AND changes()=1").bind(requestId,requestId);
 const resources=db.prepare("UPDATE kingdoms SET food=food+?,wood=wood+?,stone=stone+?,iron=iron+?,gold=gold+? WHERE id=(SELECT kingdom_id FROM master_bonus_claims WHERE request_id=?) AND changes()=1").bind(MASTER_PACK_RESOURCES.food,MASTER_PACK_RESOURCES.wood,MASTER_PACK_RESOURCES.stone,MASTER_PACK_RESOURCES.iron,MASTER_PACK_RESOURCES.gold,requestId);
 const unlocks=MASTER_DRAGON_KEYS.map(key=>db.prepare("INSERT OR IGNORE INTO kingdom_dragons(kingdom_id,dragon_key,source) SELECT kingdom_id,?,'master' FROM master_bonus_claims WHERE request_id=?").bind(key,requestId));
 const message=db.prepare("INSERT OR IGNORE INTO kingdom_mailbox(kingdom_id,source_key,title,body,reward_key) SELECT kingdom_id,?,? ,? ,'' FROM master_bonus_claims WHERE request_id=?").bind("master-order-"+requestId,"Pacote Master recebido","Três dragões dourados liberados na sua coleção. Apenas um dragão pode ser equipado por vez. Diamantes e recursos já foram creditados.",requestId);
 return [grant,diamonds,resources,...unlocks,message];
}
