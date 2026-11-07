; うて! テッポウウオ（あそびラボ 2026）。8ビット互換機の 6502 のアセンブリ。
; ビルド: node retro-8bit/tools/build.mjs archerfish（絵の番号 T_・S_ と画面のデータは data.mjs が足す）
; 決まり: ←→ で水の面のすぐ下を泳ぎ、A で真上へ水を吹く。枝にとまった虫に当たると、はじかれて水に落ちる。
;   落ちた虫は口でとって食べる（1 ぴき＋1 秒）。ほうっておくと、ほかの魚が来てとっていく。
;   ハチに当てると おこって飛んできて さされる（-2 ひき・しばらく吹けない）。時間が 0 で おしまい
; 画面は流さない（字の段も景色も止まったまま）

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
BTN_LEFT = $02
BTN_RIGHT = $01

SURF = 128         ; 水の面の y
FISH_Y = 129       ; テッポウウオの絵の上の y（背が水の面のすぐ下）
FX_MIN = 0
FX_MAX = 232
ACC = $28          ; 泳ぐ速さの増え方（1/256 ドット）
VMAX = $01C0       ; いちばん速い（1.75 ドット／フレーム）
VSTUN = $00A0      ; さされたあと
FRIC = $18
JET_Y0 = 118       ; 水のたまが出る所
JET_DY = 5         ; 水のたまの速さ
JET_TOP = 30
FLOAT_Y = 121      ; 水にうかんだ虫の絵の上の y
FLOAT_T = 210      ; うかんでいられる時間（そのあと しずむ）
GRAV = $12
NI = 6             ; 虫の数
NR = 2             ; ほかの魚の数
RV_Y = 146         ; 虫をとりに上がってくる深さ
START_T = 40       ; はじめの のこり時間（秒）
EAT_T = 1          ; 1 ぴき食べると のびる秒

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
fx = $10           ; テッポウウオの左の x（8.8）
fxl = $11
fvl = $12          ; 横の速さ（8.8・符号つき）
fvh = $13
face = $14         ; 0 右むき・1 左むき
aim_t = $15        ; 吹いている絵の残り
stun = $16         ; さされて ひるんでいる残り
jet_on = $17
jet_x = $18        ; 水のたまの まん中の x
jet_y = $19        ; 水のたまの上の y
score = $1A        ; 食べた数
hi = $1B
tsec = $1C         ; のこり（秒）
tfr = $1D
lvl_c = $1E        ; つぎの段までの秒
level = $1F
sp_t = $20
oam_i = $21
end_t = $22
lang = $23
blink_old = $24
newrec = $26
ctl = $27          ; 泳ぎに使うボタン（あそぶ = pad・タイトル = 見本）
spl_t = $28
spl_x = $29
spl_y = $2A
mus_on = $2D
paused = $2E
mus_ptr0 = $30
mus_t0 = $32
mus_base0 = $33
mus_ptr1 = $35
mus_t1 = $37
mus_base1 = $38
ins_t = $40        ; 0 なし・1 コオロギ・2 ハエ・3 ハチ（NI ずつ）
ins_st = $46       ; 1 来る・2 とまる・3 去る・4 落ちる・5 うかぶ・6 おこる
ins_x = $4C
ins_xl = $52
ins_y = $58
ins_yl = $5E
ins_vxl = $64
ins_vxh = $6A
ins_vyl = $70
ins_vyh = $76
ins_tm = $7C
ins_p = $82        ; とまる所の番号
ins_f = $88        ; 向き
rv_y = $90         ; ほかの魚（NR ずつ）
rv_x = $92
rv_xl = $94
rv_dir = $96
rv_bug = $98
rv_st = $9A        ; 0 虫へ・2 深い所で ぶらぶら
perch_used = $A0   ; 16
gw = $B0
gh = $B1
gc = $B2
gr = $B3
gx0 = $B4
gwrap = $B5
dig = $B8          ; 3 けた
ndig = $BB
cx = $BC
cnt = $BD
mouth = $BE
LANG = $7FFF
SAVE = $6000       ; 電池の RAM: "AF01"・さいこう・その うら返し

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
  sta PPUSCROLL
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
  rts

; ================= 画面の道具 =================
screen_off:
  jsr wait_frame
  lda #0
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

; ptr の 1024 バイトを $2000 へ（画面を消してから）
draw_nt:
  bit PPUSTATUS
  lda #$20
  sta PPUADDR
  lda #$00
  sta PPUADDR
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

; A の数を 3 けたの dig へ
to_digits:
  ldx #0
@h:
  cmp #100
  bcc @t
  sbc #100
  inx
  jmp @h
@t:
  stx dig
  ldx #0
@t2:
  cmp #10
  bcc @o
  sbc #10
  inx
  jmp @t2
@o:
  stx dig+1
  sta dig+2
  rts

; 数を、画面を消したまま書く: A = 数・X = 番地の下・Y = 番地の上（3 けた）
vram_num:
  stx tmp
  sty tmp2
  jsr to_digits
  bit PPUSTATUS
  lda tmp2
  sta PPUADDR
  lda tmp
  sta PPUADDR
  ldx #0
@l:
  lda dig,x
  clc
  adc #T_0
  sta PPUDATA
  inx
  cpx #3
  bne @l
  rts

