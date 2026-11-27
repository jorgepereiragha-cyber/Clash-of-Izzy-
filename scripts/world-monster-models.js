// Original low-poly tactical creature models. Render-only, never combat authority.
const p=(shape,color,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>({shape,color,x,y,z,sx,sy,sz,rx,ry,rz});
// Species-specific proportions: the same four GPU batches are shared by all
// creatures, but their silhouettes remain recognizable without relying on color.
const quadruped=(c,head,leg,tail,{body,skull,feet,tailForm})=>[
 p("orb",c,0,body[0],0,...body.slice(1)),
 p("orb",head,0,skull[0],skull[1],...skull.slice(2)),
 ...[-1,1].flatMap(side=>[-feet[1],feet[1]].map(z=>p("box",leg,side*feet[0],feet[2],z,...feet.slice(3)))),
 p("cone",tail,0,...tailForm)
];
const wolfForm={body:[.87,.39,.40,.92],skull:[1.12,-.79,.30,.32,.48],feet:[.25,.49,.36,.13,.72,.17],tailForm:[1.05,.89,.15,.92,.15,1.05]};
const boarForm={body:[.70,.61,.55,.78],skull:[.75,-.67,.40,.39,.50],feet:[.39,.40,.24,.22,.48,.24],tailForm:[.88,.82,.09,.34,.09,1.15]};
const bearForm={body:[.92,.72,.68,.91],skull:[1.22,-.68,.46,.44,.46],feet:[.47,.49,.34,.31,.68,.32],tailForm:[.92,.86,.16,.19,.16,1.05]};
const drakeForm={body:[.69,.48,.37,.92],skull:[1.04,-.80,.34,.35,.53],feet:[.34,.48,.25,.22,.50,.24],tailForm:[.90,1.02,.22,1.26,.22,1.27]};
const models={
 ash_wolf:[...quadruped(0x58677b,0x81909c,0x394651,0x596879,wolfForm),p("cone",0x8093a4,-.17,1.52,-.76,.13,.43,.15),p("cone",0x8093a4,.17,1.52,-.76,.13,.43,.15),p("orb",0xbac4c6,0,1.00,-1.12,.22,.17,.35)],
 iron_boar:[...quadruped(0x795345,0xa07558,0x493a32,0x795345,boarForm),p("orb",0xc38a75,0,.65,-1.08,.34,.20,.24),p("cone",0xf4dcb0,-.33,.63,-1.03,.12,.42,.13,.6,0,-.3),p("cone",0xf4dcb0,.33,.63,-1.03,.12,.42,.13,.6,0,.3),p("rock",0x604337,0,1.09,-.16,.44,.36,.62)],
 frost_bear:[...quadruped(0xc5dbe1,0xe3eff0,0x8caab9,0xbad2dc,bearForm),p("orb",0x9abac8,-.33,1.60,-.68,.19,.20,.17),p("orb",0x9abac8,.33,1.60,-.68,.19,.20,.17),p("orb",0x425567,0,1.10,-1.07,.23,.15,.23),p("orb",0xd2e4e8,0,1.04,-.36,.65,.57,.58)],
 marsh_wyrm:[...Array.from({length:6},(_,i)=>p("orb",i%2?0x77964d:0x456c47,Math.sin(i*1.3)*.42,.36+i*.065,.85-i*.30,.31,.3,.4)),p("orb",0x98ac61,0,1.11,-1.02,.42,.37,.48),p("cone",0xc7ce93,-.18,1.49,-.96,.1,.32,.1),p("cone",0xc7ce93,.18,1.49,-.96,.1,.32,.1)],
 stone_golem:[p("rock",0x757c81,0,1.1,0,.66,.78,.46),p("rock",0xb1b8ad,0,1.95,-.05,.39,.39,.35),...[-1,1].flatMap(side=>[p("rock",0x69787d,side*.68,1.23,0,.37,.66,.37,0,0,side*.24),p("box",0x56646a,side*.28,.34,0,.41,.68,.45)]),p("box",0xffa83d,0,1.17,-.43,.16,.29,.06)],
 ember_drake:[...quadruped(0x923d36,0xc66843,0x60342d,0x923d36,drakeForm),p("cone",0xe6b46b,-.23,1.48,-.75,.12,.46,.13),p("cone",0xe6b46b,.23,1.48,-.75,.12,.46,.13),p("cone",0xa94b37,-.95,1.22,.1,.61,1.46,.20,0,.28,-1.10),p("cone",0xa94b37,.95,1.22,.1,.61,1.46,.20,0,-.28,1.10),p("rock",0xe6b46b,0,.98,.54,.22,.28,.39)]
};
export const monsterModelKeys=Object.freeze(Object.keys(models));
export function monsterParts(key){
 return Object.hasOwn(models,key)?models[key].map(part=>({...part})):[];
}
export function visibleMonsterRows(rows){
 const out=[],seen=new Set();
 for(const row of Array.isArray(rows)?rows:[]){
  if(out.length>=50)break;
  const x=Number(row?.x),z=Number(row?.z),id=Number(row?.id),hp=Number(row?.hp);
  if(!Number.isSafeInteger(id)||id<1||seen.has(id)||!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>50||Math.abs(z)>45||!Number.isFinite(hp)||hp<=0||!Object.hasOwn(models,row?.monster_key))continue;
  seen.add(id);out.push({id,x,z,key:row.monster_key});
 }
 return out.sort((a,b)=>a.id-b.id);
}
// Four instanced batches regardless of the number of creatures. Rebuild only on
// changed visible creature identity/position, not on every HP or polling update.
export function createWorldMonsterLayer(THREE,parent,terrainHeight){
 const group=new THREE.Group();parent.add(group);
 let current="",disposed=false,geometries=null,material=null,batches=[];
 function clear(){for(const batch of batches){group.remove(batch);batch.dispose();}batches=[];}
 function update(rows){
  if(disposed)return false;
  const visible=visibleMonsterRows(rows),key=JSON.stringify(visible);
  if(key===current)return false;
  current=key;clear();
  if(!visible.length)return true;
  if(!geometries){
   geometries={orb:new THREE.SphereGeometry(1,8,5),box:new THREE.BoxGeometry(1,1,1),cone:new THREE.ConeGeometry(1,1,5),rock:new THREE.DodecahedronGeometry(1,0)};
   material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.86});
  }
  const byShape={orb:[],box:[],cone:[],rock:[]};
  for(const row of visible)for(const part of monsterParts(row.key))byShape[part.shape].push({row,part});
  const dummy=new THREE.Object3D(),color=new THREE.Color();
  for(const [shape,parts] of Object.entries(byShape)){
   if(!parts.length)continue;
   const batch=new THREE.InstancedMesh(geometries[shape],material,parts.length);
   for(const [i,{row,part}] of parts.entries()){
    dummy.position.set(row.x+part.x,terrainHeight(row.x,row.z)+part.y,row.z+part.z);
    dummy.scale.set(part.sx,part.sy,part.sz);
    dummy.rotation.set(part.rx,part.ry,part.rz);dummy.updateMatrix();
    batch.setMatrixAt(i,dummy.matrix);batch.setColorAt(i,color.setHex(part.color));
   }
   batch.instanceMatrix.needsUpdate=true;batch.instanceColor.needsUpdate=true;
   batch.computeBoundingSphere();group.add(batch);batches.push(batch);
  }
  return true;
 }
 return {update,dispose(){if(disposed)return;disposed=true;clear();parent.remove(group);if(geometries)for(const geometry of Object.values(geometries))geometry.dispose();material?.dispose();}};
}
