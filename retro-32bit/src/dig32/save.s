; ---- セーブ: メモリーカード（口 1）に島と持ち物を書く・読む（main.s のつづき。PLAN.md 6章 段階C）----
;   カードの形（本物と同じ並び）: フレーム 0 が「MC」、1〜15 がブロック 1〜15 の札（A0 空き・51 はじめ・52 なか・53 おわり、
;   次のブロック、名前、最後のバイトは XOR）。1 ブロック = 64 フレーム（8KB）。このソフトはブロック 1〜3（フレーム 64〜255）を使う
;   ブロック 1 のはじめ: フレーム 64 が題（SC・絵の出し方・ブロックの数・題・色 16）、65 が 16×16 の絵、66 から中身
;   中身（savebuf + 256〜）: "DG32"・形（1 = 島をそのまま）・島の長さ・0、変数 256・持ち物 16・たき火 32・打ち上がる物 16、島（ちぢめた形）
;   島のちぢめ方: （同じブロックがつづく数 1〜255, ブロック）の組。ちぢめたほうが長ければ、そのまま
;   書くのは朝になったとき（生き物がいない）と、のろしをあげたとき。読むのは、はじめの画面で「つづき」をえらんだとき

SAVEHDR = 256 + 16 + 256 + 16 + 32 + 16      ; 島の前まで（592）

; 1 バイトやりとり: a0 → v0
cxfer:
  sb a0, JDATA(s7)
@w:
  lw t0, JSTAT(s7)
  nop
  andi t0, t0, 2
  beqz t0, @w
  nop
  lbu v0, JDATA(s7)
  jr ra
  nop

; フレームを読む: a0 = フレーム、a1 = 128 バイトの置き場 → v0 = 1 読めた・0 だめ（カードがない・合計がちがう）
cardread:
  addiu sp, sp, -16
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  sw s2, 12(sp)
  move s0, a0
  move s1, a1
  li t0, 0x0003
  sh t0, JCTRL(s7)
  li a0, 0x81
  jal cxfer
  nop
  li a0, 0x52
  jal cxfer
  nop
  li t0, 0xff                ; カードがなければ FF
  beq v0, t0, @fail
  nop
  li a0, 0
  jal cxfer
  nop
  li a0, 0
  jal cxfer
  nop
  srl a0, s0, 8
  jal cxfer
  nop
  andi a0, s0, 255
  jal cxfer
  nop
  li s2, 4                   ; 5C 5D 上 下
@h:
  li a0, 0
  jal cxfer
  nop
  addiu s2, s2, -1
  bnez s2, @h
  nop
  srl s2, s0, 8              ; 合計
  andi t0, s0, 255
  xor s2, s2, t0
  li t1, 128
@d:
  sw t1, V_TMP(gp)
  li a0, 0
  jal cxfer
  nop
  sb v0, 0(s1)
  xor s2, s2, v0
  addiu s1, s1, 1
  lw t1, V_TMP(gp)
  nop
  addiu t1, t1, -1
  bnez t1, @d
  nop
  li a0, 0
  jal cxfer
  nop
  bne v0, s2, @fail
  nop
  li a0, 0
  jal cxfer
  nop
  li t0, 0x47
  bne v0, t0, @fail
  nop
  sh zero, JCTRL(s7)
  b @out
  li v0, 1
@fail:
  sh zero, JCTRL(s7)
  li v0, 0
@out:
  lw ra, 0(sp)
  lw s0, 4(sp)
  lw s1, 8(sp)
  lw s2, 12(sp)
  jr ra
  addiu sp, sp, 16

; フレームを書く: a0 = フレーム、a1 = 128 バイト → v0 = 1 書けた・0 だめ
cardwrite:
  addiu sp, sp, -16
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  sw s2, 12(sp)
  move s0, a0
  move s1, a1
  li t0, 0x0003
  sh t0, JCTRL(s7)
  li a0, 0x81
  jal cxfer
  nop
  li a0, 0x57
  jal cxfer
  nop
  li t0, 0xff
  beq v0, t0, @fail
  nop
  li a0, 0
  jal cxfer
  nop
  li a0, 0
  jal cxfer
  nop
  srl a0, s0, 8
  jal cxfer
  nop
  andi a0, s0, 255
  jal cxfer
  nop
  srl s2, s0, 8
  andi t0, s0, 255
  xor s2, s2, t0
  li t1, 128
@d:
  lbu a0, 0(s1)
  sw t1, V_TMP(gp)
  xor s2, s2, a0
  jal cxfer
  nop
  addiu s1, s1, 1
  lw t1, V_TMP(gp)
  nop
  addiu t1, t1, -1
  bnez t1, @d
  nop
  move a0, s2
  jal cxfer
  nop
  li a0, 0
  jal cxfer
  nop
  li a0, 0
  jal cxfer
  nop
  li a0, 0
  jal cxfer
  nop
  li t0, 0x47
  bne v0, t0, @fail
  nop
  sh zero, JCTRL(s7)
  b @out
  li v0, 1
