; ---- 絵: 水・光の筋・マリンスノー・プランクトン・捕食者・見上げた画面・字（main.s のつづき） ----
;   ART.md: 一色の多角形のふちを見せない（グーローと加算の重ねでぼかす）

; 場面をまるごと描く（V_TH が 32 より小さければ横の画面、大きければ見上げた画面）
scene:
  addiu sp, sp, -8
  sw ra, 0(sp)
  lw t0, V_TH(gp)
  nop
  slti t1, t0, 32
  beqz t1, @up
  nop
  ; ---- 横の画面 ----
  ; 水: 上のふちと下のふちの光の色のグーロー
  lw a0, V_ITOP(gp)
  jal palc
  nop
  move t8, v0
  lw a0, V_IBOT(gp)
  jal palc
  nop
  li t0, 0x38000000
  or t0, t0, t8
  sw t0, GP0(s7)
  li t0, 0xff88ff60          ; (−160,−120)
  sw t0, GP0(s7)
  sw t8, GP0(s7)
  li t0, 0xff8800a0          ; (160,−120)
  sw t0, GP0(s7)
  sw v0, GP0(s7)
  li t0, 0x0078ff60          ; (−160,120)
  sw t0, GP0(s7)
  sw v0, GP0(s7)
  li t0, 0x007800a0          ; (160,120)
  sw t0, GP0(s7)
  jal snow
  nop
  jal plkdraw
  nop
  jal predside
  nop
  li a0, 0
  jal fishdraw
  nop
  jal photodraw
  nop
  jal rays
  nop
  b @fade
  nop
@up:
  ; ---- 見上げた画面: 上からの光の円と、魚の腹のシルエット ----
  ;   捕食者の目は暗さに慣れている: 円はいつも同じ明るさに見せ、魚の影は腹の光と上の光の差だけで明るさが変わる
  jal discbase
  nop
  lw t0, V_BASE(gp)          ; まわり = 円の色の 1/8
  nop
  srl t0, t0, 3
  li t1, 0x001f1f1f
  and t0, t0, t1
  li t1, 0x28000000
  or t0, t0, t1
  sw t0, GP0(s7)
  li t0, 0xff88ff60
  sw t0, GP0(s7)
  li t0, 0xff8800a0
  sw t0, GP0(s7)
  li t0, 0x0078ff60
  sw t0, GP0(s7)
  li t0, 0x007800a0
  sw t0, GP0(s7)
  jal disc
  nop
  li a0, 1
  jal fishdraw
  nop
  jal photodraw
  nop
  jal predup
  nop
  ; 案内: A＋ B−（上のまん中。目の輪からはなす。はじめの3回だけ）
  lw t0, V_LOOKS(gp)
  nop
  slti t0, t0, 4
  beqz t0, @fade
  nop
  la a0, s_hint
  li a1, -36
  li a2, -112
  li a3, 0x00c8d0d8
  jal text
  nop
@fade:
  ; 見つかったとき: 引き算の半透明で暗くする
  lw t0, V_FADE(gp)
  nop
  blez t0, @nofade
  nop
  li t1, 0xe1000640
  sw t1, GP0(s7)
  sll t1, t0, 8
  or t1, t1, t0
  sll t1, t1, 8
  or t1, t1, t0
  li t2, 0x2a000000
  or t1, t1, t2
  sw t1, GP0(s7)
  li t0, 0xff88ff60
  sw t0, GP0(s7)
  li t0, 0xff8800a0
  sw t0, GP0(s7)
  li t0, 0x0078ff60
  sw t0, GP0(s7)
  li t0, 0x007800a0
  sw t0, GP0(s7)
  li t1, 0xe1000620
  sw t1, GP0(s7)
@nofade:
  lw ra, 0(sp)
  addiu sp, sp, 8
  jr ra
  nop

; a0 = 光の段（0〜255）→ v0 = 水の色（0x00BBGGRR）
palc:
  bgez a0, @p1
  nop
  li a0, 0
@p1:
  slti v0, a0, 256
  bnez v0, @p2
  nop
  li a0, 255
@p2:
  la v0, pal
  sll a0, a0, 2
  addu v0, v0, a0
  lw v0, 0(v0)
  jr ra
  nop

; 光の筋: ふちが 0・まん中だけうすい加算のグーローの帯を 6 本（上が明るいときだけ。600m より深いと消える）。±4px でゆれる
rays:
  lw t0, V_ITOP(gp)
  nop
  addiu t9, t0, -150
  blez t9, @none
  nop
  lw t3, V_T(gp)
  la t4, sintab
  sll t3, t3, 1
  andi t3, t3, 255
  sll t3, t3, 2
  addu t4, t4, t3
  lw t8, 0(t4)
  nop
  sra t8, t8, 10             ; ゆれ ±4
  la t5, raytab
  li t6, 6
