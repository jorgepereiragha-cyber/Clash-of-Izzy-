import test from "node:test";
import assert from "node:assert/strict";
import {hospitalEnabled,recoverableLosses,hospitalHealCost,hospitalAdmission,HOSPITAL_PER_LEVEL} from "../hospital-policy.js";
test("hospital is beta-only and casualties and recovery remain bounded",()=>{
 assert.equal(hospitalEnabled({ENVIRONMENT:"beta",GAME_4X_SYSTEMS_ENABLED:"true"}),true);
 assert.equal(hospitalEnabled({ENVIRONMENT:"production",GAME_4X_SYSTEMS_ENABLED:"true"}),false);
 assert.equal(HOSPITAL_PER_LEVEL,100);
 for(let sent=0;sent<=100;sent++)for(let survived=0;survived<=sent;survived++)assert.equal(recoverableLosses(sent,survived),Math.floor((sent-survived)/2));
 assert.equal(recoverableLosses(1,2),0);
 assert.equal(hospitalHealCost(5,12),30);
 assert.equal(hospitalHealCost(101,12),null);
 assert.equal(hospitalHealCost(1.5,12),null);
});
test("admission query checks remaining capacity and resolution token",()=>{
 let sql,args;
 const db={prepare(s){sql=s;return {bind(...a){args=a;return {}}}}};
 hospitalAdmission(db,1,"militia",5,"EXISTS(SELECT 1 FROM marches WHERE id=? AND resolution_token=?)",[2,"test"]);
 assert.match(sql,/SUM\(wounded\)/);
 assert.match(sql,/resolution_token=\?/);
 assert.deepEqual(args,[1,"militia",5,100,1,1,2,"test"]);
});