@fail:
  sh zero, JCTRL(s7)
  li v0, 0
@out:
  lw ra, 0(sp)
  lw s0, 4(sp)
  lw s1, 8(sp)
  lw s2, 12(sp)
  jr ra
  addiu sp, sp, 16

; ブロック 1〜3 の札を読んで、このソフトが使えるか → v0 = 0 使えない・1 空き・2 このソフトのセーブがある
cardslots:
  addiu sp, sp, -12
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  li s0, 1
  li s1, 1                   ; 1 = みな空き（とちゅうで 2 か 0 に）
@f:
  move a0, s0
  la a1, framebuf
  jal cardread
  nop
  beqz v0, @no
  nop
  la t0, framebuf
  lbu t1, 0(t0)
  li t2, 0xa0
  beq t1, t2, @next          ; 空き
  nop
  la t3, dirtab              ; このソフトの名前（10〜25 バイト目）か
  addiu t4, s0, -1
  sll t4, t4, 7
  addu t3, t3, t4
  li t4, 10
@c:
  addu t5, t0, t4
  lbu t5, 0(t5)
  addu t6, t3, t4
  lbu t6, 0(t6)
  nop
  bne t5, t6, @no
  nop
  addiu t4, t4, 1
  slti t5, t4, 26
  bnez t5, @c
  nop
  li s1, 2
@next:
  addiu s0, s0, 1
  slti t0, s0, 4
  bnez t0, @f
  nop
  b @out
  move v0, s1
@no:
  li v0, 0
@out:
  lw ra, 0(sp)
  lw s0, 4(sp)
  lw s1, 8(sp)
  jr ra
  addiu sp, sp, 12

; セーブがあるか見て、その日の数を V_SDAY へ → v0 = 1 ある
peeksave:
  addiu sp, sp, -8
  sw ra, 0(sp)
  jal cardslots
  nop
  li t0, 2
  bne v0, t0, @none
  nop
  li a0, 66                  ; 中身のはじめ（"DG32"・変数）
  la a1, savebuf + 256
  jal cardread
  nop
  beqz v0, @none
  nop
  li a0, 67
  la a1, savebuf + 384
  jal cardread
  nop
  beqz v0, @none
  nop
  la t0, savebuf + 256
  lw t1, 0(t0)
  li t2, 0x32334744          ; "DG32"
  bne t1, t2, @none
  nop
  lw t1, 16 + V_DAY(t0)
  nop
  sw t1, V_SDAY(gp)
  b @out
  li v0, 1
@none:
  li v0, 0
@out:
  lw ra, 0(sp)
  nop
  jr ra
  addiu sp, sp, 8

; セーブする → v0 = 1 書けた・0 だめ（カードがない・ほかのセーブでふさがっている）
savegame:
  addiu sp, sp, -16
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  sw s2, 12(sp)
  jal cardslots
  nop
  beqz v0, @fail
  nop
  ; 題と絵（決まった 2 フレーム）
  la t0, savetitle
  la t1, savebuf
  li t2, 64
@cp:
  lw t3, 0(t0)
  addiu t0, t0, 4
  sw t3, 0(t1)
  addiu t2, t2, -1
  bnez t2, @cp
  addiu t1, t1, 4
  ; 頭と、変数・持ち物・たき火・打ち上がる物
  la s0, savebuf + 256
  li t0, 0x32334744
  sw t0, 0(s0)
  sw zero, 4(s0)
  sw zero, 12(s0)
  addiu t1, s0, 16
  move t0, gp
  li t2, 64
@cv:
  lw t3, 0(t0)
  addiu t0, t0, 4
  sw t3, 0(t1)
  addiu t2, t2, -1
  bnez t2, @cv
  addiu t1, t1, 4
  la t0, inv
  li t2, 4
@ci:
  lw t3, 0(t0)
  addiu t0, t0, 4
  sw t3, 0(t1)
  addiu t2, t2, -1
  bnez t2, @ci
  addiu t1, t1, 4
  la t0, fires
  li t2, 8
@cf:
  lw t3, 0(t0)
  addiu t0, t0, 4
  sw t3, 0(t1)
  addiu t2, t2, -1
  bnez t2, @cf
  addiu t1, t1, 4
  la t0, washed
  li t2, 4
@cw:
  lw t3, 0(t0)
  addiu t0, t0, 4
  sw t3, 0(t1)
  addiu t2, t2, -1
  bnez t2, @cw
  addiu t1, t1, 4
  ; 島をちぢめる（同じブロックの続きを 数・ブロック の組に）。長くなりそうならそのまま
  la t0, world
  la t1, savebuf + SAVEHDR
  li t2, W * D * H           ; のこり
  la t9, savebuf + SAVEHDR + W * D * H - 2   ; ここまで来たら、ちぢめるのをやめる
@rl:
  lbu t3, 0(t0)
  li t4, 1
@rr:
  addu t5, t0, t4
  slt t6, t4, t2
  beqz t6, @re
  slti t6, t4, 255
  beqz t6, @re
  nop
  lbu t5, 0(t5)
  nop
  bne t5, t3, @re
  nop
  b @rr
  addiu t4, t4, 1
