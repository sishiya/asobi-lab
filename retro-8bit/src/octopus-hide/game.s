; タコの かくれんぼ（あそびラボ 2026）。8ビット互換機の 6502 のアセンブリ。
; ビルド: node retro-8bit/tools/build.mjs octopus-hide（絵の番号 T_・S_ と画面のデータは data.mjs が足す）
; 決まり: 横から見た海の底。底（砂・岩・海藻）はゆっくり左へ流れる（タコは じっとしていれば その場にいる）。
;   ←→ で歩き、A で体の色を 砂 → 岩 → 海藻 と変える（変わるあいだは白っぽい）。
;   サメが上を通るとき、タコが 足もとの底と同じ色で じっとしていれば かくれられる（+5）。ちがう色・動いている・
;   色を変えているとちゅうだと見つかって すみをはく（ハートが へる）。カニとエビを食べると +10。3 回見つかると おしまい
; 画面: 上の 4 行（字の段）は止めたまま、0 番のスプライトの当たりのあとで下だけ横に流す。海の底は 1 列ずつ書きたす

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
MASK_ON = %00011000   ; 背景とスプライトを出す（左の 8 ドットは隠す＝そこで海の底を書きかえる）

BTN_A = $80
BTN_B = $40
BTN_START = $10
BTN_LEFT = $02
BTN_RIGHT = $01

OY = 175           ; タコの上の y（OAM。底の面は 192）
OX_MIN = 8
OX_MAX = 224
FOOD_Y = 183
CHG_T = 12         ; 色を変えるのにかかるフレーム（本物のタコも 0.2〜0.7 秒）
NH = 2             ; サメの数
NF = 2             ; カニ・エビの数
BITE_Y = 166        ; かみつくときのサメの上の y
ZONE = 12          ; サメのまん中とタコのまん中が これより近いと 見られる
LVL_FR = 240       ; 240 フレーム × 3 = 12 秒ごとに段が上がる

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
ox = $10           ; タコの左の x（8.8）
oxl = $11
ocol = $12         ; 体の色 0 砂・1 岩・2 海藻
chg_t = $13        ; 色を変えているあいだ
moving = $14       ; 1 = 歩いている／おされている
face = $15         ; $40 = 左むき
inp = $16          ; タコへの入力（あそぶときはパッド、タイトルでは見本の入力）
inp_new = $17
sx = $18           ; 横に流した量（8.8）
sxl = $19
spl = $1A          ; 流れる速さ（8.8）
sph = $1B
score = $1C        ; 点 4 けた（上のけたから）
hi = $20           ; 4 けた
lives = $24
inv = $25          ; 見つかったあと、すみに かくれているあいだ
sp_t = $26
level = $27
oam_i = $28
end_t = $29
lang = $2A
blink_old = $2B
split = $2C        ; 1 = 字の段の下で横に流す
mus_on = $2D
paused = $2E
c0 = $2F           ; いま左のはしにある列
mus_ptr0 = $30
mus_t0 = $32
mus_base0 = $33
mus_ptr1 = $35
mus_t1 = $37
mus_base1 = $38
ctrl = $3E         ; いまの PPUCTRL（画面を消しているあいだは 0）
hint_cur = $3F
hz_type = $40      ; 0 なし・1 サメ（NH ずつ）
hz_st = $42        ; 0 ！を出している・1 泳いでいる
hz_t = $44
hz_x = $46         ; x（16 ビット。左の外は $FFxx、右の外は $01xx）
hz_xh = $48
hz_xl = $4A
hz_y = $4C
hz_dir = $4E       ; 0 左から右・1 右から左
hz_v = $50         ; 速さ（8.8）
hz_vh = $52
hz_done = $54      ; 1 = もう見た（見つけた／通りすぎた）
fd_type = $58      ; 0 なし・1 カニ・2 エビ（NF ずつ）
fd_x = $5A
fd_xh = $5C
fd_xl = $5E
pop_t = $60        ; 点のしるし（+10／+5）
pop_x = $61
pop_y = $62
pop_k = $63
ink_t = $64
ink_x = $65
newrec = $66
gw = $67           ; put_grid: よこ・たての枚数
gh = $68
gc = $69
gr = $6A
gxl = $6B          ; x（16 ビット）
gxh = $6C
gt = $6D           ; 行のはじめの絵
gx0l = $6E
gx0h = $6F
gstep = $70
seg_n = $71        ; 海の底: いまの種類の のこりの列
seg_t = $72        ; いまの種類
wcol = $73         ; 書いた列の数（絵の左右・2 枚を選ぶ）
lvl_t = $74
lvl_s = $75
fd_t = $76
demo_t = $77
eaten = $78
hidden = $79
shake_t = $7A      ; 画面のゆれ
shake_x = $7B
opal_cur = $7C     ; いまのタコのパレット（$FF = 書きなおす）
found_t = $7D      ; 「みつかった!」を出しているあいだ
LANG = $7FFF
SAVE = $6000       ; 電池の RAM: "OH01"・さいこうの点 4 けた

