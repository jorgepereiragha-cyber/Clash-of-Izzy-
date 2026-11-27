"""Narrow, dependency-free conversion of the eight pinned static COLLADA meshes.
Preserves geometry, normals and UV0, shares the original texture atlas.
Does not import actors, skeletal animations, attachments or mod scripts.
"""
import sys, pathlib, xml.etree.ElementTree as ET, struct, json, math
from hashlib import sha256
ROOT=pathlib.Path(sys.argv[-1]).resolve()
DEDUP="--dedup" in sys.argv[1:-1]
NAMES=("caro_fortress_struct","caro_farmstead","caro_market","caro_blacksmith","caro_wall_long","caro_wall_gate","caro_defense_tower","caro_storehouse")
def check(condition,message):
    if not condition: raise ValueError(message)
def cross(a,b):
    return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def convert(name):
    raw=(ROOT/(name+".dae")).read_bytes()
    check(b"<!DOCTYPE" not in raw.upper() and b"<!ENTITY" not in raw.upper(),"DTD not allowed")
    r=ET.fromstring(raw); ns={"c":r.tag.split("}")[0][1:]}
    def find(node,tag): return node.find(tag,ns)
    check(find(r,"c:asset/c:up_axis").text=="Z_UP","Unsupported axis")
    unit=float(find(r,"c:asset/c:unit").get("meter"))
    geometries=r.findall("c:library_geometries/c:geometry",ns)
    check(len(geometries)==1,"Expected single mesh")
    geometry=geometries[0]; mesh=find(geometry,"c:mesh")
    node=find(r,"c:library_visual_scenes/c:visual_scene/c:node")
    check(find(node,"c:instance_geometry").get("url")=="#"+geometry.get("id"),"Unexpected geometry reference")
    m=list(map(float,find(node,"c:matrix").text.split()))
    check(len(m)==16 and m[12:]==[0.,0.,0.,1.],"Unsupported transform")
    a,b,c=(m[0:3],m[4:7],m[8:11])
    cof=(cross(b,c),cross(c,a),cross(a,b)); det=dot(a,cof[0])
    check(det>1e-12,"Invalid or mirrored transform")
    def pos(v):
        x,y,z=(unit*(dot(row,v)+m[i]) for row,i in zip((a,b,c),(3,7,11)))
        return (x,z,-y)
    def normal(v):
        x,y,z=(dot(row,v)/det for row in cof)
        length=math.sqrt(x*x+y*y+z*z)
        check(length>1e-10,"Zero normal")
        return (x/length,z/length,-y/length)
    sources={}
    for src in mesh.findall("c:source",ns):
        acc=find(src,"c:technique_common/c:accessor")
        values=list(map(float,find(src,"c:float_array").text.split()))
        stride=int(acc.get("stride")); count=int(acc.get("count"))
        check(len(values)==stride*count and int(acc.get("offset","0"))==0,"Unsupported accessor")
        sources["#"+src.get("id")]=[tuple(values[i:i+stride]) for i in range(0,len(values),stride)]
    vertices=find(mesh,"c:vertices")
    sources["#"+vertices.get("id")]=sources[find(vertices,"c:input").get("source")]
    positions=[]; normals=[]; uvs=[]; indices=[]; unique={}
    prims=[p for p in mesh if p.tag.rsplit("}",1)[-1] in ("triangles","polylist")]
    check(len(prims)==1,"Expected one primitive")
    p=prims[0]; inputs=p.findall("c:input",ns); stride=1+max(int(i.get("offset")) for i in inputs)
    selectors=[]
    for semantic in ("VERTEX","NORMAL","TEXCOORD"):
        inp=next(i for i in inputs if i.get("semantic")==semantic and (semantic!="TEXCOORD" or i.get("set","0")=="0"))
        selectors.append((int(inp.get("offset")),sources[inp.get("source")]))
    ix=list(map(int,find(p,"c:p").text.split()))
    check(len(ix)%stride==0 and len(ix)//stride==int(p.get("count"))*3,"Only triangulated meshes supported")
    if p.tag.endswith("polylist"):check(set(map(int,find(p,"c:vcount").text.split()))=={3},"Nontriangular polylist")
    for k in range(0,len(ix),stride):
        source_key=tuple(ix[k+offset] for offset,_ in selectors)
        check(all(0<=index<len(table) for index,(_,table) in zip(source_key,selectors)),"Index out of bounds")
        v,n,uv=(table[index] for index,(_,table) in zip(source_key,selectors))
        p3,n3,t2=pos(v),normal(n),(uv[0],1-uv[1])
        # In candidate mode weld only byte-identical emitted float32 attributes.
        # Keep UV seams, hard normals, vertex order of first occurrence and all triangles.
        key=struct.pack("<8f",*p3,*n3,*t2) if DEDUP else source_key
        if key not in unique:
            positions.extend(p3);normals.extend(n3);uvs.extend(t2);unique[key]=len(unique)
        indices.append(unique[key])
    check(all(math.isfinite(x) for x in positions+normals+uvs),"Nonfinite vertex data")
    check(0<len(unique)<65536,"Vertex limit")
    binary=bytearray();views=[];accessors=[]
    def accessor(values,fmt,ctype,kind,target,minimum=None,maximum=None):
        while len(binary)%4: binary.append(0)
        offset=len(binary); binary.extend(struct.pack("<"+str(len(values))+fmt,*values))
        views.append({"buffer":0,"byteOffset":offset,"byteLength":len(binary)-offset,"target":target})
        a={"bufferView":len(views)-1,"componentType":ctype,"count":len(values)//{"VEC3":3,"VEC2":2,"SCALAR":1}[kind],"type":kind}
        if minimum is not None:a["min"]=minimum;a["max"]=maximum
        accessors.append(a);return len(accessors)-1
    mins=[min(positions[i::3]) for i in range(3)]; maxs=[max(positions[i::3]) for i in range(3)]
    v=accessor(positions,"f",5126,"VEC3",34962,mins,maxs)
    n=accessor(normals,"f",5126,"VEC3",34962);uv=accessor(uvs,"f",5126,"VEC2",34962)
    idx=accessor(indices,"H",5123,"SCALAR",34963)
    while len(binary)%4:binary.append(0)
    g={"asset":{"version":"2.0","generator":"Eldoria pinned static COLLADA converter"},"scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"mesh":0}],"meshes":[{"name":name,"primitives":[{"attributes":{"POSITION":v,"NORMAL":n,"TEXCOORD_0":uv},"indices":idx,"material":0}]}],"materials":[{"name":"Millennium shared atlas","pbrMetallicRoughness":{"baseColorTexture":{"index":0},"metallicFactor":0,"roughnessFactor":0.88},"normalTexture":{"index":1},"alphaMode":"OPAQUE"}],"textures":[{"source":0},{"source":1}],"images":[{"uri":"caro_struct.png"},{"uri":"caro_struct_norm.png"}],"buffers":[{"byteLength":len(binary)}],"bufferViews":views,"accessors":accessors}
    j=json.dumps(g,separators=(",",":")).encode();j+=b" "*(-len(j)%4)
    data=struct.pack("<4sII",b"glTF",2,12+8+len(j)+8+len(binary))+struct.pack("<I4s",len(j),b"JSON")+j+struct.pack("<I4s",len(binary),b"BIN\x00")+binary
    check(len(data)<8*1024*1024,"File limit")
    (ROOT/(name+".glb")).write_bytes(data)
    return {"name":name,"triangles":len(indices)//3,"vertices":len(unique),"bytes":len(data),"sha256":sha256(data).hexdigest(),"bounds":[mins,maxs]}
report=[convert(name) for name in NAMES]
(ROOT/"conversion-report.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report))
