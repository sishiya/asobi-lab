# 筆のタッチの「絵ごとの専用モデル」を学習する（速いスタイル変換。Johnson ほか 2016 の変換のネットワーク）。
# 学習は手元の GPU で。できた重みは vendor/style-models/<絵>.bin・.json（float16）に書き、js/style-fast.js がブラウザで同じ形を組んで使う。
#
# 使い方（PyTorch と torchvision と Pillow のある Python で）:
#   python face-in-frame/tools/train_style.py --painting gogh --content <写真のフォルダ> --out face-in-frame/vendor/style-models
# 写真のフォルダは、ふつうの写真がたくさん入ったもの（COCO val2017 など。学習に使うだけで、公開しない）。
# スタイルは絵の顔のまわり（paintings.js の face と styleCrop。style-bottlenecks.html と同じ切り方）を読む。
import argparse, glob, json, math, os, random, re, struct, time

import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
import torchvision
from torchvision import transforms

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # face-in-frame/


# ---- 変換のネットワーク（js/style-fast.js と同じ形。変えたら両方を直す） ----
class Conv(nn.Module):
    def __init__(self, cin, cout, k, stride=1, up=False, norm=True, relu=True):
        super().__init__()
        self.k, self.up, self.relu = k, up, relu
        self.conv = nn.Conv2d(cin, cout, k, stride)
        self.norm = nn.InstanceNorm2d(cout, affine=True) if norm else None

    def forward(self, x):
        if self.up:
            x = F.interpolate(x, scale_factor=2, mode='nearest')
        x = F.pad(x, [self.k // 2] * 4, mode='reflect')
        x = self.conv(x)
        if self.norm is not None:
            x = self.norm(x)
        return F.relu(x) if self.relu else x


class Res(nn.Module):
    def __init__(self, c):
        super().__init__()
        self.a, self.b = Conv(c, c, 3), Conv(c, c, 3, relu=False)

    def forward(self, x):
        return x + self.b(self.a(x))


class Transformer(nn.Module):
    # 入力も出力も 0〜1 の RGB。出力は sigmoid
    def __init__(self, w=(32, 64, 128), blocks=5):
        super().__init__()
        a, b, c = w
        self.layers = nn.Sequential(
            Conv(3, a, 9), Conv(a, b, 3, 2), Conv(b, c, 3, 2),
            *[Res(c) for _ in range(blocks)],
            Conv(c, b, 3, up=True), Conv(b, a, 3, up=True), Conv(a, 3, 9, norm=False, relu=False))

    def forward(self, x):
        return torch.sigmoid(self.layers(x))


# ---- 損失: VGG16 の特徴（中身）とグラム行列（スタイル） ----
class VGG(nn.Module):
    def __init__(self):
        super().__init__()
        f = torchvision.models.vgg16(weights=torchvision.models.VGG16_Weights.IMAGENET1K_V1).features.eval()
        for p in f.parameters():
            p.requires_grad_(False)
        self.slices = nn.ModuleList([f[:4], f[4:9], f[9:16], f[16:23]])  # relu1_2, relu2_2, relu3_3, relu4_3
        self.register_buffer('mean', torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1))
        self.register_buffer('std', torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1))

    def forward(self, x):
        x = (x - self.mean) / self.std
        out = []
        for s in self.slices:
            x = s(x)
            out.append(x)
        return out


def gram(y):
    b, c, h, w = y.shape
    f = y.view(b, c, h * w)
    return f.bmm(f.transpose(1, 2)) / (c * h * w)


# ---- 絵の読み方（paintings.js から face と styleCrop を読む） ----
def painting_entry(pid):
    src = open(os.path.join(ROOT, 'js', 'paintings.js'), encoding='utf-8').read()
    block = re.search(r"\{ id: '" + pid + r"'(.*?)goal:", src, re.S).group(0)
    face = dict((k, float(v)) for k, v in re.findall(r'(\w+): (-?[\d.]+)', re.search(r'face: \{([^}]*)\}', block).group(1)))
    crop = re.search(r'fastCrop: ([\d.]+)', block) or re.search(r'styleCrop: ([\d.]+)', block)  # 専用モデルだけ広さを変えるときは fastCrop
    image = re.search(r"src: '([^']+)'", block).group(1)
    return os.path.join(ROOT, image), face, float(crop.group(1)) if crop else 3.0


def style_image(pid, size):
    path, f, crop = painting_entry(pid)
    img = Image.open(path).convert('RGB')
    W, H = img.size
    side = min(W, H, (f['right'] - f['left']) * W * crop)
    cx, cy = (f['nx'] + (f['left'] + f['right']) / 2) * W, f['ny'] * W
    x = max(0, min(W - side, cx - side / 2)); y = max(0, min(H - side, cy - side / 2))
    return img.crop((x, y, x + side, y + side)).resize((size, size), Image.LANCZOS)