; 数を書くものへ: A = 数・X = 番地の下・Y = 番地の上・ndig = けた（2 か 3）
buf_num:
  stx tmp3
  sty tmp4
  jsr to_digits
  lda tmp4
  ldx tmp3
  ldy ndig
  jsr buf_head
  lda #3
  sec
  sbc ndig
  tax
@l:
  lda dig,x
  clc
  adc #T_0
  jsr buf_byte
  inx
  cpx #3
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

say_buf:
  jsr say_ptr
  jmp buf_data

; スプライト1つ: tmp = y・tmp2 = 絵・tmp3 = 色と向き・tmp4 = x
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

; gw×gh 枚の絵（tmp2 から順に）を tmp4・tmp（上の y）に。右の画面の外にはみ出す絵は出さない
put_grid:
  dec tmp              ; スプライトは 1 行下に出るので
  lda tmp4
  sta gx0
  lda gh
  sta gr
@row:
  lda gx0
  sta tmp4
  lda gw
  sta gc
  lda #0
  sta gwrap
@col:
  lda gwrap
  bne @nd
  jsr put_spr
@nd:
  inc tmp2
  lda tmp4
  clc
  adc #8
  sta tmp4
  bcc @nc
  lda #1
  sta gwrap
@nc:
  dec gc
  bne @col
  lda tmp
  clc
  adc #8
  sta tmp
  dec gr
  bne @row
  rts

oam_start:
  lda #$ff
  sta OAM
  lda #4
  sta oam_i
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
  jsr draw_nt
  lda hi
  ldx #<ADDR_THI
  ldy #>ADDR_THI
  jsr vram_num
  lda #0
  sta state
  sta paused
  sta blink_old
  jsr reset_play
  lda #SONG_MAIN
  jsr music_play
  jsr oam_start
  jsr hide_rest
  jsr screen_on
  rts

; 魚・水・虫を はじめに
reset_play:
  lda #100
  sta fx
  lda #0
  sta fxl
  sta fvl
  sta fvh
  sta face
  sta aim_t
  sta stun
  sta jet_on
  sta spl_t
  ldx #NI-1
@i:
  sta ins_t,x
  sta ins_st,x
  dex
  bpl @i
  ldx #NR-1
@r:
  lda rv_x0,x
  sta rv_x,x
  lda rv_home,x
  sta rv_y,x
  lda #2
  sta rv_st,x
  txa
  sta rv_dir,x
  lda #0
  dex
  bpl @r
  ldx #15
@p:
  sta perch_used,x
  dex
  bpl @p
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
  jmp @put
@off:
  lda #M_PUSH_OFF
@put:
  jsr say_buf
@same:
  jsr demo_swim
  jsr update_fish
  jsr draw_all
  ; 見本のコオロギ（低い枝）
  lda frame
  lsr a
  lsr a
  lsr a
  lsr a
  lsr a
  and #1
  asl a
  asl a
  clc
  adc #S_CR0
  sta tmp2
  lda #104
  sta tmp
  lda #1
  sta tmp3
  lda #48
  sta tmp4
  lda #2
  sta gw
  lda #1
  sta gh
  jsr put_grid
  jsr hide_rest
  lda pad_new
  and #BTN_START
  beq @r
  jsr start_game
@r:
  rts

; 見本: 右へ左へ泳ぐ
demo_swim:
  lda face
  bne @l
  lda fx
  cmp #190
  bcc @goR
  lda #BTN_LEFT
  sta ctl
  rts
@goR:
  lda #BTN_RIGHT
  sta ctl
  rts
@l:
  lda fx
  cmp #30
  bcs @goL
  lda #BTN_RIGHT
  sta ctl
  rts
@goL:
  lda #BTN_LEFT
  sta ctl
  rts

; ================= あそぶ =================
start_game:
  jsr screen_off
  lda #<nt_play_0
  ldx #>nt_play_0
  ldy lang
  beq @p0
  lda #<nt_play_1
  ldx #>nt_play_1
@p0:
  sta ptr
  stx ptr+1
  jsr draw_nt
  lda hi
  ldx #<ADDR_PHI
  ldy #>ADDR_PHI
  jsr vram_num
  lda #0
  sta score
  sta level
  sta paused
  sta newrec
  jsr reset_play
  lda #START_T
  sta tsec
  lda #60
  sta tfr
  lda #10
  sta lvl_c
  lda #40
  sta sp_t
  lda frame
  eor rng
  sta rng
  lda #1
  sta state
  jsr oam_start
  jsr hide_rest
  jsr screen_on
  rts

play_update:
  lda pad_new
  and #BTN_START
  beq @np
  lda paused
  eor #1
  sta paused
  beq @np
  lda #$30           ; 止めたら音も止める
  sta $4004
  sta $4000
  sta $400C
  lda #$80
  sta $4008
  sta $400B
@np:
  lda paused
  beq @run
  rts
@run:
  lda pad
  sta ctl
  jsr update_fish
  ; A で吹く（水のたまが 1 つ飛んでいるあいだは吹けない）
  lda pad_new
  and #BTN_A|BTN_B
  beq @nf
  jsr fire