@r:
  lh t0, 4(t5)               ; この帯の強さ（8〜16）
  nop
  mult t0, t9
  mflo t0
  sra t0, t0, 5              ; v（0〜52）
  srl t1, t0, 2
  addu t1, t1, t0
  srl t1, t1, 1              ; G = v × 5/8
  sll t1, t1, 8
  srl t2, t0, 2              ; R = v/4
  or t1, t1, t2
  sll t2, t0, 16             ; B = v
  or a3, t1, t2              ; まん中の色
  lh a1, 0(t5)               ; 上の x
  lh a2, 2(t5)               ; 上の半分の幅
  addu a1, a1, t8
  addiu v1, a1, 70           ; 下の x
  ; 左の半分: 左のふち（0）→ まん中（色）
  li t0, 0x3a000000
  sw t0, GP0(s7)
  subu t0, a1, a2
  andi t0, t0, 0xffff
  li t1, 0xff880000
  or t0, t0, t1
  sw t0, GP0(s7)
  sw a3, GP0(s7)
  andi t0, a1, 0xffff
  or t0, t0, t1
  sw t0, GP0(s7)
  sw zero, GP0(s7)
  sll t2, a2, 1
  subu t0, v1, t2
  andi t0, t0, 0xffff
  li t1, 0x00780000
  or t0, t0, t1
  sw t0, GP0(s7)
  sw a3, GP0(s7)
  andi t0, v1, 0xffff
  or t0, t0, t1
  sw t0, GP0(s7)
  ; 右の半分: まん中（色）→ 右のふち（0）
  li t0, 0x3a000000
  or t0, t0, a3
  sw t0, GP0(s7)
  andi t0, a1, 0xffff
  li t1, 0xff880000
  or t0, t0, t1
  sw t0, GP0(s7)
  sw zero, GP0(s7)
  addu t0, a1, a2
  andi t0, t0, 0xffff
  or t0, t0, t1
  sw t0, GP0(s7)
  sw a3, GP0(s7)
  andi t0, v1, 0xffff
  li t1, 0x00780000
  or t0, t0, t1
  sw t0, GP0(s7)
  sw zero, GP0(s7)
  sll t2, a2, 1
  addu t0, v1, t2
  andi t0, t0, 0xffff
  or t0, t0, t1
  sw t0, GP0(s7)
  addiu t6, t6, -1
  bnez t6, @r
  addiu t5, t5, 6
@none:
  jr ra
  nop

; マリンスノー: 2 層の視差（手前は速く明るく、奥はゆっくり暗く）
snowinit:
  move t9, ra
  la t8, snowp
  li t7, NSNOW
@si:
  jal rand
  nop
  andi t0, v0, 0x1fff        ; x ×16（0〜511）→ −160〜
  addiu t0, t0, -2560
  sw t0, 0(t8)
  srl t0, v0, 16
  andi t0, t0, 0xfff         ; 深さ ×16（0〜255）
  sw t0, 4(t8)
  addiu t7, t7, -1
  bnez t7, @si
  addiu t8, t8, 8
  jr t9
  nop
snow:
  la t8, snowp
  li t7, NSNOW
  lw t6, V_FD(gp)
  nop
  sra t6, t6, 4
@s:
  andi t9, t7, 1             ; 1 = 奥の層
  lw t0, 0(t8)
  li t2, -6
  beqz t9, @s0
  nop
  li t2, -3
@s0:
  addu t0, t0, t2
  li t1, -2600
  slt t1, t0, t1
  beqz t1, @s1
  nop
  addiu t0, t0, 5200
@s1:
  sw t0, 0(t8)
  lw t1, 4(t8)
  nop
  subu t1, t1, t6
  sll t2, t1, 1
  addu t1, t1, t2            ; ×3
  sra t1, t1, 4
  beqz t9, @s2
  nop
  sra t1, t1, 1              ; 奥は半分しか動かない
@s2:
  addiu t1, t1, 128
  andi t1, t1, 255
  addiu t1, t1, -128         ; −128〜127 で折り返す
  sra t0, t0, 4
  li t2, 0x6a222428          ; 手前（1 点・加算）
  beqz t9, @s3
  nop
  li t2, 0x6a0e1012          ; 奥
@s3:
  sw t2, GP0(s7)
  sll t1, t1, 16
  andi t0, t0, 0xffff
  or t0, t0, t1
  sw t0, GP0(s7)
  addiu t7, t7, -1
  bnez t7, @s
  addiu t8, t8, 8
  jr ra
  nop

; プランクトン: 青緑にまたたく点（3×3 のにじみ＋まん中の 1 点）
plkdraw:
  la t8, plk
  li t7, NPLK
  lw t6, V_FD(gp)
  nop
  sra t6, t6, 4