OAM = $0200
BUF = $0300
FT = $0400         ; 列ごとの底の種類（32）

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
  sta ctrl
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
  jsr flush
  lda #0
  sta buf_ready
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

; 書くもの（番地の上・下・長さ・中身 …、0 でおわり）を書く。長さの上のビットが 1 なら たてに（32 ずつ）
flush:
  ldx #0
@ent:
  lda BUF,x
  beq @end
  sta PPUADDR
  lda BUF+1,x
  sta PPUADDR
  lda BUF+2,x
  bpl @h
  and #$7f
  tay
  lda ctrl
  ora #4
  sta PPUCTRL
  jmp @g
@h:
  tay
  lda ctrl
  sta PPUCTRL
@g:
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
  lda ctrl
  sta PPUCTRL
  lda #0
  sta buf_len
  sta BUF
  rts

; 書くものを閉じて、つぎの帰線を待つ。そのあと 0 番の当たりを待って、字の段より下を横に流す
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
  lda sx
  clc
  adc shake_x
  sta PPUSCROLL
  lda #0
  sta PPUSCROLL
@r:
  rts

; ================= 画面の道具 =================
screen_off:
  jsr wait_frame
  lda #0
  sta split
  sta ctrl
  sta PPUCTRL
  sta PPUMASK
  sta buf_len
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
  sta ctrl
  sta PPUCTRL
  lda #MASK_ON
  sta PPUMASK
  lda #1
  sta split
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

; ptr の 1024 バイトを画面の表 A（$20 か $24）へ（画面を消してから）。ptr はこわさない
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

; A = 画面の番号（0 タイトル・1 あそぶ・2 おわり）→ ことばに合った画面を $2000 と $2400 に
draw_screen:
  asl a
  ora lang
  asl a
  tax
  lda nt_tab,x
  sta ptr
  lda nt_tab+1,x
  sta ptr+1
  lda #$20
  jsr draw_nt
  lda #$24
  jsr draw_nt
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

; 4 けたの数を、画面を消したまま書く: A = 番地の上・tmp = 下・X = ゼロページの数の場所
vram_digits:
  bit PPUSTATUS
  sta PPUADDR
  lda tmp
  sta PPUADDR
  ldy #4
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

say_buf:
  jsr say_ptr
  jmp buf_data

; タコの色をスプライトのパレット 0 へ（A = 0 砂・1 岩・2 海藻・3 とちゅう）
oct_palette:
  sta tmp4
  asl a
  clc
  adc tmp4
  sta tmp4
  lda #$3f
  ldx #$11
  ldy #3
  jsr buf_head
  ldx tmp4
  lda oct_pal,x
  jsr buf_byte
  lda oct_pal+1,x
  jsr buf_byte
  lda oct_pal+2,x
  jsr buf_byte
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

; gw×gh 枚の絵（gt から順に）を x = gxl/gxh（16 ビット）・y = tmp に。tmp3 の $40 で左右を返す。画面の外の絵は出さない
put_grid:
  lda gh
  sta gr
@row:
  lda gxl
  sta gx0l
  lda gxh
  sta gx0h
  lda gw
  sta gc
  lda tmp3
  and #$40
  beq @nf
  lda gt
  clc
  adc gw
  sec
  sbc #1
  sta tmp2
  lda #$ff
  sta gstep
  jmp @col
@nf:
  lda gt
  sta tmp2
  lda #1
  sta gstep
@col:
  lda gx0h
  bne @nd
  lda gx0l
  sta tmp4
  jsr put_spr
@nd:
  lda tmp2
  clc
  adc gstep
  sta tmp2
  lda gx0l
  clc
  adc #8
  sta gx0l
  lda gx0h
  adc #0
  sta gx0h
  dec gc
  bne @col
  lda gt
  clc
  adc gw
  sta gt
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
  lda #248
  sta OAM+3
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

; ================= 海の底 =================
; つぎの列の種類 → A（種類が切りかわるときは ちがう種類に。長さは段で短くなる）
gen_next:
  lda seg_n
  bne @same
  jsr rand
  and #1
  sec
  adc seg_t            ; seg_t + 1 か + 2
  cmp #3
  bcc @ok
  sbc #3
@ok:
  sta seg_t
  jsr rand
  ldx level
  and len_mask,x
  clc
  adc len_min,x
  sta seg_n
@same:
  dec seg_n
  inc wcol
  lda seg_t
  rts

; X = 画面の表の列。つぎの列を作って、書くものへ（$2000 と $2400 の両方、22〜29 行をたてに）
stream_col:
  stx tmp3
  jsr gen_next
  ldx tmp3
  sta FT,x
  asl a
  asl a
  sta tmp
  lda wcol
  and #3
  ora tmp
  asl a
  asl a
  asl a
  sta tmp4
  lda #$22
  jsr col_entry
  lda #$26
  jsr col_entry
  rts

