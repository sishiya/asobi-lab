# 多面体の旅人・大まかな形（ブロックアウト）3案。flat-history/ART.md の3章に合わせる（RULES 10章の②）
# 使い方: "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup -P tools/blender/traveler_blockout.py -- _dev/blender
#   → <出力先>/traveler-a.glb・traveler-b.glb・traveler-c.glb
# 大まかな形の段階なので、細工はつけない。見るのはシルエット・大中小・明暗の3段・進む向き（+X が前）。
# 部品はどれも凸（2D世界の断面がメッシュごとの凸包のため）。材質は金属にしない（ゲームには映りこみの光がない）。
# 単位はゲームの makePoly と同じ（ゲームで 1.25 倍）。足もとの輪 z=0.12、胴 z≈0.95、頭 z≈1.75。
# 名前の頭: spin＝縦の軸で回る、bob＝上下にゆれる（hero-lineup.mjs の最小の動き）
import bpy, bmesh, sys, os, math
from mathutils import Vector, Matrix

outdir = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '.'

def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    global TEAL, GOLD, LIGHT, RING
    TEAL = mat('teal', '#167f76', 0.45)                         # 胴: 中くらいの暗さ
    GOLD = mat('gold', '#e9bb4c', 0.5, '#7a5210', 0.4)          # 頭・留め金: 明るい
    LIGHT = mat('light', '#fff6d6', 0.4, '#ffd76a', 2.5)        # 目: いちばん明るい1点
    RING = mat('ring', '#d9b25a', 0.6, '#d9b25a', 0.15)               # 輪は脇役（明るすぎると目立つものが2つになる）
    global GLOWTEAL
    GLOWTEAL = mat('glowteal', '#5ee0cf', 0.4, '#2fbfae', 1.2)  # うしろからも見える光（カメラはたいてい主人公のうしろ）