@nf:
  jsr update_jet
  jsr spawn_ins
  jsr update_ins
  jsr update_rv
  jsr eat_check
  jsr clock
  jsr draw_all
  jsr hide_rest
  jsr hud
  lda tsec
  bne @r
  jsr go_end
@r:
  rts

; ---- 時計と段 ----
clock:
  dec tfr
  bne @r
  lda #60
  sta tfr
  lda tsec
  beq @r
  dec tsec
  lda tsec
  cmp #6
  bcs @nt
  cmp #0
  beq @nt
  jsr sfx_tick
@nt:
  dec lvl_c
  bne @r
  lda #10
  sta lvl_c
  lda level
  cmp #7
  bcs @r
  inc level
@r:
  rts

; ---- テッポウウオの動き（ctl の ←→） ----
update_fish:
  lda aim_t
  beq @na
  dec aim_t
@na:
  lda stun
  beq @ns
  dec stun
@ns:
  lda ctl
  and #BTN_RIGHT
  beq @nr
  lda #0
  sta face
  lda fvl
  clc
  adc #ACC
  sta fvl
  lda fvh
  adc #0
  sta fvh
  jmp @clamp
@nr:
  lda ctl
  and #BTN_LEFT
  beq @fric
  lda #1
  sta face
  lda fvl
  sec
  sbc #ACC
  sta fvl
  lda fvh
  sbc #0
  sta fvh
  jmp @clamp
@fric:
  lda fvh
  bmi @fneg
  ora fvl
  beq @tm
  lda fvl
  sec
  sbc #FRIC
  sta fvl
  lda fvh
  sbc #0
  sta fvh
  bpl @tm
  jmp @zero
@fneg:
  lda fvl
  clc
  adc #FRIC
  sta fvl
  lda fvh
  adc #0
  sta fvh
  bmi @tm
@zero:
  lda #0
  sta fvl
  sta fvh
@tm:
  jmp @move
@clamp:
  ; 速さの上限（さされたあとは おそい）
  lda #<VMAX
  sta tmp
  lda #>VMAX
  sta tmp2
  lda stun
  beq @cl
  lda #<VSTUN
  sta tmp
  lda #>VSTUN
  sta tmp2
@cl:
  lda fvh
  bmi @cneg
  cmp tmp2
  bcc @move
  bne @cpos
  lda fvl
  cmp tmp
  bcc @move
@cpos:
  lda tmp
  sta fvl
  lda tmp2
  sta fvh
  jmp @move
@cneg:
  ; -上限 = (tmp2:tmp) の うら返し +1
  lda tmp
  eor #$ff
  clc
  adc #1
  sta tmp3
  lda tmp2
  eor #$ff
  adc #0
  sta tmp4
  lda fvh
  cmp tmp4
  bcc @cn2
  bne @move
  lda fvl
  cmp tmp3
  bcs @move
@cn2:
  lda tmp3
  sta fvl
  lda tmp4
  sta fvh
@move:
  lda fxl
  clc
  adc fvl
  sta fxl
  lda fx
  adc fvh
  sta fx
  ; はし（左へ行きすぎると 255 側にまわるので、大きいほうで見る）
  lda fvh
  bmi @left
  lda fx
  cmp #FX_MAX+1
  bcc @r
  lda #FX_MAX
  sta fx
  jmp @stop
@left:
  lda fx
  cmp #FX_MAX+1
  bcc @r
  lda #FX_MIN
  sta fx
@stop:
  lda #0
  sta fvl
  sta fvh
  sta fxl
@r:
  ; 口の x
  lda face
  bne @ml
  lda fx
  clc
  adc #22
  sta mouth
  rts
@ml:
  lda fx
  clc
  adc #1
  sta mouth
  rts

; ---- 水を吹く ----
fire:
  lda jet_on
  bne @r
  lda stun
  bne @r
  lda #1
  sta jet_on
  lda mouth
  sta jet_x
  lda #JET_Y0
  sta jet_y
  lda #10
  sta aim_t
  jsr sfx_spit
@r:
  rts

update_jet:
  lda jet_on
  bne @go
  rts
@go:
  lda jet_y
  sec
  sbc #JET_DY
  sta jet_y
  cmp #JET_TOP
  bcs @hit
  lda #0
  sta jet_on
  rts
@hit:
  ; とまっている虫に当たったか
  ldx #NI-1
@l:
  lda ins_st,x
  cmp #2
  bne @nx
  jsr ins_cx           ; cx = 虫の まん中の x・A = 半分の はば
  sta tmp
  lda jet_x
  sec
  sbc cx
  bcs @p
  eor #$ff
  adc #1
@p:
  cmp tmp
  bcs @nx
  lda jet_y            ; 水のたま（8 の高さ）と虫（8 の高さ）が重なる
  clc
  adc #8
  cmp ins_y,x
  bcc @nx
  lda ins_y,x
  clc
  adc #7
  cmp jet_y
  bcc @nx
  jmp knock
@nx:
  dex
  bpl @l
  rts

; X の虫に当たった
knock:
  lda #0
  sta jet_on
  lda #8
  sta spl_t
  lda jet_x
  sta spl_x
  lda jet_y
  sta spl_y
  ldy ins_p,x
  lda #0
  sta perch_used,y
  lda ins_t,x
  cmp #3
  bne @fall
  ; ハチ: おこって飛んでくる
  lda #6
  sta ins_st,x
  jsr sfx_buzz
  rts
