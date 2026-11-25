import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../rally-ui.js",import.meta.url),"utf8");
const ctx=vm.createContext({window:{localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null}},document:{getElementById:()=>null}});
vm.runInContext(source,ctx);
const evaluate=expression=>JSON.parse(JSON.stringify(vm.runInContext(expression,ctx)));
test("formation accepts only known troops and integral quantities within collective limit",()=>{
 assert.deepEqual(evaluate('parseFormation([["militia","50"],["archer","0"],["knight","10"]],60)'),{militia:50,knight:10});
 for(const expr of ['parseFormation([["militia","61"]],60)','parseFormation([["militia","1.5"]],60)','parseFormation([["militia","1e2"]],200)','parseFormation([["militia","-1"]],60)','parseFormation([["fake","1"]],60)','parseFormation([["militia","0"]],60)','parseFormation([["militia","40"],["archer","30"]],60)']) assert.equal(evaluate(expr),null);
});
test("rally capacity reflects authoritative values and closes full rallies",()=>{
 assert.deepEqual(evaluate('rallyCapacityView({total_troops:19990,troop_capacity:20000})'),{total:19990,capacity:20000,remaining:10});
 assert.equal(evaluate('rallyCapacityView({total_troops:20001,troop_capacity:20000}).remaining'),0);
 assert.equal(evaluate('rallyCapacityView({})'),null);
 assert.match(source,/busy\|\|!capacity\|\|capacity.remaining===0/);
 assert.doesNotMatch(source,/window\.prompt/);
});
