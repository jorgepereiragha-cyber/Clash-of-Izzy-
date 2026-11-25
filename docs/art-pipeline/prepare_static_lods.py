"""Static-only GLB LOD staging. Run inside Blender, not ordinary Python.
Example: blender -b --python docs/art-pipeline/prepare_static_lods.py -- source.glb /tmp/eldoria/farm_L1 --budgets 8000 2500 800
Never writes the runtime manifest, never modifies source, never submits paid jobs.
"""
import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def triangles(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def prepare(source, budget, output):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    objects = list(bpy.context.scene.objects)
    meshes = [obj for obj in objects if obj.type == "MESH"]
    if not meshes or any(obj.type == "ARMATURE" or obj.animation_data for obj in objects):
        raise ValueError("Only static, unanimated meshes are supported.")
    if any(obj.data.shape_keys or obj.modifiers for obj in meshes):
        raise ValueError("Resolve shape keys and modifiers in source before static reduction.")
    bpy.context.view_layer.update()
    # Bake transforms with independent mesh data before removing parent hierarchy.
    for obj in meshes:
        world = obj.matrix_world.copy()
        obj.data = obj.data.copy()
        obj.parent = None
        obj.matrix_world.identity()
        obj.data.transform(world)
        obj.data.update()
    for obj in objects:
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    points = [v.co for obj in meshes for v in obj.data.vertices]
    if not points or not all(math.isfinite(c) for p in points for c in p):
        raise ValueError("Empty/non-finite geometry.")
    # Blender Z-up; glTF exporter converts to Y-up.
    mins = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    maxs = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    offset = Vector(((mins.x + maxs.x) / 2, (mins.y + maxs.y) / 2, mins.z))
    for obj in meshes:
        for v in obj.data.vertices:
            v.co -= offset
        obj.data.update()
    total = sum(triangles(obj) for obj in meshes)
    if total > budget:
        ratio = budget / total
        for obj in meshes:
            bpy.context.view_layer.objects.active = obj
            mod = obj.modifiers.new("Eldoria_LOD", "DECIMATE")
            mod.ratio = ratio
            bpy.ops.object.modifier_apply(modifier=mod.name)
    actual = sum(triangles(obj) for obj in meshes)
    if actual <= 0 or actual > budget:
        raise ValueError(f"Triangle budget not satisfied: {actual}/{budget}; manual retopology required.")
    bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", export_yup=True, export_animations=False)
    if not output.is_file() or output.stat().st_size < 20:
        raise ValueError("Export failed.")
    print(f"{output}: {actual} triangles")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output_prefix", type=Path)
    parser.add_argument("--budgets", type=int, nargs=3, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:])
    source = args.source.resolve(strict=True)
    if source.suffix.lower() != ".glb" or not (args.budgets[0] >= args.budgets[1] >= args.budgets[2] > 0):
        raise ValueError("Use a GLB and three positive descending budgets.")
    targets = [Path(f"{args.output_prefix}_LOD{i}.glb").resolve() for i in range(3)]
    if any(p == source or p.exists() for p in targets):
        raise FileExistsError("Refusing to overwrite an existing GLB.")
    for output, budget in zip(targets, args.budgets):
        output.parent.mkdir(parents=True, exist_ok=True)
        prepare(source, budget, output)


if __name__ == "__main__":
    main()
