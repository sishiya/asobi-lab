; ---- 音（SPU）: はじめに音の RAM へ送る・残響・環境音。1こまごとに腹の光の音・捕食者のうねりと鼓動・合図の音（main.s のつづき） ----
;   声の割りふり: 0 環境音・1 腹の光・2 と 6 食べた鐘（交互）・3 鼓動・4 見つかった・5 捕食者のうねり（ノイズ）
;   決まりの側は V_EVT に印を立てるだけ（1 食べた・2 見つかった・4 はじまり）。ここで鳴らして消す

SPU     = 0xc00          ; s7（1F801000）から
SPUCNT  = 0xdaa
EV_EAT   = 1
EV_CAUGHT = 2
EV_START = 4

sndinit:
  move t9, ra
  sh zero, SPUCNT(s7)        ; いったん止める
  li t0, 0x3fff              ; 全体の音量
  sh t0, 0xd80(s7)
  sh t0, 0xd82(s7)
  li t0, 0x3800              ; 残響の音量
  sh t0, 0xd84(s7)
  sh t0, 0xd86(s7)
  li t0, 0xe000              ; 残響の作業場所（音の RAM の終わりの 64KB）
  sh t0, 0xda2(s7)
  la t1, revtab              ; 残響の形（このゲームのために決めた数: 深い海の広い響き）
  li t2, 0
@rv:
  lhu t0, 0(t1)
  addu t3, s7, t2
  sh t0, 0xdc0(t3)
  addiu t1, t1, 2
  addiu t2, t2, 2
  slti t0, t2, 64
  bnez t0, @rv
  nop
  ; 音の RAM へ DMA（口 4）で送る
  li t0, SNDBASE
  sh t0, 0xda6(s7)
  li t0, 0x8020              ; 動かす・DMA で書く
  sh t0, SPUCNT(s7)
  lw t0, DPCR(s7)
  li t1, 0x00080000
  or t0, t0, t1
  sw t0, DPCR(s7)
  la t0, sndbank
  sw t0, 0x0c0(s7)           ; D4MADR
  li t0, (SNDSIZE / 64) << 16 | 16
  sw t0, 0x0c4(s7)           ; D4BCR（16 語 × かたまりの数）
  li t0, 0x01000201
  sw t0, 0x0c8(s7)           ; D4CHCR（ブロック・RAM から）
@dw:
  lw t0, 0x0c8(s7)
  li t1, 0x01000000
  and t0, t0, t1
  bnez t0, @dw
  nop
  li t0, 0xe180              ; 動かす・音を出す・残響・ノイズの速さ（シフト 8・ステップ 1。低く暗いうねり）
  sh t0, SPUCNT(s7)
  li t0, 0x3d                ; 残響へ: 声 0・2・3・4・5
  sh t0, 0xd98(s7)
  sh zero, 0xd9a(s7)
  li t0, 0x20                ; ノイズ: 声 5
  sh t0, 0xd94(s7)
  ; 環境音を鳴らしはじめる（ゆっくり立ち上がって、ずっと）
  li a0, 0
  li a1, S_AMB
  li a2, 0x0400              ; 11025Hz
  li a3, 0x1800
  li v0, 0x500f
  li v1, 0x1f14
  jal vset
  nop
  li t0, 1
  sh t0, 0xd88(s7)
  sw zero, V_HUMON(gp)
  sw zero, V_WOOSH(gp)
  sw zero, V_THUMP(gp)
  sw zero, V_EVT(gp)
  jr t9
  nop

; 声の設定: a0 = 声、a1 = はじめの場所（8 バイト単位）、a2 = 高さ、a3 = 音量（左右おなじ）、v0・v1 = ADSR
vset:
  sll t0, a0, 4
  addu t0, t0, s7
  sh a3, SPU + 0(t0)
  sh a3, SPU + 2(t0)
  sh a2, SPU + 4(t0)
  sh a1, SPU + 6(t0)
  sh v0, SPU + 8(t0)
  jr ra
  sh v1, SPU + 10(t0)

; 声の高さと音量だけ（鳴っている間に変える）
vtone:
  sll t0, a0, 4
  addu t0, t0, s7
  sh a3, SPU + 0(t0)
  sh a3, SPU + 2(t0)
  jr ra
  sh a2, SPU + 4(t0)

; a0 = 声の番号のビット → 鳴らす・止める
kon:
  jr ra
  sh a0, 0xd88(s7)
koff:
  jr ra
  sh a0, 0xd8c(s7)

; 1こまごとの音
sndframe:
  addiu sp, sp, -8
  sw ra, 0(sp)
  ; ---- 環境音: 深いほど少し低く ----
  lw t1, V_FD(gp)
  li a0, 0
  sra t1, t1, 8
  li a2, 0x0430
  subu a2, a2, t1
  li a3, 0x1800
  jal vtone
  nop
  ; ---- 腹の光の音: 光の段で高さと大きさ（押した結果が耳でもすぐわかる） ----
  lw t1, V_L16(gp)
  lw t2, V_HUMON(gp)
  srl t1, t1, 4
  slti t3, t1, 4
  bnez t3, @hoff
  nop
  bnez t2, @hon
  nop
  li a0, 1
  li a1, S_HUM
  li a2, 0x0300
  li a3, 0
  li v0, 0x300f
  li v1, 0x1f0e
  jal vset
  nop
  li a0, 2
  jal kon
  nop
  li t0, 1
  sw t0, V_HUMON(gp)