@fall:
  lda #4
  sta ins_st,x
  lda #0
  sta ins_xl,x
  sta ins_yl,x
  sta ins_vyl,x
  lda #$ff             ; 上へ 1 ドットはねてから落ちる
  sta ins_vyh,x
  ; 横へ 0.4〜1.4 ドット。向きは でたらめ
  jsr rand
  and #$ff
  sta tmp
  lda #0
  sta tmp2
  lda tmp
  clc
  adc #$60
  sta tmp
  bcc @nc
  inc tmp2
@nc:
  jsr rand
  and #1
  beq @pos
  lda tmp
  eor #$ff
  clc
  adc #1
  sta tmp
  lda tmp2
  eor #$ff
  adc #0
  sta tmp2
@pos:
  lda tmp
  sta ins_vxl,x
  lda tmp2
  sta ins_vxh,x
  jsr sfx_hit
  rts

; X の虫の まん中の x を cx に、A = 当たりの半分の はば
ins_cx:
  lda ins_t,x
  cmp #2
  beq @fly
  lda ins_x,x
  clc
  adc #8
  sta cx
  lda #8
  rts
@fly:
  lda ins_st,x
  cmp #5
  bcs @fl16            ; うかんだハエは 16 はばの絵
  lda ins_x,x
  clc
  adc #4
  sta cx
  lda #6
  rts
@fl16:
  lda ins_x,x
  clc
  adc #8
  sta cx
  lda #6
  rts

; ---- 虫が来る ----
spawn_ins:
  dec sp_t
  beq @go
  rts
@go:
  ldx level
  lda spawn_iv,x
  sta sp_t
  ; とまっている・来ている虫の数
  lda #0
  sta cnt
  ldx #NI-1
@c:
  lda ins_st,x
  beq @cn
  cmp #3
  bcs @cn
  inc cnt
@cn:
  dex
  bpl @c
  ldx level
  lda cnt
  cmp max_ins,x
  bcc @room
  rts
@room:
  ldx #NI-1
@f:
  lda ins_t,x
  beq @got
  dex
  bpl @f
  rts
@got:
  ; とまる所: 0〜n-1（段が上がると高い所も）
  ldy level
  lda n_perch,y
  sta tmp4
  jsr rand
  and #15
@m:
  cmp tmp4
  bcc @pk
  sec
  sbc tmp4
  jmp @m
@pk:
  sta tmp
  ldy tmp4
@try:
  ldx tmp              ; X は あとで虫の番号にもどす
  lda perch_used,x
  beq @free
  inx
  cpx tmp4
  bcc @nw
  ldx #0
@nw:
  stx tmp
  dey
  bne @try
  rts
@free:
  ; 空いている虫の番号をさがしなおす
  ldx #NI-1
@f2:
  lda ins_t,x
  beq @g2
  dex
  bpl @f2
  rts
@g2:
  ldy tmp
  lda #1
  sta perch_used,y
  tya
  sta ins_p,x
  lda perch_f,y
  sta ins_f,x
  ; 種類
  jsr rand
  and #15
  ldy level
  cmp wasp_ch,y
  bcs @nw2
  lda #3
  jmp @ty
@nw2:
  jsr rand
  and #15
  ldy level
  cmp fly_ch,y
  bcs @cr
  lda #2
  jmp @ty
@cr:
  lda #1
@ty:
  sta ins_t,x
  lda #1
  sta ins_st,x
  jsr ins_target       ; tmp = とまる x・tmp2 = とまる y
  ; うしろの上から飛んで来る
  lda ins_f,x
  bne @fromR
  lda tmp
  sec
  sbc #56
  bcs @sx
  lda #0
  jmp @sx
@fromR:
  lda tmp
  clc
  adc #56
  bcs @cR
  cmp #240
  bcc @sx
@cR:
  lda #240
@sx:
  sta ins_x,x
  lda tmp2
  sec
  sbc #40
  cmp #28
  bcs @sy
  lda #28
@sy:
  sta ins_y,x
  lda #0
  sta ins_xl,x
  sta ins_yl,x
  rts

; X の虫のとまる所 → tmp = x・tmp2 = y
ins_target:
  ldy ins_p,x
  lda perch_x,y
  sta tmp
  lda ins_t,x
  cmp #2
  bne @n
  lda tmp
  clc
  adc #4
  sta tmp
@n:
  lda perch_y,y
  sta tmp2
  rts

; ---- 虫の動き ----
update_ins:
  ldx #NI-1
@l:
  lda ins_st,x
  bne @live
  jmp @next
@live:
  cmp #1
  bne @n2
  jsr st_arrive
  jmp @next
@n2:
  cmp #2
  bne @n3
  jsr st_perch
  jmp @next
@n3:
  cmp #3
  bne @n4
  jsr ins_move
  lda ins_y,x
  cmp #20
  bcc @kill
  lda ins_x,x
  cmp #244
  bcs @kill
  jmp @next
@n4:
  cmp #4
  bne @n5
  jsr st_fall
  jmp @next
@n5:
  cmp #5
  bne @n6
  jsr st_float
  jmp @next
