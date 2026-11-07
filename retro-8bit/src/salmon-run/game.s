; サケ のぼれ!（あそびラボ 2026）。8ビット互換機の 6502 のアセンブリ。
; ビルド: node retro-8bit/tools/build.mjs salmon-run（絵の番号 T_・S_ と画面のデータは data.mjs が足す）
; 決まり: 滝つぼで A をおしているあいだ ちからが たまり（ねらいの しるしが上がる）、はなすと とぶ。
;   滝のふちより上まで とべば上の段へ。たりないと滝にはじかれ、つよすぎると上の岩に ぶつかって落ちる（時間だけ かかる）。
;   クマが手をのばしているあいだに とぶと つかまる（ちからが へる）。ちからは だんだん へり、段に のぼると少しもどる。
; 画面: 上の 4 行（字の段 $2000）は止めたまま、0 番のスプライトの当たりのあとで $2400 の川を たてに流す
;   川は 30 行で ひとまわり。上へ のぼるたびに、見えなくなった下の行に 上の新しい行を書く（行の型は data.mjs）

PPUCTRL = $2000
PPUMASK = $2001
PPUSTATUS = $2002
OAMADDR = $2003
PPUSCROLL = $2005
PPUADDR = $2006
PPUDATA = $2007
OAMDMA = $4014
JOY1 = $4016

CTRL_ON = %10001000   ; NMI あり・スプライトの絵は $1000・背景は $0000
MASK_ON = %00011110

BTN_A = $80
BTN_B = $40
BTN_START = $10

RIVER_ROWS = 6
POOL_Y = 200       ; 滝つぼの水面の画面の y（川がとまっているとき）
PMIN = 16          ; ためはじめの高さ
PMAX = 150         ; いちばん強い（どの段でも上の岩にぶつかる）
MAXHOLD = 30       ; いちばん強いまま これだけ待つと、がまんできずに とぶ
G = $40            ; 重さ（1/256 ドット）
GAIN = 36          ; 段に のぼったとき もどる ちから
BEAR_HIT = 56      ; クマに つかまったとき へる ちから
CLEAR_LIP = 4      ; 滝のふちより これだけ上を通れば のぼれる
FISH_TOP = 5       ; サケのまん中から せなかまで

; サケの ようす
F_SWIM = 0
F_READY = 1
F_CHARGE = 2
F_AIR = 3
F_FALL = 4
F_RECOVER = 6
F_TIRED = 7
F_REST = 8         ; 見本: 上の段で ひとやすみ

; ---- ゼロページ ----
nmi_count = $00
buf_ready = $01
buf_len = $02
frame = $03
pad = $04
pad_old = $05
pad_new = $06
state = $07        ; 0 タイトル・1 あそぶ・2 おわり
rng = $08          ; 2バイト
tmp = $0A
tmp2 = $0B
tmp3 = $0C
tmp4 = $0D
ptr = $0E          ; 2バイト
fx = $10           ; サケのまん中の x（8.8）
fxl = $11
fh = $12           ; 滝つぼの水面からの高さ（8.8）
fhl = $13
fv = $14           ; 上への速さ（8.8・符号つき）
fvl = $15
fvx = $16          ; 横の速さ（8.8・符号つき）
fvxl = $17
fdir = $18         ; 0 右むき・1 左むき（滝のある向き）
fst = $19
ft = $1A
pw = $1B           ; ためた ちから = いちばん高い所（8.8）
pwl = $1C
steps = $1D        ; のぼった段 3 けた
hi = $20           ; 3 けた
stam = $23         ; ちから（8.8）
staml = $24
level = $25
oam_i = $26
end_t = $27
lang = $28
blink_old = $29
msg_t = $2A
hold = $2B
split = $2C
mus_on = $2D
paused = $2E
newrec = $2F
mus_ptr0 = $30
mus_t0 = $32
mus_base0 = $33
mus_ptr1 = $35
mus_t1 = $37
mus_base1 = $38
psy = $40          ; 滝つぼの水面の画面の y
scry = $41         ; 字の段のすぐ下に出す $2400 の たての位置（0〜239）
gap = $42          ; つぎに書く行までの のこり（ドット）
scroll_left = $43
tk = $44           ; いまの滝つぼの段の番号
liph = $45         ; 上の段の水面までの高さ
ceil = $46         ; 上の岩までの高さ
lipx = $47         ; 滝のふちの x
launchx = $48      ; とぶ場所の x
nsteps = $49
g_j = $4A          ; 行を作る係: いまの帯の上のたなの番号
g_o = $4B          ; 帯の何行め
g_h = $4C          ; 帯の高さ
g_w = $4D          ; 行の番号（下の けた）
g_nt = $4E         ; つぎの行を書く $2400 の行
g_pre = $4F        ; はじめの川の行
b_st = $50         ; クマ: 0 いない・1 見はる・2 手をあげる・3 手をのばす
b_t = $51
b_in = $52         ; あらわれる点めつ
ob_t = $53         ; 前の段のクマが いなくなる点めつ
ob_x = $54
ob_f = $55
spl_t = $56
spl_x = $57
spl_y = $58
star_t = $59
star_x = $5A
star_y = $5B
crossed = $5C
maxt = $5D
demo = $5E
bar_t = $5F
hq = $60           ; 段の高さ（16 こ）
gw = $70           ; put_grid
gh = $71
gc = $72
gr = $73
gx0 = $74
gwrap = $75
grow = $76
fall_t = $77
below = $78
LANG = $7FFF
SAVE = $6000       ; 電池の RAM: "SR01"・いちばん多い段 3 けた

OAM = $0200
BUF = $0300

.org $8000

; ================= はじめ =================
reset:
  sei
  cld
  ldx #$40
  stx $4017
  ldx #$ff
  txs
  inx
  stx PPUCTRL
  stx PPUMASK
  stx $4010
  bit PPUSTATUS
@vw1:
  bit PPUSTATUS
  bpl @vw1
  lda #0
  tax