@hon:
  lw t1, V_L16(gp)
  li a0, 1
  srl t1, t1, 4
  sll a2, t1, 2
  addu a2, a2, t1            ; 段 × 5
  addiu a2, a2, 0x0300       ; 147Hz 〜 392Hz
  sll a3, t1, 4
  sll t2, t1, 3
  addu a3, a3, t2            ; 段 × 24
  addiu a3, a3, 0x0300
  jal vtone
  nop
  b @hdone
  nop
@hoff:
  beqz t2, @hdone
  nop
  li a0, 2
  jal koff
  nop
  sw zero, V_HUMON(gp)
@hdone:
  ; ---- 捕食者が上がる・見る間のうねり（ノイズ）----
  lw t1, V_PST(gp)
  lw t2, V_WOOSH(gp)
  addiu t3, t1, -1
  sltiu t3, t3, 2            ; 1 か 2（上がる・見る）
  beqz t3, @woff
  nop
  bnez t2, @wdone
  nop
  li a0, 5
  li a1, S_HUM               ; ノイズの声も、終わらない音の場所を指しておく
  li a2, 0x1000
  li a3, 0x0500
  li v0, 0x580f
  li v1, 0x1f16
  jal vset
  nop
  li a0, 0x20
  jal kon
  nop
  li t0, 1
  sw t0, V_WOOSH(gp)
  b @wdone
  nop
@woff:
  beqz t2, @wdone
  nop
  li a0, 0x20
  jal koff
  nop
  sw zero, V_WOOSH(gp)
@wdone:
  ; ---- 鼓動: 見ている間、疑いが強いほど速く大きく ----
  lw t1, V_PST(gp)
  li t2, 2
  bne t1, t2, @nothump
  nop
  lw t0, V_THUMP(gp)
  nop
  addiu t0, t0, -1
  bgtz t0, @tset
  nop
  lw t1, V_SUS(gp)
  nop
  srl t0, t1, 2
  li t2, 44
  subu t0, t2, t0            ; 間 44 → 4（こま）
  slti t2, t0, 12
  beqz t2, @tmin
  nop
  li t0, 12
@tmin:
  sw t0, V_THUMP(gp)
  li a0, 3
  li a1, S_THUMP
  li a2, 0x0800
  sll a3, t1, 6
  addiu a3, a3, 0x0800       ; 疑いで大きく
  slti t2, a3, 0x3000
  bnez t2, @tv
  nop
  li a3, 0x3000
@tv:
  li v0, 0x000f
  li v1, 0x1f0a
  jal vset
  nop
  li a0, 8
  jal kon
  nop
  b @nothump
  nop
@tset:
  sw t0, V_THUMP(gp)
@nothump:
  ; ---- 合図の音 ----
  lw s1, V_EVT(gp)
  sw zero, V_EVT(gp)
  andi t0, s1, EV_EAT
  beqz t0, @noeat
  nop
  ; 食べた: 五音の音階の鐘（食べた数で順に）。声 2 と 6 を交互に（重なっても切れない）
  lw t1, V_CNT(gp)
  la t2, pentatonic
  andi t3, t1, 7
  sll t3, t3, 1
  addu t2, t2, t3
  lhu a2, 0(t2)
  andi t3, t1, 1
  li a0, 2
  beqz t3, @pv
  nop
  li a0, 6
@pv:
  move s2, a0
  li a1, S_PLINK
  li a3, 0x1c00
  li v0, 0x000f
  li v1, 0x1f0a
  jal vset
  nop
  li a0, 1
  sllv a0, a0, s2
  jal kon
  nop
@noeat:
  andi t0, s1, EV_START
  beqz t0, @nostart
  nop
  ; はじまり: 高い鐘を 1 つ
  li a0, 2
  li a1, S_PLINK
  li a2, 0x1000
  li a3, 0x1800
  li v0, 0x000f
  li v1, 0x1f0a
  jal vset
  nop
  li a0, 4
  jal kon
  nop
@nostart:
  andi t0, s1, EV_CAUGHT
  beqz t0, @nocaught
  nop
  ; 見つかった: 腹の光とうねりを止めて、低く「ぼうん」
  li a0, 0x22
  jal koff
  nop
  sw zero, V_HUMON(gp)
  sw zero, V_WOOSH(gp)
  li a0, 4
  li a1, S_BOOM
  li a2, 0x0800
  li a3, 0x3000
  li v0, 0x000f
  li v1, 0x1f0a
  jal vset
  nop
  li a0, 0x10
  jal kon
  nop
@nocaught:
  lw ra, 0(sp)
  addiu sp, sp, 8
  jr ra
  nop

; 音をすべて止める（タイトルへもどるときなど。環境音はのこす）
sndquiet:
  li t0, 0x7e
  sh t0, 0xd8c(s7)
  sw zero, V_HUMON(gp)
  sw zero, V_WOOSH(gp)
  jr ra
  nop

.align 4
; 食べた鐘の高さ（22050Hz の 880Hz を 0x0800 として）: 五音の音階 ラ シ ド# ミ ファ# ラ シ ド#
pentatonic: .half 0x0800, 0x08fa, 0x0a14, 0x0c00, 0x0d74, 0x1000, 0x11f5, 0x1428
; 残響の形（32 こ）: 遠くの壁の重なりで深い海の広さを。数はこのゲームで決めた（場所は 8 バイト単位）
revtab:
  .half 0x0040, 0x0020, 0x6000, 0x5000, 0xb800, 0x4000, 0xc800, 0x5800, 0x6000, 0x5000
  .half 0x0e00, 0x0f00, 0x0c00, 0x0b80, 0x0a00, 0x0980, 0x0700, 0x0780
  .half 0x0d80, 0x0e80, 0x0880, 0x0800, 0x0600, 0x0680, 0x0500, 0x0580
  .half 0x1000, 0x1080, 0x1100, 0x1180, 0x6000, 0x6000