@n6:
  jsr st_angry
  jmp @next
@kill:
  jsr ins_kill
@next:
  dex
  bmi @r
  jmp @l
@r:
  rts

ins_kill:
  lda #0
  sta ins_t,x
  sta ins_st,x
  rts

; 来る: とまる所へ 1 ドットずつ（ハエは横に 2）
st_arrive:
  jsr ins_target
  lda ins_x,x
  cmp tmp
  beq @y
  bcc @r1
  dec ins_x,x
  lda ins_t,x
  cmp #2
  bne @y
  lda ins_x,x
  cmp tmp
  beq @y
  dec ins_x,x
  jmp @y
@r1:
  inc ins_x,x
  lda ins_t,x
  cmp #2
  bne @y
  lda ins_x,x
  cmp tmp
  beq @y
  inc ins_x,x
@y:
  lda ins_y,x
  cmp tmp2
  beq @at
  inc ins_y,x
  rts
@at:
  lda ins_x,x
  cmp tmp
  bne @r
  lda #2
  sta ins_st,x
  ; とまる長さ（2 フレームで 1 へる）
  ldy level
  lda ins_t,x
  cmp #1
  bne @nc
  lda stay_cr,y
  jmp @st
@nc:
  cmp #2
  bne @nwa
  lda stay_fl,y
  jmp @st
@nwa:
  lda #150
@st:
  sta tmp3
  jsr rand
  and #31
  clc
  adc tmp3
  sta ins_tm,x
@r:
  rts

st_perch:
  lda frame
  and #1
  bne @r
  dec ins_tm,x
  bne @r
  ; 飛んで行く
  ldy ins_p,x
  lda #0
  sta perch_used,y
  lda #3
  sta ins_st,x
  lda #0
  sta ins_xl,x
  sta ins_yl,x
  sta ins_vyl,x
  lda #$ff
  sta ins_vyh,x
  lda ins_f,x
  bne @lf
  lda #$80
  sta ins_vxl,x
  lda #1
  sta ins_vxh,x
  rts
@lf:
  lda #$80
  sta ins_vxl,x
  lda #$fe
  sta ins_vxh,x
@r:
  rts

; x += vx・y += vy（8.8・符号つき）
ins_move:
  lda ins_xl,x
  clc
  adc ins_vxl,x
  sta ins_xl,x
  lda ins_x,x
  adc ins_vxh,x
  sta ins_x,x
  lda ins_yl,x
  clc
  adc ins_vyl,x
  sta ins_yl,x
  lda ins_y,x
  adc ins_vyh,x
  sta ins_y,x
  rts

st_fall:
  lda ins_vyl,x
  clc
  adc #GRAV
  sta ins_vyl,x
  lda ins_vyh,x
  adc #0
  sta ins_vyh,x
  jsr ins_move
  ; 左右のはねかえり（落ちる所は 24〜216）
  lda ins_x,x
  cmp #24
  bcc @bl
  cmp #217
  bcc @y
  lda #216
  jmp @neg
@bl:
  lda #24
@neg:
  sta ins_x,x
  lda ins_vxl,x
  eor #$ff
  clc
  adc #1
  sta ins_vxl,x
  lda ins_vxh,x
  eor #$ff
  adc #0
  sta ins_vxh,x
@y:
  lda ins_vyh,x
  bmi @r
  lda ins_y,x
  cmp #FLOAT_Y
  bcc @r
  ; 水に落ちた
  lda #FLOAT_Y
  sta ins_y,x
  lda #5
  sta ins_st,x
  lda #FLOAT_T
  sta ins_tm,x
  lda #0
  sta ins_vyh,x        ; うかんでからは「ほかの魚が来ているか」に使う
  lda ins_t,x
  cmp #2
  bne @ns
  lda ins_x,x          ; ハエは 16 はばの絵にかわるので左へ 4
  sec
  sbc #4
  sta ins_x,x
@ns:
  jsr sfx_plop
@r:
  rts

st_float:
  dec ins_tm,x
  bne @live
  jmp ins_kill         ; しずんだ
@live:
  lda ins_vyh,x
  bne @r
  ; ほかの魚をよぶ（深い所で ぶらぶらしている魚）
  ldy #NR-1
@f:
  lda rv_st,y
  cmp #2
  beq @got
  dey
  bpl @f
  rts
@got:
  lda #1
  sta ins_vyh,x
  txa
  sta rv_bug,y
  lda #0
  sta rv_st,y
@r:
  rts

; おこったハチ: テッポウウオの口へ 2 ドットずつ。とどいたら さす
st_angry:
  lda fx
  clc
  adc #4
  sta tmp
  lda #112
  sta tmp2
  lda ins_x,x
  cmp tmp
  beq @y
  bcc @rt
  dec ins_x,x
  dec ins_x,x
  lda #1
  sta ins_f,x
  jmp @y
@rt:
  inc ins_x,x
  inc ins_x,x
  lda #0
  sta ins_f,x
@y:
  lda ins_y,x
  cmp tmp2
  bcs @d
  inc ins_y,x
  inc ins_y,x
@d:
  lda ins_x,x
  sec
  sbc tmp
  bcs @p
  eor #$ff
  adc #1
