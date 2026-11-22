/** Server-only progression, independent from castle (1–30) and VIP (1–7).
 * No user-supplied XP amounts and no economic rewards until separately audited. */
export const PLAYER_PHASES=Object.freeze([
 Object.freeze({phase:"P1",name:"Novo Reino",title:"Governante Iniciante"}),
 Object.freeze({phase:"P2",name:"Senhor Feudal",title:"Lorde Feudal"}),
 Object.freeze({phase:"P3",name:"Conde Soberano",title:"Conde Soberano"}),
 Object.freeze({phase:"P4",name:"Marquês Poderoso",title:"Marquês Poderoso"}),
 Object.freeze({phase:"P5",name:"Duque Supremo",title:"Duque Supremo"}),
 Object.freeze({phase:"P6",name:"Rei Lendário",title:"Rei Lendário"}),
 Object.freeze({phase:"P7",name:"Imperador Divino",title:"Imperador Divino"}),
 Object.freeze({phase:"P8",name:"Deus Supremo",title:"Deus Supremo"})
]);
export function calculateXPRequired(level){
 return Number.isSafeInteger(level)&&level>=1&&level<80
   ?Math.floor(1000*Math.pow(1.2,level-1)):0;
}
export const MAX_PLAYER_XP=Array.from({length:79},(_,i)=>calculateXPRequired(i+1))
 .reduce((a,b)=>a+b,0);
export function getPlayerProgression(totalXP){
 const raw=Number(totalXP);
 const total=Number.isSafeInteger(raw)&&raw>0?Math.min(raw,MAX_PLAYER_XP):0;
 let level=1,spent=0;
 while(level<80&&spent+calculateXPRequired(level)<=total){
   spent+=calculateXPRequired(level);level++;
 }
 const phase=PLAYER_PHASES[Math.floor((level-1)/10)];
 const next=calculateXPRequired(level),earned=total-spent;
 return {level,phase:phase.phase,phaseName:phase.name,title:phase.title,totalXP:total,
  experience:earned,experienceToNext:next,
  progressPercent:next?Math.min(100,Math.floor(earned*100/next)):100};
}
/** Bounded experience ONLY after a server-owned queue has completed. */
export function experienceForCompletedQueue(queue){
 if(!queue||!["construction","training","research"].includes(queue.queue_type))return 0;
 if(queue.queue_type==="training"){
  const q=Number(queue.quantity);
  return Number.isSafeInteger(q)&&q>=1&&q<=100?q*5:0;
 }
 const level=Number(queue.to_level);
 return Number.isSafeInteger(level)&&level>=1&&level<=30
  ?level*(queue.queue_type==="construction"?100:80):0;
}
