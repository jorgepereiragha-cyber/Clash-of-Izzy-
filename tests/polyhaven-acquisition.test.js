import test from "node:test";
import assert from "node:assert/strict";
import {selectMaps,FAMILIES} from "../scripts/fetch-polyhaven.mjs";
test("PBR selection uses ten distinct researched texture families and 1k maps",()=>{
 assert.equal(FAMILIES.length,10);assert.equal(new Set(FAMILIES).size,10);
 const jpg={url:"https://dl.polyhaven.org/file/ph-assets/test.jpg",size:123,md5:"a".repeat(32)};
 const selected=selectMaps({diff:{"1k":{jpg}},nor_gl:{"1k":{jpg}},rough:{"1k":{jpg}},ao:{"1k":{jpg}}});
 assert.deepEqual(selected.map(x=>x.role),["albedo","normal","roughness","ao"]);
 assert.throws(()=>selectMaps({diff:{"1k":{jpg:{...jpg,url:"https://untrusted.example/test.jpg"}}}}));
 assert.throws(()=>selectMaps({diff:{"1k":{jpg:{...jpg,size:9*1024*1024}}}}));
 assert.throws(()=>selectMaps({}));
});
