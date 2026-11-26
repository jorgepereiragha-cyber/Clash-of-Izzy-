"""Download a reviewed, fixed list of free GLB candidates to a new staging folder.
No secrets, no remote code execution, no runtime manifest changes.
"""
import argparse
import hashlib
import json
import re
import tempfile
import urllib.request
from pathlib import Path
from validate_staging_glb import inspect

CATALOG = Path(__file__).with_name("online_candidates.json")
MAX_BYTES = 2 * 1024 * 1024
MAX_TOTAL = 12 * 1024 * 1024
TEXTURE_MAX_TOTAL = 16 * 1024 * 1024
TEXTURE_CANDIDATES = {"stone":"castle_wall_slates", "wood":"medieval_wood", "roof":"roof_slates_02", "road":"cobblestone_floor_001"}
TEXTURE_MAPS = {"albedo":"diff", "normal":"nor_gl", "roughness":"rough"}

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError("Redirects not allowed for pinned candidates")

def validate_entry(row):
    if not re.fullmatch(r"[a-z][a-z0-9_]{1,40}", row["id"]):
        raise ValueError("Invalid candidate ID")
    if not re.fullmatch(r"https://cdn\.3dassets\.dev/assets/[0-9]+/v1/model\.glb", row["downloadUrl"]):
        raise ValueError("Unapproved download URL")
    if not re.fullmatch(r"https://3dassets\.dev/assets/[a-z0-9-]+", row["sourceUrl"]):
        raise ValueError("Invalid provenance URL")
    if row["license"] != "CC0-1.0" or row["status"] != "candidate-not-approved":
        raise ValueError("Missing or unapproved license/state")
    if not isinstance(row["maxTriangles"], int) or not 0 < row["maxTriangles"] <= 45000:
        raise ValueError("Invalid triangle limit")

def bounded_download(url, opener):
    with opener.open(urllib.request.Request(url, headers={"User-Agent":"Eldoria-art-staging/1"}), timeout=20) as response:
        if response.status != 200 or response.geturl() != url:
            raise ValueError("Unexpected HTTP status or URL")
        data=response.read(MAX_BYTES+1)
    if not data or len(data)>MAX_BYTES:
        raise ValueError("Candidate empty or exceeds staging download limit")
    return data

def download(row, folder, opener):
    validate_entry(row)
    data=bounded_download(row["downloadUrl"], opener)
    path=folder / (row["id"]+".glb")
    with tempfile.NamedTemporaryFile(dir=folder, suffix=".glb") as temp:
        temp.write(data)
        temp.flush()
        info=inspect(Path(temp.name))
    if info["triangles"]>row["maxTriangles"] or info["skinned"]:
        raise ValueError("Candidate exceeds budget or is unexpectedly skinned")
    with path.open("xb") as f:
        f.write(data)
    return {**row, **info, "sha256":hashlib.sha256(data).hexdigest(), "file":path.name}

def jpeg_dimensions(data):
    # Read only JPEG frame metadata; do not decode untrusted pixels in CI.
    if not data.startswith(b"\xff\xd8") or not data.endswith(b"\xff\xd9"):
        raise ValueError("Invalid JPEG signature")
    i=2
    sof={0xc0,0xc1,0xc2}
    while i+4<=len(data):
        if data[i]!=0xff:
            raise ValueError("Invalid JPEG marker")
        while i<len(data) and data[i]==0xff:
            i+=1
        if i>=len(data):
            break
        marker=data[i]
        i+=1
        if marker in {0xda,0xd9} or i+2>len(data):
            break
        size=int.from_bytes(data[i:i+2],"big")
        if size<2 or i+size>len(data):
            raise ValueError("Invalid JPEG segment")
        if marker in sof:
            if size<8 or data[i+2]!=8:
                raise ValueError("Unsupported JPEG frame")
            height=int.from_bytes(data[i+3:i+5],"big")
            width=int.from_bytes(data[i+5:i+7],"big")
            if min(width,height)<128 or max(width,height)>1024:
                raise ValueError("Texture exceeds 1K budget or is too small")
            return width,height
        i+=size
    raise ValueError("JPEG frame missing")

def stage_textures(output, opener):
    folder=output/"textures"
    folder.mkdir(exist_ok=False)
    report=[]
    total=0
    for family,slug in TEXTURE_CANDIDATES.items():
        sizes=set()
        for role,suffix in TEXTURE_MAPS.items():
            url=f"https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{slug}/{slug}_{suffix}_1k.jpg"
            data=bounded_download(url,opener)
            width,height=jpeg_dimensions(data)
            sizes.add((width,height))
            total+=len(data)
            if total>TEXTURE_MAX_TOTAL:
                raise ValueError("Texture staging budget exceeded")
            name=f"{family}_{role}.jpg"
            with (folder/name).open("xb") as f:
                f.write(data)
            report.append({"family":family,"role":role,"file":name,"width":width,"height":height,
                "bytes":len(data),"sha256":hashlib.sha256(data).hexdigest(),
                "sourceUrl":f"https://polyhaven.com/a/{slug}","downloadUrl":url,
                "license":"CC0-1.0","licenseUrl":"https://polyhaven.com/license",
                "colorSpace":"sRGB" if role=="albedo" else "linear",
                "status":"candidate-not-approved"})
        if len(sizes)!=1:
            raise ValueError(f"Map dimensions differ for {family}")
    (folder/"provenance.json").write_text(json.dumps({"status":"staging only; requires visual review and optimization","assets":report},indent=2)+"\n",encoding="utf-8")
    print(f"{len(report)} PBR texture maps checked; {total} bytes. Visual acceptance pending.")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("output",type=Path)
    args=p.parse_args()
    rows=json.loads(CATALOG.read_text(encoding="utf-8"))["sources"]
    if not rows or len(rows)>20 or len({r["id"] for r in rows})!=len(rows):
        raise ValueError("Empty/oversized/duplicate queue")
    for row in rows:
        validate_entry(row)
    output=args.output.resolve()
    output.mkdir(parents=True,exist_ok=False)
    opener=urllib.request.build_opener(NoRedirect)
    report=[]
    total=0
    for row in rows:
        info=download(row,output,opener)
        total+=info["bytes"]
        if total>MAX_TOTAL:
            raise ValueError("Total staging budget exceeded")
        report.append(info)
    (output/"provenance.json").write_text(json.dumps({"status":"requires visual review; not approved for deployment","assets":report},indent=2)+"\n",encoding="utf-8")
    print(f"{len(report)} candidates checked; {total} bytes. Visual acceptance pending.")
    stage_textures(output, opener)

if __name__=="__main__":
    main()
