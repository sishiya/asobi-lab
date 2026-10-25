# ほって つんで 3D の音

- `shore.wav` — 浜の環境音（11025Hz・1チャンネル・16 ビット・18 秒のくり返し）。2026-10-25 に、この PC の Stable Audio 3（audio-studio、モデル medium + same-l）で作った。中身は CC BY-NC 4.0（`LICENSE-CONTENT`）。
  - 種類: SFX、長さ 20 秒、種 5151（3案のうち v2。0.5 秒ごとの大きさのゆれがいちばん小さかった。v3 は途中にほぼ無音の所があった）、steps 8・cfg 1.0
  - ことば: Calm tropical island shore ambience with gentle small waves lapping on coral sand and a soft warm breeze, steady and seamless, no birds, no voices, no music / source: small ocean waves on a sandy beach, light wind through palm leaves / action: slow regular wash in and out, very gentle, no sudden events / material: soft hiss of foam, smooth low rumble / space: outdoor, a little distant, open air
  - 直し: 1チャンネル・2 秒の重ねでくり返し（18 秒）・ピーク −1dB・11025Hz（SPU の RAM に入るように。ffmpeg で書きなおし、情報の欄は消した）
- ほかの音（掘る・くずれた・置いた・足音・置けない・できた・着地）は、`../data.mjs` の `sounds()` が数式で作る（ビルドのとき）。
- どれも `tools/adpcm.mjs` で SPU の ADPCM にして、ソフトに入れる（はじめに DMA で音の RAM へ送る）。
