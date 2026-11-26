// Pure visual geography. Does not change server coordinates, march timing, or ownership.
const RIVER_POINTS=Object.freeze([[-50,-22],[-30,-10],[-10,-14],[12,-5],[34,-13],[52,-7]]);
export function worldTerrainHeight(x,z){
 return Math.sin(x*.095)*.48+Math.cos(z*.13)*.34+Math.sin((x+z)*.055)*.28+Math.cos((x-z)*.035)*.22;
}
export function worldRiverZ(x){
 if(x<=RIVER_POINTS[0][0])return RIVER_POINTS[0][1];
 for(let i=1;i<RIVER_POINTS.length;i++){
  const [bx,bz]=RIVER_POINTS[i],[ax,az]=RIVER_POINTS[i-1];
  if(x<=bx){const t=(x-ax)/(bx-ax),smooth=t*t*(3-2*t);return az+(bz-az)*smooth;}
 }
 return RIVER_POINTS[RIVER_POINTS.length-1][1];
}
export function worldRiverDistance(x,z){return x< -50||x>52?Infinity:Math.abs(z-worldRiverZ(x));}
export function worldTerrainBlend(x,z){
 const edge=Math.min(1,Math.max(0,(Math.hypot(x/56,z/46)-.57)/.55));
 const meadow=Math.max(0,Math.min(1,.5+.24*Math.sin(x*.17+z*.08)+.17*Math.cos(z*.23-x*.12)+.09*Math.sin((x-z)*.41)));
 const bank=Math.max(0,1-worldRiverDistance(x,z)/3.5);
 return {edge,meadow,bank};
}
export function worldRiverRibbon({segments=96,halfWidth=.75,offset=-.05}={}){
 const count=Math.max(8,Math.min(128,Math.floor(segments)||96));
 const width=Math.max(.1,Math.min(2,Number(halfWidth)||.75));
 const elevation=Math.max(-.18,Math.min(.06,Number(offset)||0));
 const positions=[],indices=[];
 for(let i=0;i<=count;i++){
  const x=-50+102*i/count,z=worldRiverZ(x),w=width*(.88+.12*Math.cos(x*.19));
  for(const side of [-1,1]){
   const zz=z+side*w;
   positions.push(x,worldTerrainHeight(x,zz)+elevation,zz);
  }
  if(i<count){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
 }
 return {positions,indices};
}
