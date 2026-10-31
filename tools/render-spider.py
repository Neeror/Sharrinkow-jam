import bpy
from mathutils import Vector
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root / 'source-models/black_widow_spider.glb'))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.render.resolution_x = 640
scene.render.resolution_y = 480
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('InspectionWorld')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.18, 0.18, 0.18, 1)
meshes = [obj for obj in scene.objects if obj.type == 'MESH' and any(modifier.type == 'ARMATURE' for modifier in obj.modifiers)]
print('RENDER_MESHES', [(obj.name, obj.data.name) for obj in meshes])
scene.frame_set(0)
graph = bpy.context.evaluated_depsgraph_get()
points = []
for obj in meshes:
    evaluated = obj.evaluated_get(graph)
    mesh = evaluated.to_mesh()
    points.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
    evaluated.to_mesh_clear()
minimum = Vector([min(p[i] for p in points) for i in range(3)])
maximum = Vector([max(p[i] for p in points) for i in range(3)])
center = (minimum + maximum) / 2
extent = max(maximum - minimum)
print('EVALUATED_BOUNDS', list(minimum), list(maximum), 'size', list(maximum - minimum))
bpy.ops.object.camera_add(location=center + Vector((extent, -extent, extent * 0.8)))
camera = bpy.context.object
camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = extent * 1.4
camera.data.clip_start = extent * 0.001
scene.camera = camera
bpy.ops.object.light_add(type='AREA', location=center + Vector((extent, -extent, extent * 2)))
bpy.context.object.data.energy = extent * extent * 800
bpy.context.object.data.shape = 'DISK'
bpy.context.object.data.size = extent * 2
bpy.context.object.rotation_euler = (center - bpy.context.object.location).to_track_quat('-Z', 'Y').to_euler()
for frame in [0, 30, 60, 90]:
    scene.frame_set(frame)
    scene.render.filepath = str(root / f'artifacts/spider-frame-{frame}.png')
    bpy.ops.render.render(write_still=True)
(root / 'artifacts/spider-bounds.json').write_text(json.dumps({'min': list(minimum), 'max': list(maximum), 'size': list(maximum - minimum)}), encoding='utf-8')
