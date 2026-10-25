; ---- 音（SPU）: はじめに音の RAM へ送る・浜の環境音。1こまごとに、決まりの側が立てた印（V_EVT）の音を鳴らして消す（main.s のつづき） ----
;   声の割りふり: 0 浜の環境音（くり返し）・1 掘る（ざくっ）・2 くずれた・3 置いた・4 足音・5 置けない・6 着地・7 できた／のろし
;   印: EV_DIG（掘っている途中。V_EVM のブロックで高さ）・EV_BREAK・EV_PLACE・EV_STEP・EV_DENY・EV_LAND
;   浜は外なので残響はかけない（広い所の乾いた音）

SPU     = 0xc00          ; s7（1F801000）から
SPUCNT  = 0xdaa
EV_DIG   = 1
EV_BREAK = 2
EV_PLACE = 4
EV_STEP  = 8
EV_DENY  = 16
EV_LAND  = 32
EV_MADE  = 64
EV_WIN   = 128
; 256 以上は crits.s（EV_SAVE・EV_STEAL・EV_POKE・EV_CRAB）

sndinit:
  move t9, ra
  sh zero, SPUCNT(s7)        ; いったん止める
  li t0, 0x3fff              ; 全体の音量
  sh t0, 0xd80(s7)
  sh t0, 0xd82(s7)
  sh zero, 0xd84(s7)         ; 残響なし
  sh zero, 0xd86(s7)
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
  li t0, 0xc000              ; 動かす・音を出す
  sh t0, SPUCNT(s7)
  sh zero, 0xd98(s7)
  sh zero, 0xd9a(s7)
  sh zero, 0xd94(s7)
  ; 浜の環境音を鳴らしはじめる（ゆっくり立ち上がって、ずっと）
  li a0, 0
  li a1, S_SHORE
  li a2, 0x0400              ; 11025Hz
  li a3, 0x1000
  li v0, 0x500f
  li v1, 0x1f14
  jal vset
  nop
  li t0, 1
  sh t0, 0xd88(s7)
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

; 1 つ鳴らす: a0 = 声、a1 = 場所、a2 = 高さ、a3 = 音量（ADSR は音の形のまま）
shot:
  move t8, ra
  li v0, 0x000f
  li v1, 0x1f0a
  bal vset
  nop
  li t0, 1
  sllv t0, t0, a0
  jr t8
  sh t0, 0xd88(s7)

; 1こまごとの音: 印を見て鳴らし、消す
sndframe:
  addiu sp, sp, -8
  sw ra, 0(sp)
  sw s0, 4(sp)
  lw s0, V_EVT(gp)
  sw zero, V_EVT(gp)
  beqz s0, @end
  nop
  ; 掘る・くずれた・置いた: ブロックで高さを変える（やわらかい土は低く、かたい石は高く）
  lw t0, V_EVM(gp)
  la t1, sndpitch
  sll t0, t0, 1
  addu t1, t1, t0
  lhu a2, 0(t1)
  andi t0, s0, EV_DIG
  beqz t0, @nd
  nop
  li a0, 1
  li a1, S_CRUNCH
  li a3, 0x2400
  jal shot
  nop
@nd:
  andi t0, s0, EV_BREAK
  beqz t0, @nb
  nop
  li a0, 2
  li a1, S_POP
  li a3, 0x3000
  jal shot
  nop
@nb:
  andi t0, s0, EV_PLACE
  beqz t0, @np
  nop
  li a0, 3
  li a1, S_THUNK
  li a3, 0x3000
  jal shot
  nop
@np:
  andi t0, s0, EV_STEP
  beqz t0, @ns
  nop
  lw t0, V_BLINK(gp)         ; 足音は少しずつ高さをゆらす（同じ音のくり返しに聞こえないように）
  li a2, 0x0780
  andi t0, t0, 3
  sll t0, t0, 5
  addu a2, a2, t0
  li a0, 4
  li a1, S_STEP
  li a3, 0x3800
  jal shot
  nop
@ns:
  andi t0, s0, EV_DENY
  beqz t0, @nn
  nop
  li a0, 5
  li a1, S_DENY
  li a2, 0x0800
  li a3, 0x1c00
  jal shot
  nop
@nn:
  andi t0, s0, EV_MADE
  beqz t0, @nm
  nop
  li a0, 7
  li a1, S_MADE
  li a2, 0x0800
  li a3, 0x2800
  jal shot
  nop
@nm:
  andi t0, s0, EV_WIN
  beqz t0, @nw
  nop
  li a0, 7                   ; のろし: 低めの「ころん」を大きく
  li a1, S_MADE
  li a2, 0x0600
  li a3, 0x3c00
  jal shot
  nop
@nw:
  andi t0, s0, EV_SAVE       ; 子ガメが海に入った: 高い「ころん」
  beqz t0, @nsv
  nop
  li a0, 7
  li a1, S_MADE
  li a2, 0x0c00
  li a3, 0x2000
  jal shot
  nop
@nsv:
  andi t0, s0, EV_STEAL | EV_POKE   ; ヤシガニが持っていった・つついた: 高い「こつっ」
  beqz t0, @nst
  nop
  li a0, 2
  li a1, S_POP
  li a2, 0x0c00
  li a3, 0x2800
  jal shot
  nop
@nst:
  andi t0, s0, EV_CRAB       ; ヤシガニの足音（かさかさ）
  beqz t0, @ncr
  nop
  li a0, 5
  li a1, S_STEP
  li a2, 0x0e00
  li a3, 0x1400
  jal shot
  nop
@ncr:
  andi t0, s0, EV_HATCH      ; 子ガメが出てきた: やわらかく低い「ころん」
  beqz t0, @nh
  nop
  li a0, 7
  li a1, S_MADE
  li a2, 0x0500
  li a3, 0x1c00
  jal shot
  nop
@nh:
  andi t0, s0, EV_LAND
  beqz t0, @end
  nop
  li a0, 6
  li a1, S_LAND
  li a2, 0x0800
  li a3, 0x2800
  jal shot
  nop
@end:
  lw ra, 0(sp)
  lw s0, 4(sp)
  jr ra
  addiu sp, sp, 8

.align 4
; ブロックごとの音の高さ（22050Hz の音を 0x0800 として）: 空気・草・土・石・砂・幹・葉・板・火山ガラス・水・岩盤
sndpitch: .half 0x0800, 0x0700, 0x0680, 0x0980, 0x05c0, 0x0760, 0x0880, 0x0800, 0x0b00, 0x0800, 0x0800
.align 4
