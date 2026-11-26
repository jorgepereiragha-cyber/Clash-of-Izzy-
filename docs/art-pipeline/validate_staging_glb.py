"""Offline GLB staging checks: no dependencies, no runtime activation."""
import argparse
import json
import struct
from pathlib import Path

def inspect(path):
    data=path.read_bytes()
    if len(data)<20 or len(data)>12*1024*1024:
        raise ValueError("invalid GLB size")
    magic,version,length,jlen,jtype=struct.unpack_from("<4sIIII",data)
    if magic!=b"glTF" or version!=2 or length!=len(data) or jtype!=0x4E4F534A or jlen%4 or jlen+20>length:
        raise ValueError("invalid GLB header")
    g=json.loads(data[20:20+jlen])
    if g.get("asset",{}).get("version")!="2.0":
        raise ValueError("invalid glTF version")
    for item in g.get("images",[])+g.get("buffers",[]):
        if "uri" in item:
            raise ValueError("staging requires self-contained GLB (embedded images/buffers)")
    meshes=g.get("meshes",[])
    accessors=g.get("accessors",[])
    triangles=0
    for mesh in meshes:
        for p in mesh["primitives"]:
            if p.get("mode",4)!=4:
                raise ValueError("only triangle primitives accepted")
            position=accessors[p["attributes"]["POSITION"]]
            if position.get("type")!="VEC3" or not isinstance(position.get("count"),int) or position["count"]<3:
                raise ValueError("invalid POSITION accessor")
            for attribute,index in p["attributes"].items():
                if accessors[index].get("count")!=position["count"]:
                    raise ValueError(f"attribute count mismatch: {attribute}")
            a=accessors[p["indices"] if "indices" in p else p["attributes"]["POSITION"]]
            count=a["count"]
            if not isinstance(count,int) or count<3 or count%3:
                raise ValueError("invalid triangle accessor")
            triangles+=count//3
    if not triangles:
        raise ValueError("empty geometry")
    return {"triangles":triangles,"bytes":len(data),"ktx2":"KHR_texture_basisu" in g.get("extensionsUsed",[]),"skinned":bool(g.get("skins")),"animations":len(g.get("animations",[])),"embeddedImages":len(g.get("images",[])),"materialCount":len(g.get("materials",[]))}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("file",type=Path)
    p.add_argument("--max-triangles",required=True,type=int)
    p.add_argument("--require-ktx2",action="store_true")
    args=p.parse_args()
    info=inspect(args.file)
    print(json.dumps(info,indent=2))
    if not 0<info["triangles"]<=args.max_triangles or (args.require_ktx2 and not info["ktx2"]):
        raise SystemExit("Staging budget/texture requirement not met")
if __name__=="__main__":
    main()
