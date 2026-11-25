import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker=readFileSync(new URL("../worker.js",import.meta.url),"utf8");

test("game state and action each have a single guarded dispatch",()=>{
  for(const [path,method,required] of [
    ["state","GET",["game-state-player","if(limited)return limited","await gameState(env,playerId)"]],
    ["action","POST",["game-action-player","if(playerLimit)return playerLimit","game-action-network","if(networkLimit)return networkLimit","await readBody(request)","if(body.__bodyError)","await gameAction(env,playerId,body)"]]
  ]){
    const marker='if(url.pathname==="/api/game/'+path+'"&&request.method==="'+method+'"){';
    assert.equal(worker.split(marker).length,2,path+" duplicate dispatch");
    const start=worker.indexOf(marker);
    const end=worker.indexOf("\n      }",start);
    assert.ok(end>start);
    const block=worker.slice(start,end);
    let previous=-1;
    for(const fragment of required){
      const current=block.indexOf(fragment);
      assert.ok(current>previous,path+" guard missing or out of order: "+fragment);
      previous=current;
    }
  }
});
