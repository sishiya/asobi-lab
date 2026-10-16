// 面のデータと、置ける3Dの形（段階A: 1面だけ）

// 3Dの形。w=横（マス）、h=高さ（マス）、d=奥行き（秒）、slope=手前へ1秒進むごとに上がるマス
export const KINDS = {
  beam: {
    name: '角材', w: 7, h: 1, d: 12, slope: 0, color: '#d39a5c',
    desc: '奥行き12秒の長い板。2D世界には12秒だけ橋が出る。',
  },
  lift: {
    name: '斜めの板', w: 5, h: 1, d: 10, slope: 0.75, color: '#4fb0a5',
    desc: '手前（未来）へ向かって上がる板。2D世界では1秒に0.75マスずつ上がる足場。',
  },
  wall: {
    name: '縦の板', w: 1, h: 3, d: 6, slope: 0, color: '#9a84d8',
    desc: '2D世界に6秒だけ壁が出る。住人はそこで引き返す。',
  },
};

function makeTops(W) {
  const a = [];
  for (let c = 0; c < W; c++) {
    if (c >= 12 && c <= 16) a.push(-Infinity); // 底のない崖
    else if (c >= 24) a.push(7);                // 高い段
    else if (c >= 19) a.push(3);                // 段の前の浅いくぼみ
    else a.push(4);
  }
  return a;
}

export const LEVEL = {
  id: 'cliff',
  name: '崖と段',
  W: 36, H: 14, T: 60,
  tops: makeTops(36),
  start: { x: 1.6 },
  goal: { x: 32.4 },
  stock: { beam: 1, lift: 1, wall: 1 },
};
