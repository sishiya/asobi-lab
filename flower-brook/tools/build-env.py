# 花の小川: しずくに映す空の光（Blender 5.2 で: blender -b -P flower-brook/tools/build-env.py）
# 素材はリポジトリの外 ../3d-library/polyhaven/hdri/flower_hillside_1k.hdr（CC0。Poly Haven。取り方は tools/fetch-assets.py）
# 1k の HDRI を 512×256 に縮めて assets/sky-env.hdr に（映りこみだけなので小さくてよい）。
# ver. 0.7 では写実の花・草（flora-real.glb）もここで作っていたが、ver. 0.8 で外した（git の履歴に build-flora.py）
import bpy, os

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.normpath(os.path.join(HERE, '..', '..', '..', '3d-library', 'polyhaven'))
env = bpy.data.images.load(os.path.join(LIB, 'hdri', 'flower_hillside_1k.hdr'))
env.scale(512, 256)
OUT = os.path.normpath(os.path.join(HERE, '..', 'assets', 'sky-env.hdr'))
env.filepath_raw = OUT; env.file_format = 'HDR'; env.save()
print('BUILT', OUT, os.path.getsize(OUT) // 1024, 'KB')
