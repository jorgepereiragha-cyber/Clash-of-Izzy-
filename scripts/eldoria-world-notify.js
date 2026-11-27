import { ELDORIA_ROOM_SHARDS, roomNameForShard } from "./eldoria-realtime-routing.js";

// Best effort, only in the closed beta. No identity, troop data or coordinates
// are sent: clients must fetch their own authenticated state from D1.
export async function notifyWorldChanged(env){
 if(env?.ENVIRONMENT!=="beta"||!env.ELDORIA_ROOM)return;
 const namespace=env.ELDORIA_ROOM;
 const shards=[null,...Array.from({length:ELDORIA_ROOM_SHARDS},(_,i)=>i)];
 await Promise.allSettled(shards.map(async shard=>{
  const stub=namespace.get(namespace.idFromName(roomNameForShard(shard)));
  await stub.fetch(new Request("https://eldoria.internal/world-changed",{method:"POST",signal:AbortSignal.timeout(2000)}));
 }));
}

// A committed mutation invalidates clients; rejected actions and polling do not.
export async function notifyCommittedRallyMutation(env,method,response){
 if(method==="POST"&&response.ok)await notifyWorldChanged(env);
 return response;
}
