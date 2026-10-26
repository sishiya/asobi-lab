// 棚にならぶディスク（あそびラボのオリジナルだけ。PLAN.md 0章）。frames = ケースの絵（タイトル画面）を撮るまで進めるこま
// color = ケースの帯とディスクのラベルのはじめの色（shelf.js の DISC_COLORS から）。keys = [コントローラーのボタン, そのソフトで何をするか]
// 名前・説明・キーの案内は TX(日本語, 英語)
// hidden: true = 棚に出さない（データとディスクは残す。2026-10-26 ユーザー「ほってつんで３D以外は非公開に」。戻すときは hidden を消す）
import { TX } from './i18n.js';

const DISCS = [
  {
    id: 'glow-belly', hidden: true, file: 'discs/glow-belly.exe', title: TX('ムネエソの腹あかり', 'Glow Belly'), color: '#1f4f7a',
    desc: TX('深い海で、腹の光を上からの光に合わせて、下から見上げる捕食者に見つかりにくくする。昼は深く、夜は浅く上がって食べる。',
      'Deep in the sea, match your belly light to the light from above so predators looking up can\'t spot you. Stay deep by day, rise to feed at night.'),
    keys: [['PAD', TX('↑↓ 浮く・沈む', '↑↓ rise / sink')], ['A', TX('腹の光を強く', 'brighter belly')], ['B', TX('腹の光を弱く', 'dimmer belly')], ['START', TX('はじめる', 'start')]],
    frames: 40,
  },
  {
    id: 'dig32', file: 'discs/dig32.exe', title: TX('ほって つんで 3D（試作）', 'Dig and Stack 3D (prototype)'), color: '#6f7a3a',
    desc: TX('火山の島を、自分の目で歩く。掘ったブロックで道具を作り、夜をこえて、のろしを島のいちばん高い所に立てて船を呼ぼう。画面をクリックするとマウスで見回せる（Esc で放す）。',
      'Walk a volcanic island with your own eyes. Make tools from the blocks you dig, get through the nights, and raise a signal fire on the highest ground to call a ship. Click the screen to look around with the mouse (Esc releases it).'),
    keys: [['PAD', TX('前・うしろ・横歩き（マウスがないときの ←→ は向き）', 'walk & strafe (without a mouse, ←→ turn)')], ['B', TX('掘る（おしつづける）', 'dig (hold)')], ['X', TX('置く／夜にたき火で休む', 'place / rest at a fire at night')], ['A', TX('ジャンプ', 'jump')], ['SELECT', TX('作る（開く・閉じる）', 'craft (open/close)')], ['R2', TX('つぎの持ち物', 'next item')], ['L2', TX('前の持ち物', 'previous item')], ['L', TX('上を見る', 'look up')], ['R', TX('下を見る', 'look down')]],
    frames: 50,
  },
  {
    id: 'cube', hidden: true, file: 'discs/cube.exe', title: TX('光るキューブ', 'Lit Cube'), color: '#7d4f78',
    desc: TX('3D の計算をする係（GTE）の確かめ。十字キーで回す。', 'A test of the 3D math chip (GTE). Turn it with the D-pad.'),
    keys: [['PAD', TX('回す', 'turn')]],
    frames: 60,
  },
  {
    id: 'spin-tri', hidden: true, file: 'discs/spin-tri.exe', title: TX('回る三角形', 'Spinning Triangle'), color: '#56636f',
    desc: TX('CPU と絵の係の、はじめの確かめ。', 'The first test of the CPU and the picture chip.'),
    keys: [],
    frames: 60,
  },
];
export const LIBRARY = DISCS.filter((e) => !e.hidden);
