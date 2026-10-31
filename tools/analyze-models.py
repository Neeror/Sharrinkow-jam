import bpy
import json
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
source = root / 'source-models'
files = sorted(source.rglob('*.glb')) + sorted(source.rglob('*.gltf')) + sorted(source.rglob('*.blend'))
report = []
for path in files:
    if not path.is_file():
        continue
    entry = {'file': str(path.relative_to(root)), 'bytes': path.stat().st_size}
    try:
        if path.suffix == '.blend':
            bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False, use_scripts=False)
        else:
            bpy.ops.wm.read_factory_settings(use_empty=True)
            bpy.ops.import_scene.gltf(filepath=str(path))
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
        bpy.context.view_layer.update()
        bounds = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
        entry['dimensions'] = [max(v[i] for v in bounds) - min(v[i] for v in bounds) for i in range(3)] if bounds else []
        entry['triangles'] = sum(sum(len(face.vertices) - 2 for face in obj.data.polygons) for obj in meshes)
        entry['objects'] = [{'name': obj.name, 'vertices': len(obj.data.vertices), 'triangles': sum(len(face.vertices) - 2 for face in obj.data.polygons)} for obj in meshes]
        entry['materials'] = [material.name for material in bpy.data.materials]
        entry['animations'] = [{'name': action.name, 'frames': list(action.frame_range)} for action in bpy.data.actions]
        entry['skeletons'] = [{'name': obj.name, 'bones': len(obj.data.bones), 'names': [bone.name for bone in obj.data.bones]} for obj in bpy.context.scene.objects if obj.type == 'ARMATURE']
        entry['images'] = [{'name': image.name, 'size': list(image.size), 'packed': bool(image.packed_file), 'path': image.filepath, 'exists': Path(bpy.path.abspath(image.filepath)).exists()} for image in bpy.data.images if image.source == 'FILE']
    except Exception as error:
        entry['error'] = str(error)
    report.append(entry)
    (root / 'artifacts' / 'model-analysis.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print('MODEL_REPORT', json.dumps({key: value for key, value in entry.items() if key not in ['objects', 'images', 'skeletons']}, ensure_ascii=True), flush=True)
