import bpy
from pathlib import Path

root = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root / 'source-models/bed.glb'))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
total = sum(sum(len(face.vertices) - 2 for face in obj.data.polygons) for obj in meshes)
for obj in meshes:
    bpy.context.view_layer.objects.active = obj
    weld = obj.modifiers.new('MergeSeams', 'WELD')
    weld.merge_threshold = 0.00001
    bpy.ops.object.modifier_apply(modifier=weld.name)
    modifier = obj.modifiers.new('GameReduction', 'DECIMATE')
    modifier.ratio = 125000 / total
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
result = sum(sum(len(face.vertices) - 2 for face in obj.data.polygons) for obj in meshes)
print('BED_TRIANGLES', result)
if not 100000 <= result <= 150000:
    raise ValueError(f'Bed budget not reached: {result}')
output = root / 'source-models/prepared'
output.mkdir(exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output / 'bed.glb'), export_format='GLB', export_animations=False)
