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

def download(row, folder, opener):
    validate_entry(row)
    with opener.open(urllib.request.Request(row["downloadUrl"], headers={"User-Agent":"Eldoria-art-staging/1"}), timeout=20) as response:
        if response.status != 200 or response.geturl() != row["downloadUrl"]:
            raise ValueError("Unexpected HTTP status or URL")
        data=response.read(MAX_BYTES+1)
    if len(data)>MAX_BYTES:
        raise ValueError("Candidate exceeds staging download limit")
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

if __name__=="__main__":
    main()