@clr:
  sta $00,x
  sta $0100,x
  sta $0300,x
  sta $0400,x
  sta $0500,x
  sta $0600,x
  sta $0700,x
  inx
  bne @clr
  lda #$ff
@hide:
  sta OAM,x
  inx
  bne @hide
@vw2:
  bit PPUSTATUS
  bpl @vw2
  lda #%00001111
  sta $4015
  lda #$5b
  sta rng
  lda #$c3
  sta rng+1
  jsr load_palette
  jsr load_save
  lda #CTRL_ON
  sta PPUCTRL
  jsr go_title

main:
  jsr read_pad
  lda state
  bne @n1
  jsr title_update
  jmp @done
@n1:
  cmp #1
  bne @n2
  jsr play_update
  jmp @done
@n2:
  jsr end_update
@done:
  jsr fall_shimmer
  jsr music_update
  jsr wait_frame
  jmp main

irq:
  rti

; ================= 帰線（NMI） =================
nmi:
  pha
  txa
  pha
  tya
  pha
  lda #0
  sta OAMADDR
  lda #>OAM
  sta OAMDMA
  lda buf_ready
  beq @skip
  ldx #0
@ent:
  lda BUF,x
  beq @end
  sta PPUADDR
  lda BUF+1,x
  sta PPUADDR
  ldy BUF+2,x
  inx
  inx
  inx
@dat:
  lda BUF,x
  sta PPUDATA
  inx
  dey
  bne @dat
  jmp @ent
@end:
  lda #0
  sta buf_ready
  sta buf_len
@skip:
  lda #0
  sta PPUSCROLL      ; 字の段は流さない
  sta PPUSCROLL
  lda #CTRL_ON
  sta PPUCTRL
  lda #MASK_ON
  sta PPUMASK
  inc nmi_count
  pla
  tay
  pla
  tax
  pla
  rti

; 書くものを閉じて、つぎの帰線を待つ。そのあと 0 番の当たりを待って、字の段より下を $2400 の scry から出す
wait_frame:
  ldx buf_len
  lda #0
  sta BUF,x
  lda #1
  sta buf_ready
  lda nmi_count
@w:
  cmp nmi_count
  beq @w
  inc frame
  lda split
  beq @r
  ; 先に書く値を用意する。当たりは 31 行めの左のはし（ドット 10）なので、書き終わるのは 31 行めの なかほど。
  ; そのあと 31 行めのおわりで たてに 1 つ進むので、1 つ手前（scry-1）を書く。$2006 の下 = たての行の下 3 ビット
  ldx scry
  dex
  cpx #$ff
  bne @y
  ldx #239
@y:
  stx tmp3
  txa
  and #$38
  asl a
  asl a
  sta tmp4
  ldx #0
  ldy #10
@c:                  ; 前の画面の当たりの印が消えるのを待つ
  bit PPUSTATUS
  bvc @s0
  dex
  bne @c
  dey
  bne @c
  rts
@s0:
  ldx #0
  ldy #10
@s:                  ; 当たりを待つ
  bit PPUSTATUS
  bvs @hit
  dex
  bne @s
  dey
  bne @s
  rts
@hit:
  lda #$04           ; $2400 の画面
  sta PPUADDR
  lda tmp3
  sta PPUSCROLL
  lda #0
  sta PPUSCROLL
  lda tmp4
  sta PPUADDR
@r:
  rts

; ================= 画面の道具 =================
screen_off:
  jsr wait_frame
  lda #0
  sta split
  sta PPUCTRL
  sta PPUMASK
  rts

screen_on:
  lda #0
  sta buf_len
  bit PPUSTATUS
@w:
  bit PPUSTATUS
  bpl @w
  lda #0
  sta PPUSCROLL
  sta PPUSCROLL
  lda #CTRL_ON
  sta PPUCTRL
  lda #MASK_ON
  sta PPUMASK
  rts

load_palette:
  bit PPUSTATUS
  lda #$3f
  sta PPUADDR
  lda #0
  sta PPUADDR
  ldx #0
@l:
  lda palette,x
  sta PPUDATA
  inx
  cpx #32
  bne @l
  rts

; ptr の 1024 バイトを画面の表 A（$20 か $24）へ（画面を消してから）
draw_nt:
  bit PPUSTATUS
  sta PPUADDR
  lda #$00
  sta PPUADDR
  lda ptr+1
  pha
  ldx #4
  ldy #0
@l:
  lda (ptr),y
  sta PPUDATA
  iny
  bne @l
  inc ptr+1
  dex
  bne @l
  pla
  sta ptr+1
  rts

; ptr の字のデータ（番地・長さ・中身）を、画面を消したまま書く
vram_msg:
  bit PPUSTATUS
  ldy #0
  lda (ptr),y
  sta PPUADDR
  iny
  lda (ptr),y
  sta PPUADDR
  iny
  lda (ptr),y
  tax
  iny
@l:
  lda (ptr),y
  sta PPUDATA
  iny
  dex
  bne @l
  rts

; 3 けたの数を、画面を消したまま書く: A = 番地の上・tmp = 下・X = ゼロページの数の場所
vram_digits:
  bit PPUSTATUS
  sta PPUADDR
  lda tmp
  sta PPUADDR
  ldy #3
@l:
  lda $00,x
  clc
  adc #T_0
  sta PPUDATA
  inx
  dey
  bne @l
  rts

; 書くものの見出し: A = 番地の上・X = 下・Y = 長さ
buf_head:
  sty tmp
  ldy buf_len
  sta BUF,y
  txa
  sta BUF+1,y
  lda tmp
  sta BUF+2,y
  iny
  iny
  iny
  sty buf_len
  rts

buf_byte:
  ldy buf_len
  sta BUF,y
  inc buf_len
  rts

; ptr のデータ（番地・長さ・中身）をそのまま書くものへ
buf_data:
  ldy #2
  lda (ptr),y
  clc
  adc #3
  sta tmp2
  ldy #0
  ldx buf_len
