// Beta-only hospital policy, using the existing wounded column.
export const hospitalEnabled=env=>env.ENVIRONMENT==="beta"&&env.GAME_4X_SYSTEMS_ENABLED==="true";
export const HOSPITAL_PER_LEVEL=100;
export const HOSPITAL_HEAL_MAX=100;
export function recoverableLosses(sent,survived){
 if(!Number.isSafeInteger(sent)||!Number.isSafeInteger(survived)||sent<0||survived<0||survived>sent)return 0;
 return Math.floor((sent-survived)/2);
}
export function hospitalHealCost(quantity,trainingFood){
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>HOSPITAL_HEAL_MAX||!Number.isSafeInteger(trainingFood)||trainingFood<1)return null;
 return quantity*Math.ceil(trainingFood/2);
}
// Guard is the unique march resolution token; capacity is checked at write time,
// after any earlier type in this same batch. No additional casualties are created.
export function hospitalAdmission(db,kingdomId,unit,quantity,guard,guardArgs){
 return db.prepare("INSERT INTO army_units(kingdom_id,unit_type,tier,quantity,wounded) SELECT ?,?,1,0,MIN(?,MAX(0,COALESCE((SELECT level*? FROM kingdom_buildings WHERE kingdom_id=? AND building_type='hospital'),0)-(SELECT COALESCE(SUM(wounded),0) FROM army_units WHERE kingdom_id=?))) WHERE "+guard+" ON CONFLICT(kingdom_id,unit_type,tier) DO UPDATE SET wounded=wounded+excluded.wounded").bind(kingdomId,unit,quantity,HOSPITAL_PER_LEVEL,kingdomId,kingdomId,...guardArgs);
}
