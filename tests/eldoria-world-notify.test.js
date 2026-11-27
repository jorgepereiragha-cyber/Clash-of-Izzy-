import test from "node:test";
import assert from "node:assert/strict";
import { notifyWorldChanged } from "../scripts/eldoria-world-notify.js";
import { readRealtimePacket } from "../scripts/eldoria-realtime-client.js";
import { EldoriaRoom } from "../eldoria-room.js";

test("beta notification fans out to legacy and eight shards and tolerates failure",async()=>{
 const rooms=[],requests=[];
 const env={ENVIRONMENT:"beta",ELDORIA_ROOM:{idFromName:name=>name,get:name=>({fetch:async request=>{
  rooms.push(name);
  requests.push({method:request.method,url:request.url,body:await request.text()});
  if(name==="eldoria-shard-2")throw new Error("unavailable");
  return new Response(null,{status:204});
 }})}};
 await notifyWorldChanged({...env,ENVIRONMENT:"production"});
 assert.equal(rooms.length,0);
 await notifyWorldChanged(env);
 assert.equal(new Set(rooms).size,9);
 assert.ok(rooms.includes("eldoria"));
 assert.equal(requests.length,9);
 for(const request of requests)assert.deepEqual(request,{method:"POST",url:"https://eldoria.internal/world-changed",body:""});
});
test("only internal beta POST broadcasts a data-free invalidation",async()=>{
 const packets=[];
 const room=new EldoriaRoom({getWebSockets:()=>[{send:msg=>packets.push(JSON.parse(msg))}]},{ENVIRONMENT:"beta"});
 assert.equal((await room.fetch(new Request("https://public.example/world-changed",{method:"POST"}))).status,405);
 assert.equal((await room.fetch(new Request("https://eldoria.internal/world-changed",{method:"POST"}))).status,204);
 assert.deepEqual(packets,[{type:"world_changed"}]);
 await room.webSocketMessage({send:()=>{}},'{"type":"world_changed"}');
 assert.equal(packets.length,1);
 assert.deepEqual(readRealtimePacket('{"type":"world_changed","playerId":"secret"}'),{type:"world_changed"});
});
