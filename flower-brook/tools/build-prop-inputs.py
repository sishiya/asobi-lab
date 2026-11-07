# TripoSG に渡す入力画像を Blender で作る（自作なので権利がはっきりする。背景は透明＝背景切りぬきのモデルを使わない）
# blender -b -P tools/build-prop-inputs.py -- <出力フォルダ>
import bpy, bmesh, math, random, sys, os
from mathutils import Vector, noise

OUT = sys.argv[sys.argv.index('--') + 1]
os.makedirs(OUT, exist_ok=True)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 64; sc.cycles.device = 'CPU'
    sc.render.resolution_x = sc.render.resolution_y = 1024
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.6
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.5; o = bpy.data.objects.new('sun', sun); sc.collection.objects.link(o); o.rotation_euler = (0.9, 0.2, 0.8)
    return sc

def clay(col):
    m = bpy.data.materials.new('clay'); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = 0.7
    return m

def camera(sc, loc, look):
    c = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(c); sc.camera = c
    c.location = loc; d = Vector(look) - Vector(loc); c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); c.data.lens = 50

def pebble(sc, at, size, seed, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1, location=at)
    o = bpy.context.object; o.scale = size
    bm = bmesh.new(); bm.from_mesh(o.data)
    off = Vector((seed * 3.1, seed * 1.7, seed * 2.3))
    for v in bm.verts:   # 川の石: 角のとれた形に、ゆるいでこぼこ
        n = noise.noise(v.co * 1.3 + off) * 0.16 + noise.noise(v.co * 4 + off) * 0.03
        v.co *= 1 + n
        if v.co.z < -0.25: v.co.z = -0.25 + (v.co.z + 0.25) * 0.3   # 底はつぶれて地面にすわる
    bm.to_mesh(o.data); bm.free()
    bpy.ops.object.shade_smooth(); o.data.materials.append(mat)

# 1) 岸の石（大きいの1つ＋小さいの3つの寄りあい）
sc = reset(); m = clay((0.55, 0.53, 0.5))
random.seed(3)
pebble(sc, (0, 0, 0), (1.3, 0.95, 0.8), 1, m)
pebble(sc, (1.25, 0.55, -0.12), (0.62, 0.5, 0.48), 2, m)
pebble(sc, (-1.1, 0.7, -0.15), (0.5, 0.42, 0.4), 3, m)
pebble(sc, (0.6, -0.95, -0.18), (0.42, 0.36, 0.34), 4, m)
camera(sc, (3.9, -4.6, 2.3), (0.25, 0, -0.05))
sc.render.filepath = os.path.join(OUT, 'stones.png'); bpy.ops.render.render(write_still=True)

# 2) アーチの根もと（つるの株: 太い幹が地面で根に分かれて広がる）
sc = reset(); m = clay((0.42, 0.36, 0.28))
random.seed(7)
cu = bpy.data.curves.new('root', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1; cu.bevel_resolution = 6; cu.use_fill_caps = True
def strand(pts, r0, r1):
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for i, (p, bp) in enumerate(zip(pts, sp.bezier_points)):
        bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'; bp.radius = r0 + (r1 - r0) * i / (len(pts) - 1)
# 幹: 3本がねじれて上へ（ゲームのつると同じ巻きかた）
for k in range(3):
    pts = []
    for i in range(5):
        z = i * 0.3; a = z * 1.6 + k * 2.094; rr = 0.16
        pts.append((math.cos(a) * rr, math.sin(a) * rr, z))
    strand(pts, 0.17, 0.1)
# 根: 地面をはって広がり、先は細く土にもぐる
for k in range(7):
    a = k / 7 * 6.283 + random.uniform(-0.3, 0.3); L = random.uniform(1.0, 1.7)
    pts = []
    for i in range(6):
        u = i / 5; r = 0.12 + u * L; bend = math.sin(u * 3 + k) * 0.25
        pts.append((math.cos(a + bend * u) * r, math.sin(a + bend * u) * r, 0.35 * (1 - u) ** 2 - 0.12 * u))
    strand(pts, 0.16, 0.025)
o = bpy.data.objects.new('root', cu); sc.collection.objects.link(o); cu.materials.append(m)
camera(sc, (4.6, -5.4, 3.0), (0, 0, 0.4))
sc.render.filepath = os.path.join(OUT, 'roots.png'); bpy.ops.render.render(write_still=True)
print('done', OUT)
