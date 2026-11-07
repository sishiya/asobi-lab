# TripoSG（MIT）で、透明な背景の自作画像から形（.glb）を作る。
# 背景切りぬきのモデル（RMBG-1.4）は使わず、取りにも行かない。diso（CUDA のビルドが要る）が無ければ、遅いほうの取り出し方にする。
#   <TripoSG>/.venv/Scripts/python.exe <このファイル> <TripoSG のフォルダ> <入力.png> <出力.glb> [面の数] [seed]
import sys, os, types
root, src, dst = sys.argv[1], sys.argv[2], sys.argv[3]
faces = int(sys.argv[4]) if len(sys.argv) > 4 else 6000
seed = int(sys.argv[5]) if len(sys.argv) > 5 else 42
sys.path.insert(0, root); sys.path.insert(0, os.path.join(root, 'scripts'))
try:
    import diso; flash = True
except ImportError:
    sys.modules['diso'] = types.SimpleNamespace(DiffDMC=None); flash = False
sys.modules['briarmbg'] = types.SimpleNamespace(BriaRMBG=None)   # 読みこまれないように
import numpy as np, torch, trimesh
from huggingface_hub import snapshot_download
from triposg.pipelines.pipeline_triposg import TripoSGPipeline
import triposg.schedulers.scheduling_rectified_flow, triposg.models.transformers.triposg_transformer, triposg.models.autoencoders.autoencoder_kl_triposg   # 新しい diffusers は先に読みこんだものしか使わない
from image_process import prepare_image
from inference_triposg import simplify_mesh

wdir = os.path.join(root, 'pretrained_weights', 'TripoSG')
snapshot_download(repo_id='VAST-AI/TripoSG', local_dir=wdir)
pipe = TripoSGPipeline.from_pretrained(wdir).to('cuda', torch.float16)
img = prepare_image(src, bg_color=np.array([1.0, 1.0, 1.0]), rmbg_net=None)   # 透明度があれば切りぬきは使われない
with torch.no_grad():
    out = pipe(image=img, generator=torch.Generator(device='cuda').manual_seed(seed), num_inference_steps=50, guidance_scale=7.0,
               use_flash_decoder=flash).samples[0]
mesh = trimesh.Trimesh(out[0].astype(np.float32), np.ascontiguousarray(out[1]))
print('raw faces', len(mesh.faces), 'flash', flash)
mesh = simplify_mesh(mesh, faces)
mesh.export(dst); print('saved', dst, len(mesh.faces))

# 公開前チェックに合わせて、trimesh が足す extras・generator を消す
import json, struct
def strip(path):
    b = open(path, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + n])
    j['asset'] = {'version': '2.0'}
    for k in ('nodes', 'meshes', 'scenes'):
        for o in j.get(k, []): o.pop('extras', None)
    j.pop('extras', None)
    t = json.dumps(j, separators=(',', ':')).encode(); t += b' ' * (-len(t) % 4)
    rest = b[20 + n:]
    out = b[:12] + struct.pack('<I', len(t)) + b[16:20] + t + rest
    out = out[:8] + struct.pack('<I', len(out)) + out[12:]
    open(path, 'wb').write(out)
strip(dst)