col_entry:
  ldy buf_len
  sta BUF,y
  lda tmp3
  clc
  adc #$c0
  sta BUF+1,y
  lda #$88
  sta BUF+2,y
  iny
  iny
  iny
  ldx tmp4
  lda #8
  sta tmp2
@l:
  lda floor_tab,x
  sta BUF,y
  inx
  iny
  dec tmp2
  bne @l
  sty buf_len
  rts

; 画面を消したまま 32 列を書く（1・2 … 31・0 の順。0 は左の隠れた所なので、つぎに右から出る列）
fill_floor:
  ldx #1
@l:
  stx c0
  jsr stream_col
  lda #0
  ldx buf_len
  sta BUF,x
  jsr flush
  ldx c0
  inx
  cpx #33
  beq @r
  cpx #32
  bne @l
  ldx #0
  stx c0
  jsr stream_col
  lda #0
  ldx buf_len
  sta BUF,x
  jsr flush
@r:
  lda #0
  sta c0
  rts

; 海の底を流す。左のはしの列が かわったら、その列に新しい底を書く（右のはしから出てくる）
scroll_on:
  lda sxl
  clc
  adc spl
  sta sxl
  lda sx
  adc sph
  sta sx
  lsr a
  lsr a
  lsr a
  cmp c0
  beq @r
  sta c0
  tax
  jsr stream_col
@r:
  rts

; 画面の x = A のところの底の種類 → A
floor_at:
  clc
  adc sx
  lsr a
  lsr a
  lsr a
  tax
  lda FT,x
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
  lda #0
  jsr draw_screen
  lda #<ADDR_THI
  sta tmp
  lda #>ADDR_THI
  ldx #hi
  jsr vram_digits
  lda #$4d             ; 見本の底はいつも同じ
  sta rng
  lda #$a1
  sta rng+1
  lda #0
  sta level
  sta state
  sta paused
  sta blink_old
  sta sx
  sta sxl
  sta sph
  sta spl
  sta seg_t
  lda #9
  sta seg_n
  jsr fill_floor
  jsr reset_octo
  lda #60
  sta ox
  jsr clear_things
  lda frame
  sta rng
  lda #SONG_MAIN
  jsr music_play
  jsr oam_start
  jsr hide_rest
  jsr screen_on
  lda #$ff
  sta opal_cur
  rts

reset_octo:
  lda #96
  sta ox
  lda #0
  sta oxl
  sta ocol
  sta chg_t
  sta moving
  sta face
  sta inv
  sta ink_t
  sta pop_t
  rts

clear_things:
  lda #0
  ldx #NH-1
@l:
  sta hz_type,x
  dex
  bpl @l
  ldx #NF-1
@f:
  sta fd_type,x
  dex
  bpl @f
  rts

blink_push:
  lda frame
  and #$20
  cmp blink_old
  beq @same
  sta blink_old
  cmp #0
  bne @off
  lda #M_PUSH
  jmp say_buf
@off:
  lda #M_PUSH_OFF
  jmp say_buf
@same:
  rts

; 見本: 歩いては止まり、足もとの底に色を合わせる
demo_input:
  lda #0
  sta inp
  sta inp_new
  inc demo_t
  lda demo_t
  and #$40
  bne @stop
  lda face
  bne @gl
  lda ox
  cmp #196
  bcc @gr
  lda #BTN_LEFT
  sta inp
  rts
@gr:
  lda #BTN_RIGHT
  sta inp
  rts
@gl:
  lda ox
  cmp #28
  bcs @gl2
  lda #BTN_RIGHT
  sta inp
  rts
@gl2:
  lda #BTN_LEFT
  sta inp
  rts
@stop:
  lda chg_t
  bne @r
  lda ox
  clc
  adc #12
  jsr floor_at
  cmp ocol
  beq @r
  lda demo_t
  and #7
  bne @r
  lda #BTN_A
  sta inp_new
@r:
  rts

title_update:
  jsr blink_push
  jsr demo_input
  jsr update_octo
  jsr pal_update
  jsr draw_all
  lda pad_new
  and #BTN_START
  beq @r
  jsr start_game
@r:
  rts

; ================= あそぶ =================
start_game:
  jsr screen_off
  lda #1
  jsr draw_screen
  lda #<ADDR_PHI
  sta tmp
  lda #>ADDR_PHI
  ldx #hi
  jsr vram_digits
  lda frame
  eor rng
  sta rng
  lda #0
  ldx #3
