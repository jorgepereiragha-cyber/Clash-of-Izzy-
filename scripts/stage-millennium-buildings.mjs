// Stage reviewed Millennium models in a beta checkout. No runtime downloads.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const root=path.resolve(process.argv[2]||"art-candidates");
const dest="assets/3d/millennium";
const manifestPath="assets/3d/manifest.json";
const manifest=JSON.parse(await readFile(manifestPath,"utf8"));
const base="https://github.com/0ADMods/millenniumad/blob/91636b405ee8d0088ec3a34fba6074dbd5c9d0f3/";
const source="Millennium A.D. (Carolingian structures)";
const attribution="The Council of Modders, Fallen Empire Studio, Scion Development — https://www.wildfiregames.com/ — CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/";
const license="CC-BY-SA-3.0";
const common={source,license,attribution,licenseFile:"licenses/Millennium-AD.txt",licenseUrl:"https://creativecommons.org/licenses/by-sa/3.0/",adaptedArtLicense:license};
const choices=[
 ["farm","caro_farmstead","1e67f55f3dd1d0c6c7ba62d04d4d2e3a57d2a6420040400cb09163e2d9751d6f",1.55,1.2],
 ["market","caro_market","a63f85f20a9a735ac3c3a27d71b8915a0a938b8f6015e523e627bff280eb6451",1.55,1.65],
 ["warehouse","caro_storehouse","11703efa00b33b4faf04619ff843595ff863fd5e9fa150f016f48340bfbc2a2e",1.55,1.8]
];
const textureChoices=[
 ["caro_struct.png","514267124bf056a32df72cc5cce3086d2ac7675eabb10379caa7fb8f39b654f1"],
 ["caro_struct_norm.png","d9bc3e3a9fc35e3c8165fe36f8dec682980efb418733c30b6b3dd3bd2685a3a7"]
];
const validated=[];
async function prepare(name,expected,sourceUrl,modifications){
 const bytes=await readFile(path.join(root,name));
 const sha256=createHash("sha256").update(bytes).digest("hex");
 if(sha256!==expected)throw Error("Unreviewed file "+name);
 const src="/"+dest+"/"+name;
 validated.push({name,bytes,src,file:{...common,sourceUrl,modifications,sha256,bytes:bytes.length}});
 return src;
}
for(const [name,hash] of textureChoices)await prepare(name,hash,base+"art/textures/skins/structural/"+name,"Unmodified upstream atlas; shared by the converted GLBs.");
for(const [type,name,hash,targetFootprint,targetHeight] of choices){
 const id="millennium-"+type;
 const existing=manifest.models.filter(a=>a.enabled&&a.type===type);
 if(existing.length!==1)throw Error("Expected exactly one active building for "+type);
 const sourceUrl=base+"art/meshes/structural/"+name+".dae";
 const src=await prepare(name+".glb",hash,sourceUrl,"Static COLLADA converted to glTF 2.0; transforms, normals and UV0 converted; shared local texture atlas. Actor attachments and animations not included.");
 for(const a of manifest.models)if(a.type===type)a.enabled=false;
 const previous=manifest.models.find(a=>a.id===id);
 const entry={id,type,src,enabled:true,targetFootprint,targetHeight,source,sourceUrl,license};
 if(previous)Object.assign(previous,entry);else manifest.models.push(entry);
}
await mkdir(dest,{recursive:true});
for(const v of validated){await writeFile(path.join(dest,v.name),v.bytes);manifest.files[v.src]=v.file;}
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+"\n");
console.log("Staged three reviewed building roles with shared textures.");
