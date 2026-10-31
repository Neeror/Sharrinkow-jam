import bpy
from pathlib import Path

root = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root / 'source-models/extracted/3dexport_blender_file_1733305010/blender file.blend'), load_ui=False, use_scripts=False)
for material in bpy.data.materials:
    if not material.use_nodes:
        continue
    print('MATERIAL', material.name)
    for node in material.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image:
            image = node.image
            print(' IMAGE', node.name, image.name, image.size[:], image.has_data, len(image.packed_file.data) if image.packed_file else 0)
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH' and obj.name in ['Body', 'Center_part_curtains']:
        print('OBJECT', obj.name, 'scale', list(obj.scale), 'range', min(v.co.z for v in obj.data.vertices), max(v.co.z for v in obj.data.vertices))
