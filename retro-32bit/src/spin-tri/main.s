; 回る三角形（段階A のテストソフト）
;   グーローの背景 → 軌道の円（線）→ 加算の半透明でまわる 8 つの四角（DMA の並べ表で送る）→ まん中で回る三角形。
;   画面は 320×240、VRAM の上（y=0）と下（y=256）を交互に描いて見せる（ダブルバッファ）。
;   遅延スロットとロードの遅れは自分で nop を入れる

IO     = 0x1f801000
GP0    = 0x810
GP1    = 0x814
ISTAT  = 0x070
D2MADR = 0x0a0
D2BCR  = 0x0a4
D2CHCR = 0x0a8
DPCR   = 0x0f0

.org 0x80010000
start:
  li s7, IO
  ; 表示: リセット → 320×240・15ビット → 横・縦の範囲 → 表示の場所 → 表示を入れる
  sw zero, GP1(s7)
  li t0, 0x08000001
  sw t0, GP1(s7)
  li t0, 0x06c60260
  sw t0, GP1(s7)
  li t0, 0x07042018
  sw t0, GP1(s7)
  li t0, 0x05000000
  sw t0, GP1(s7)
  li t0, 0x04000002          ; DMA は CPU → GP0
  sw t0, GP1(s7)
  li t0, 0x03000000
  sw t0, GP1(s7)
  ; 描き方: ディザあり・加算の半透明（モード 1）
  li t0, 0xe1000620
  sw t0, GP0(s7)
  ; DMA の GPU の口を使えるように
  lw t0, DPCR(s7)
  li t1, 0x00000800
  or t0, t0, t1
  sw t0, DPCR(s7)
  li s6, 0                   ; いま描く側（0＝上・1＝下）
  li s5, 0                   ; 角度（0〜255 で 1 周）

frame:
  ; ---- 垂直帰線を待つ ----
@wait:
  lw t0, ISTAT(s7)
  nop
  andi t0, t0, 1
  beqz t0, @wait
  nop
  li t0, -2
  sw t0, ISTAT(s7)

  ; ---- 描きおえた側を見せ、反対側に描く ----
  sll t1, s6, 18             ; 描きおえた側の y（256）<< 10
  li t0, 0x05000000
  or t0, t0, t1
  sw t0, GP1(s7)
  xori s6, s6, 1
  sll s4, s6, 8              ; s4 = 描く側の y（0 か 256）
  sll t1, s4, 10
  li t0, 0xe3000000
  or t0, t0, t1
  sw t0, GP0(s7)             ; 描ける範囲の左上
  addiu t1, s4, 239
  sll t1, t1, 10
  ori t1, t1, 319
  li t0, 0xe4000000
  or t0, t0, t1
  sw t0, GP0(s7)             ; 右下
  addiu t1, s4, 120
  sll t1, t1, 11
  ori t1, t1, 160
  li t0, 0xe5000000
  or t0, t0, t1
  sw t0, GP0(s7)             ; まん中を (0,0) に

  ; ---- 背景: 上は藍、下は深い緑のグーローの四角 ----
  li t0, 0x38301810
  sw t0, GP0(s7)
  li t0, 0xff88ff60          ; (-160,-120)
  sw t0, GP0(s7)
  li t0, 0x00301810
  sw t0, GP0(s7)
  li t0, 0xff8800a0          ; (160,-120)
  sw t0, GP0(s7)
  li t0, 0x00283008
  sw t0, GP0(s7)
  li t0, 0x0078ff60          ; (-160,120)
  sw t0, GP0(s7)
  li t0, 0x00283008
  sw t0, GP0(s7)
  li t0, 0x007800a0          ; (160,120)
  sw t0, GP0(s7)

  ; ---- 軌道の円（線をつなぐ。終わりの印 0x55555555） ----
  li t0, 0x48605040
  sw t0, GP0(s7)
  li s0, 0
@ring:
  move a0, s0
  jal polar
  li a1, 104
  sw v0, GP0(s7)
  addiu s0, s0, 8
  slti t0, s0, 257
  bnez t0, @ring
  nop
  li t0, 0x55555555
  sw t0, GP0(s7)

  ; ---- まわる 8 つの四角を並べ表に作る（1 つ = 頭 1 語 + 色 1 語 + 頂点 4 語） ----
  la s1, pkts
  li s0, 0                   ; 何こ目