@p:
  lw t0, 8(t8)
  nop
  beqz t0, @pn
  nop
  lw t1, 4(t8)
  lw t0, 0(t8)
  subu t1, t1, t6
  sll t2, t1, 1
  addu t1, t1, t2
  sra t1, t1, 4              ; 画面の y
  addiu t2, t1, 124
  sltiu t2, t2, 248
  beqz t2, @pn
  nop
  sra t0, t0, 4
  lw t3, V_T(gp)             ; またたき: 時刻と番号で明るさをかえる
  nop
  addu t3, t3, t7
  sll t3, t3, 3
  andi t3, t3, 0x3f
  addiu t3, t3, 0x30         ; 0x30〜0x6f
  sll t4, t3, 8
  sll t5, t3, 16
  or t4, t4, t5
  srl t5, t3, 2
  or t4, t4, t5              ; 0x00 t t t/4（青緑）
  li t5, 0x62000000
  or t5, t5, t4
  sw t5, GP0(s7)             ; にじみ 3×3（加算）
  addiu t2, t1, -1
  sll t2, t2, 16
  addiu t5, t0, -1
  andi t5, t5, 0xffff
  or t2, t2, t5
  sw t2, GP0(s7)
  li t5, 0x00030003
  sw t5, GP0(s7)
  li t5, 0x6a60f0c0          ; まん中の 1 点
  sw t5, GP0(s7)
  sll t2, t1, 16
  andi t5, t0, 0xffff
  or t2, t2, t5
  sw t2, GP0(s7)
@pn:
  addiu t7, t7, -1
  bnez t7, @p
  addiu t8, t8, 12
  jr ra
  nop

; 捕食者（横の画面）: 下の暗がりから上がる、デメニギスのなかま。体は背のつやのあるグーロー、
;   頭はすき通ったドーム（加算）、上を向いた筒の目は緑の反射（ART.md）
predside:
  lw t0, V_EYE(gp)
  nop
  blez t0, @ps
  nop
  move s0, ra                ; s0 はここでは使ってよい（scene のあいだは決まりの値を持たない）
  srl t0, t0, 1
  li t1, 178
  subu t9, t1, t0            ; 体の y（178 → 58）
  la t6, predshape
  li t5, 15
@pf:
  li t0, 0x301c1618          ; まん中 #18161c
  sw t0, GP0(s7)
  sll t0, t9, 16
  li t1, 0xffce              ; まん中 x = −50
  or t0, t0, t1
  sw t0, GP0(s7)
  lh t0, 0(t6)
  lh t1, 2(t6)
  bal @pp
  nop
  lh t0, 4(t6)
  lh t1, 6(t6)
  bal @pp
  nop
  addiu t5, t5, -1
  bnez t5, @pf
  addiu t6, t6, 4
  ; 大きなむなびれ（デメニギスのしるし。少しすけた暗い三角）
  li t0, 0x22201a18
  sw t0, GP0(s7)
  addiu t1, t9, 6
  sll t1, t1, 16
  ori t1, t1, 0xfff6         ; (−10, y+6)
  sw t1, GP0(s7)
  addiu t1, t9, 26
  sll t1, t1, 16
  ori t1, t1, 0xffd8         ; (−40, y+26)
  sw t1, GP0(s7)
  addiu t1, t9, 20
  sll t1, t1, 16
  ori t1, t1, 0xfffc         ; (−4, y+20)
  sw t1, GP0(s7)
  ; すき通った頭（加算のドーム 35%）
  li a0, 0x00221f14
  sw zero, V_RIM(gp)
  li a1, 0
  addiu a2, t9, -4
  li a3, 22
  li v1, 12
  jal blob
  nop
  ; 上を向いた目（緑の反射。にじみ＋しん）
  li a0, 0x00306a38
  sw zero, V_RIM(gp)
  li a1, 0
  addiu a2, t9, -13
  li a3, 10
  li v1, 7
  jal blob
  nop
  ; しん: 上を向いた筒の目を 2 つ（3×3、#6fe08a）
  li t0, 0x608ae06f
  sw t0, GP0(s7)
  addiu t1, t9, -15
  sll t1, t1, 16
  ori t1, t1, 0xfffe         ; (−2, y−15)
  sw t1, GP0(s7)
  li t1, 0x00030003
  sw t1, GP0(s7)
  sw t0, GP0(s7)
  addiu t1, t9, -14
  sll t1, t1, 16
  ori t1, t1, 0xfff8         ; (−8, y−14)
  sw t1, GP0(s7)
  li t1, 0x00030003
  sw t1, GP0(s7)
  move ra, s0
@ps:
  jr ra
  nop
