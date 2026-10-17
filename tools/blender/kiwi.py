# Blender のためし: 標本台に乗ったキーウィを作って glb に書き出す（RULES 9章）。
# 使い方: "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup -P tools/blender/kiwi.py -- _dev/blender/kiwi.glb
# Blender は Z が上。glTF に書き出すと Three.js の Y が上に直る（export_yup）。
import bpy, sys, math
from mathutils import Vector

out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'kiwi.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, color, rough=0.6, metal=0.0):
    m = bpy.data.materials.new(name)
    bsdf = m.node_tree.nodes['Principled BSDF'] if m.node_tree else None
    if bsdf is None:
        m.use_nodes = True
        bsdf = m.node_tree.nodes['Principled BSDF']
    # color は画面で見る色（sRGB 0〜1）。Blender の数はリニアなので変換する（しないと白っぽく出る）
    bsdf.inputs['Base Color'].default_value = (*[c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in color], 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    return m

FEATHER = mat('feather', (0.32, 0.22, 0.13), 0.9)
BEAK = mat('beak', (0.78, 0.68, 0.50), 0.5)
EYE = mat('eye', (0.02, 0.02, 0.02), 0.2)
LEG = mat('leg', (0.55, 0.47, 0.36), 0.6)
WOOD = mat('wood', (0.20, 0.11, 0.06), 0.45)
BRASS = mat('brass', (0.80, 0.62, 0.30), 0.3, 1.0)

def finish(o, m, name, smooth=True, subsurf=0, bevel=0.0):
    o.name = name
    o.data.materials.append(m)
    if smooth:
        bpy.ops.object.shade_smooth()
    if subsurf:
        o.modifiers.new('subsurf', 'SUBSURF').levels = subsurf
    if bevel:
        b = o.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = 3
    return o

# 標本台（上の面が z=0.12）と真鍮の札
bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0)); o = bpy.context.object
o.scale = (0.75, 0.42, 0.12); bpy.ops.object.transform_apply(scale=True)
finish(o, WOOD, 'plinth', smooth=False, bevel=0.03)
bpy.ops.mesh.primitive_cube_add(location=(0, -0.425, 0)); o = bpy.context.object
o.scale = (0.22, 0.01, 0.05); bpy.ops.object.transform_apply(scale=True)
finish(o, BRASS, 'plate', smooth=False, bevel=0.006)

# 体（たまご形）と頭
bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1, location=(-0.05, 0, 0.62)); o = bpy.context.object
o.scale = (0.48, 0.36, 0.38); o.rotation_euler = (0, math.radians(-12), 0)
finish(o, FEATHER, 'body', subsurf=1)
bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=0.16, location=(0.38, 0, 0.82)); o = bpy.context.object
finish(o, FEATHER, 'head', subsurf=1)

# 長いくちばし（円すいの先を前・下へ）
tip = Vector((0.98, 0, 0.42)); base = Vector((0.50, 0, 0.78))
bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.04, radius2=0.008, depth=(tip - base).length, location=(base + tip) / 2); o = bpy.context.object
o.rotation_euler = (tip - base).to_track_quat('Z', 'Y').to_euler()
finish(o, BEAK, 'beak')

# 目
for y in (-0.11, 0.11):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=0.022, location=(0.48, y, 0.87))
    finish(bpy.context.object, EYE, 'eye')

# 脚と3本の指
for y in (-0.12, 0.12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.03, depth=0.2, location=(0.02, y, 0.22))
    finish(bpy.context.object, LEG, 'leg')
    for a in (-30, 0, 30):
        r = math.radians(a)
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.014, depth=0.14,
            location=(0.02 + 0.07 * math.cos(r), y + 0.07 * math.sin(r), 0.135),
            rotation=(0, math.radians(90), r))
        finish(bpy.context.object, LEG, 'toe')

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True)
tris = 0
dg = bpy.context.evaluated_depsgraph_get()
for ob in bpy.context.scene.objects:
    me = ob.evaluated_get(dg).to_mesh(); me.calc_loop_triangles(); tris += len(me.loop_triangles); ob.evaluated_get(dg).to_mesh_clear()
print(f'exported {out}  objects={len(bpy.context.scene.objects)}  triangles={tris}')
