# Isolated Millennium A.D. art conversion. No mod scripts are executed.
import bpy, pathlib, sys
root=pathlib.Path(sys.argv[sys.argv.index("--")+1]).resolve()
for name in ("caro_fortress_struct", "caro_farmstead", "caro_market", "caro_blacksmith", "caro_wall_long", "caro_wall_gate", "caro_defense_tower", "caro_storehouse"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source=root/(name+".dae")
    bpy.ops.wm.collada_import(filepath=str(source))
    meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
    if not meshes: raise RuntimeError("No meshes")
    material=bpy.data.materials.new("Millennium stone atlas")
    material.use_nodes=True
    nodes=material.node_tree.nodes
    shader=nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value=.88
    color=nodes.new("ShaderNodeTexImage")
    color.image=bpy.data.images.load(str(root/"caro_struct.png"))
    material.node_tree.links.new(color.outputs["Color"],shader.inputs["Base Color"])
    normal=nodes.new("ShaderNodeTexImage")
    normal.image=bpy.data.images.load(str(root/"caro_struct_norm.png"))
    # Ubuntu Blender's OCIO config may expose only Linear/sRGB.
    # Normal maps must not receive the sRGB transfer function.
    try:
        normal.image.colorspace_settings.name="Non-Color"
    except (TypeError, ValueError):
        normal.image.colorspace_settings.name="Linear"
    bump=nodes.new("ShaderNodeNormalMap")
    material.node_tree.links.new(normal.outputs["Color"],bump.inputs["Color"])
    material.node_tree.links.new(bump.outputs["Normal"],shader.inputs["Normal"])
    for node in (color,normal):
        image=node.image
        w,h=image.size
        factor=min(1,1024/max(w,h))
        if factor<1:image.scale(max(1,round(w*factor)),max(1,round(h*factor)))
        image.pack()
    bpy.ops.object.select_all(action="DESELECT")
    for mesh in meshes:
        if not mesh.data.uv_layers: raise RuntimeError("Missing UV atlas")
        mesh.data.materials.clear()
        mesh.data.materials.append(material)
        mesh.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    bpy.ops.export_scene.gltf(filepath=str(root/(name+".glb")),export_format="GLB",use_selection=True)
    if (root/(name+".glb")).stat().st_size>8*1024*1024: raise RuntimeError("Candidate exceeds 8 MiB")