@pp:                          ; t0, t1 = 形の点 → 色（上はつや #2a2630、下は #0e0c10）と点を送る
  li t2, 0x0030262a
  bltz t1, @pp1
  nop
  li t2, 0x00100c0e
@pp1:
  sw t2, GP0(s7)
  addiu t0, t0, -40
  addu t1, t1, t9
  sll t1, t1, 16
  andi t0, t0, 0xffff
  or t0, t0, t1
  sw t0, GP0(s7)
  jr ra
  nop

; やわらかい光のかたまり（加算のグーローの扇 16 枚）: a1 = x、a2 = y、a3 = 横の半径、v1 = たての半径、
;   a0 = まん中の色、V_RIM = ふちの色（0 なら消えるようにぼける）
blob:
  move t2, ra
  lw t8, V_RIM(gp)
  la t3, sintab
  li t4, 0
  lw t9, V_CMD(gp)
  nop
  sll t9, t9, 24
  or t9, t9, a0
@b:
  sw t9, GP0(s7)
  sll t0, a2, 16
  andi t1, a1, 0xffff
  or t0, t0, t1
  sw t0, GP0(s7)
  move v0, t4
  bal @bp
  nop
  addiu v0, t4, 1
  bal @bp
  nop
  addiu t4, t4, 1
  slti t0, t4, 16
  bnez t0, @b
  nop
  jr t2
  nop
@bp:                          ; v0 = 番号 → ふちの色と点を送る
  sw t8, GP0(s7)
  sll t5, v0, 4
  andi t5, t5, 255
  sll t5, t5, 2
  addu t6, t3, t5
  lw t6, 0(t6)               ; sin
  addiu t5, t5, 256
  andi t5, t5, 1023
  addu t7, t3, t5
  lw t7, 0(t7)               ; cos
  mult t6, v1
  mflo t6
  sra t6, t6, 12
  addu t6, t6, a2
  mult t7, a3
  mflo t7
  sra t7, t7, 12
  addu t7, t7, a1
  sll t6, t6, 16
  andi t7, t7, 0xffff
  or t6, t6, t7
  sw t6, GP0(s7)
  jr ra
  nop

; 光の円の色（V_BASE）: 空の明るさで、昼の青（40,110,170）〜 夜の寒い青（36,54,90）
discbase:
  lw t0, V_SKY(gp)
  nop
  addiu t0, t0, -158
  li t1, 461                 ; ×256/142
  mult t0, t1
  mflo t0
  sra t0, t0, 8
  bgez t0, @db1
  nop
  li t0, 0
@db1:
  slti t1, t0, 257
  bnez t1, @db2
  nop
  li t0, 256
@db2:
  sw t0, V_RIM(gp)           ; 昼の割合（0〜256）をいったんここに
  la t4, discday
  li t5, 0
  li v0, 0
@dbc:
  addu t6, t4, t5
  lbu t1, 0(t6)              ; 昼
  lbu t2, 3(t6)              ; 夜
  nop
  subu t3, t1, t2
  mult t3, t0
  mflo t3
  sra t3, t3, 8
  addu t3, t3, t2
  sll t6, t5, 3
  sllv t3, t3, t6
  or v0, v0, t3
  addiu t5, t5, 1
  slti t6, t5, 3
  bnez t6, @dbc
  nop
  jr ra
  sw v0, V_BASE(gp)

; 見上げた画面の光の円: 同心のだ円 4 枚（100/80/55/30%）を、ふちが 0 の加算で重ねる。まん中ほど明るく、ふちはぼける。夜は小さい
disc:
  addiu sp, sp, -8
  sw ra, 0(sp)
  lw t0, V_RIM(gp)           ; 昼の割合（discbase が入れた）
  nop
  li t1, 30
  mult t0, t1
  mflo s1
  sra s1, s1, 8
  addiu s1, s1, 120          ; 横の半径 120〜150
  li t1, 22
  mult t0, t1
  mflo s2
  sra s2, s2, 8
  addiu s2, s2, 88           ; たて 88〜110
  lw a0, V_BASE(gp)          ; 1 枚の色 = 円の色の 5/16、ふちは 0（4 枚がやわらかく重なり、まん中は 1.25 倍）
  li a1, 1280
  jal shade
  nop
  move s3, v0
  sw zero, V_RIM(gp)
  la s4, disck
  li s5, 4
@d:
  lbu t0, 0(s4)
  nop
  mult s1, t0
  mflo a3
  sra a3, a3, 8
  mult s2, t0
  mflo v1
  sra v1, v1, 8
  move a0, s3
  li a1, 0
  li a2, -10
  jal blob
  nop
  addiu s5, s5, -1
  bnez s5, @d
  addiu s4, s4, 1
  ; 光の模様: 細い加算の帯 3 本が、ゆっくり回ってゆれる（水面のゆらぎが届いたように）
  lw t0, V_BASE(gp)
  nop
  srl s3, t0, 4              ; 色の 1/16（うすく）
  li t1, 0x000f0f0f
  and s3, s3, t1
  li t0, 0x2a000000
  or s3, s3, t0              ; 加算の四角＋色
  la s4, sintab
  li s5, 0
