// Visual-only formation: never changes army counts or combat. No remote art.
export const UNIT_STYLES = Object.freeze({
  militia:"infantry", swordsman:"infantry", spearman:"spear", archer:"bow",
  crossbowman:"crossbow", cavalry:"horse", knight:"horse", mage:"mage",
  catapult:"siege", ram:"ram", trebuchet:"siege"
});
export function planArmyFigures(troops, tier = "balanced") {
  const budget = tier === "low" ? 4 : tier === "high" ? 12 : 8;
  const counts = new Map();
  for (const row of Array.isArray(troops) ? troops : []) {
    const type = row?.unit_type;
    if (!Object.hasOwn(UNIT_STYLES, type)) continue;
    const n = Number(row.quantity);
    if (!Number.isSafeInteger(n) || n <= 0) continue;
    counts.set(type, Math.min(Number.MAX_SAFE_INTEGER, (counts.get(type) || 0) + n));
  }
  const types = Object.keys(UNIT_STYLES).filter(type => counts.has(type));
  const figures = [];
  // One representative of each type first, then extras; stable across state refreshes.
  for (let round = 0; round < 5 && figures.length < budget; round++) {
    for (const type of types) {
      if (figures.length >= budget) break;
      const cap = Math.min(tier === "low" ? 2 : tier === "high" ? 5 : 3,
        Math.max(1, Math.ceil(Math.log2(counts.get(type) + 1))));
      if (round < cap) figures.push(type);
    }
  }
  return figures.map((type,index) => ({
    type, style:UNIT_STYLES[type],
    x:(index % 6 - (Math.min(6, figures.length - Math.floor(index/6)*6)-1)/2)*.86,
    z:4.25 + Math.floor(index/6)*1.05
  }));
}

export function createProceduralUnit(THREE, type, tier) {
  const style=UNIT_STYLES[type];
  if (!Object.hasOwn(UNIT_STYLES,type)) throw new TypeError("Unknown troop");
  const root=new THREE.Group();
  const armor=new THREE.MeshStandardMaterial({color:0x31577d,roughness:.73,metalness:.18});
  const steel=new THREE.MeshStandardMaterial({color:0xaeb6b9,roughness:.48,metalness:.5});
  const wood=new THREE.MeshStandardMaterial({color:0x775039,roughness:.9});
  const gold=new THREE.MeshStandardMaterial({color:0xd5b16b,roughness:.5,metalness:.3});
  const add=(geometry,mat,x,y,z,rz=0)=>{
    const mesh=new THREE.Mesh(geometry,mat);
    mesh.position.set(x,y,z);mesh.rotation.z=rz;
    mesh.castShadow=tier==="high";mesh.receiveShadow=tier==="high";
    root.add(mesh);return mesh;
  };
  const box=(w,h,d,mat,x,y,z,rz=0)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,rz);
  const cylinder=(r,h,mat,x,y,z,rz=0)=>add(new THREE.CylinderGeometry(r,r,h,6),mat,x,y,z,rz);
  if(style==="siege"||style==="ram"){
    box(.64,.22,.65,wood,0,.27,0);
    for(const x of [-.33,.33])for(const z of [-.24,.24]){
      const wheel=cylinder(.15,.08,steel,x,.16,z,Math.PI/2);
    }
    if(style==="ram"){
      box(.56,.22,.78,wood,0,.60,0);
      box(.22,.24,.85,steel,0,.39,.12);
    }else{
      box(.12,.72,.12,wood,0,.58,0,.22);
      box(.13,.80,.14,wood,0,.80,0,-.75);
      box(.24,.12,.22,steel,.24,1.02,0);
    }
  }else{
    const mounted=style==="horse", y=mounted?.48:0;
    if(mounted){
      box(.38,.42,.72,wood,0,.45,0);
      box(.22,.30,.22,wood,0,.69,.32,-.18);
      for(const x of [-.13,.13])for(const z of [-.24,.24])box(.09,.29,.10,wood,x,.18,z);
    }else{
      box(.12,.30,.12,wood,-.10,.15,0);
      box(.12,.30,.12,wood,.10,.15,0);
    }
    box(.31,.40,.20,armor,0,y+.49,0);
    cylinder(.13,.23,steel,0,y+.80,0);
    if(style==="bow"||style==="crossbow"){
      box(.07,.43,.06,wood,.25,y+.47,0,-.24);
      box(.30,.05,.06,wood,.25,y+.49,0);
    }else if(style==="spear"||style==="mage"){
      cylinder(.035,.83,wood,.25,y+.52,0);
      add(new THREE.ConeGeometry(.075,.18,5),style==="mage"?gold:steel,.25,y+.99,0);
    }else{
      box(.07,.42,.055,steel,.25,y+.50,0,-.34);
      box(.20,.27,.06,gold,-.23,y+.48,.10);
    }
  }
  // All materials are private to this figure. Dispose only resources not attached.
  const used=new Set(root.children.map(mesh=>mesh.material));
  for(const mat of [armor,steel,wood,gold])if(!used.has(mat))mat.dispose();
  root.userData.coIUnitType=type;
  return root;
}

// Stable phase per visible representative; no random state or gameplay timing.
export function troopAnimationPhase(index,duration,reducedMotion=false){
  if(reducedMotion||!Number.isSafeInteger(index)||index<0||!Number.isFinite(duration)||duration<=0)return 0;
  return ((index*0.6180339887498949)%1)*duration;
}