@l:
  lda (ptr),y
  sta BUF,x
  inx
  iny
  cpy tmp2
  bne @l
  stx buf_len
  rts

; A = 字の番号（M_…）→ ptr にことばの字
say_ptr:
  ldx lang
  beq @j
  clc
  adc #MSG_N
@j:
  tax
  lda msg_lo,x
  sta ptr
  lda msg_hi,x
  sta ptr+1
  rts

; 字の段の 2 行めに しばらく出す: A = 字の番号
say:
  jsr say_ptr
  jsr buf_data
  lda #100
  sta msg_t
  rts

; スプライト1つ: tmp = y・tmp2 = 絵・tmp3 = 色と向き・tmp4 = x（X はこわさない）
put_spr:
  ldy oam_i
  beq @full
  lda tmp
  sta OAM,y
  lda tmp2
  sta OAM+1,y
  lda tmp3
  sta OAM+2,y
  lda tmp4
  sta OAM+3,y
  tya
  clc
  adc #4
  sta oam_i
@full:
  rts

; gw×gh 枚の絵（tmp2 から順に、行ごと）を tmp4・tmp に。tmp3 の $40 で左右を裏返す（列を右から並べる）。
; 画面の右の外にはみ出す絵は出さない（X はこわさない）
put_grid:
  lda tmp4
  sta gx0
  lda tmp2
  sta grow
  lda gh
  sta gr
@row:
  lda gx0
  sta tmp4
  lda #0
  sta gwrap
  sta gc
@col:
  lda tmp3
  and #$40
  beq @nf
  lda gw             ; 裏返し: gw-1-列
  sec
  sbc #1
  sbc gc
  jmp @tl
@nf:
  lda gc
@tl:
  clc
  adc grow
  sta tmp2
  lda gwrap
  bne @nd
  jsr put_spr
@nd:
  lda tmp4
  clc
  adc #8
  sta tmp4
  bcc @nc
  lda #1
  sta gwrap
@nc:
  inc gc
  lda gc
  cmp gw
  bne @col
  lda grow
  clc
  adc gw
  sta grow
  lda tmp
  clc
  adc #8
  sta tmp
  dec gr
  bne @row
  rts

; スプライトを出しはじめる: 0 番は字の段の下のふちに当てる印（背景のうしろなので見えない）
oam_start:
  lda #23
  sta OAM
  lda #S_MARK
  sta OAM+1
  lda #$23
  sta OAM+2
  lda #8
  sta OAM+3
  lda #4
  sta oam_i
  lda split          ; 字の段のない画面では 0 番もかくす
  bne @r
  lda #$ff
  sta OAM
@r:
  rts

hide_rest:
  ldx oam_i
  beq @r
  lda #$ff
@l:
  sta OAM,x
  inx
  inx
  inx
  inx
  bne @l
@r:
  rts

read_pad:
  lda pad
  sta pad_old
  lda #1
  sta JOY1
  sta pad
  lda #0
  sta JOY1
@l:
  lda JOY1
  lsr a
  rol pad
  bcc @l
  lda pad_old
  eor #$ff
  and pad
  sta pad_new
  rts

rand:
  ldy #8
  lda rng
@l:
  asl a
  rol rng+1
  bcc @n
  eor #$39
@n:
  dey
  bne @l
  sta rng
  rts

; 滝の白いすじが きらめく（滝のパレットの 1 を 8 フレームごとに 白 と うすい水色 に）
fall_shimmer:
  lda frame
  and #7
  bne @r
  lda #$3f
  ldx #$09
  ldy #1
  jsr buf_head
  lda frame
  and #8
  beq @a
  lda #$31
  jmp buf_byte
@a:
  lda #$30
  jmp buf_byte
@r:
  rts

; ================= 川の行を作る =================
; X = 段の番号 → 段の高さ（行）を hq に入れて A に
gen_height:
  txa
  pha
  jsr rand
  sta tmp
  pla
  tax
  cpx #4
  bcs @any
  lda tmp            ; はじめの 3 段は 7〜8（ゆとりのある高さ）
  and #1
  clc
  adc #7
  jmp @put
@any:
  lda tmp
  and #3
  clc
  adc #6             ; 6〜9 行（48〜72 ドット）
@put:
  pha
  txa
  and #15
  tax
  pla
  sta hq,x
  rts

; つぎの行の型の番号を A に（data.mjs の world と同じ決まり）
next_row:
  lda g_pre
  cmp #RIVER_ROWS
  bcs @band
  clc
  adc #TM_RIVER
  pha
  inc g_pre
  inc g_w
  lda g_pre
  cmp #RIVER_ROWS
  bne @rr
  lda #1
  sta g_j
  lda #0
  sta g_o
  ldx #0
  jsr gen_height
  sta g_h
@rr:
  pla
  rts
@band:
  inc g_o
  lda g_h
  sec
  sbc g_o
  bne @n0
  lda #10            ; 水面
  jmp @side
@n0:
  cmp #1
  bne @n1
  lda g_w            ; 水
  and #1
  ora #8
  jmp @side
@n1:
  cmp #2
  bne @n2
  lda g_w            ; たなの下の岩
  and #1
  ora #6
  jmp @side
@n2:
  cmp #3
  bne @n2b
  lda g_w            ; たなの いちばん下
  and #1
  ora #11
  jmp @side
@n2b:
  lda g_o
  cmp #1
  bne @n3
  lda g_w            ; しぶき
  and #1
  ora #4
  jmp @side
@n3:
  lda g_w
  and #3
@side:
  sta tmp
  lda g_j
  and #1
  beq @s0
  lda tmp
  clc
  adc #NK
  sta tmp
@s0:
  inc g_w
  lda tmp
  cmp #10
  beq @adv
  cmp #NK+10
  beq @adv
  rts
@adv:
  pha
  inc g_j
  lda #0
  sta g_o
  ldx g_j
  dex
  jsr gen_height
  sta g_h
  pla
  rts

; A = 型の番号 → ptr
tm_ptr:
  tax
  lda tm_lo,x
  sta ptr
  lda tm_hi,x
  sta ptr+1
  rts