@sh:
  lw t0, V_T(gp)
  sll t1, s5, 6
  addu t1, t1, s5
  addu t1, t1, s5            ; k × 66
  srl t0, t0, 2
  addu t0, t0, t1            ; 角度
  andi t0, t0, 255
  sll t1, t0, 2
  addu t2, s4, t1
  lw t2, 0(t2)               ; sin
  addiu t1, t1, 256
  andi t1, t1, 1023
  addu t3, s4, t1
  lw t3, 0(t3)               ; cos
  li t4, 110
  mult t3, t4
  mflo t5
  sra t5, t5, 12             ; d.x
  mult t2, t4
  mflo t6
  sra t6, t6, 12             ; d.y（だ円なので 3/4 に）
  sra t7, t6, 2
  subu t6, t6, t7
  sra t7, t2, 10             ; n.x = −sin × 4
  subu t7, zero, t7
  sra t8, t3, 10             ; n.y = cos × 4
  sw s3, GP0(s7)
  subu a0, zero, t5          ; c − d − n
  subu a0, a0, t7
  subu a1, zero, t6
  subu a1, a1, t8
  addiu a1, a1, -10
  sll a1, a1, 16
  andi a0, a0, 0xffff
  or a0, a0, a1
  sw a0, GP0(s7)
  subu a0, t5, t7            ; c + d − n
  subu a1, t6, t8
  addiu a1, a1, -10
  sll a1, a1, 16
  andi a0, a0, 0xffff
  or a0, a0, a1
  sw a0, GP0(s7)
  subu a0, t7, t5            ; c − d + n
  subu a1, t8, t6
  addiu a1, a1, -10
  sll a1, a1, 16
  andi a0, a0, 0xffff
  or a0, a0, a1
  sw a0, GP0(s7)
  addu a0, t5, t7            ; c + d + n
  addu a1, t6, t8
  addiu a1, a1, -10
  sll a1, a1, 16
  andi a0, a0, 0xffff
  or a0, a0, a1
  sw a0, GP0(s7)
  addiu s5, s5, 1
  slti t0, s5, 3
  bnez t0, @sh
  nop
  lw ra, 0(sp)
  addiu sp, sp, 8
  jr ra
  nop

; 見上げた画面の捕食者の目（下に2つ）: 気づいていないと細く閉じた緑、疑いで大きく丸く、だいだいへ。ボタンに見えないよう、塗りのにじみで
predup:
  move s0, ra
  lw t0, V_SUS(gp)
  nop
  sll t1, t0, 3
  addu t1, t1, t0
  addu t1, t1, t0
  addu t1, t1, t0
  addu t1, t1, t0
  sra t1, t1, 3              ; 疑いの割合（×13/8 ≒ 256/160）
  slti t2, t1, 257
  bnez t2, @pu1
  nop
  li t1, 256
@pu1:
  la t4, eyecol
  li t5, 0
  li s1, 0
@pc:
  addu t6, t4, t5
  lbu t2, 0(t6)              ; 落ちついた色
  lbu t3, 3(t6)              ; 見つけそうな色
  nop
  subu t3, t3, t2
  mult t3, t1
  mflo t3
  sra t3, t3, 8
  addu t3, t3, t2
  sll t6, t5, 3
  sllv t3, t3, t6
  or s1, s1, t3              ; 目の色
  addiu t5, t5, 1
  slti t6, t5, 3
  bnez t6, @pc
  nop
  li t1, 10
  divu t0, t1
  mflo s2
  addiu s2, s2, 6            ; 横の半径 6〜22
  sll s3, t0, 2
  addu s3, s3, t0
  srl s3, s3, 5
  addiu s3, s3, 1            ; たて 1（閉じている）〜 26
  li s4, -70
@eye:
  srl a0, s1, 2              ; にじみ（色の 1/4、ふちは 0）
  li t0, 0x003f3f3f
  and a0, a0, t0
  sw zero, V_RIM(gp)
  move a1, s4
  li a2, 72
  sll a3, s2, 1
  addiu a3, a3, 4
  sll v1, s3, 1
  addiu v1, v1, 4
  jal blob
  nop
  srl t0, s1, 1              ; しん（ふちは半分）
  li t1, 0x007f7f7f
  and t0, t0, t1
  sw t0, V_RIM(gp)
  move a0, s1
  move a1, s4
  li a2, 72
  move a3, s2
  move v1, s3
  jal blob
  nop
  ; ひとみ（黒・不透明）。目が開いているときだけ
  slti t0, s3, 9
  bnez t0, @nop
  nop
  li t0, 0x30
  sw t0, V_CMD(gp)
  sw zero, V_RIM(gp)
  li a0, 0
  move a1, s4
  li a2, 70                  ; 魚のほう（上）へ寄せる＝魚を見ている
  li a3, 6
  li v1, 6
  jal blob
  nop
  li t0, 0x32
  sw t0, V_CMD(gp)