# ---- 重みを書き出す（float16。並びは js/style-fast.js が読む順） ----
def export(net, path):
    tensors, meta = [], []
    for name, t in net.state_dict().items():
        t = t.detach().float().cpu()
        if t.dim() == 4:  # 畳みこみ: (出, 入, 縦, 横) → TensorFlow の (縦, 横, 入, 出)
            t = t.permute(2, 3, 1, 0).contiguous()
        if name.endswith('running_mean') or name.endswith('running_var') or name.endswith('num_batches_tracked'):
            continue
        meta.append({'name': name, 'shape': list(t.shape)})
        tensors.append(t.half().numpy().tobytes())
    with open(path + '.bin', 'wb') as fp:
        for b in tensors:
            fp.write(b)
    with open(path + '.json', 'w', encoding='utf-8') as fp:
        json.dump({'format': 'face-in-frame fast style v1', 'dtype': 'float16', 'tensors': meta}, fp)


# カメラの映像は、肌や壁のような平らな所が多い。平らな所で縞を描かないように、写真の半分をぼかして学ばせる
# （v010。ぼかさずに学んだモデルは、なめらかな所に縦縞と格子を出した。ユーザー「変な縦縞がでました」）
BLURS = [transforms.GaussianBlur(21, s) for s in (1.5, 3, 6)] + [transforms.GaussianBlur(41, 12)]


def soften(x):
    return random.choice(BLURS)(x) if random.random() < 0.5 else x


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--painting', required=True)
    ap.add_argument('--content', required=True)
    ap.add_argument('--out', default=os.path.join(ROOT, 'vendor', 'style-models'))
    ap.add_argument('--size', type=int, default=256)
    ap.add_argument('--style-size', type=int, default=384)
    ap.add_argument('--epochs', type=float, default=2)
    ap.add_argument('--batch', type=int, default=4)
    ap.add_argument('--style-weight', type=float, default=1e5)
    ap.add_argument('--content-weight', type=float, default=1.0)
    ap.add_argument('--tv-weight', type=float, default=4e-6)
    ap.add_argument('--noise', type=float, default=0.02)  # 入力にのせる小さなゆらぎ（js/style-fast.js の NOISE と同じにする）
    ap.add_argument('--lr', type=float, default=1e-3)
    ap.add_argument('--preview', default='')  # 学習のあとに変換してみる写真（なくてもよい）
    a = ap.parse_args()

    dev = torch.device('cuda')
    torch.manual_seed(1); random.seed(1)
    files = sorted(glob.glob(os.path.join(a.content, '*.jpg')))
    tf = transforms.Compose([transforms.Resize(a.size), transforms.CenterCrop(a.size), transforms.ToTensor()])
    net, vgg = Transformer().to(dev), VGG().to(dev)
    opt = torch.optim.Adam(net.parameters(), a.lr)
    style = transforms.ToTensor()(style_image(a.painting, a.style_size)).unsqueeze(0).to(dev)
    with torch.no_grad():
        gs = [gram(y) for y in vgg(style)]
    steps = int(len(files) * a.epochs / a.batch)
    print(f'{a.painting}: {len(files)} 枚・{steps} 歩', flush=True)
    t0 = time.time()
    for step in range(steps):
        batch = torch.stack([soften(tf(Image.open(random.choice(files)).convert('RGB'))) for _ in range(a.batch)]).to(dev)
        y = net((batch + a.noise * torch.randn_like(batch)).clamp(0, 1))
        fy, fx = vgg(y), vgg(batch)
        lc = a.content_weight * F.mse_loss(fy[1], fx[1])
        ls = a.style_weight * sum(F.mse_loss(gram(f), g.expand(f.shape[0], -1, -1)) for f, g in zip(fy, gs))
        ltv = a.tv_weight * ((y[:, :, 1:] - y[:, :, :-1]).abs().sum() + (y[:, :, :, 1:] - y[:, :, :, :-1]).abs().sum())
        loss = lc + ls + ltv
        opt.zero_grad(); loss.backward(); opt.step()
        if step % 200 == 0 or step == steps - 1:
            print(f'  {step:5d}/{steps}  中身 {lc.item():.3f}  スタイル {ls.item():.3f}  {time.time() - t0:.0f}秒', flush=True)
    os.makedirs(a.out, exist_ok=True)
    export(net.eval(), os.path.join(a.out, a.painting))
    if a.preview:
        with torch.no_grad():
            x = transforms.ToTensor()(Image.open(a.preview).convert('RGB').resize((448, 448))).unsqueeze(0).to(dev)
            transforms.ToPILImage()(net(x)[0].cpu()).save(os.path.join(a.out, a.painting + '-preview.png'))
    print('書いた:', os.path.join(a.out, a.painting + '.bin'), flush=True)


if __name__ == '__main__':
    main()