@sq:
  ; まん中の位置 = 角度 (k*32 - 2*角度) の向きに 104
  sll a0, s0, 5
  sll t0, s5, 1
  subu a0, a0, t0
  jal polar
  li a1, 104
  move s2, v0                ; s2 = まん中（xy をつめた形）
  ; 頂点 4 つ = まん中 + 角度 (3*角度 + 64*j) の向きに 9
  li s3, 0
@corner:
  sll t0, s3, 6
  sll a0, s5, 1
  addu a0, a0, s5
  addu a0, a0, t0
  jal polar
  li a1, 9
  addu t0, v0, s2            ; x と y を別々に足す（x の繰り上がりが y にまざらないよう、下で直す）
  andi t1, v0, 0xffff
  andi t2, s2, 0xffff
  addu t1, t1, t2
  srl t1, t1, 16             ; 繰り上がり（0 か 1）
  sll t1, t1, 16
  subu t0, t0, t1
  ; 置く場所: pkts + k*24 + 8 + 4*順番。順番は 0,1,3,2（三角形 2 つで四角になる順）
  la t3, order
  addu t3, t3, s3
  lbu t3, 0(t3)
  sll t4, s0, 3
  sll t5, s0, 4
  addu t4, t4, t5            ; k*24
  addu t4, t4, s1
  sll t3, t3, 2
  addu t4, t4, t3
  sw t0, 8(t4)
  addiu s3, s3, 1
  slti t0, s3, 4
  bnez t0, @corner
  nop
  ; 頭と色
  sll t4, s0, 3
  sll t5, s0, 4
  addu t4, t4, t5
  addu t4, t4, s1            ; この四角の頭の番地
  addiu t0, t4, 24           ; つぎの四角
  li t1, 0x00ffffff
  and t0, t0, t1
  li t2, 7
  bne s0, t2, @notlast
  nop
  move t0, t1                ; 最後は 0xffffff（終わり）
@notlast:
  li t1, 0x05000000
  or t0, t0, t1
  sw t0, 0(t4)
  la t1, colors
  sll t2, s0, 2
  addu t1, t1, t2
  lw t1, 0(t1)
  nop
  sw t1, 4(t4)
  addiu s0, s0, 1
  slti t0, s0, 8
  bnez t0, @sq
  nop
  ; DMA で送る（つながったリスト・RAM から）
  sw s1, D2MADR(s7)
  sw zero, D2BCR(s7)
  li t0, 0x01000401
  sw t0, D2CHCR(s7)
@dma:
  lw t0, D2CHCR(s7)
  li t1, 0x01000000
  and t0, t0, t1
  bnez t0, @dma
  nop

  ; ---- まん中の三角形（グーロー: 赤・緑・青） ----
  li t0, 0x300030ff
  sw t0, GP0(s7)
  move a0, s5
  jal polar
  li a1, 84
  sw v0, GP0(s7)
  li t0, 0x0040ff30
  sw t0, GP0(s7)
  addiu a0, s5, 85
  jal polar
  li a1, 84
  sw v0, GP0(s7)
  li t0, 0x00ff6020
  sw t0, GP0(s7)
  addiu a0, s5, 171
  jal polar
  li a1, 84
  sw v0, GP0(s7)

  addiu s5, s5, 1
  andi s5, s5, 255
  j frame
  nop

; a0 = 角度（0〜255）、a1 = 半径 → v0 = (y << 16) | (x & 0xffff)。t0〜t3 をこわす
polar:
  la t1, sintab
  andi t0, a0, 255
  sll t0, t0, 2
  addu t2, t1, t0
  lw t3, 0(t2)               ; sin
  addiu t0, a0, 64
  andi t0, t0, 255
  sll t0, t0, 2
  addu t2, t1, t0
  lw t2, 0(t2)               ; cos
  mult a1, t3
  mflo t3
  sra t3, t3, 12             ; y
  mult a1, t2
  mflo t2
  sra t2, t2, 12             ; x
  andi t2, t2, 0xffff
  sll t3, t3, 16
  jr ra
  or v0, t3, t2

order: .byte 0, 1, 3, 2
.align 4
colors:
  .word 0x2a1040c0, 0x2a2070c0, 0x2a20a0b0, 0x2a40c080
  .word 0x2a80c040, 0x2ac0a020, 0x2ac07020, 0x2ac04060
pkts: .space 192
