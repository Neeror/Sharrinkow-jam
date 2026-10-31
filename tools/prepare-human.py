import bpy
import math
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root / 'source-models/extracted/3dexport_blender_file_1733305010/blender file.blend'), load_ui=False, use_scripts=False)
keep = {'Body', 'Boxers', 'Center_part_curtains', 'Eye'}
for material in bpy.data.materials:
    if not material.use_nodes:
        continue
    images = {}
    for node in material.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image:
            for role in ['DIFFUSE', 'NORMAL', 'ALPHA', 'ROUGHNESS']:
                if f'({role})' in node.name:
                    images[role] = node.image
    material.node_tree.nodes.clear()
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Roughness'].default_value = 0.48
    output_node = nodes.new('ShaderNodeOutputMaterial')
    links.new(shader.outputs['BSDF'], output_node.inputs['Surface'])
    for role, image in images.items():
        texture = nodes.new('ShaderNodeTexImage')
        texture.image = image
        if role == 'DIFFUSE':
            links.new(texture.outputs['Color'], shader.inputs['Base Color'])
        elif role == 'NORMAL':
            normal = nodes.new('ShaderNodeNormalMap')
            links.new(texture.outputs['Color'], normal.inputs['Color'])
            links.new(normal.outputs['Normal'], shader.inputs['Normal'])
        elif role == 'ROUGHNESS':
            links.new(texture.outputs['Color'], shader.inputs['Roughness'])
        elif role == 'ALPHA':
            links.new(texture.outputs['Color'], shader.inputs['Alpha'])
            material.surface_render_method = 'DITHERED'
for material in bpy.data.materials:
    if 'boxer' not in material.name.lower():
        continue
    shader = next(node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    for socket in ['Base Color', 'Alpha']:
        for link in list(shader.inputs[socket].links):
            material.node_tree.links.remove(link)
    shader.inputs['Base Color'].default_value = (0.012, 0.015, 0.02, 1)
    shader.inputs['Alpha'].default_value = 1
    shader.inputs['Roughness'].default_value = 0.94
rig = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
rig.animation_data_clear()
for bone in rig.pose.bones:
    for constraint in list(bone.constraints):
        bone.constraints.remove(constraint)
for side, angle in [('L', -1.1), ('R', 0.85)]:
    parent = rig.pose.bones.get(f'upper_arm_parent.{side}')
    if parent and 'IK_FK' in parent:
        parent['IK_FK'] = 1.0
    bone = rig.pose.bones.get(f'DEF-upper_arm.{side}')
    if bone:
        bone.rotation_mode = 'XYZ'
        bone.rotation_euler.z = angle
for obj in list(bpy.data.objects):
    if obj != rig and obj.name not in keep:
        bpy.data.objects.remove(obj, do_unlink=True)
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    obj.shape_key_clear()
    obj.hide_set(False)
    obj.hide_viewport = False
    obj.hide_render = False
    bpy.context.view_layer.objects.active = obj
    for modifier in list(obj.modifiers):
        if modifier.type != 'ARMATURE':
            obj.modifiers.remove(modifier)
neck = rig.pose.bones.get('DEF-spine.005')
if neck:
    neck.rotation_mode = 'XYZ'
    neck.rotation_euler.x = -0.22
    neck.rotation_euler.y = 0.15
rig.rotation_mode = 'XYZ'
rig.rotation_euler.x = -math.pi / 2
bpy.context.view_layer.update()
bpy.context.scene.frame_set(1)
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    bpy.context.view_layer.objects.active = obj
    for modifier in list(obj.modifiers):
        if modifier.type == 'ARMATURE':
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier = obj.modifiers.new('GameSkin', 'ARMATURE')
    modifier.object = rig
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')
output = root / 'source-models/prepared'
output.mkdir(exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output / 'human.glb'), export_format='GLB', export_animations=False, export_def_bones=True, export_skins=True, export_morph=False)
print('HUMAN_EXPORTED', output / 'human.glb')