; g_nt の行の番地の上を A・下を X に。そのあと g_nt を 1 つ上へ
nt_addr:
  lda g_nt
  and #7
  asl a
  asl a
  asl a
  asl a
  asl a
  tax
  lda g_nt
  lsr a
  lsr a
  lsr a
  clc
  adc #$24
  pha
  dec g_nt
  bpl @k
  lda #29
  sta g_nt
@k:
  pla
  rts

; 画面を消したまま、はじめの 30 行と色の表を書く
init_world:
  lda #0
  sta g_pre
  sta g_w
  sta g_j
  sta g_o
  lda #29
  sta g_nt
  lda #30
  sta tmp3
@row:
  jsr next_row
  jsr tm_ptr
  jsr nt_addr
  bit PPUSTATUS
  sta PPUADDR
  stx PPUADDR
  ldy #0
@c:
  lda (ptr),y
  sta PPUDATA
  iny
  cpy #32
  bne @c
  dec tmp3
  bne @row
  bit PPUSTATUS
  lda #$27
  sta PPUADDR
  lda #$c0
  sta PPUADDR
  ldx #0
@a:
  lda attr1,x
  sta PPUDATA
  inx
  cpx #64
  bne @a
  rts

; 1 行を書くものへ（川が上へ流れたとき）
buf_row:
  jsr next_row
  jsr tm_ptr
  jsr nt_addr
  ldy #32
  jsr buf_head
  ldy #0
  ldx buf_len
@c:
  lda (ptr),y
  sta BUF,x
  inx
  iny
  cpy #32
  bne @c
  stx buf_len
  rts

; ================= タイトル =================
go_title:
  ldx #0
  lda LANG
  cmp #1
  bne @lj
  inx
@lj:
  stx lang
  jsr screen_off
  lda #<nt_title_0
  ldx #>nt_title_0
  ldy lang
  beq @t0
  lda #<nt_title_1
  ldx #>nt_title_1
@t0:
  sta ptr
  stx ptr+1
  lda #$20
  jsr draw_nt
  lda #<ADDR_THI
  sta tmp
  lda #>ADDR_THI
  ldx #hi
  jsr vram_digits
  lda #0
  sta state
  sta paused
  sta blink_old
  jsr setup_demo
  lda #SONG_MAIN
  jsr music_play
  jsr oam_start
  jsr hide_rest
  jsr screen_on
  rts

; 見本: 題の画面の滝（水面 136・上の段まで 40・ふち 96）
setup_demo:
  lda #1
  sta demo
  lda #136
  sta psy
  lda #40
  sta liph
  lda #255
  sta ceil
  lda #96
  sta lipx
  lda #66
  sta launchx
  sta fx
  lda #0
  sta fdir
  sta fh
  sta fhl
  sta fv
  sta fvl
  sta fvx
  sta fvxl
  sta b_st
  sta ob_t
  sta spl_t
  sta star_t
  sta scroll_left
  lda #F_READY
  sta fst
  lda #40
  sta ft
  rts

title_update:
  lda frame
  and #$20
  cmp blink_old
  beq @same
  sta blink_old
  cmp #0
  bne @off
  lda #M_PUSH
  jsr say_ptr
  jmp @put
@off:
  lda #M_PUSH_OFF
  jsr say_ptr
@put:
  jsr buf_data
@same:
  jsr demo_hold
  jsr update_fish
  jsr draw_all
  lda pad_new
  and #BTN_START
  beq @r
  jsr start_game
@r:
  rts

; 見本のサケ: すこし待ってから、ふちより 6〜13 上まで ためて とぶ
demo_hold:
  lda #0
  sta hold
  lda fst
  cmp #F_READY
  bne @c
  lda ft
  beq @go
  dec ft
  rts
@go:
  inc hold
  rts
@c:
  cmp #F_CHARGE
  bne @r
  lda liph
  clc
  adc #6
  sta tmp
  lda frame
  and #7
  adc tmp
  cmp pw
  bcc @r
  inc hold
@r:
  rts

; ================= あそぶ =================
start_game:
  jsr screen_off
  lda #<nt_hud_0
  ldx #>nt_hud_0
  ldy lang
  beq @p0
  lda #<nt_hud_1
  ldx #>nt_hud_1
@p0:
  sta ptr
  stx ptr+1
  lda #$20
  jsr draw_nt
  lda #<ADDR_PHI
  sta tmp
  lda #>ADDR_PHI
  ldx #hi
  jsr vram_digits
  lda #M_HINT
  jsr say_ptr
  jsr vram_msg
  lda #240
  sta msg_t
  lda #0
  sta steps
  sta steps+1
  sta steps+2
  sta nsteps
  sta level
  sta paused
  sta newrec
  sta demo
  sta tk
  sta b_st
  sta ob_t
  sta spl_t
  sta star_t
  sta scroll_left
  sta fh
  sta fhl
  sta fv
  sta fvl
  sta fvx
  sta fvxl
  sta staml
  sta bar_t
  lda #255
  sta stam
  lda frame
  eor rng
  sta rng
  jsr init_world
  lda #POOL_Y
  sta psy
  lda #24
  sta scry
  lda #25
  sta gap
  jsr setup_tier
  lda launchx
  sta fx
  lda #F_READY
  sta fst
  lda #1
  sta state
  sta split
  jsr oam_start
  jsr hide_rest
  jsr screen_on
  rts

; いまの段（tk）から、ふち・とぶ場所・高さ・上の岩・クマを決める
setup_tier:
  lda tk
  clc
  adc #1
  and #1
  beq @left
  lda #96            ; 上の段は右のたな（滝は 10〜11 列）: 右へ とぶ
  sta lipx
  lda #66
  sta launchx
  lda #0
  sta fdir
  jmp @h
@left:
  lda #160           ; 上の段は左のたな（滝は 20〜21 列）: 左へ とぶ
  sta lipx
  lda #190
  sta launchx
  lda #1
  sta fdir