@re:
  sb t4, 0(t1)
  sb t3, 1(t1)
  addiu t1, t1, 2
  addu t0, t0, t4
  subu t2, t2, t4
  slt t6, t1, t9
  beqz t6, @raw
  nop
  bnez t2, @rl
  nop
  la t0, savebuf + SAVEHDR
  subu t1, t1, t0
  sw t1, 8(s0)               ; 島の長さ
  b @wr
  nop
@raw:
  li t0, 1                   ; そのまま
  sw t0, 4(s0)
  li t0, W * D * H
  sw t0, 8(s0)
  la t0, world
  la t1, savebuf + SAVEHDR
  li t2, W * D * H / 4
@rw:
  lw t3, 0(t0)
  addiu t0, t0, 4
  sw t3, 0(t1)
  addiu t2, t2, -1
  bnez t2, @rw
  addiu t1, t1, 4
@wr:
  ; フレームの数 =（SAVEHDR + 島の長さ + 127）/ 128
  lw t0, 8(s0)
  nop
  addiu t0, t0, SAVEHDR + 127
  srl s1, t0, 7
  li s0, 0
  la s2, savebuf
@wf:
  addiu a0, s0, 64
  move a1, s2
  jal cardwrite
  nop
  beqz v0, @fail
  nop
  addiu s0, s0, 1
  addiu s2, s2, 128
  bne s0, s1, @wf
  nop
  ; さいごにブロックの札（書きおわってから札を立てる）
  li s0, 1
  la s2, dirtab
@wd:
  move a0, s0
  move a1, s2
  jal cardwrite
  nop
  beqz v0, @fail
  nop
  addiu s0, s0, 1
  addiu s2, s2, 128
  slti t0, s0, 4
  bnez t0, @wd
  nop
  b @out
  li v0, 1
@fail:
  li v0, 0
@out:
  lw ra, 0(sp)
  lw s0, 4(sp)
  lw s1, 8(sp)
  lw s2, 12(sp)
  jr ra
  addiu sp, sp, 16

; セーブを読む → v0 = 1 読めた（島・変数・持ち物をもどした）・0 だめ
loadgame:
  addiu sp, sp, -16
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  sw s2, 12(sp)
  li s0, 0                   ; フレーム 66〜255 を savebuf + 256 へ
  la s2, savebuf + 256
@rf:
  addiu a0, s0, 66
  move a1, s2
  jal cardread
  nop
  beqz v0, @fail
  nop
  addiu s0, s0, 1
  addiu s2, s2, 128
  slti t0, s0, 190
  bnez t0, @rf
  nop
  la s0, savebuf + 256
  lw t1, 0(s0)
  li t2, 0x32334744
  bne t1, t2, @fail
  nop
  addiu t1, s0, 16           ; 変数・持ち物・たき火・打ち上がる物をもどす
  move t0, gp
  li t2, 64
@lv:
  lw t3, 0(t1)
  addiu t1, t1, 4
  sw t3, 0(t0)
  addiu t2, t2, -1
  bnez t2, @lv
  addiu t0, t0, 4
  la t0, inv
  li t2, 4
@li:
  lw t3, 0(t1)
  addiu t1, t1, 4
  sw t3, 0(t0)
  addiu t2, t2, -1
  bnez t2, @li
  addiu t0, t0, 4
  la t0, fires
  li t2, 8
@lf:
  lw t3, 0(t1)
  addiu t1, t1, 4
  sw t3, 0(t0)
  addiu t2, t2, -1
  bnez t2, @lf
  addiu t0, t0, 4
  la t0, washed
  li t2, 4
@lw:
  lw t3, 0(t1)
  addiu t1, t1, 4
  sw t3, 0(t0)
  addiu t2, t2, -1
  bnez t2, @lw
  addiu t0, t0, 4
  ; 島をもどす
  lw t4, 4(s0)
  la t1, savebuf + SAVEHDR
  la t0, world
  bnez t4, @lraw
  nop
  li t2, W * D * H
@ld:
  lbu t3, 0(t1)              ; 数
  lbu t4, 1(t1)              ; ブロック
  addiu t1, t1, 2
  beqz t3, @fail
  nop
@lp:
  sb t4, 0(t0)
  addiu t0, t0, 1
  addiu t2, t2, -1
  blez t2, @ok
  addiu t3, t3, -1
  bnez t3, @lp
  nop
  b @ld
  nop
@lraw:
  li t2, W * D * H / 4
@lr:
  lw t3, 0(t1)
  addiu t1, t1, 4
  sw t3, 0(t0)
  addiu t2, t2, -1
  bnez t2, @lr
  addiu t0, t0, 4
@ok:
  b @out
  li v0, 1
@fail:
  li v0, 0
@out:
  lw ra, 0(sp)
  lw s0, 4(sp)
  lw s1, 8(sp)
  lw s2, 12(sp)
  jr ra
  addiu sp, sp, 16

.align 4
framebuf: .space 128
savebuf:  .space 192 * 128