@z:
  sta score,x
  dex
  bpl @z
  sta level
  sta sx
  sta sxl
  sta paused
  sta newrec
  sta lvl_t
  sta lvl_s
  sta eaten
  sta hidden
  sta hint_cur
  sta shake_t
  sta shake_x
  sta found_t
  sta seg_t            ; はじめはタコの まわりが砂（タコも砂の色）
  lda #22
  sta seg_n
  jsr fill_floor
  jsr reset_octo
  jsr clear_things
  jsr set_speed
  lda #3
  sta lives
  lda #150
  sta sp_t
  lda #90
  sta fd_t
  lda #1
  sta state
  jsr oam_start
  jsr hide_rest
  jsr screen_on
  lda #$ff
  sta opal_cur
  rts

set_speed:
  lda level
  asl a
  asl a
  sta tmp
  asl a
  clc
  adc tmp              ; level × 12
  adc #$80
  sta spl
  lda #0
  sta sph
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
  lda #$80
  sta $4008
  sta $400B
@np:
  lda paused
  beq @run
  rts
@run:
  lda pad
  sta inp
  lda pad_new
  sta inp_new
  jsr scroll_on
  jsr update_octo
  jsr level_up
  jsr spawn
  jsr update_hz
  jsr update_food
  jsr pal_update
  jsr do_shake
  lda found_t
  beq @nf
  dec found_t
@nf:
  lda inv
  beq @ni
  dec inv
@ni:
  jsr draw_all
  jsr hud
  jsr hint
  lda lives
  bne @r
  jsr go_end
@r:
  rts

level_up:
  inc lvl_t
  lda lvl_t
  cmp #LVL_FR
  bcc @r
  lda #0
  sta lvl_t
  inc lvl_s
  lda lvl_s
  cmp #3
  bcc @r
  lda #0
  sta lvl_s
  lda level
  cmp #7
  bcs @r
  inc level
  jsr set_speed
@r:
  rts

; ---- タコ ----
update_octo:
  lda #0
  sta moving
  ; じっとしていれば底といっしょに左へ（その場にいる）
  lda oxl
  sec
  sbc spl
  sta oxl
  lda ox
  sbc sph
  sta ox
  lda inp
  and #BTN_RIGHT
  beq @nr
  lda oxl
  clc
  adc #$80
  sta oxl
  lda ox
  adc #1
  sta ox
  lda #0
  sta face
  inc moving
  jmp @clamp
@nr:
  lda inp
  and #BTN_LEFT
  beq @clamp
  dec ox
  lda #$40
  sta face
  inc moving
@clamp:
  lda ox
  cmp #OX_MIN
  bcs @c1
  lda #OX_MIN          ; 左のはしで おされる（動いたことになる）
  sta ox
  lda #0
  sta oxl
  lda spl
  ora sph
  beq @c1
  lda #1
  sta moving
@c1:
  lda ox
  cmp #OX_MAX
  bcc @c2
  lda #OX_MAX
  sta ox
  lda #0
  sta oxl
@c2:
  ; 色を変える（とちゅうで また押すと、つぎの色へ。やりなおし）
  lda inp_new
  and #BTN_A|BTN_B
  beq @na
  ldx ocol
  inx
  cpx #3
  bcc @ok
  ldx #0
@ok:
  stx ocol
  lda #CHG_T
  sta chg_t
  jsr sfx_change
@na:
  lda chg_t
  beq @r
  dec chg_t
@r:
  rts

; タコのパレット: 色を変えているあいだは白く光る、足もとと合って じっとしていれば ふちも底の色になって なじむ
pal_update:
  lda chg_t
  beq @n
  lda #3
  bne @set
@n:
  jsr hiding
  beq @plain
  lda ocol
  clc
  adc #4
  bne @set
@plain:
  lda ocol
@set:
  cmp opal_cur
  beq @r
  sta opal_cur
  jmp oct_palette
@r:
  rts

; 画面のゆれ（字の段より下を横に）
do_shake:
  lda #0
  ldx shake_t
  beq @s
  dec shake_t
  txa
  and #2
  beq @p
  lda #$fd
  bne @s
@p:
  lda #3
@s:
  sta shake_x
  rts

; タコが かくれているか → A（1 = かくれている）
hiding:
  lda chg_t
  ora moving
  bne @no
  lda ox                 ; 体の まん中の左右どちらかが 合っていれば よい（さかい目で きびしくしない）
  clc
  adc #7
  jsr floor_at
  cmp ocol
  beq @yes
  lda ox
  clc
  adc #17
  jsr floor_at
  cmp ocol
  bne @no
@yes:
  lda #1
  rts
@no:
  lda #0
  rts

; ---- サメ ----
spawn:
  dec sp_t
  beq @go
  rts
@go:
  ldx level
  lda spawn_iv,x
  sta sp_t
  jsr new_shark
  jsr rand
  and #3
  ldx level
  cmp dbl_tab,x
  bcs @r
  jsr new_shark        ; 2 匹いっしょに
@r:
  rts

new_shark:
  ldx #NH-1