@h:
  lda tk
  and #15
  tax
  lda hq,x
  asl a
  asl a
  asl a
  sta liph
  lda hq,x
  sta tmp
  inx
  txa
  and #15
  tax
  lda hq,x
  clc
  adc tmp
  sec
  sbc #2
  asl a
  asl a
  asl a
  sec
  sbc #7
  sta ceil
  ; クマ: はじめの 3 段は いない。あとは段が上がるほど よく出る
  lda #0
  sta b_st
  lda tk
  cmp #3
  bcc @r
  jsr rand
  ldx level
  cmp bear_tab,x
  bcs @r
  lda #1
  sta b_st
  jsr rand
  and #31
  clc
  adc #70
  sta b_t
  lda #24
  sta b_in
@r:
  rts

play_update:
  lda pad_new
  and #BTN_START
  beq @np
  lda fst
  cmp #F_TIRED
  beq @np
  lda paused
  eor #1
  sta paused
  beq @np
  lda #$30
  sta $4004
  sta $4000
  lda #$80
  sta $4008
  sta $400B
@np:
  lda paused
  beq @run
  rts
@run:
  lda #0
  sta hold
  lda pad
  and #BTN_A|BTN_B
  beq @nh
  inc hold
@nh:
  jsr update_fish
  jsr update_bear
  jsr scroll_up
  jsr drain
  jsr draw_all
  jsr hud
  lda msg_t
  beq @nm
  dec msg_t
  bne @nm
  lda #M_CLEAR
  jsr say_ptr
  jsr buf_data
@nm:
  lda fst
  cmp #F_TIRED
  bne @r
  inc end_t
  lda end_t
  cmp #120
  bcc @r
  jsr go_end
@r:
  rts

; ちからが へる（段が上がるほど早く）。0 になったら おしまい
drain:
  lda fst
  cmp #F_TIRED
  beq @r
  ldx level
  lda staml
  sec
  sbc drain_tab,x
  sta staml
  lda stam
  sbc #0
  sta stam
  bcs @r
  lda #0
  sta stam
  sta staml
  jsr tired
@r:
  rts

tired:
  lda #F_TIRED
  sta fst
  lda #0
  sta end_t
  sta fvx
  sta fvxl
  lda #M_TIRED
  jsr say
  lda #250
  sta msg_t
  jsr music_stop
  lda #SONG_OVER
  jsr music_play
  rts

; 川を上へ流す（のぼった段の高さぶん、2 ドットずつ）
scroll_up:
  lda scroll_left
  beq @r
  ldx #2
  cmp #2
  bcs @k
  ldx #1
@k:
  stx tmp
  lda scroll_left
  sec
  sbc tmp
  sta scroll_left
  lda psy
  clc
  adc tmp
  sta psy
  lda spl_y
  clc
  adc tmp
  sta spl_y
  lda scry
  sec
  sbc tmp
  bcs @w
  adc #240
@w:
  sta scry
  lda gap
  sec
  sbc tmp
  sta gap
  cmp #17
  bcs @r
  clc
  adc #8
  sta gap
  jsr buf_row
@r:
  rts

; ---- サケ ----
update_fish:
  lda fst
  cmp #F_SWIM
  bne @n1
  jmp fish_swim
@n1:
  cmp #F_READY
  bne @n2
  lda scroll_left
  bne @rr
  lda hold
  beq @rr
  lda #F_CHARGE
  sta fst
  lda #PMIN
  sta pw
  lda #0
  sta pwl
  sta maxt
@rr:
  rts
@n2:
  cmp #F_CHARGE
  bne @n3
  jmp fish_charge
@n3:
  cmp #F_AIR
  bne @n4
  jmp fish_air
@n4:
  cmp #F_FALL
  bne @n6
  jmp fish_fall
@n6:
  cmp #F_RECOVER
  bne @n8
  dec ft
  bne @r
  lda #F_SWIM
  sta fst
  rts
@n8:
  cmp #F_REST
  bne @r
  dec ft
  bne @r
  lda #0             ; 見本: 下の滝つぼへ もどる
  sta fh
  sta fhl
  lda launchx
  sta fx
  lda #F_READY
  sta fst
  lda #50
  sta ft
@r:
  rts

; とぶ場所へ およぐ（1.5 ドット／フレーム）
fish_swim:
  lda fx
  cmp launchx
  beq @there
  ldx #1
  lda frame
  and #1
  beq @s
  inx
@s:
  stx tmp
  lda fx
  cmp launchx
  bcs @left
  clc
  adc tmp
  cmp launchx
  bcc @put
  lda launchx
  jmp @put
@left:
  sec
  sbc tmp
  cmp launchx
  bcs @put
  lda launchx
@put:
  sta fx
  rts
@there:
  lda #F_READY
  sta fst
  rts

fish_charge:
  lda hold
  beq launch
  lda pwl
  ldx level
  clc
  adc rate_lo,x
  sta pwl
  lda pw
  adc rate_hi,x
  sta pw
  cmp #PMAX
  bcc @tick
  lda #PMAX
  sta pw
  inc maxt
  lda maxt
  cmp #MAXHOLD
  bcs launch
@tick:
  lda frame
  and #3
  bne @r
  jsr sfx_tick
@r:
  rts

launch:
  ldx pw
  lda v0_lo,x
  sta fvl
  lda v0_hi,x
  sta fv
  lda vx_lo,x
  sta fvxl
  lda vx_hi,x
  sta fvx
  lda fdir
  beq @r
  lda #0             ; 左へ: 横の速さを負に
  sec
  sbc fvxl
  sta fvxl
  lda #0
  sbc fvx
  sta fvx
@r:
  lda #0
  sta crossed
  sta fhl
  lda #F_AIR
  sta fst
  jsr splash_here
  jsr sfx_leap
  rts

; 重さで動かす（高さ += 速さ・速さ -= G・x += 横の速さ）。水面より下に出たら below = 1
physics:
  lda #0
  sta below
  lda fhl
  clc
  adc fvl
  sta fhl
  lda fh
  adc fv
  sta fh
  ldx fv
  bpl @nb
  bcs @nb
  inc below          ; 負の速さで けたが下がった = 水面より下
