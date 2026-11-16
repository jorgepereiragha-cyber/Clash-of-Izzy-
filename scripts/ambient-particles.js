/* Partículas 2D leves para a cidade. Sem novo contexto WebGL ou dependência externa. */
(() => {
 "use strict";
 const host=document.getElementById("city");
 if(!host||host.querySelector(".coi-ambient-layer"))return;
 const reduce=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
 const saveData=navigator.connection?.saveData===true;
 if(reduce||saveData)return;
 const canvas=document.createElement("canvas");
 canvas.className="coi-ambient-layer";canvas.setAttribute("aria-hidden","true");
 host.append(canvas);
 const ctx=canvas.getContext("2d",{alpha:true});
 if(!ctx){canvas.remove();return;}
 const particles=[];
 let width=0,height=0,raf=0,last=0,visible=true;
 const mobile=matchMedia("(max-width: 760px)").matches;
 const count=mobile?22:48;
 const resize=()=>{
  const rect=host.getBoundingClientRect(),dpr=Math.min(1.5,window.devicePixelRatio||1);
  width=Math.max(1,rect.width);height=Math.max(1,rect.height);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(!particles.length)for(let i=0;i<count;i++)particles.push({x:Math.random()*width,y:Math.random()*height,r:.6+Math.random()*1.5,v:.12+Math.random()*.3,a:.18+Math.random()*.35,phase:Math.random()*6.28});
 };
 const draw=(time)=>{
  raf=0;if(!visible||document.hidden)return;
  const dt=Math.min(2,(time-last)/16.67||1);last=time;
  ctx.clearRect(0,0,width,height);
  for(const p of particles){
   p.y-=p.v*dt;p.x+=Math.sin(time*.00035+p.phase)*.16*dt;
   if(p.y< -4){p.y=height+4;p.x=Math.random()*width;}
   ctx.globalAlpha=p.a;ctx.fillStyle=p.phase%2<1?"#f5d995":"#d9ecff";
   ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;raf=requestAnimationFrame(draw);
 };
 const start=()=>{if(!raf&&visible&&!document.hidden){last=0;raf=requestAnimationFrame(draw)}};
 const stop=()=>{if(raf)cancelAnimationFrame(raf);raf=0};
 const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting===true;visible?start():stop()});
 observer.observe(host);resize();start();
 window.addEventListener("resize",resize,{passive:true});
 document.addEventListener("visibilitychange",()=>document.hidden?stop():start());
 window.addEventListener("pagehide",()=>{stop();observer.disconnect();window.removeEventListener("resize",resize);},{once:true});
})();