@p:
  cmp #6
  bcs @r
  lda ins_y,x
  cmp #110
  bcc @r
  ; さされた
  lda score
  sec
  sbc #2
  bcs @s
  lda #0
@s:
  sta score
  lda #90
  sta stun
  jsr sfx_sting
  lda #3               ; 飛んで行く
  sta ins_st,x
  lda #0
  sta ins_vyl,x
  lda #$fe
  sta ins_vyh,x
  lda #$00
  sta ins_vxl,x
  lda #$02
  sta ins_vxh,x
@r:
  rts

; ---- ほかの魚 ----
; ふだんは深い所を ゆっくり行ったり来たり（st 2）。虫が水に落ちると上がってきて とりに行く（st 0）
update_rv:
  ldy #NR-1
@l:
  lda rv_st,y
  beq @hunt
  ; ぶらぶら: 0.5 ドットずつ、はしで ふりかえる。深さは もとの所へ
  lda rv_y,y
  cmp rv_home,y
  beq @wx
  bcs @up
  clc
  adc #1
  jmp @sy
@up:
  sec
  sbc #1
@sy:
  sta rv_y,y
@wx:
  lda frame
  and #1
  bne @next0
  lda rv_dir,y
  bne @wl
  lda rv_x,y
  clc
  adc #1
  sta rv_x,y
  cmp #216
  bcc @next0
  lda #1
  sta rv_dir,y
  jmp @next0
@wl:
  lda rv_x,y
  sec
  sbc #1
  sta rv_x,y
  cmp #16
  bcs @next0
  lda #0
  sta rv_dir,y
@next0:
  jmp @next
@hunt:
  ldx rv_bug,y
  lda ins_st,x
  cmp #5
  beq @ok
  lda #2               ; 虫がもういない: もどる
  sta rv_st,y
  jmp @next
@ok:
  ; 上がる
  lda rv_y,y
  cmp #RV_Y+1
  bcc @hi
  sec
  sbc #1
  sta rv_y,y
@hi:
  sty tmp4
  jsr ins_cx
  ldy tmp4
  lda rv_dir,y
  bne @ml
  lda rv_x,y
  clc
  adc #22
  jmp @m
@ml:
  lda rv_x,y
  clc
  adc #1
@m:
  sta tmp              ; ほかの魚の口
  sec
  sbc cx
  bcs @pp
  eor #$ff
  adc #1
@pp:
  cmp #3
  bcs @chase
  lda rv_y,y           ; 口がとどく深さまで上がってから
  cmp #RV_Y+3
  bcs @next
  ; とられた
  lda cx
  sta spl_x
  lda #FLOAT_Y
  sta spl_y
  lda #10
  sta spl_t
  jsr ins_kill
  lda #2
  sta rv_st,y
  sty tmp4
  jsr sfx_steal
  ldy tmp4
  jmp @next
@chase:
  lda tmp
  cmp cx
  bcs @goL
  lda #0
  sta rv_dir,y
  jsr rv_right
  jmp @next
@goL:
  lda #1
  sta rv_dir,y
  jsr rv_left
@next:
  dey
  bmi @r
  jmp @l
@r:
  rts

rv_right:
  ldx level
  lda rv_xl,y
  clc
  adc rv_spl,x
  sta rv_xl,y
  lda rv_x,y
  adc rv_sph,x
  cmp #233
  bcc @s
  lda #232
@s:
  sta rv_x,y
  rts

rv_left:
  ldx level
  lda rv_xl,y
  sec
  sbc rv_spl,x
  sta rv_xl,y
  lda rv_x,y
  sbc rv_sph,x
  bcs @s
  lda #0
@s:
  sta rv_x,y
  rts

; ---- 食べる ----
eat_check:
  lda stun
  bne @r
  ldx #NI-1
@l:
  lda ins_st,x
  cmp #5
  bne @nx
  jsr ins_cx
  lda mouth
  sec
  sbc cx
  bcs @p
  eor #$ff
  adc #1
@p:
  cmp #10
  bcs @nx
  ; 食べた
  jsr ins_kill
  lda score
  cmp #250
  bcs @ns
  inc score
@ns:
  lda tsec
  clc
  adc #EAT_T
  cmp #100
  bcc @t
  lda #99
@t:
  sta tsec
  lda cx
  sta spl_x
  lda #FLOAT_Y
  sta spl_y
  lda #8
  sta spl_t
  jsr sfx_eat
@nx:
  dex
  bpl @l
@r:
  rts

; ---- 絵 ----
draw_all:
  jsr oam_start
  ; さされた！
  lda stun
  cmp #50
  bcc @nw
  lda frame
  and #4
  bne @nw
  lda #108
  sta tmp
  lda #S_WARN
  sta tmp2
  lda #2
  sta tmp3
  lda fx
  clc
  adc #8
  sta tmp4
  lda #1
  sta gw
  lda #2
  sta gh
  jsr put_grid
@nw:
  ; テッポウウオ
  lda stun
  and #4
  bne @nofish
  lda #0               ; 絵: 吹く・尾をふる
  ldx aim_t
  bne @aim
  lda frame
  and #8
  beq @pose
  lda #12
  bne @pose
@aim:
  lda #24
@pose:
  ldx face
  beq @fr
  clc
  adc #6