@f:
  lda hz_type,x
  beq @got
  dex
  bpl @f
  rts
@got:
  lda #1
  sta hz_type,x
  lda #0
  sta hz_st,x
  sta hz_done,x
  sta hz_xl,x
  ldy level
  lda warn_tab,y
  sta hz_t,x
  ; 泳ぐ高さ: 0 番は上・1 番は下のすじ
  jsr rand
  and #15
  clc
  adc lane_y,x
  sta hz_y,x
  ; 速さ 1.25〜 ＋ 段 × 0.1
  lda level
  asl a
  asl a
  asl a
  sta tmp
  lda level
  asl a
  clc
  adc tmp              ; level × 10
  sta tmp
  jsr rand
  and #$1f
  clc
  adc tmp
  adc #$40
  sta hz_v,x
  lda #1
  adc #0
  sta hz_vh,x
  ; 向き
  jsr rand
  and #1
  sta hz_dir,x
  beq @fromL
  lda #0
  sta hz_x,x
  lda #1
  sta hz_xh,x
  jmp @snd
@fromL:
  lda #$e0
  sta hz_x,x
  lda #$ff
  sta hz_xh,x
@snd:
  jsr sfx_warn
  rts

update_hz:
  ldx #NH-1
@l:
  lda hz_type,x
  bne @live
  jmp @next
@live:
  lda hz_st,x
  bne @go
  dec hz_t,x
  bne @n0
  lda #1
  sta hz_st,x
@n0:
  jmp @next
@go:
  cmp #2
  bne @swim
  jsr dive               ; 見つけた: タコへ まっすぐ おりてくる
  jmp @next
@swim:
  cmp #3
  bne @mv
  lda hz_t,x             ; かみついたまま 少し止まる
  beq @rise
  dec hz_t,x
  jmp @next
@rise:
  lda hz_y,x             ; かみついたあと: 上へ もどりながら 去る
  cmp #90
  bcc @mv
  dec hz_y,x
  dec hz_y,x
@mv:
  lda hz_dir,x
  bne @left
  lda hz_xl,x
  clc
  adc hz_v,x
  sta hz_xl,x
  lda hz_x,x
  adc hz_vh,x
  sta hz_x,x
  lda hz_xh,x
  adc #0
  sta hz_xh,x
  cmp #1
  bne @judge
  beq @kill
@left:
  lda hz_xl,x
  sec
  sbc hz_v,x
  sta hz_xl,x
  lda hz_x,x
  sbc hz_vh,x
  sta hz_x,x
  lda hz_xh,x
  sbc #0
  sta hz_xh,x
  cmp #$ff
  bne @judge
  lda hz_x,x
  cmp #$e0
  bcs @judge
@kill:
  lda #0
  sta hz_type,x
  jmp @next
@judge:
  lda state
  cmp #1
  bne @next
  lda hz_done,x
  bne @next
  ; d = (サメの x + 16) − (タコの x + 12)
  lda hz_x,x
  clc
  adc #4
  sta tmp
  lda hz_xh,x
  adc #0
  sta tmp2
  lda tmp
  sec
  sbc ox
  sta tmp
  lda tmp2
  sbc #0
  sta tmp2
  lda tmp
  clc
  adc #11
  sta tmp3
  lda tmp2
  adc #0
  bne @out
  lda tmp3
  cmp #23
  bcs @out
  ; 見られている
  lda inv
  bne @next
  txa
  pha
  jsr hiding
  sta tmp4
  pla
  tax
  lda tmp4
  bne @next
  lda #1
  sta hz_done,x
  txa
  pha
  jsr found
  pla
  tax
  jmp @next
@out:
  ; 通りすぎたか（左から来たら d > 0、右から来たら d < 0）
  lda hz_dir,x
  bne @od
  lda tmp2
  bmi @next
  jmp @passed
@od:
  lda tmp2
  bpl @next
@passed:
  lda #1
  sta hz_done,x
  lda inv
  bne @next
  inc hidden
  txa
  pha
  lda #1
  jsr popup
  ldx #3
  lda #5
  jsr add_score
  jsr sfx_hide
  pla
  tax
@next:
  dex
  bmi @done
  jmp @l
@done:
  rts

; X のサメが見つけた: 向きを変えて タコへ おりてくる（かみつくのは dive の中）
found:
  lda #2
  sta hz_st,x
  lda hz_xh,x            ; 画面のはしにいたら 中へ
  beq @in
  lda #0
  sta hz_xh,x
  sta hz_x,x
@in:
  lda #200               ; かみつかれるまで ほかのサメは見ない
  sta inv
  lda #90
  sta found_t
  jsr sfx_alert
  rts

; X のサメ: タコの上へ（よこ 3・たて 4 ドットずつ）。着いたら かみつく
dive:
  lda ox
  sec
  sbc #4
  bcs @t
  lda #0
