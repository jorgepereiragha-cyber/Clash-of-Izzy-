// Original procedural art for the equipped dragon, purely visual.
export const DRAGON_PALETTES=Object.freeze({
 ember_wyrm:[0x326a9f,0xe28a46,0xf2c36e],mist_talon:[0x608db0,0xb9d7e1,0x8cd9f6],
 frost_glimmer:[0x3e87bf,0xb3ebf5,0xd9f7ff],storm_rune:[0x6c4696,0x9d7ee2,0xe4d0ff],
 jade_guardian:[0x347c68,0x75c99c,0xd7b970],abyss_wing:[0x3d325d,0x7351a0,0xca94ff],
 sun_ascendant:[0xbd7937,0xffc367,0xffeab2],astral_aegis:[0xb49763,0x6874ba,0xf4dfaa],
 imperial_drake:[0xb38b41,0x9d483c,0xffdd80]
});
export function projectDragonVisual(row) {
 const key=row?.dragon_key;
 if(typeof key!=="string"||!Object.hasOwn(DRAGON_PALETTES,key))return null;
 const value=Number(row.level);
 const level=Number.isFinite(value)?Math.max(1,Math.min(100,Math.floor(value))):1;
 return {key,level,scale:0.72+0.20*(level-1)/99};
}
export function makeDragonFigure(THREE, visual, tier) {
 const [bodyColor,wingColor,crestColor]=DRAGON_PALETTES[visual.key];
 const root=new THREE.Group(), wings=[];
 const bodyMat=new THREE.MeshStandardMaterial({color:bodyColor,roughness:.72,metalness:.12,flatShading:true});
 const wingMat=new THREE.MeshStandardMaterial({color:wingColor,roughness:.79,side:THREE.DoubleSide,flatShading:true});
 const crestMat=new THREE.MeshStandardMaterial({color:crestColor,roughness:.48,metalness:.22});
 function mesh(parent,geom,mat,x,y,z,sx=1,sy=1,sz=1){
  const obj=new THREE.Mesh(geom,mat);obj.position.set(x,y,z);obj.scale.set(sx,sy,sz);
  obj.castShadow=false;obj.receiveShadow=false;parent.add(obj);return obj;
 }
 const body=(x,y,z,sx,sy,sz)=>mesh(root,new THREE.IcosahedronGeometry(1,1),bodyMat,x,y,z,sx,sy,sz);
 body(0,0,0,.32,.35,.68);body(0,.19,.47,.19,.27,.38);body(0,.38,.72,.23,.19,.26);
 body(0,.29,.92,.15,.11,.17);
 for(let i=0;i<4;i++)body(0,-.10-i*.045,-.60-i*.20,.17-i*.027,.16-i*.023,.25);
 for(const s of [-1,1]){
  for(const z of [-.36,.24])body(s*.23,-.25,z,.10,.20,.14);
  const horn=mesh(root,new THREE.ConeGeometry(.065,.23,5),crestMat,s*.12,.58,.68);
  horn.rotation.x=-.35;
  mesh(root,new THREE.SphereGeometry(.04,6,4),crestMat,s*.19,.41,.78);
  const wing=new THREE.Group();wing.position.set(s*.22,.13,.10);root.add(wing);wings.push({wing,sign:s});
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute([
   0,0,0, s*.58,.32,.34, s*1.42,.08,.08, s*1.06,-.04,-.30, s*.69,-.03,-.20, s*.40,-.05,-.48
  ],3));
  geo.setIndex([0,1,2,0,2,3,0,3,4,0,4,5]);geo.computeVertexNormals();
  mesh(wing,geo,wingMat,0,0,0);
  const spar=mesh(wing,new THREE.BoxGeometry(1.25,.045,.055),bodyMat,s*.63,.10,.10);
  spar.rotation.z=s*.10;
 }
 for(let i=0;i<(tier==="high"?5:3);i++){
  mesh(root,new THREE.ConeGeometry(.055,.17,5),crestMat,0,.34-i*.025,.25-i*.22);
 }
 root.scale.setScalar(visual.scale);
 root.rotation.y=-.40;
 root.userData.coIDragonKey=visual.key;
 return {root,wings};
}
export function poseDragon(figure,time,animated) {
 const phase=animated?Math.sin(time*2.6):0;
 for(const {wing,sign} of figure.wings)wing.rotation.z=sign*(.18+phase*.36);
}
