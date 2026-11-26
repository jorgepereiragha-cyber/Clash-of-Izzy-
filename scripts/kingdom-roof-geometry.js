// Original Eldoria pitched roof. Geometry only; no GPU or gameplay dependencies.
// Local coordinates: eaves at y=0, ridge on the z axis, closed manifold.
export function gableRoofData(width, depth, height) {
  if (![width, depth, height].every(v => Number.isFinite(v) && v > 0)) {
    throw new RangeError("Invalid roof dimensions");
  }
  const a=[-width/2,0,-depth/2], b=[width/2,0,-depth/2], c=[0,height,-depth/2];
  const d=[-width/2,0,depth/2], e=[width/2,0,depth/2], f=[0,height,depth/2];
  const positions=[], uv=[];
  const tri=(p,q,r, u,v,w)=>{positions.push(...p,...q,...r);uv.push(...u,...v,...w);};
  const slant=Math.hypot(width/2,height);
  // Slopes face up/out; roof texture follows eave-to-ridge and length.
  tri(a,d,f,[0,0],[depth,0],[depth,slant]);
  tri(a,f,c,[0,0],[depth,slant],[0,slant]);
  tri(b,c,f,[0,0],[0,slant],[depth,slant]);
  tri(b,f,e,[0,0],[depth,slant],[depth,0]);
  // Closed underside uses the roof material.
  tri(a,b,e,[0,0],[width,0],[width,depth]);
  tri(a,e,d,[0,0],[width,depth],[0,depth]);
  // Gable ends use masonry/timber material rather than slate.
  tri(a,c,b,[0,0],[width/2,height],[width,0]);
  tri(d,e,f,[0,0],[width,0],[width/2,height]);
  return {positions,uv,groups:[
    {start:0,count:18,materialIndex:0},{start:18,count:6,materialIndex:1}
  ]};
}
