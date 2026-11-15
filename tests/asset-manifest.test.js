import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateAssetManifest } from "../scripts/validate-3d-assets.js";
async function fixture(models, glbs = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "coi-assets-"));
  await mkdir(path.join(root, "assets", "3d"), { recursive: true });
  await writeFile(path.join(root, "assets", "3d", "manifest.json"), JSON.stringify({ version: 1, models }));
  for (const [name, bytes] of Object.entries(glbs)) await writeFile(path.join(root, "assets", "3d", name), bytes);
  return root;
}
function validGlb() { const b = Buffer.alloc(20); b.write("glTF",0,"ascii"); b.writeUInt32LE(2,4); b.writeUInt32LE(20,8); b.writeUInt32LE(4,12); b.writeUInt32LE(0x4e4f534a,16); return b; }
test("manifesto 3D atual passa sem exigir modelos ainda não publicados", async () => { const r = await validateAssetManifest(process.cwd()); assert.equal(r.enabled, 0); });
test("aceita GLB 2.0 local, único e habilitado", async () => { const root=await fixture([{type:"castle",enabled:true,src:"/assets/3d/castle.glb"}],{"castle.glb":validGlb()}); try { const r=await validateAssetManifest(root); assert.equal(r.enabled,1); assert.equal(r.bytes,20); } finally { await rm(root,{recursive:true,force:true}); } });
test("rejeita tipos de edifício duplicados", async () => { const root=await fixture([{type:"castle",enabled:false},{type:"castle",enabled:false}]); try { await assert.rejects(validateAssetManifest(root),/tipo duplicado/); } finally { await rm(root,{recursive:true,force:true}); } });
test("rejeita caminhos externos, traversal e extensões diferentes de GLB", async () => { for (const src of ["https://example.com/castle.glb","/assets/3d/../secret.glb","/assets/3d/castle.gltf"]) { const root=await fixture([{type:"castle",enabled:true,src}]); try { await assert.rejects(validateAssetManifest(root),/src/); } finally { await rm(root,{recursive:true,force:true}); } } });
test("rejeita arquivo com cabeçalho GLB inválido", async () => { const root=await fixture([{type:"castle",enabled:true,src:"/assets/3d/castle.glb"}],{"castle.glb":Buffer.alloc(32)}); try { await assert.rejects(validateAssetManifest(root),/assinatura GLB/); } finally { await rm(root,{recursive:true,force:true}); } });
test("rejeita GLB ausente ou maior que o orçamento individual", async () => { const a=await fixture([{type:"castle",enabled:true,src:"/assets/3d/missing.glb"}]); try { await assert.rejects(validateAssetManifest(a),/não encontrado/); } finally { await rm(a,{recursive:true,force:true}); } const b=await fixture([{type:"castle",enabled:true,src:"/assets/3d/large.glb"}],{"large.glb":Buffer.alloc(12*1024*1024+1)}); try { await assert.rejects(validateAssetManifest(b),/excede 12 MiB/); } finally { await rm(b,{recursive:true,force:true}); } });
