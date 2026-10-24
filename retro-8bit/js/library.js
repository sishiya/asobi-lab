// 棚にならぶカートリッジ（あそびラボのオリジナルだけ）。frames = 棚の小さな画面に出すまで進めるフレーム
// color = カセットの色。keys = [コントローラーのボタン（PAD・A・B・START・SELECT）, そのソフトで何をするか]。押せるキーは main.js の BUTTON_KEYS
export const LIBRARY = [
  {
    id: 'dino-ranch', file: 'roms/dino-ranch.nes', title: '恐竜かけっこ牧場 8bit', color: '#d6ad45',
    desc: '恐竜をかけ合わせて育て、100m を走らせる。大きい体は重く、長い脚は転びやすい。しっぽでつり合いをとる。',
    keys: [['PAD', 'えらぶ'], ['A', '決める'], ['B', 'もどる'], ['START', 'はじめる']],
    frames: 90,
  },
  {
    id: 'frog-night', file: 'roms/frog-night.nes', title: 'カエルのよる', color: '#2f6b70',
    desc: '夜の池で舌をのばして虫をとる。でも、光るホタルは毒。朝が来るまでの 90 秒。',
    keys: [['PAD', '←→ 動く'], ['A', '舌'], ['START', 'はじめる・止める']],
    frames: 70,
  },
];