@t:
  sta tmp
  lda hz_x,x
  cmp tmp
  beq @xd
  bcc @xr
  sbc #3
  bcc @xl0
  cmp tmp
  bcs @xs
@xl0:
  lda tmp
@xs:
  sta hz_x,x
  lda #1
  sta hz_dir,x
  jmp @xd
@xr:
  adc #3
  cmp tmp
  bcc @xs2
  lda tmp
@xs2:
  sta hz_x,x
  lda #0
  sta hz_dir,x
@xd:
  lda hz_y,x
  cmp #BITE_Y
  bcs @yd
  adc #4
  cmp #BITE_Y
  bcc @ys
  lda #BITE_Y
@ys:
  sta hz_y,x
  rts
@yd:
  lda hz_x,x
  cmp tmp
  bne @r
  lda #3                 ; かみついた → 少し止まってから 去る
  sta hz_st,x
  sta hz_vh,x
  lda #0
  sta hz_v,x
  lda #14
  sta hz_t,x
  txa
  pha
  jsr bite
  pla
  tax
@r:
  rts

bite:
  lda lives
  beq @z
  dec lives
@z:
  lda #100
  sta inv
  lda #24
  sta shake_t
  lda #54                ; すみは サメが はなれるときに（40 から下で出す）
  sta ink_t
  lda ox
  clc
  adc #4
  sta ink_x
  jsr sfx_found
  rts

; A = 0 なら +10、1 なら +5 のしるしを タコの上に
popup:
  sta pop_k
  lda #40
  sta pop_t
  lda ox
  clc
  adc #4
  sta pop_x
  lda #164
  sta pop_y
  rts

; X = けた（0〜3）に A を足す（くり上がり。9999 で止める）
add_score:
  clc
  adc score,x
  sta score,x
@c:
  lda score,x
  cmp #10
  bcc @r
  sbc #10
  sta score,x
  dex
  bmi @max
  inc score,x
  jmp @c
@max:
  lda #9
  ldx #3
@m:
  sta score,x
  dex
  bpl @m
@r:
  rts

; ---- カニ・エビ（底の上にいて、底といっしょに流れる） ----
update_food:
  dec fd_t
  bne @move
  jsr rand
  and #63
  clc
  adc #110
  sta fd_t
  ldx #NF-1
@f:
  lda fd_type,x
  beq @new
  dex
  bpl @f
  jmp @move
@new:
  jsr rand
  and #1
  clc
  adc #1
  sta fd_type,x
  lda #0
  sta fd_x,x
  sta fd_xl,x
  lda #1
  sta fd_xh,x
@move:
  ldx #NF-1
@m:
  lda fd_type,x
  beq @mn
  lda fd_xl,x
  sec
  sbc spl
  sta fd_xl,x
  lda fd_x,x
  sbc sph
  sta fd_x,x
  lda fd_xh,x
  sbc #0
  sta fd_xh,x
  bne @off
  ; 食べる: |(x + 8) − (タコの x + 12)| < 10
  lda ox
  clc
  adc #4
  sta tmp
  lda fd_x,x
  sec
  sbc tmp
  bcs @p
  eor #$ff
  adc #1
@p:
  cmp #10
  bcs @mn
  lda #0
  sta fd_type,x
  inc eaten
  txa
  pha
  lda #0
  jsr popup
  ldx #2
  lda #1
  jsr add_score
  jsr sfx_eat
  pla
  tax
  jmp @mn
@off:
  cmp #$ff             ; 左へ出たら おしまい
  bne @mn
  lda fd_x,x
  cmp #$f0
  bcs @mn
  lda #0
  sta fd_type,x
@mn:
  dex
  bpl @m
  rts

; ---- 絵 ----
draw_all:
  jsr oam_start
  ; 点のしるし（いちばん前）
  lda pop_t
  beq @nopop
  dec pop_t
  lda pop_t
  and #1
  bne @pm
  dec pop_y
@pm:
  lda pop_y
  sta tmp
  lda #3
  sta tmp3
  lda pop_x
  sta tmp4
  lda #S_PLUS
  sta tmp2
  jsr put_spr
  lda tmp4
  clc
  adc #6
  sta tmp4
  lda pop_k
  bne @p5
  lda #S_ONE
  sta tmp2
  jsr put_spr
  lda tmp4
  clc
  adc #6
  sta tmp4
  lda #S_ZERO
  sta tmp2
  jsr put_spr
  jmp @nopop
@p5:
  lda #S_FIVE
  sta tmp2
  jsr put_spr
@nopop:
  ; すみ
  lda ink_t
  beq @noink
  dec ink_t
  lda ink_t
  cmp #40
  bcs @noink
  lda #OY-6
  sta tmp
  lda #3
  sta tmp3
  lda ink_x
  sta gxl
  lda #0
  sta gxh
  lda #2
  sta gw
  sta gh
  lda #S_INKA
  ldx ink_t
  cpx #28
  bcs @ik
  lda #S_INKB