@fr:
  clc
  adc #S_FISHA
  sta tmp2
  lda #FISH_Y
  sta tmp
  lda #0
  sta tmp3
  lda fx
  sta tmp4
  lda #3
  sta gw
  lda #2
  sta gh
  jsr put_grid
@nofish:
  ; 水のたまと すじ
  lda jet_on
  beq @nojet
  lda jet_x
  sec
  sbc #4
  sta tmp4
  lda jet_y
  sta tmp
  lda #S_JET
  sta tmp2
  lda #3
  sta tmp3
  lda #1
  sta gw
  sta gh
  jsr put_grid
  ldx #0
@st:
  lda jet_y
  clc
  adc st_off,x
  cmp #122
  bcs @nojet
  sta tmp
  lda jet_x
  sec
  sbc #4
  sta tmp4
  lda frame
  and #2
  lsr a
  clc
  adc #S_ST0
  sta tmp2
  lda #1
  sta gw
  sta gh
  txa
  pha
  jsr put_grid
  pla
  tax
  inx
  cpx #3
  bne @st
@nojet:
  ; しぶき
  lda spl_t
  beq @nospl
  dec spl_t
  lda spl_x
  sec
  sbc #8
  sta tmp4
  lda spl_y
  sec
  sbc #4
  sta tmp
  lda #3
  sta tmp3
  lda #S_SPLB
  ldx spl_t
  cpx #5
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
  ; 虫
  ldx #NI-1
@i:
  lda ins_st,x
  beq @in
  txa
  pha
  jsr draw_ins
  pla
  tax
@in:
  dex
  bpl @i
  ; ほかの魚（あそんでいるときだけ。板の上には出さない）
  lda state
  cmp #1
  bne @rdone
  ldx #NR-1
@rv:
  lda rv_y,x
  sta tmp
  lda rv_x,x
  sta tmp4
  lda #3
  sta tmp3
  lda frame
  and #8
  beq @rp
  lda #6
@rp:
  ldy rv_dir,x
  beq @rr
  clc
  adc #3
@rr:
  clc
  adc #S_RVA
  sta tmp2
  lda #3
  sta gw
  lda #1
  sta gh
  txa
  pha
  jsr put_grid
  pla
  tax
@rn:
  dex
  bpl @rv
@rdone:
  rts

; X の虫の絵
draw_ins:
  lda ins_y,x
  sta tmp
  lda ins_x,x
  sta tmp4
  lda #1
  sta gh
  ; 絵の形: 0・1 とまる・2・3 飛ぶ
  lda ins_st,x
  cmp #5
  bne @nfl
  jmp @float
@nfl:
  cmp #2
  bne @fly
  lda ins_tm,x
  cmp #24              ; もうすぐ飛ぶ: はねをふるわせる
  bcc @buzz
  lda frame
  lsr a
  lsr a
  lsr a
  lsr a
  lsr a
  sta tmp2
  txa
  adc tmp2
  and #1
  jmp @pz
@buzz:
  lda frame
  and #2
  lsr a
  ora #2
  jmp @pz
@fly:
  cmp #4
  bne @fly2
  lda #0
  jmp @pz
@fly2:
  lda frame
  and #2
  lsr a
  ora #2
@pz:
  sta tmp2             ; 形 0〜3
  lda ins_st,x
  cmp #4
  bne @nv
  lda #$80             ; 落ちる: さかさま
  jmp @at
@nv:
  lda #0
@at:
  sta tmp3
  lda ins_t,x
  cmp #2
  beq @fl
  cmp #3
  beq @wa
  ; コオロギ
  lda #S_CR0
  jsr @base2
  lda #1
  ora tmp3
  sta tmp3
  jmp put_grid
@wa:
  lda #S_WA0
  jsr @base2
  lda #2
  ora tmp3
  sta tmp3
  jmp put_grid
@fl:
  lda tmp2
  asl a
  clc
  adc ins_f,x
  clc
  adc #S_FL0
  sta tmp2
  lda #1
  sta gw
  ora tmp3
  sta tmp3
  jmp put_grid
@base2:                ; A = はじめの絵 → tmp2 = はじめ + 形×4 + 向き×2
  sta gc
  lda tmp2
  asl a
  asl a
  clc
  adc gc
  ldy ins_f,x
  beq @b0
  clc
  adc #2
@b0:
  sta tmp2
  lda #2
  sta gw
  rts
@float:
  ldy ins_tm,x
  cpy #50
  bcs @fv
  lda frame            ; しずみかけ: 点めつ
  and #4
  beq @fv
  rts
@fv:
  lda frame
  and #16
  lsr a
  lsr a
  lsr a                ; 0 か 2
@fa:
  clc
  ldy ins_t,x
  cpy #2
  bne @fc
  adc #S_FLF0
  jmp @fd
@fc:
  adc #S_FLC0
@fd:
  sta tmp2
  lda #1
  sta tmp3
  lda #2
  sta gw
  jmp put_grid

; 数を字の段へ
hud:
  lda #3
  sta ndig
  lda score
  ldx #<ADDR_SCORE
  ldy #>ADDR_SCORE
  jsr buf_num
  lda #2
  sta ndig
  lda tsec
  ldx #<ADDR_TIME
  ldy #>ADDR_TIME
  jmp buf_num

