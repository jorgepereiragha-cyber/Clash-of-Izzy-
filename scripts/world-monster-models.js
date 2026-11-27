// Original low-poly tactical creature models. Render-only, never combat authority.
const p=(shape,color,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>({shape,color,x,y,z,sx,sy,sz,rx,ry,rz});
const quadruped=(c,head,leg,tail)=>[
 p("orb",c,0,.77,0,.53,.48,.88),
 p("orb",head,0,1.02,-.72,.4,.38,.44),
 ...[-1,1].flatMap(side=>[-.47,.48].map(z=>p("box",leg,side*.31,.32,z,.18,.64,.22))),
 p("cone",tail,0,.91,.9,.19,.7,.19,1.05)
];
const models={
 ash_wolf:[...quadruped(0x58677b,0x81909c,0x394651,0x596879),p("cone",0x8093a4,-.22,1.45,-.73,.15,.42,.18),p("cone",0x8093a4,.22,1.45,-.73,.15,.42,.18),p("orb",0xbac4c6,0,.88,-1.03,.25,.18,.35)],
 iron_boar:[...quadruped(0x795345,0xa07558,0x493a32,0x795345),p("orb",0xc38a75,0,.83,-1.04,.29,.20,.29),p("cone",0xf4dcb0,-.29,.78,-1.02,.11,.41,.12,.6,0,-.3),p("cone",0xf4dcb0,.29,.78,-1.02,.11,.41,.12,.6,0,.3)],
 frost_bear:[...quadruped(0xc5dbe1,0xe3eff0,0x8caab9,0xbad2dc),p("orb",0x9abac8,-.3,1.34,-.73,.19,.22,.16),p("orb",0x9abac8,.3,1.34,-.73,.19,.22,.16),p("orb",0x425567,0,.95,-1.06,.18,.12,.15)],
 marsh_wyrm:[...Array.from({length:6},(_,i)=>p("orb",i%2?0x77964d:0x456c47,Math.sin(i*1.3)*.42,.36+i*.065,.85-i*.30,.31,.3,.4)),p("orb",0x98ac61,0,1.11,-1.02,.42,.37,.48),p("cone",0xc7ce93,-.18,1.49,-.96,.1,.32,.1),p("cone",0xc7ce93,.18,1.49,-.96,.1,.32,.1)],
 stone_golem:[p("rock",0x757c81,0,1.1,0,.66,.78,.46),p("rock",0xb1b8ad,0,1.95,-.05,.39,.39,.35),...[-1,1].flatMap(side=>[p("rock",0x69787d,side*.68,1.23,0,.37,.66,.37,0,0,side*.24),p("box",0x56646a,side*.28,.34,0,.41,.68,.45)]),p("box",0xffa83d,0,1.17,-.43,.16,.29,.06)],
 ember_drake:[...quadruped(0x923d36,0xc66843,0x60342d,0x923d36),p("cone",0xe6b46b,-.23,1.48,-.75,.12,.46,.13),p("cone",0xe6b46b,.23,1.48,-.75,.12,.46,.13),p("box",0xa94b37,-.79,1.35,.1,1.26,.10,.82,0,.15,-.4),p("box",0xa94b37,.79,1.35,.1,1.26,.10,.82,0,-.15,.4)]
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
