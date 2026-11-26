/* Local presentation-only artwork; catalog IDs and ownership remain server-authoritative. */
(function(){
 "use strict";
 const groups=Object.freeze({
  common:["c1","c2","c3","c4","c5","c6","c7","c8"],
  "rare-epic":["r1","r2","r3","r4","r5","e1","e2","e3","e4"],
  "legendary-fusion":["l1","l2","l3","f_medieval","f_elemental","f_gemmaster","f_ascendant","f_demonlord","f_cosmos"],
  norse:["n1","n2","n3","n4","n5","n6"],
  seasonal:["s1","s2","s3","s4","s5","s6"],
  "pantheon-relics":["eg_ra_crown","eg_anubis_armor","eg_horus_blade","eg_isis_ankh","eg_sekhmet_aura","su_enlil_crown","su_inanna_armor","su_enki_scepter","su_utu_disc","su_ninhursag_aura","me_marduk_crown","me_ishtar_armor","me_gilgamesh_axe","me_tiamat_scale","me_nergal_aura","po_poseidon_crown","po_amphitrite_armor","po_trident","po_tethys_pearl","po_abyss_aura"],
  "castle-previews":["castle-1","castle-2","castle-3","castle-4","castle-5","castle-6"]
 });
 const lookup=new Map(Object.entries(groups).flatMap(([group,ids])=>ids.map(id=>[id,group])));
 const colors=Object.freeze({c1:"#cbd2d8",c2:"#d6ac78",c3:"#a7b8cd",c4:"#e5bf76",c5:"#93dcff",c6:"#8bd39e",c7:"#ff9264",c8:"#64c8e8",r1:"#eccc7f",r2:"#91c9ff",r3:"#78e3b3",r4:"#fa8293",r5:"#c6a2ff",e1:"#d3edff",e2:"#ffae63",e3:"#a4d5ff",e4:"#db95eb",l1:"#efbf79",l2:"#fff1c0",l3:"#c4a0ff",n1:"#bad4ed",n2:"#a0d3ff",n3:"#f1ca86",n4:"#93dca0",n5:"#e6d7a2",n6:"#f4cf81",s1:"#ffad62",s2:"#c1c9d0",s3:"#ed859e",s4:"#a8e1ea",s5:"#cfabeb",s6:"#9eb5e9",f_medieval:"#d2bd92",f_elemental:"#88dbc9",f_gemmaster:"#b7dfef",f_ascendant:"#ffe2a0",f_demonlord:"#f58c81",f_cosmos:"#c5b1ff"});
 function create(id,name){
  if(typeof id!=="string"||!lookup.has(id))return null;
  const group=lookup.get(id),ns="http://www.w3.org/2000/svg";
  const art=document.createElementNS(ns,"svg");art.setAttribute("class","coi-skin-art");art.setAttribute("viewBox",group==="castle-previews"?"0 0 320 200":group==="pantheon-relics"?"0 0 160 160":"0 0 512 512");art.setAttribute("role","img");art.setAttribute("aria-label",(group==="castle-previews"?"Ilustração temática: ":"Emblema: ")+String(name||"Skin"));art.setAttribute("focusable","false");
  if(colors[id])art.style.setProperty("--skin-ink",colors[id]);
  const use=document.createElementNS(ns,"use");use.setAttribute("href","/assets/art/skins/"+group+".svg#"+id);art.append(use);return art;
 }
 function credit(){
  const p=document.createElement("p");p.className="coi-skin-credit";p.append("Ícones de ");
  const a=document.createElement("a");a.href="https://game-icons.net/";a.target="_blank";a.rel="noopener noreferrer";a.textContent="Lorc / Game-icons.net";p.append(a," · ");
  const b=document.createElement("a");b.href="https://creativecommons.org/licenses/by/3.0/";b.target="_blank";b.rel="noopener noreferrer";b.textContent="CC BY 3.0";p.append(b," · adaptados para cor temática e fundo transparente.");return p;
 }
 window.COI_SKIN_ART=Object.freeze({create,credit});
})();