@ik:
  sta gt
  jsr put_grid
@noink:
  ; サメ（タコより前。かみつく所が見える）
  ldx #NH-1
@h:
  lda hz_type,x
  bne @hd
  jmp @hn
@hd:
  lda hz_st,x
  bne @body
  lda frame            ; ！（来るほうのはしで点めつ）
  and #8
  beq @wv
  jmp @hn
@wv:
  lda hz_y,x
  sta tmp
  lda #S_WARN
  sta gt
  lda #3
  sta tmp3
  lda #12
  ldy hz_dir,x
  beq @wl
  lda #236
@wl:
  sta gxl
  lda #0
  sta gxh
  lda #1
  sta gw
  lda #2
  sta gh
  txa
  pha
  jsr put_grid
  pla
  tax
  jmp @hn
@body:
  lda hz_y,x
  sta tmp
  lda #1
  ldy hz_dir,x
  beq @sr
  lda #$41
@sr:
  sta tmp3
  lda hz_x,x
  sta gxl
  lda hz_xh,x
  sta gxh
  lda #4
  sta gw
  lda #2
  sta gh
  lda #S_SHARKA
  sta gt
  lda frame
  and #8
  beq @sa
  lda #S_SHARKB
  sta gt
@sa:
  txa
  pha
  jsr put_grid
  pla
  tax
  lda hz_st,x            ; 底に うつる サメの かげ（ねらっている所）
  cmp #3
  beq @hn
  lda #191
  sta tmp
  lda #3
  sta tmp3
  lda hz_x,x
  clc
  adc #8
  sta gxl
  lda hz_xh,x
  adc #0
  sta gxh
  lda #2
  sta gw
  lda #1
  sta gh
  lda #S_SHADOW
  sta gt
  txa
  pha
  jsr put_grid
  pla
  tax
@hn:
  dex
  bmi @sdone
  jmp @h
@sdone:
  ; 色を変えた: タコのまわりに きらきら
  lda chg_t
  cmp #4
  bcc @nosp
  lda #3
  sta tmp3
  lda #S_SPARKA
  ldx chg_t
  cpx #8
  bcs @spk
  lda #S_SPARKB
@spk:
  sta tmp2
  lda #OY+3
  sta tmp
  lda ox
  sec
  sbc #5
  bcs @sp1
  lda #0
@sp1:
  sta tmp4
  jsr put_spr
  lda ox
  clc
  adc #21
  sta tmp4
  jsr put_spr
  lda #OY-8
  sta tmp
  lda ox
  clc
  adc #8
  sta tmp4
  jsr put_spr
@nosp:
  ; タコ（見つかったあとは点めつ）
  lda inv
  cmp #101               ; かみつかれる前は点めつしない
  bcs @oshow
  and #4
  bne @nooct
@oshow:
  lda chg_t
  beq @k
  lda #3
  jmp @k2
@k:
  lda ocol
@k2:
  asl a
  sta tmp
  lda moving
  beq @still
  lda frame
  lsr a
  lsr a
  lsr a
  and #1
  ora tmp
  sta tmp
@still:
  lda tmp              ; (種類 × 2 + 歩き) × 6
  asl a
  sta tmp2
  asl a
  clc
  adc tmp2
  adc #S_OC00
  sta gt
  lda #OY
  sta tmp
  lda face
  sta tmp3
  lda ox
  sta gxl
  lda #0
  sta gxh
  lda #3
  sta gw
  lda #2
  sta gh
  jsr put_grid
@nooct:
  ; カニ・エビ
  ldx #NF-1
@fd:
  lda fd_type,x
  beq @fn
  lda #FOOD_Y
  sta tmp
  lda #2
  sta tmp3
  lda fd_x,x
  sta gxl
  lda fd_xh,x
  sta gxh
  lda #2
  sta gw
  lda #1
  sta gh
  lda frame
  and #$10
  beq @fa
  lda #2
@fa:
  sta gt
  lda fd_type,x
  cmp #1
  beq @crab
  lda #S_SHRA
  bne @fs
@crab:
  lda #S_CRABA
@fs:
  clc
  adc gt
  sta gt
  txa
  pha
  jsr put_grid
  pla
  tax
@fn:
  dex
  bpl @fd
@hearts:
  lda state
  beq @end
  lda #7
  sta tmp
  lda #3
  sta tmp3
  ldx #0
@ht:
  lda heart_x,x
  sta tmp4
  lda #S_HEART
  cpx lives
  bcc @full
  lda #S_HEARTOFF
@full:
  sta tmp2
  jsr put_spr
  inx
  cpx #3
  bne @ht
@end:
  jsr hide_rest
  rts

; 点を字の段へ
hud:
  lda #>ADDR_SCORE
  ldx #<ADDR_SCORE
  ldy #4
  jsr buf_head
  ldx #0