@nop:
  li t0, 70
  bne s4, t0, @eye
  li s4, 70
  jr s0
  nop

; ---- 字（5×7 のドット字。V_SCL 倍） ----
; a0 = 字の番号の列（0xff で終わり・0xfe はすきま）、a1 = x、a2 = y、a3 = 色
text:
  lw t9, V_SCL(gp)
  li t0, 0x60000000
  or a3, a3, t0              ; 四角（大きさは語で）
  sll t8, t9, 16
  or t8, t8, t9              ; 大きさの語
@ch:
  lbu t0, 0(a0)
  nop
  li t1, 0xff
  beq t0, t1, @done
  nop
  li t1, 0xfe
  beq t0, t1, @adv
  nop
  la t1, font
  sll t2, t0, 3
  subu t2, t2, t0            ; ×7
  addu t1, t1, t2
  move t2, a2                ; 行の y
  li t3, 7
@row:
  lbu t4, 0(t1)
  move t5, a1                ; 列の x
  li t6, 16
@col:
  and t7, t4, t6
  beqz t7, @off
  nop
  sw a3, GP0(s7)
  sll t7, t2, 16
  andi v1, t5, 0xffff
  or t7, t7, v1
  sw t7, GP0(s7)
  sw t8, GP0(s7)
@off:
  addu t5, t5, t9
  srl t6, t6, 1
  bnez t6, @col
  nop
  addu t2, t2, t9
  addiu t3, t3, -1
  bnez t3, @row
  addiu t1, t1, 1
@adv:
  sll t0, t9, 2
  addu t0, t0, t9
  addu t0, t0, t9            ; 6 × 大きさ
  addu a1, a1, t0
  b @ch
  addiu a0, a0, 1
@done:
  jr ra
  nop

; a0 = 数 → 字の番号の列を numbuf に作って text へ（a1・a2・a3 はそのまま）
num:
  la t0, numbuf + 7
  li t1, 0xff
  sb t1, 0(t0)
  li t2, 10
@n:
  divu a0, t2
  mfhi t3
  mflo a0
  addiu t0, t0, -1
  bnez a0, @n
  sb t3, 0(t0)
  b text
  move a0, t0

; 左上: 食べた数・命・エネルギー。右上: 1日の時計。右下: 深さ
hud:
  addiu sp, sp, -8
  sw ra, 0(sp)
  li t0, 0x60e0d05f          ; プランクトンの印（ゲームの中の点と同じ青緑 #5fd0e0）
  sw t0, GP0(s7)
  li t0, 0xff92ff6c          ; (−148,−110)
  sw t0, GP0(s7)
  li t0, 0x00050005
  sw t0, GP0(s7)
  lw a0, V_CNT(gp)
  li a1, -138
  li a2, -114
  li a3, 0x00e8e0d8
  jal num
  nop
  ; 命（小さな銀の魚: 体のひし形＋尾の三角）
  lw t9, V_LIVES(gp)
  li t8, -143
@lv:
  blez t9, @lvd
  nop
  li t0, 0x28c8c0b8          ; 体（背はまっすぐ、腹は深い: 背 (x−3,−96)・頭 (x+4,−95)・尾のつけね (x−3,−93)・腹 (x+1,−90)）
  sw t0, GP0(s7)
  li t1, 0xffa00000
  addiu t2, t8, -3
  andi t2, t2, 0xffff
  or t2, t2, t1
  sw t2, GP0(s7)
  li t1, 0xffa10000
  addiu t2, t8, 4
  andi t2, t2, 0xffff
  or t2, t2, t1
  sw t2, GP0(s7)
  li t1, 0xffa30000
  addiu t2, t8, -3
  andi t2, t2, 0xffff
  or t2, t2, t1
  sw t2, GP0(s7)
  li t1, 0xffa60000
  addiu t2, t8, 1
  andi t2, t2, 0xffff
  or t2, t2, t1
  sw t2, GP0(s7)
  li t0, 0x28a09890          ; 二又の尾（つけね 2 点 → 上と下の先 2 点）
  sw t0, GP0(s7)
  li t1, 0xffa10000
  addiu t2, t8, -3
  andi t2, t2, 0xffff
  or t2, t2, t1
  sw t2, GP0(s7)
  li t1, 0xff9f0000
  addiu t2, t8, -6
  andi t2, t2, 0xffff
  or t2, t2, t1
  sw t2, GP0(s7)
  li t1, 0xffa20000
  addiu t2, t8, -3
  andi t2, t2, 0xffff
  or t2, t2, t1
  sw t2, GP0(s7)
  li t1, 0xffa40000
  addiu t2, t8, -6
  andi t2, t2, 0xffff
  or t2, t2, t1
  sw t2, GP0(s7)
  addiu t9, t9, -1
  b @lv
  addiu t8, t8, 13
