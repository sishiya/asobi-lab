# ムネエソの腹あかり の音

- `ambience.wav` — 深い海の環境音（11025Hz・1チャンネル・16 ビット・18 秒のくり返し）。2026-10-25 に、この PC の Stable Audio 3（audio-studio、モデル medium + same-l）で作った。中身は CC BY-NC 4.0（`LICENSE-CONTENT`）。
  - 種類: SFX、長さ 20 秒、種 884067236（3案のうち v1。スペクトログラムでいちばん変化が少なくなめらか）、steps 8・cfg 1.0
  - ことば: Deep ocean twilight zone ambience, calm and dark, slow evolving low drone with soft distant underwater rumble and faint shimmering high tones, no animals, steady and seamless / source: deep sea water mass, distant ocean currents / action: continuous slow swells, very gentle movement, no sudden events / material: soft low rumble, airy hollow resonance, smooth / space: vast open underwater space, distant, reverberant hydrophone
  - 直し: 1チャンネル・2 秒の重ねでくり返し（18 秒）・ピーク −1dB・11025Hz（SPU の RAM に入るように）
- ほかの音（腹の光の音・食べた音・鼓動・見つかった音・はじまりの音）は、`../data.mjs` の `sounds()` が数式で作る（ビルドのとき）。
- どれも `tools/adpcm.mjs` で SPU の ADPCM にして、ソフトに入れる（はじめに DMA で音の RAM へ送る）。