def mat(name, color, rough, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = 0.0
    if emit:
        b.inputs['Emission Color'].default_value = (*lin(emit), 1)
        b.inputs['Emission Strength'].default_value = strength
    return m

def link(o, parent):
    bpy.context.scene.collection.objects.link(o)
    o.parent = parent
    return o

def empty(name, parent=None, loc=(0, 0, 0)):
    o = link(bpy.data.objects.new(name, None), parent); o.location = loc; return o

def hull(name, pts, m, parent=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    # 点の凸包で部品を作る（どの部品も凸になる）。面は平ら（flatShading）
    bm = bmesh.new()
    for p in pts:
        bm.verts.new(p)
    bmesh.ops.convex_hull(bm, input=list(bm.verts))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(m)
    o = link(bpy.data.objects.new(name, me), parent); o.location = loc; o.rotation_euler = rot
    return o

def ico_pts(r, sz=1.0):
    p = (1 + 5 ** 0.5) / 2
    vs = [(-1, p, 0), (1, p, 0), (-1, -p, 0), (1, -p, 0), (0, -1, p), (0, 1, p), (0, -1, -p), (0, 1, -p), (p, 0, -1), (p, 0, 1), (-p, 0, -1), (-p, 0, 1)]
    k = r / math.sqrt(1 + p * p)
    return [(x * k, y * k, z * k * sz) for x, y, z in vs]

def oct_pts(r, sz=1.0, sx=1.0):
    return [(r * sx, 0, 0), (-r * sx, 0, 0), (0, r, 0), (0, -r, 0), (0, 0, r * sz), (0, 0, -r * sz)]

def tet_pts(r):
    t = r / math.sqrt(3)
    return [(t, t, t), (-t, -t, t), (-t, t, -t), (t, -t, -t)]

def ring(parent, r=0.42, tube=0.028, n=10):
    # 足もとの輪。凸でないので、短い板を n 枚ならべる（それぞれ凸）。ゲームの輪（0.025）より太く、原寸で 3px 以上に
    g = empty('ring', parent, (0, 0, 0.12))
    for i in range(n):
        a0, a1 = i / n * math.tau, (i + 1) / n * math.tau
        pts = []
        for a in (a0, a1):
            for rr in (r - tube, r + tube):
                for z in (-tube / 2, tube / 2):
                    pts.append((math.cos(a) * rr, math.sin(a) * rr, z))
        hull(f'ring{i}', pts, RING, g)
    return g

def beam(name, a, b, t, m, parent):
    a, b = Vector(a), Vector(b)
    d = b - a; q = d.to_track_quat('Z', 'Y')
    pts = []
    for z in (0, d.length):
        for x in (-t / 2, t / 2):
            for y in (-t / 2, t / 2):
                pts.append(a + q @ Vector((x, y, z)))
    return hull(name, pts, m, parent)

def export(name):
    path = os.path.join(outdir, f'traveler-{name}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True)
    tris = sum(len(o.data.polygons) * 2 for o in bpy.context.scene.objects if o.type == 'MESH')
    print(f'exported {path}  parts={sum(o.type == "MESH" for o in bpy.context.scene.objects)}  ~tris<={tris}')

# ---------------- 案A 宝石の旅人・改: いまの部品のまま、比率・明暗・向きを直す ----------------
reset()
root = empty('traveler')
torso = empty('torso', root, (0, 0, 0.98))
hull('spinTorso', ico_pts(0.46, 1.3), TEAL, torso)                       # 縦にのばし、下をとがらせて浮かぶ感じ
hull('crownGem', oct_pts(0.07, 1.4), GLOWTEAL, torso, (0, 0, 0.56))   # 冠の上の光る石（うしろから見える目立つ1点）
hull('collar', [(math.cos(a) * r, math.sin(a) * r, z) for a in [i / 5 * math.tau for i in range(5)] for r, z in ((0.34, 0.36), (0.22, 0.5))], GOLD, torso)  # 胴の上の金の冠（頭とのあいだの明るい段）
head = empty('bobHead', root, (0, 0, 1.78))
hull('head', oct_pts(0.25, 1.1), GOLD, head)
hull('eye', oct_pts(0.075), LIGHT, head, (0.25, 0, 0.02))                # 前を向く目（原寸で約7px）
for i, y in enumerate((-0.5, 0.5)):
    hull(f'bobHand{i}', tet_pts(0.2), GOLD, root, (0.25, y * 0.95, 0.95), (0.6, 0.9, 0.3))   # 手は大きく、前へ
for i, (x, z, s) in enumerate(((-0.6, 1.4, 0.12), (-0.84, 1.36, 0.09), (-1.05, 1.3, 0.065))):
    hull(f'bobTail{i}', oct_pts(s, 1.0, 1.6), TEAL, root, (x, 0, z))     # うしろに流れる3つのかけら（進む向き）
ring(root)
export('a')

# ---------------- 案B 天球儀の旅人: レオナルドの骨組み＋ケプラーの入れ子 ----------------
reset()
root = empty('traveler')
torso = empty('torso', root, (0, 0, 0.98))
frame = empty('spinFrame', torso)
vs = ico_pts(0.56)
edges = set()
for i in range(12):
    d = sorted(range(12), key=lambda j: (Vector(vs[i]) - Vector(vs[j])).length)[1:6]
    for j in d:
        edges.add(tuple(sorted((i, j))))
for k, (i, j) in enumerate(sorted(edges)):
    beam(f'beam{k}', vs[i], vs[j], 0.075, GOLD, frame)                   # 辺は太い角材（原寸で約6px）
p = (1 + 5 ** 0.5) / 2
dod = [(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)] + [(0, s / p, t * p) for s in (-1, 1) for t in (-1, 1)] + [(s / p, t * p, 0) for s in (-1, 1) for t in (-1, 1)] + [(t * p, 0, s / p) for s in (-1, 1) for t in (-1, 1)]
hull('spinInner', [(x * 0.24, y * 0.24, z * 0.24) for x, y, z in dod], GLOWTEAL, torso)   # 中の十二面体（入れ子）
head = empty('bobHead', root, (0, 0, 1.8))
hull('head', ico_pts(0.17), GOLD, head)
halo = empty('spinHalo', head); halo.rotation_euler = (math.radians(70), math.radians(20), 0)
for i in range(10):
    a0, a1 = i / 10 * math.tau, (i + 1) / 10 * math.tau
    hull(f'halo{i}', [(math.cos(a) * rr, math.sin(a) * rr, z) for a in (a0, a1) for rr in (0.26, 0.31) for z in (-0.02, 0.02)], GOLD, halo)
hull('eye', oct_pts(0.07), LIGHT, head, (0.18, 0, 0.0))
for i, y in enumerate((-0.72, 0.72)):
    hull(f'bobHand{i}', oct_pts(0.11), TEAL, root, (0.2, y, 1.05))       # まわる小さな星（手）
ring(root)
export('b')

# ---------------- 案C 結晶の旅人: 前のめりの結晶のマント（巡礼の人のシルエット） ----------------
reset()
root = empty('traveler')
lean = empty('torso', root, (0, 0, 0.95)); lean.rotation_euler = (0, math.radians(14), 0)   # 前（+X）へかたむく
hexr = 0.34
hx = [(math.cos(i / 6 * math.tau + math.pi / 6) * hexr, math.sin(i / 6 * math.tau + math.pi / 6) * hexr) for i in range(6)]
hull('body', [(x, y, z) for x, y in hx for z in (-0.15, 0.4)] + [(0, 0, 0.62), (0, 0, -0.8)], TEAL, lean)   # 六角柱の結晶。上は短く、下は長くとがる
for i, y in enumerate((-1, 1)):
    hull(f'mantle{i}', [(0.08, y * 0.2, 0.5), (-0.1, y * 0.2, 0.42), (0.02, y * 0.48, 0.3), (-0.25, y * 0.5, 0.62), (-0.05, y * 0.32, 0.18)], GOLD, lean)  # 肩の金のかけら（上に開く）
head = empty('bobHead', root, (0.2, 0, 1.72))
hull('head', oct_pts(0.2, 1.25, 1.15), GOLD, head)
hull('clasp', oct_pts(0.075, 1.3), GLOWTEAL, root, (-0.12, 0, 1.45))   # マントの留め金の光る石（うしろから見える）
hull('eye', oct_pts(0.07), LIGHT, head, (0.23, 0, 0.03))
for i, y in enumerate((-0.36, 0.36)):
    hull(f'bobHand{i}', oct_pts(0.1, 1.6), GOLD, root, (0.5, y, 1.0), (0, math.radians(-30), 0))
for i, (x, z, s) in enumerate(((-0.5, 1.05, 0.11), (-0.74, 0.95, 0.085), (-0.94, 0.86, 0.06))):
    hull(f'bobTail{i}', oct_pts(s, 1.0, 1.7), TEAL, root, (x, 0, z), (0, math.radians(-20), 0))   # マントのすそが流れる
ring(root)
export('c')
