#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v toktx >/dev/null || { echo "Instale Khronos KTX-Software (toktx) antes da conversão." >&2; exit 1; }
command -v ktx >/dev/null || { echo "Instale o validador ktx." >&2; exit 1; }
test -f raw_textures/PROVENANCE.json
mkdir -p raw_ktx2
# Verify acquisition hashes before converting. No public output and no runtime changes.
node --input-type=module - <<'JS'
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
const p=JSON.parse(await readFile("raw_textures/PROVENANCE.json","utf8"));
if(p.license!=="CC0-1.0"||p.missing.length||!p.files.length)throw Error("Acquisition incomplete");
for(const item of p.files){
 if(!/^[a-z0-9_]+\.(jpg|png)$/.test(item.file))throw Error("Unsafe path");
 const bytes=await readFile("raw_textures/"+item.file);
 if(createHash("sha256").update(bytes).digest("hex")!==item.sha256)throw Error("Hash mismatch");
}
JS
while IFS= read -r file; do
  name="${file%.*}"
  transfer=linear
  [[ "$name" == *_albedo ]] && transfer=srgb
  test ! -e "raw_ktx2/$name.ktx2"
  toktx --t2 --encode uastc --genmipmap --assign_oetf "$transfer" "raw_ktx2/$name.ktx2" "raw_textures/$file"
  ktx validate "raw_ktx2/$name.ktx2"
done < <(node --input-type=module -e 'import {readFileSync} from "node:fs";for(const x of JSON.parse(readFileSync("raw_textures/PROVENANCE.json")).files)console.log(x.file)')
echo "KTX2 staging prepared; review rendering, hashes and GPU compatibility before import."