@lvd:
  ; エネルギー（8 つの目もり。腹の光の色）
  lw t9, V_E(gp)
  li t8, 0
@eg:
  sll t0, t8, 11             ; 目もり 1 つ = 2048
  slt t0, t0, t9
  li t1, 0x60302820          ; 消えた目もり（暗い）
  beqz t0, @ed
  nop
  li t1, 0x60e0d060          ; ついた目もり（腹の光の色）
  addiu t2, t8, 1            ; つぎの目もりが消えていれば、これが右はし
  sll t2, t2, 11
  slt t2, t2, t9
  bnez t2, @ed
  nop
  lw t2, V_L16(gp)           ; 光らせている間は、右はしがまたたく（減っている）
  nop
  slti t2, t2, 128
  bnez t2, @ed
  nop
  lw t2, V_T(gp)
  nop
  andi t2, t2, 16
  beqz t2, @ed
  nop
  li t1, 0x60706830
@ed:
  sw t1, GP0(s7)
  sll t0, t8, 3
  subu t0, t0, t8            ; ×7
  addiu t0, t0, -150
  andi t0, t0, 0xffff
  li t1, 0xffb00000          ; y = −80
  or t0, t0, t1
  sw t0, GP0(s7)
  li t0, 0x00030005
  sw t0, GP0(s7)
  addiu t8, t8, 1
  slti t0, t8, 8
  bnez t0, @eg
  nop
  ; 1日の時計: 水面の線から出た太陽（昼）・月（夜）が、弧の上を左から右へ
  li a1, 128
  li a2, -100
  li a3, 18
  li t0, 0x00303438
  sw t0, V_DIM(gp)
  jal arc
  nop
  li t0, 0x40605848          ; 水面の線
  sw t0, GP0(s7)
  li t0, 0xff9c006a          ; (106,−100)
  sw t0, GP0(s7)
  li t0, 0xff9c0096          ; (150,−100)
  sw t0, GP0(s7)
  lw t0, V_T(gp)             ; 角度 = T × 128 / DAY（0 → 128 で半周）
  li t1, 128
  mult t0, t1
  mflo t0
  li t1, DAY
  div t0, t1
  mflo t0
  la t3, sintab
  sll t0, t0, 2
  addu t4, t3, t0
  lw t4, 0(t4)               ; sin
  addiu t0, t0, 256
  andi t0, t0, 1023
  addu t5, t3, t0
  lw t5, 0(t5)               ; cos
  li t1, 18
  mult t4, t1
  mflo t4
  sra t4, t4, 12
  li t6, -100
  subu t4, t6, t4            ; y = cy − sin×r
  mult t5, t1
  mflo t5
  sra t5, t5, 12
  li t6, 128
  subu t5, t6, t5            ; x = cx − cos×r
  lw t6, V_SKY(gp)
  li t0, 0x6070e0f0          ; 太陽（黄）
  slti t6, t6, 240
  beqz t6, @sun
  nop
  li t0, 0x60e0d8c8          ; 月（白）
@sun:
  sw t0, GP0(s7)
  addiu t4, t4, -2
  addiu t5, t5, -2
  sll t4, t4, 16
  andi t5, t5, 0xffff
  or t4, t4, t5
  sw t4, GP0(s7)
  li t0, 0x00050005
  sw t0, GP0(s7)
  ; 深さ（m）
  lw a0, V_FD(gp)
  nop
  sra a0, a0, 8
  sll a0, a0, 2
  li a1, 96
  li a2, 100
  li a3, 0x00a8b0b8
  jal num
  nop
  la a0, s_m
  li a1, 140
  li a2, 100
  li a3, 0x00a8b0b8
  jal text
  nop
  lw ra, 0(sp)
  addiu sp, sp, 8
  jr ra
  nop

; 半円の弧（上半分）: a1 = x、a2 = y、a3 = 半径、色は V_DIM
arc:
  lw t0, V_DIM(gp)
  li t1, 0x48000000
  or t0, t0, t1
  sw t0, GP0(s7)
  la t3, sintab
  li t4, 0
