# 花の小川: 写実の素材（CC0、Poly Haven）をリポジトリの外 ../3d-library/polyhaven へ取る（python -I flower-brook/tools/fetch-assets.py）。出どころは list-flower-brook.tsv に
import json, os, urllib.request
LIB = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '3d-library', 'polyhaven'))
MODELS = ['dandelion_01', 'flower_gazania', 'flower_ursinia', 'celandine_01', 'grass_medium_02']
TEX = ['river_small_rocks', 'clean_pebbles']
HDRI = ['flower_hillside', 'evening_meadow']
op = urllib.request.build_opener(); op.addheaders = [('User-Agent', 'sishiya-flower-brook-asset-fetch/1.0')]; urllib.request.install_opener(op)
log = []
def get(url, path):
    path = os.path.join(LIB, path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        urllib.request.urlretrieve(url, path)
    log.append((os.path.relpath(path, LIB).replace(os.sep, '/'), url))
    return os.path.getsize(path)
def files(a):
    with urllib.request.urlopen('https://api.polyhaven.com/files/' + a) as r: return json.load(r)
tot = 0
for m in MODELS:
    g = files(m)['gltf']['1k']['gltf']
    tot += get(g['url'], f'{m}/{m}_1k.gltf')
    for rel, inc in g.get('include', {}).items(): tot += get(inc['url'], f'{m}/{rel}')
    print(m, tot // 1048576, 'MB so far', flush=True)
for t in TEX:
    d = files(t)
    for k in ['Diffuse', 'nor_gl', 'arm', 'Displacement']:
        if k in d: f = d[k]['1k']['jpg']; tot += get(f['url'], f'tex/{os.path.basename(f["url"])}')
    print(t, tot // 1048576, 'MB so far', flush=True)
for h in HDRI:
    d = files(h)['hdri']
    for res in ['1k', '2k']: f = d[res]['hdr']; tot += get(f['url'], f'hdri/{h}_{res}.hdr')
    print(h, tot // 1048576, 'MB so far', flush=True)
with open(os.path.join(LIB, 'list-flower-brook.tsv'), 'w', encoding='utf-8', newline='\n') as fo:
    for p, u in log: fo.write(f'{p}\t{u}\n')
print('TOTAL', tot // 1048576, 'MB', len(log), 'files')