@l:
  lda score,x
  clc
  adc #T_0
  jsr buf_byte
  inx
  cpx #4
  bne @l
  rts

; 字の段の 2 行め: はじめは操作、サメが来ると「じっと!」（段 2 から消す）
hint:
  ldy #3
  lda found_t
  bne @set
  ldy #0
  lda level
  cmp #2
  bcs @set
  iny
  lda hz_type
  ora hz_type+1
  beq @set
  iny
@set:
  cpy hint_cur
  beq @r
  sty hint_cur
  lda hint_msg,y
  jmp say_buf
@r:
  rts

; ================= おわり =================
go_end:
  lda #2
  sta state
  lda #0
  sta end_t
  sta found_t
  ldx #0
@c:
  lda score,x
  cmp hi,x
  bcc @nohi
  bne @newhi
  inx
  cpx #4
  bne @c
  jmp @nohi
@newhi:
  ldx #3
@cp:
  lda score,x
  sta hi,x
  sta SAVE+4,x
  dex
  bpl @cp
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
  lda end_t
  cmp #60
  bcs @res
  jsr do_shake
  jsr draw_all         ; しばらく そのまま（すみが広がる）
  rts
@res:
  bne @wait
  jsr screen_off
  lda #2
  jsr draw_screen
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
  lda #<ADDR_ESCORE
  sta tmp
  lda #>ADDR_ESCORE
  ldx #score
  jsr vram_digits
  lda #<ADDR_EBEST
  sta tmp
  lda #>ADDR_EBEST
  ldx #hi
  jsr vram_digits
  lda #<ADDR_SCORE
  sta tmp
  lda #>ADDR_SCORE
  ldx #score
  jsr vram_digits
  lda #<ADDR_PHI
  sta tmp
  lda #>ADDR_PHI
  ldx #hi
  jsr vram_digits
  lda #0
  sta sx
  sta sxl
  sta spl
  sta sph
  sta level
  sta seg_t
  lda #6
  sta seg_n
  jsr fill_floor
  jsr clear_things
  jsr reset_octo
  lda #0
  sta lives
  jsr oam_start
  jsr hide_rest
  jsr screen_on
  lda #$ff
  sta opal_cur
  rts
@wait:
  jsr demo_input       ; 結果の画面でも タコは見本と同じに
  jsr update_octo
  jsr pal_update
  jsr draw_all
  lda end_t
  cmp #90
  bcc @r
  jsr blink_push
  lda pad_new
  and #BTN_START
  beq @r
  jsr go_title
@r:
  rts

; ================= 音 =================
sfx_change:            ; 色を変える: やわらかい ぷるん
  lda #%10010110
  sta $4000
  lda #%10010010
  sta $4001
  lda #$a0
  sta $4002
  lda #$08
  sta $4003
  rts

sfx_warn:              ; サメが来る: 低い 2 つの音
  lda #%01011010
  sta $4000
  lda #%10100011
  sta $4001
  lda #$40
  sta $4002
  lda #$0b
  sta $4003
  rts

sfx_alert:             ; 見つかった!: 高く短い 2 つの音
  lda #%10011000
  sta $4000
  lda #%10000010
  sta $4001
  lda #$70
  sta $4002
  lda #$08
  sta $4003
  rts

sfx_found:             ; 見つかった: すみを はく音
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

sfx_eat:               ; 食べた: ぱくっ
  lda #%10010101
  sta $4000
  lda #%10000011
  sta $4001
  lda #$60
  sta $4002
  lda #$08
  sta $4003
  lda #%00000010
  sta $400C
  lda #$03
  sta $400E
  lda #$08
  sta $400F
  rts

sfx_hide:              ; かくれた: 上がる音
  lda #%10010110
  sta $4000
  lda #%10001011
  sta $4001
  lda #$d0
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
  ldx #3
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
  sta hi,x
  sta SAVE+4,x
  dex
  bpl @w
  rts

; 曲の係（music_play・music_stop・music_update）は src/music.s（build がつなぐ）

; ================= 決まりの表 =================
save_magic: .byte 'O', 'H', '0', '1'
nt_tab: .word nt_title_0, nt_title_1, nt_play_0, nt_play_1, nt_end_0, nt_end_1
hint_msg: .byte M_HINT0, M_HINT1, M_HINT2, M_HINT3
spawn_iv: .byte 220, 190, 165, 145, 130, 118, 106, 96
warn_tab: .byte 70, 64, 58, 52, 48, 44, 40, 36
dbl_tab: .byte 0, 0, 0, 1, 1, 2, 2, 3
len_min: .byte 4, 4, 3, 3, 2, 2, 2, 2
len_mask: .byte 7, 3, 3, 3, 3, 3, 1, 1
lane_y: .byte 83, 115
heart_x: .byte 104, 114, 124