@nb:
  lda fvl
  sec
  sbc #G
  sta fvl
  lda fv
  sbc #0
  sta fv
  lda fxl
  clc
  adc fvxl
  sta fxl
  lda fx
  adc fvx
  sta fx
  rts

fish_air:
  jsr physics
  lda below
  beq @nb
  jmp splash_down
@nb:
  ; 上の岩
  lda fh
  clc
  adc #FISH_TOP
  bcs @bonk
  cmp ceil
  bcc @nc
@bonk:
  jmp bonk
@nc:
  ; 滝のふちを こえたか
  lda crossed
  bne @cr
  lda fdir
  bne @dl
  lda fx
  cmp lipx
  bcc @bear
  jmp @cross
@dl:
  lda fx
  cmp lipx
  bcs @bear
@cross:
  lda #1
  sta crossed
  lda liph
  clc
  adc #CLEAR_LIP
  sta tmp
  lda fh
  cmp tmp
  bcs @bear
  jmp short
@cr:
  ; おりてきて 上の段の水面に とどいた
  lda fv
  bpl @bear
  lda fh
  cmp liph
  bcc @land
  beq @land
@bear:
  jmp bear_check
@land:
  jmp land

; クマの手（のばしているあいだ）にかかったか
bear_check:
  lda b_st
  cmp #3
  bne @r
  lda b_in
  bne @r
  ; 横: ふちの まわり ±12
  lda lipx
@x:
  sec
  sbc fx
  bcs @px
  eor #$ff
  adc #1
@px:
  cmp #12
  bcs @r
  ; たて: ふちの高さ -4〜+26
  lda liph
  clc
  adc #11
  sec
  sbc fh
  bcs @py
  eor #$ff
  adc #1
@py:
  cmp #16
  bcs @r
  jmp caught
@r:
  rts

caught:
  lda stam
  sec
  sbc #BEAR_HIT
  bcs @k
  lda #0
@k:
  sta stam
  lda #F_FALL
  sta fst
  lda #0
  sta fvx
  sta fvxl
  sta fv
  sta fvl
  jsr to_face        ; はなされて 滝の前へ
  lda #M_BEAR
  jsr say
  jsr sfx_caught
  lda #20
  sta b_t            ; つかんだまま すこし
  lda stam
  bne @r
  jsr tired
@r:
  rts

short:
  lda #F_FALL
  sta fst
  lda #0
  sta fvx
  sta fvxl
  lda fv
  bmi @k
  lda #0
  sta fv
  sta fvl
@k:
  jsr to_face
  lda demo
  bne @r
  lda #M_LOW
  jsr say
@r:
  jsr sfx_bump
  rts

; 滝の前（ふちから 10 ドット 手前）へ
to_face:
  lda lipx
  ldx fdir
  bne @l
  sec
  sbc #10
  sta fx
  rts
@l:
  clc
  adc #10
  sta fx
  rts

bonk:
  lda #F_FALL
  sta fst
  lda #0
  sta fvx
  sta fvxl
  sta fv
  sta fvl
  lda #24
  sta star_t
  lda fx
  sta star_x
  lda psy
  sec
  sbc fh
  sec
  sbc #12
  sta star_y
  lda #M_HIGH
  jsr say
  jsr sfx_bonk
  rts

fish_fall:
  jsr physics
  lda below
  bne splash_down
  rts

splash_down:
  lda #0
  sta fh
  sta fhl
  sta fv
  sta fvl
  sta fvx
  sta fvxl
  lda #F_RECOVER
  sta fst
  lda #30
  sta ft
  jsr splash_here
  jsr sfx_splash
  rts

; 上の段に のぼった
land:
  jsr sfx_land
  lda demo
  beq @play
  lda liph           ; 見本: 上の段で ひとやすみ
  sta fh
  lda #0
  sta fhl
  sta fv
  sta fvl
  sta fvx
  sta fvxl
  lda #F_REST
  sta fst
  lda #50
  sta ft
  lda fx
  sta spl_x
  lda psy
  sec
  sbc liph
  sta spl_y
  lda #16
  sta spl_t
  rts
@play:
  lda #0
  sta fh
  sta fhl
  sta fv
  sta fvl
  sta fvx
  sta fvxl
  lda psy
  sec
  sbc liph
  sta psy
  lda #POOL_Y
  sec
  sbc psy
  sta scroll_left
  jsr splash_here
  ; のぼった段・ちから
  inc nsteps
  bne @ns
  dec nsteps
@ns:
  ldx #2
@d:
  inc steps,x
  lda steps,x
  cmp #10
  bcc @dd
  lda #0
  sta steps,x
  dex
  bpl @d
@dd:
  lda nsteps         ; 段 = 5 段ごと（7 まで）
  ldx #0
@lv:
  cmp #5
  bcc @lvd
  sbc #5
  inx
  cpx #7
  bne @lv
@lvd:
  stx level
  lda stam
  clc
  adc #GAIN
  bcc @g
  lda #255
@g:
  sta stam
  ; 前の段のクマは あきらめて いなくなる
  lda b_st
  beq @nb
  jsr bear_x
  sta ob_x
  lda fdir
  sta ob_f
  lda #40
  sta ob_t
@nb:
  inc tk
  jsr setup_tier
  lda #F_SWIM
  sta fst
  rts

splash_here:
  lda #16
  sta spl_t
  lda fx
  sta spl_x
  lda psy
  sta spl_y
  rts

; ---- クマ ----
update_bear:
  lda ob_t
  beq @o
  dec ob_t
@o:
  lda b_in
  beq @i
  dec b_in
@i:
  lda b_st
  beq @r
  lda fst
  cmp #F_TIRED
  beq @r
  dec b_t
  bne @r
  lda b_st
  cmp #1
  bne @n1
  lda #2             ; 手をあげる（くる合図）
  sta b_st
  lda #30
  sta b_t
  rts