@a:
  sll t5, t4, 4              ; 0〜128 を 16 ずつ
  sll t5, t5, 2
  addu t6, t3, t5
  lw t6, 0(t6)
  addiu t5, t5, 256
  andi t5, t5, 1023
  addu t7, t3, t5
  lw t7, 0(t7)
  mult t6, a3
  mflo t6
  sra t6, t6, 12
  subu t6, a2, t6
  mult t7, a3
  mflo t7
  sra t7, t7, 12
  subu t7, a1, t7
  sll t6, t6, 16
  andi t7, t7, 0xffff
  or t6, t6, t7
  sw t6, GP0(s7)
  addiu t4, t4, 1
  slti t5, t4, 9
  bnez t5, @a
  nop
  li t0, 0x55555555
  sw t0, GP0(s7)
  jr ra
  nop

; タイトル: START がまたたく
titletext:
  lw t0, V_BLINK(gp)
  nop
  andi t0, t0, 32
  beqz t0, @tt
  nop
  la a0, s_start
  li a1, -30
  li a2, 76
  li a3, 0x00e8e0d8
  b text
  nop
@tt:
  jr ra
  nop

; おわり: 食べた数を大きく。START がまたたく
result:
  addiu sp, sp, -8
  sw ra, 0(sp)
  ; 食べた数を 3 倍の字でまん中に（けた数で左へ寄せる）。左に光るプランクトンの印
  lw t0, V_CNT(gp)
  li t1, 1
  li t2, 10
@dg:
  slt t3, t0, t2
  bnez t3, @dgd
  nop
  addiu t1, t1, 1
  sll t3, t2, 3
  sll t4, t2, 1
  b @dg
  addu t2, t3, t4            ; ×10
@dgd:
  li t2, 18                  ; 1 けた 36px の半分
  mult t1, t2
  mflo t1
  subu s1, zero, t1          ; 数の左の x
  li a0, 0x00383418          ; 印のにじみ（#5fd0e0 の 1/4）
  sw zero, V_RIM(gp)
  addiu a1, s1, -18
  li a2, -82
  li a3, 10
  li v1, 10
  jal blob
  nop
  li t0, 0x60e0d05f          ; 印（ゲームの中と同じ青緑の四角）
  sw t0, GP0(s7)
  addiu t1, s1, -20
  andi t1, t1, 0xffff
  li t2, 0xffac0000          ; y = −84
  or t1, t1, t2
  sw t1, GP0(s7)
  li t1, 0x00040004
  sw t1, GP0(s7)
  li t0, 6
  sw t0, V_SCL(gp)
  lw a0, V_CNT(gp)
  move a1, s1
  li a2, -102
  li a3, 0x00f0e8e0
  jal num
  nop
  ; 右上: 朝の時計（一日が終わった）
  li a1, 128
  li a2, -100
  li a3, 18
  li t0, 0x00303438
  sw t0, V_DIM(gp)
  jal arc
  nop
  li t0, 0x40605848
  sw t0, GP0(s7)
  li t0, 0xff9c006a
  sw t0, GP0(s7)
  li t0, 0xff9c0096
  sw t0, GP0(s7)
  li t0, 0x6070e0f0          ; 右の水面に朝の太陽
  sw t0, GP0(s7)
  li t0, 0xff9a0090          ; (144,−102)
  sw t0, GP0(s7)
  li t0, 0x00050005
  sw t0, GP0(s7)
  li t0, 2
  sw t0, V_SCL(gp)
  jal titletext
  nop
  lw ra, 0(sp)
  addiu sp, sp, 8
  jr ra
  nop

; 字の列（番号: 0〜9・A10 B11 S12 T13 R14 m15 ^16 v17 +18 −19・すきま 0xfe・終わり 0xff）
s_start: .byte 12, 13, 10, 14, 13, 0xff
s_hint:  .byte 10, 18, 0xfe, 0xfe, 11, 19, 0xff
s_m:     .byte 15, 0xff
; 光の円: 昼の RGB・夜の RGB、だ円 4 枚の大きさ（/256）
discday: .byte 40, 110, 170, 36, 54, 90
disck:   .byte 255, 205, 141, 77
; 目の色: 落ちついた RGB・見つけそうな RGB
eyecol:  .byte 48, 128, 72, 255, 144, 48
.align 4
; 光の筋: 上の x・上の半分の幅・強さ（8〜16）
raytab:  .half -150, 10, 10, -95, 22, 14, -30, 14, 9, 20, 30, 16, 80, 12, 10, 130, 20, 12
; 捕食者（デメニギスのなかま）の形: まわりの点（頭が右、目は頭の上で上を向く）。最初の点を最後にもくり返す
predshape:
  .half 60, 0, 52, -6, 40, -12, 20, -9, -20, -7, -60, -5, -90, -3, -106, -13
  .half -100, 0, -106, 13, -90, 3, -60, 6, -20, 9, 20, 10, 44, 8, 60, 0
