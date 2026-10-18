# 多面体の旅人・B 天球儀（作りこみ）。flat-history/ART.md に合わせる（RULES 10章の③）
# 使い方: "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup -P tools/blender/traveler_b.py -- flat-history/models/armillary.glb
#
# 形の考え（参考は ART.md 4章）:
# - 胴: レオナルドの骨組みの二十面体（辺は六角の角材、頂点に金の留め玉）。頂点を真上・真下に向け、下はとがって浮かぶ。
#   中に、ケプラーの入れ子のように光る十二面体。骨組みとのあいだにすき間をあけて、入れ子が読めるように
# - 進む向き（+X が前。カメラはたいていうしろ）: 胴を前へ傾け、頭を前に出し、うしろへ光のつぶが流れる（彗星の尾）
# - 黄道の環: 胴をまわる主役の環（太め）。うしろが上がるように傾ける。その上を、手のかわりの暗い星がふたつまわる
# - 頭: 明るい金の小さな二十面体に、傾いた光輪の環
# - 明暗: 光る十二面体（いちばん明るい）＞頭と留め玉の明るい金＞骨組みの真鍮（紙より暗い）＞星の暗い青緑（影絵）
# - 部品はどれも凸（断面はメッシュごとの凸包）。環は短い板を並べる。材質は金属にしない（ゲームには映りこみの光がない）
# - 断面: 二十面体の殻（ほぼ透明・userData.slice）を足し、2D に「二十面体の多角形の中に十二面体の多角形」が出るように
# 名前の頭: spin＝縦の軸で回る、bob＝上下にゆれる（hero-lineup.mjs）。extras の noInk＝インクのふちをつけない
# 直した記録: AD1（アートディレクター役の1回目、5/10）→ 向き・芯の大きさ・環の主役・星の位置と色・断面の殻
#             AD2（6/10）→ 環を大きく開く・尾を上と横へ・星を左右に・ひとまわり小さく
#             AD3（7/10。形の段階はここまで）→ 尾を外す・全体を 0.85 倍・芯の発光 1.4
import bpy, bmesh, sys, math
from mathutils import Vector

out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'armillary.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)

def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]