@n1:
  cmp #2
  bne @n2
  lda #3             ; 手をのばす
  sta b_st
  lda #36
  sta b_t
  jsr sfx_swipe
  rts
@n2:
  lda #1             ; 見はる
  sta b_st
  jsr rand
  and #63
  clc
  adc #70
  sta b_t
@r:
  rts

; クマの左の x を A に（右のたなでは ふち+12、左のたなでは ふち-36）
bear_x:
  lda fdir
  bne @l
  lda lipx
  clc
  adc #12
  rts
@l:
  lda lipx
  sec
  sbc #36
  rts

; ---- 絵 ----
draw_all:
  jsr oam_start
  ; サケ
  lda fst
  cmp #F_RECOVER
  bne @nblink
  lda frame
  and #4
  beq @nblink
  jmp @nofish
@nblink:
  lda fst
  cmp #F_TIRED
  bne @pose
  lda frame
  and #8
  beq @pose
  jmp @nofish
@pose:
  ldx #S_SALA
  lda fst
  cmp #F_CHARGE
  bne @p1
  ldx #S_SALC
  jmp @p3
@p1:
  cmp #F_AIR
  beq @pa
  cmp #F_FALL
  beq @pb
  lda frame
  and #16
  beq @p3
  ldx #S_SALB
  jmp @p3
@pa:
  lda frame
  and #4
  beq @p3
@pb:
  ldx #S_SALB
@p3:
  stx tmp2
  lda psy
  sec
  sbc fh
  sec
  sbc #9
  sta tmp
  lda fh             ; 水の中では ゆれる
  bne @nbob
  lda fst
  cmp #F_CHARGE
  beq @shake
  lda frame
  and #32
  beq @nbob
  inc tmp
  jmp @nbob
@shake:
  lda frame
  and #2
  beq @nbob
  inc tmp
@nbob:
  ; 向き: およぐときは進む向き、ほかは滝の向き
  lda fdir
  sta gc
  lda fst
  cmp #F_SWIM
  bne @dir
  lda #0
  sta gc
  lda fx
  cmp launchx
  bcc @dir
  inc gc
@dir:
  lda #0
  ldx gc
  beq @d0
  lda #$40
@d0:
  sta tmp3
  lda fx
  sec
  sbc #12
  sta tmp4
  lda #3
  sta gw
  lda #2
  sta gh
  jsr put_grid
@nofish:
  ; クマの手
  lda b_st
  cmp #3
  bne @nopaw
  lda b_in
  bne @nopaw
  jsr bear_surf
  sec
  sbc #20
  sta tmp
  lda #S_PAW
  sta tmp2
  lda #1
  ldx fdir
  beq @pf
  lda #$41
@pf:
  sta tmp3
  lda lipx
  ldx fdir
  bne @pl
  sec
  sbc #4
  jmp @px
@pl:
  sec
  sbc #12
@px:
  sta tmp4
  lda #2
  sta gw
  sta gh
  jsr put_grid
@nopaw:
  ; ねらいの しるし（ためているあいだ）
  lda fst
  cmp #F_CHARGE
  bne @nomark
  lda psy
  sec
  sbc pw
  sec
  sbc #4
  sta tmp
  lda #S_MARKER
  sta tmp2
  lda #2
  ldx fdir
  beq @mf
  lda #$42
@mf:
  sta tmp3
  lda lipx
  ldx fdir
  bne @ml
  sec
  sbc #20
  jmp @mx
@ml:
  clc
  adc #4
@mx:
  sta tmp4
  lda #2
  sta gw
  lda #1
  sta gh
  jsr put_grid
@nomark:
  ; クマ
  lda b_st
  beq @nobear
  lda b_in
  and #2
  bne @nobear
  ldx #S_BEARA
  lda b_st
  cmp #2
  bne @b1
  ldx #S_BEARB
@b1:
  cmp #3
  bne @b2
  ldx #S_BEARC
@b2:
  stx tmp2
  jsr bear_surf
  sec
  sbc #20
  sta tmp
  lda #1
  ldx fdir
  beq @bf
  lda #$41
@bf:
  sta tmp3
  jsr bear_x
  sta tmp4
  lda #3
  sta gw
  sta gh
  jsr put_grid
@nobear:
  ; 前の段のクマ（いなくなる）
  lda ob_t
  beq @noob
  and #4
  bne @noob
  lda #S_BEARA
  sta tmp2
  lda psy
  sec
  sbc #20
  sta tmp
  lda #1
  ldx ob_f
  beq @of
  lda #$41
@of:
  sta tmp3
  lda ob_x
  sta tmp4
  lda #3
  sta gw
  sta gh
  jsr put_grid
@noob:
  ; しぶき
  lda spl_t
  beq @nospl
  dec spl_t
  lda spl_y
  sec
  sbc #8
  sta tmp
  lda spl_x
  sec
  sbc #8
  sta tmp4
  lda #2
  sta tmp3
  lda #S_SPLB
  ldx spl_t
  cpx #9
  bcc @sp
  lda #S_SPLA
@sp:
  sta tmp2
  lda #2
  sta gw
  lda #1
  sta gh
  jsr put_grid
@nospl:
  ; ぶつかった星
  lda star_t
  beq @nostar
  dec star_t
  lda star_y
  sta tmp
  lda #S_STAR
  sta tmp2
  lda #2
  sta tmp3
  lda frame
  and #4
  beq @s1
  lda #$42
  sta tmp3
@s1:
  lda star_x
  sec
  sbc #4
  sta tmp4
  jsr put_spr
@nostar:
  jsr hide_rest
  rts

; 上の段の水面の画面の y を A に
bear_surf:
  lda psy
  sec
  sbc liph
  rts

; 字の段: のぼった段とちからの帯
hud:
  lda #>ADDR_STEP
  ldx #<ADDR_STEP
  ldy #3
  jsr buf_head
  ldx #0