; ================= おわり =================
go_end:
  lda #2
  sta state
  lda #0
  sta end_t
  sta jet_on
  lda score
  cmp hi
  bcc @nohi
  beq @nohi
  sta hi
  sta SAVE+4
  eor #$ff
  sta SAVE+5
  lda #1
  sta newrec
@nohi:
  lda #SONG_OVER
  jsr music_play
  rts

end_update:
  lda end_t
  cmp #200
  bcs @k
  inc end_t
@k:
  lda #0
  sta ctl
  lda end_t
  cmp #50
  bcs @res
  jsr update_fish
  jsr draw_all
  jsr hide_rest
  rts
@res:
  beq @draw
  jmp @wait
@draw:
  ; 結果を出す
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
  jsr draw_nt
  lda #M_E_TITLE
  jsr say_ptr
  jsr vram_msg
  lda #M_E_SCORE
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
  lda score
  ldx #<ADDR_ESCORE
  ldy #>ADDR_ESCORE
  jsr vram_num
  lda hi
  ldx #<ADDR_EBEST
  ldy #>ADDR_EBEST
  jsr vram_num
  lda score
  ldx #<ADDR_SCORE
  ldy #>ADDR_SCORE
  jsr vram_num
  ; のこりは 00
  bit PPUSTATUS
  lda #>ADDR_TIME
  sta PPUADDR
  lda #<ADDR_TIME
  sta PPUADDR
  lda #T_0
  sta PPUDATA
  sta PPUDATA
  lda hi
  ldx #<ADDR_PHI
  ldy #>ADDR_PHI
  jsr vram_num
  jsr reset_play
  jsr oam_start
  jsr hide_rest
  jsr screen_on
  rts
@wait:
  jsr demo_swim
  jsr update_fish
  jsr draw_all
  jsr hide_rest
  lda end_t
  cmp #80
  bcc @r
  lda frame
  and #$20
  cmp blink_old
  beq @same
  sta blink_old
  cmp #0
  bne @off
  lda #M_PUSH
  jmp @put
@off:
  lda #M_PUSH_OFF
@put:
  jsr say_buf
@same:
  lda pad_new
  and #BTN_START
  beq @r
  jsr go_title
@r:
  rts

; ================= 音 =================
sfx_spit:
  lda #%00000010       ; しゅっ
  sta $400C
  lda #$03
  sta $400E
  lda #$10
  sta $400F
  lda #%10010011
  sta $4000
  lda #%10010010
  sta $4001
  lda #$a0
  sta $4002
  lda #$08
  sta $4003
  rts

sfx_hit:
  lda #%01010011       ; ぱちっ
  sta $4000
  lda #$00
  sta $4001
  lda #$60
  sta $4002
  lda #$08
  sta $4003
  rts

sfx_plop:
  lda #%00000011       ; ぽちゃ
  sta $400C
  lda #$08
  sta $400E
  lda #$10
  sta $400F
  rts

sfx_eat:
  lda #%10010100       ; ぱくっ（上がる）
  sta $4000
  lda #%10001011
  sta $4001
  lda #$f0
  sta $4002
  lda #$08
  sta $4003
  rts

sfx_steal:
  lda #%01010100       ; とられた（下がる）
  sta $4000
  lda #%10100010
  sta $4001
  lda #$80
  sta $4002
  lda #$09
  sta $4003
  rts

sfx_buzz:
  lda #%00010100       ; ぶーん
  sta $4000
  lda #$00
  sta $4001
  lda #$f0
  sta $4002
  lda #$0b
  sta $4003
  rts

sfx_sting:
  lda #%00000100
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

sfx_tick:
  lda #%10010010
  sta $4000
  lda #$00
  sta $4001
  lda #$40
  sta $4002
  lda #$08
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
  lda SAVE+4
  eor #$ff
  cmp SAVE+5
  bne @new
  lda SAVE+4
  sta hi
  rts
@new:
  ldx #3
@w:
  lda save_magic,x
  sta SAVE,x
  dex
  bpl @w
  lda #0
  sta hi
  sta SAVE+4
  lda #$ff
  sta SAVE+5
  rts

; 曲の係（music_play・music_stop・music_update）は src/music.s（build がつなぐ）

; ================= 決まりの表（段 0〜7） =================
save_magic: .byte 'A', 'F', '0', '1'
spawn_iv: .byte 70, 62, 56, 50, 46, 42, 38, 34
max_ins: .byte 3, 3, 4, 4, 4, 5, 5, 5
n_perch: .byte 5, 6, 7, 8, 9, 10, 10, 10
wasp_ch: .byte 0, 2, 2, 3, 3, 4, 4, 5
fly_ch: .byte 3, 5, 6, 7, 8, 9, 10, 11
stay_cr: .byte 190, 175, 160, 145, 130, 118, 106, 96
stay_fl: .byte 110, 100, 90, 80, 72, 64, 56, 50
rv_spl: .byte $c0, $d8, $f0, $08, $20, $38, $50, $68
rv_sph: .byte 0, 0, 0, 1, 1, 1, 1, 1
st_off: .byte 8, 16, 24
rv_x0: .byte 40, 170
rv_home: .byte 184, 196
