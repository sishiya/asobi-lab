# 花の小川: 写実の花と草（ver. 0.7）を1つの GLB に（Blender 5.2 で: blender -b -P flower-brook/tools/build-flora.py）
# 素材はリポジトリの外 ../3d-library/polyhaven/（どれも CC0。Poly Haven。取り方は tools/fetch-assets.py）:
#   花 = flower_gazania・celandine_01・flower_ursinia・dandelion_01、草 = grass_medium_02、空の光 = flower_hillside（HDRI）
# 株ごとに: 形を確定 → 根もとを原点へ → 三角形が多いものは間引く → 名前を「種類_株」に。絵は 512 に縮める。
import bpy, os

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.normpath(os.path.join(HERE, '..', '..', '..', '3d-library', 'polyhaven'))
OUT = os.path.normpath(os.path.join(HERE, '..', 'assets', 'flora-real.glb'))
PICK = {   # 使う株（LOD0）。小さめ・形のちがうものを
    'flower_gazania': 'abcdefgh', 'celandine_01': 'abde', 'flower_ursinia': 'cde', 'dandelion_01': 'cde', 'grass_medium_02': 'abcde',
}
MAXTRI, TEX = 2400, 512

bpy.ops.wm.read_factory_settings(use_empty=True)
keep = []
for asset, letters in PICK.items():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(LIB, asset, asset + '_1k.gltf'))
    for o in set(bpy.data.objects) - before:
        if o.type != 'MESH': continue
        tag = o.name.replace('_LOD0', '').split('_')[-1]
        if tag not in letters: bpy.data.objects.remove(o); continue
        o.parent = None
        bpy.context.view_layer.objects.active = o
        for x in bpy.context.selected_objects: x.select_set(False)
        o.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        # 根もと（いちばん下のまん中）を原点に
        vs = o.data.vertices; zmin = min(v.co.z for v in vs); cx = sum(v.co.x for v in vs) / len(vs); cy = sum(v.co.y for v in vs) / len(vs)
        for v in vs: v.co.x -= cx; v.co.y -= cy; v.co.z -= zmin
        o.location = (0, 0, 0)
        tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
        if tris > MAXTRI:
            d = o.modifiers.new('dec', 'DECIMATE'); d.ratio = MAXTRI / tris
            bpy.ops.object.modifier_apply(modifier='dec')
        short = asset.replace('flower_', '').replace('_01', '').replace('_medium_02', '')
        o.name = o.data.name = f'{short}_{tag}'
        keep.append(o)
# 余ったもの（空の親など）を消す
for o in list(bpy.data.objects):
    if o not in keep: bpy.data.objects.remove(o)
for img in bpy.data.images:
    if img.size[0] > TEX: img.scale(TEX, TEX)
for o in keep: o.select_set(True)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_image_format='AUTO', export_jpeg_quality=82, export_apply=True)
for o in keep: print('KEEP', o.name, sum(len(p.vertices) - 2 for p in o.data.polygons), tuple(round(d, 3) for d in o.dimensions))
print('BUILT', OUT, os.path.getsize(OUT) // 1024, 'KB')

# 空の光（PMREM の環境光にだけ使う。背景には出さない）: 1k の HDRI を 512×256 に縮めて assets/sky-env.hdr
env = bpy.data.images.load(os.path.join(LIB, 'hdri', 'flower_hillside_1k.hdr'))
env.scale(512, 256)
ENV = os.path.normpath(os.path.join(HERE, '..', 'assets', 'sky-env.hdr'))
env.filepath_raw = ENV; env.file_format = 'HDR'; env.save()
print('BUILT', ENV, os.path.getsize(ENV) // 1024, 'KB')