def mat(name, color, rough, emit=None, strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = 0.0
    if emit:
        b.inputs['Emission Color'].default_value = (*lin(emit), 1)
        b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    return m

BRASS = mat('brass', '#a87425', 0.5, '#3a2408', 0.3)      # 骨組み・環: 紙より暗い真鍮
GOLD = mat('gold', '#f0c55a', 0.45, '#6a4a10', 0.35)      # 頭・留め玉: 明るい金
GLOW = mat('glow', '#9ff0dc', 0.4, '#33c9b6', 1.4)        # 中の十二面体: いちばん明るい（AD1: 1.3 は大きすぎる芯で塊に見えた。AD3: 芯を 0.17 にしたあとは 1.4 で、白黒で頭より明るく）
MOTE = mat('mote', '#5fd6c6', 0.4, '#2a9e90', 0.6)        # うしろへ流れる光のつぶ
TEAL = mat('teal', '#1f5f58', 0.45)                       # 星（手）: 暗い青緑。光の前で影絵として読ませる（AD1）
EYE = mat('eye', '#fff6d6', 0.4, '#ffd76a', 2.5)
SHELL = mat('shell', '#f3e6c8', 0.5, alpha=0.06)          # 断面だけに出す殻（3D ではほとんど見えない）

def link(o, parent):
    bpy.context.scene.collection.objects.link(o); o.parent = parent; return o

def empty(name, parent=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    o = link(bpy.data.objects.new(name, None), parent); o.location = loc; o.rotation_euler = rot; return o

def hull(name, pts, m, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), **extras):
    bm = bmesh.new()
    for p in pts:
        bm.verts.new(p)
    bmesh.ops.convex_hull(bm, input=list(bm.verts))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(m)
    o = link(bpy.data.objects.new(name, me), parent); o.location = loc; o.rotation_euler = rot
    for k, v in extras.items():
        o[k] = v
    return o

def ico_pts(r):
    p = (1 + 5 ** 0.5) / 2
    vs = [(-1, p, 0), (1, p, 0), (-1, -p, 0), (1, -p, 0), (0, -1, p), (0, 1, p), (0, -1, -p), (0, 1, -p), (p, 0, -1), (p, 0, 1), (-p, 0, -1), (-p, 0, 1)]
    k = r / math.sqrt(1 + p * p)
    return [Vector((x * k, y * k, z * k)) for x, y, z in vs]

def oct_pts(r, sz=1.0):
    return [(r, 0, 0), (-r, 0, 0), (0, r, 0), (0, -r, 0), (0, 0, r * sz), (0, 0, -r * sz)]

def beam(name, a, b, t, m, parent, sides=6):
    # 六角の角材（かどが面になって光を拾う）
    d = b - a; q = d.to_track_quat('Z', 'Y')
    pts = [a + q @ Vector((math.cos(i / sides * math.tau) * t / 2, math.sin(i / sides * math.tau) * t / 2, z)) for z in (0, d.length) for i in range(sides)]
    return hull(name, pts, m, parent)

def hoop(name, parent, r, tube, n, m, h=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    # 環: 短い板を n 枚（それぞれ凸）。h は厚み（たて）。環にはインクのふちをつけない（AD1: 線がふえてざわつく）
    g = empty(name, parent, loc, rot)
    h = h or tube
    for i in range(n):
        a0, a1 = i / n * math.tau, (i + 1) / n * math.tau
        hull(f'{name}{i}', [(math.cos(a) * rr, math.sin(a) * rr, z) for a in (a0, a1) for rr in (r - tube / 2, r + tube / 2) for z in (-h / 2, h / 2)], m, g, noInk=True)
    return g

root = empty('traveler')
root.scale = (0.85, 0.85, 0.85)   # AD3: ゲームの大きさ 165px 前後に（角材は 0.07×0.85≒0.06 で ART の下限を守る）

# ---- 胴（前へ 14 度かたむく） ----
torso = empty('torso', root, (0, 0, 1.0), rot=(0, math.radians(14), 0))
frame = empty('spinFrame', torso)
R = 0.52                                  # AD2: 0.56→0.52（高さ 205px は大きすぎた）
vs = ico_pts(R)
q = vs[5].normalized().rotation_difference(Vector((0, 0, 1)))   # この頂点を真上へ
vs = [q @ v for v in vs]
# 断面だけの殻（いちばん先に描くように、名前を先頭に。2D では紙の色の多角形とインクのふちになる）
hull('aShell', [v * 1.02 for v in vs], SHELL, frame, slice=True, noInk=True)
edges = sorted({tuple(sorted((i, j))) for i in range(12) for j in sorted(range(12), key=lambda j: (vs[i] - vs[j]).length)[1:6]})
for k, (i, j) in enumerate(edges):
    beam(f'beam{k}', vs[i], vs[j], 0.07, BRASS, frame)
for i, v in enumerate(vs):
    hull(f'node{i}', [v + w for w in ico_pts(0.055)], GOLD, frame)   # 頂点の留め玉（原寸で約5px）
top = max(vs, key=lambda v: v.z); bot = min(vs, key=lambda v: v.z)
hull('drop', [bot + Vector(p) + Vector((0, 0, -0.1)) for p in oct_pts(0.06, 1.8)], GLOW, frame)   # 下の頂点にさがる光のしずく
hull('bail', [top + Vector((math.cos(a) * 0.03, math.sin(a) * 0.03, z)) for a in [i / 6 * math.tau for i in range(6)] for z in (0, 0.12)], GOLD, frame)

p = (1 + 5 ** 0.5) / 2
dod = [(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)] + [(0, s / p, t * p) for s in (-1, 1) for t in (-1, 1)] + [(s / p, t * p, 0) for s in (-1, 1) for t in (-1, 1)] + [(t * p, 0, s / p) for s in (-1, 1) for t in (-1, 1)]
hull('spinInner', [(x * 0.17, y * 0.17, z * 0.17) for x, y, z in dod], GLOW, torso)   # AD1: 0.25→0.17（外接 0.29＝骨組みの約半分。すき間から紙が見える）

# ---- 黄道の環（主役の環。うしろが上がる）と、暗い星ふたつ ----
ecl = empty('ecliptic', torso, rot=(math.radians(32), math.radians(24), 0))   # AD2: 真横の棒に見えないよう、大きく開く
orbit = empty('spinOrbit', ecl)
hoop('eclRing', orbit, 0.80, 0.06, 24, BRASS, h=0.05)           # AD1: 太く（原寸で約5px）。環の主役はこれ1本。AD2: 半径 0.86→0.80
for i, a in enumerate((math.pi / 2, -math.pi / 2)):   # AD2: 芯の前をふさがないよう、うしろから見て左右に
    hull(f'star{i}', [Vector(pt) + Vector((math.cos(a) * 0.82, math.sin(a) * 0.82, 0)) for pt in oct_pts(0.13, 1.5)], TEAL, orbit)

# うしろへ流れる光のつぶは、モデルに置かない（AD3: カメラはいつもうしろなので、止まった形では胴に重なって芯をよごす）。
# 進む向きは動きの段階で: 歩くと胴の傾きが増え、環が遅れて傾き、光のつぶが粒子として上へ散る

# ---- 頭（前へ出す） ----
head = empty('bobHead', root, (0.1, 0, 1.84))
hull('head', ico_pts(0.17), GOLD, head)
halo = empty('spinHalo', head, rot=(math.radians(68), math.radians(18), 0))
hoop('haloRing', halo, 0.29, 0.045, 14, GOLD, h=0.03)
hull('eye', oct_pts(0.06), EYE, head, (0.17, 0, 0.01))

# ---- 足もとの輪（脇役）と東西南北の目盛り ----
ring = empty('ring', root, (0, 0, 0.12))
hoop('floorRing', ring, 0.42, 0.028, 16, BRASS, h=0.02)
for i in range(4):
    a = i / 4 * math.tau
    c = Vector((math.cos(a) * 0.42, math.sin(a) * 0.42, 0))
    hull(f'tick{i}', [c + Vector(pt) for pt in oct_pts(0.04, 0.6)], GOLD, ring, noInk=True)

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_extras=True)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
print(f'exported {out}  parts={len(meshes)}  tris={sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)}')