@l:
  lda steps,x
  clc
  adc #T_0
  jsr buf_byte
  inx
  cpx #3
  bne @l
  inc bar_t
  lda bar_t
  and #3
  bne @r
  lda #>ADDR_BAR
  ldx #<ADDR_BAR
  ldy #8
  jsr buf_head
  lda stam
  lsr a
  lsr a
  sta tmp3           ; 0〜63
  ldx #8
@b:
  lda tmp3
  cmp #8
  bcc @part
  sbc #8
  sta tmp3
  lda #8
  jmp @put
@part:
  pha
  lda #0
  sta tmp3
  pla
@put:
  clc
  adc #T_BAR0
  jsr buf_byte
  dex
  bne @b
@r:
  rts

; ================= おわり =================
go_end:
  lda #2
  sta state
  lda #0
  sta end_t
  sta hold
  ; いちばん多い段
  ldx #0
@c:
  lda steps,x
  cmp hi,x
  bcc @nohi
  bne @newhi
  inx
  cpx #3
  bne @c
  jmp @nohi
@newhi:
  ldx #2
@cp:
  lda steps,x
  sta hi,x
  sta SAVE+4,x
  dex
  bpl @cp
  lda #1
  sta newrec
@nohi:
  jsr screen_off
  lda #<nt_end_0
  ldx #>nt_end_0
  ldy lang
  beq @p0
  lda #<nt_end_1
  ldx #>nt_end_1
@p0:
  sta ptr
  stx ptr+1
  lda #$20
  jsr draw_nt
  lda #M_E_STEP
  jsr say_ptr
  jsr vram_msg
  lda #M_E_BEST
  jsr say_ptr
  jsr vram_msg
  lda newrec
  beq @nn
  lda #M_E_NEW
  jsr say_ptr
  jsr vram_msg
@nn:
  lda #<ADDR_ESTEP
  sta tmp
  lda #>ADDR_ESTEP
  ldx #steps
  jsr vram_digits
  lda #<ADDR_EBEST
  sta tmp
  lda #>ADDR_EBEST
  ldx #hi
  jsr vram_digits
  lda #<ADDR_THI
  sta tmp
  lda #>ADDR_THI
  ldx #hi
  jsr vram_digits
  jsr setup_demo
  lda #90
  sta ft
  jsr oam_start
  jsr hide_rest
  jsr screen_on
  rts

end_update:
  lda end_t
  cmp #200
  bcs @k
  inc end_t
@k:
  jsr demo_hold
  jsr update_fish
  jsr draw_all
  lda end_t
  cmp #60
  bcc @r
  lda frame
  and #$20
  cmp blink_old
  beq @same
  sta blink_old
  cmp #0
  bne @off
  lda #M_PUSH
  jsr say_ptr
  jmp @put
@off:
  lda #M_PUSH_OFF
  jsr say_ptr
@put:
  jsr buf_data
@same:
  lda pad_new
  and #BTN_START
  beq @r
  jsr go_title
@r:
  rts

; ================= 音 =================
sfx_leap:
  lda #%10010110
  sta $4000
  lda #%10001010
  sta $4001
  lda #$60
  sta $4002
  lda #$11
  sta $4003
  lda #%00000010       ; 水をはなれる音
  sta $400C
  lda #$04
  sta $400E
  lda #$18
  sta $400F
  rts

sfx_splash:
  lda #%00000100
  sta $400C
  lda #$07
  sta $400E
  lda #$20
  sta $400F
  rts

; ためている音（ちからが たまるほど高く）
sfx_tick:
  lda #%01110011
  sta $4000
  lda #$08
  sta $4001
  lda #200
  sec
  sbc pw
  sta $4002
  lda #$00
  sta $4003
  rts

sfx_land:
  lda #%10010101
  sta $4000
  lda #%10000011
  sta $4001
  lda #$50
  sta $4002
  lda #$08
  sta $4003
  lda #%00000011
  sta $400C
  lda #$05
  sta $400E
  lda #$18
  sta $400F
  rts

sfx_bump:
  lda #%00000011
  sta $400C
  lda #$09
  sta $400E
  lda #$18
  sta $400F
  rts

sfx_bonk:
  lda #%10011001
  sta $4000
  lda #%10011010
  sta $4001
  lda #$80
  sta $4002
  lda #$0a
  sta $4003
  lda #%00000100
  sta $400C
  lda #$0c
  sta $400E
  lda #$18
  sta $400F
  rts

sfx_swipe:
  lda #%00000011
  sta $400C
  lda #$03
  sta $400E
  lda #$10
  sta $400F
  rts

sfx_caught:
  lda #%00000110
  sta $400C
  lda #$0a
  sta $400E
  lda #$40
  sta $400F
  lda #%10011010
  sta $4000
  lda #%10110011
  sta $4001
  lda #$00
  sta $4002
  lda #$11
  sta $4003
  rts

; ================= セーブ =================
load_save:
  ldx #3
@c:
  lda SAVE,x
  cmp save_magic,x
  bne @new
  dex
  bpl @c
  ldx #2
@d:
  lda SAVE+4,x
  cmp #10
  bcs @new
  sta hi,x
  dex
  bpl @d
  rts
@new:
  ldx #3
@w:
  lda save_magic,x
  sta SAVE,x
  lda #0
  sta SAVE+4,x
  dex
  bpl @w
  ldx #2
  lda #0
@z:
  sta hi,x
  dex
  bpl @z
  rts

; 曲の係（music_play・music_stop・music_update）は src/music.s（build がつなぐ）

; ================= 決まりの表 =================
save_magic: .byte 'S', 'R', '0', '1'
; ためる速さ（1 フレームに のびる高さ 8.8）・ちからの へり方（1/256）・クマの出やすさ（/256）
rate_lo: .byte $40, $60, $80, $A0, $C0, $E0, $00, $20
rate_hi: .byte $01, $01, $01, $01, $01, $01, $02, $02
drain_tab: .byte 24, 30, 38, 46, 56, 66, 78, 92
bear_tab: .byte 0, 64, 90, 110, 130, 150, 160, 170
