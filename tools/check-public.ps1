# Pre-publish check: finds personal info and secrets before a git commit/push or an Artifact publish.
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-public.ps1              # whole folder
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-public.ps1 -Path evolution
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-public.ps1 -Staged      # files staged for commit (pre-commit hook)
# Exit code 0 = nothing found, 1 = something to look at (the commit is stopped).
# Your own words to block (name, e-mail, address...) go in .private-words.txt at the repo root,
# one regex per line. That file is in .gitignore and is never committed.
param([string[]]$Path = @('.'), [switch]$Staged)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$textExt = '.html','.htm','.js','.mjs','.css','.md','.txt','.json','.ps1','.sh','.bat','.cmd','.yml','.yaml','.xml','.svg','.csv','.ini','.cfg','.toml','.py','.gltf','.s',''
$imageExt = '.jpg','.jpeg','.png','.gif','.webp'
$badNames ='^\.env', '^\.dev\.vars', '\.pem$', '\.key$', '\.pfx$', '\.p12$', '^id_(rsa|ed25519|ecdsa)', '^credentials', '\.kdbx$'
$skipDirs = '\\\.git\\', '\\node_modules\\'

$rules = @(
  @{ n = 'メールアドレス';           r = '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}' },
  @{ n = 'PCのユーザーフォルダ';     r = '[A-Za-z]:[\\/]+Users[\\/]+\w[^\\/\s"'']*|/Users/\w[^/\s"'']*|/home/\w[^/\s"'']*' },
  @{ n = '秘密鍵';                   r = '-----BEGIN [A-Z ]*PRIVATE KEY-----' },
  @{ n = 'APIキー・トークン';        r = 'sk-[A-Za-z0-9_-]{16,}|sk-ant-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[abprs]-[A-Za-z0-9-]{10,}' },
  @{ n = 'Cloudflare のトークン';     r = '(?i)(CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY)\s*[:=]\s*["'']?[A-Za-z0-9_-]{20,}' },
  @{ n = 'パスワード等の書き込み';   r = '(?i)(password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*["''][^"'']{4,}["'']' },
  @{ n = '電話番号';                 r = '(?<![\d.-])0\d{1,4}-\d{1,4}-\d{4}(?![\d-])' },
  @{ n = '郵便番号・住所';           r = '〒\s*\d{3}-?\d{4}' },
  @{ n = 'Artifact の URL（PUBLISH.local.md に書く）'; r = 'claude\.ai/(code/)?artifacts?/[A-Za-z0-9-]{8,}' }
)
# GitHub's no-reply commit address is meant to be public (it is on every commit anyway)
$allow = @('(?i)@example\.(com|org|net)$', '(?i)^noreply@', '(?i)@users\.noreply\.github\.com$', '^sishiya-support@googlegroups.com$', '^/hom[e]/web_user$')   # wasm（Emscripten）の中の仮の家フォルダ web_user（[e] はこの行が自分に当たらないように）

$private = @()
$pw = Join-Path $root '.private-words.txt'
if (Test-Path $pw) {
  $private = Get-Content $pw -Encoding UTF8 | Where-Object { $_ -and $_ -notmatch '^\s*#' }
}

# collect files
$files = @()
if ($Staged) {
  $names = & git -c core.quotepath=false diff --cached --name-only --diff-filter=ACMR
  foreach ($n in $names) { if ($n -and (Test-Path -LiteralPath $n -PathType Leaf)) { $files += (Resolve-Path -LiteralPath $n).Path } }
} else {
  foreach ($p in $Path) {
    $full = (Resolve-Path -LiteralPath $p).Path
    if (Test-Path -LiteralPath $full -PathType Leaf) { $files += $full }
    else { $files += Get-ChildItem -LiteralPath $full -Recurse -File -Force | ForEach-Object FullName }
  }
}
$files = $files | Where-Object { $f = $_; -not ($skipDirs | Where-Object { $f -match $_ }) } | Sort-Object -Unique

$hits = New-Object System.Collections.ArrayList
foreach ($f in $files) {
  $rel = $f.Substring($root.Length).TrimStart('\')
  $name = [IO.Path]::GetFileName($f)
  if ($name -eq '.private-words.txt' -or $name -like '*.local.md') {
    if ($Staged) { [void]$hits.Add("$rel : このファイルはコミットしてはいけません（.gitignore を確認）") }
    continue
  }
  foreach ($b in $badNames) { if ($name -match $b) { [void]$hits.Add("$rel : 秘密情報の可能性があるファイル名") } }
  $len = (Get-Item -LiteralPath $f).Length
  if ($len -gt 10MB) { [void]$hits.Add("$rel : 10MB を超える大きなファイル") }
  $ext = [IO.Path]::GetExtension($f).ToLower()
  if ($ext -eq $name.ToLower()) { $ext = '' }   # dotfiles such as .gitignore
  if ($imageExt -contains $ext) {
    # 画像: 撮影情報（Exif・GPS）や文字の埋め込み（PNG の tEXt など）がないか。写っている中身は目で確かめる（RULES 7章）
    $bytes = [IO.File]::ReadAllBytes($f)
    $ascii = [Text.Encoding]::ASCII.GetString($bytes)
    if ($ascii -match 'Exif\x00|GPSInfo|<x:xmpmeta|tEXt|iTXt|zTXt|eXIf') { [void]$hits.Add("$rel : 画像に撮影情報・メタデータがある（消してから公開）") }
    continue
  }
  if ($ext -eq '.mp4' -and $rel -like 'thumbs\*') {
    # 動くサムネイル（make-motion-thumbs.ps1）: 作者・場所・題などの付加情報がないか（ffprobe）。写っている中身は目で確かめる
    $probe = Get-Command ffprobe -ErrorAction SilentlyContinue
    if (-not $probe) { [void]$hits.Add("$rel : ffprobe がなく付加情報を調べられない（目で確認）"); continue }
    $tags = & $probe.Source -v error -show_entries 'format_tags:stream_tags' -of 'default=nw=1' $f
    $extra = @($tags | Where-Object { $_ -and $_ -notmatch '^TAG:(major_brand|minor_version|compatible_brands|encoder|handler_name|vendor_id|language)=' })
    if ($extra.Count) { [void]$hits.Add("$rel : mp4 に付加情報がある（$($extra -join ', ')）") }
    continue
  }
  if ($ext -eq '.ogg') {
    # 音（Stable Audio で作り ffmpeg で書き出す。dusk-diorama/audio）: 作者・題・コメントなどの付加情報がないか（ffprobe）。中身は耳で確かめる
    $probe = Get-Command ffprobe -ErrorAction SilentlyContinue
    if (-not $probe) { [void]$hits.Add("$rel : ffprobe がなく付加情報を調べられない（目で確認）"); continue }
    $tags = & $probe.Source -v error -show_entries 'format_tags:stream_tags' -of 'default=nw=1' $f
    $extra = @($tags | Where-Object { $_ -and $_ -notmatch '^TAG:(encoder|ENCODER)=' })
    if ($extra.Count) { [void]$hits.Add("$rel : ogg に付加情報がある（$($extra -join ', ')）") }
    continue
  }
  if ($ext -eq '.glb') {
    # 3D の形（tools/blender/*.py で書き出す）: 先頭の JSON に作者・著作権・付加情報（extras）・PC のパスがないか。形そのものは目で確かめる
    $bytes = [IO.File]::ReadAllBytes($f)
    $json = [Text.Encoding]::UTF8.GetString($bytes, 20, [BitConverter]::ToUInt32($bytes, 12))
    # extras は、ゲームが使う印（slice・noInk・noSlice の true）だけならよい
    $extrasOk = $true
    foreach ($m in [regex]::Matches($json, '"extras":\{([^}]*)\}')) { if ($m.Groups[1].Value -notmatch '^("(slice|noInk|noSlice)":true,?)+$') { $extrasOk = $false } }
    if (-not $extrasOk -or $json -match '"(copyright|author)"|(?<![A-Za-z])[A-Za-z]:[\\/]|/Users/|/home/') { [void]$hits.Add("$rel : glb に作者・付加情報・パスがある（書き出しの設定を見直す）") }
    continue
  }
  if ($ext -eq '.hdr') {
    # 空の光（flower-brook/tools/build-flora.py。Poly Haven の CC0 の HDRI を縮めたもの）: 頭の文字が形式の行だけか（コメント・ソフト名・撮影情報がないか）。絵は目で確かめる
    $head = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($f), 0, 512)
    $lines = @(($head -split "`n`n")[0] -split "`n")
    $bad = @($lines | Where-Object { $_ -and $_ -notmatch '^(#\?RADIANCE|#\?RGBE|FORMAT=32-bit_rle_(rgbe|xyze)|EXPOSURE=[0-9.eE+-]+|GAMMA=[0-9.]+)$' })
    if ($bad.Count) { [void]$hits.Add("$rel : hdr の頭に付加情報がある（$($bad -join ' / ')）") }
    continue
  }
  if ($ext -eq '.wav') {
    # 音のもと（retro-32bit/src/*/sound/。Stable Audio で作り ffmpeg で書き出す）: 作者・題・コメントなどの付加情報がないか（ffprobe）。中身は耳で確かめる
    $probe = Get-Command ffprobe -ErrorAction SilentlyContinue
    if (-not $probe) { [void]$hits.Add("$rel : ffprobe がなく付加情報を調べられない（目で確認）"); continue }
    $tags = & $probe.Source -v error -show_entries 'format_tags:stream_tags' -of 'default=nw=1' $f
    $extra = @($tags | Where-Object { $_ -and $_ -notmatch '^TAG:(encoder|ENCODER)=' })
    if ($extra.Count) { [void]$hits.Add("$rel : wav に付加情報がある（$($extra -join ', ')）") }
    continue
  }
  if ($ext -eq '.nes' -or ($ext -eq '.exe' -and $rel -match '^retro-32bit[\\/]')) {
    # 8ビット互換機の ROM（retro-8bit/tools/build.mjs が src/ から作る）・32ビット互換機のソフト（retro-32bit/tools/build.mjs）: バイトの中に、メール・PC のパス・鍵・自分の言葉などがないか
    $ascii = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($f))
    # 32ビット互換機のソフトには音のデータ（ADPCM）が入るので、たまたまの並びがメールに見えることがある。見てたしかめたものだけ外す
    $romAllow = @('^m@E\.VI$')
    foreach ($r in $rules) { foreach ($m in [regex]::Matches($ascii, $r.r)) { if (-not ($romAllow | Where-Object { $m.Value -match $_ })) { [void]$hits.Add("$rel : ROM の中に $($r.n) → $($m.Value)"); break } } }
    foreach ($w in $private) { if ($ascii -match $w) { [void]$hits.Add("$rel : ROM の中に 自分の言葉（.private-words.txt）") } }
    continue
  }
  if ($textExt -notcontains $ext -and $rel -match '^[a-z0-9-]+[\\/]vendor[\\/]') {
    # ゲームが入れた外のライブラリ（face-in-frame/vendor/ の MediaPipe の wasm とモデルなど）: バイトの中に、メール・PC のパス・鍵・自分の言葉などがないか
    $ascii = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($f))
    # MediaPipe の wasm に入っている Google のビルドの記録（社内のメール・ビルドした人のフォルダ）は公開の配布物のまま。2026-10-25 ユーザーが許可
    $vendorAllow = $allow + @('(?i)@[a-z0-9.-]+\.corp\.google\.com$', '^/hom[e]/vrabaud$')
    foreach ($r in $rules) { foreach ($m in [regex]::Matches($ascii, $r.r)) { if (-not ($vendorAllow | Where-Object { $m.Value -match $_ })) { [void]$hits.Add("$rel : ライブラリの中に $($r.n) → $($m.Value)"); break } } }
    foreach ($w in $private) { if ($ascii -match $w) { [void]$hits.Add("$rel : ライブラリの中に 自分の言葉（.private-words.txt）") } }
    continue
  }
  if ($textExt -notcontains $ext) { [void]$hits.Add("$rel : テキスト以外のファイル（画像なら撮影情報・写り込みを目で確認）"); continue }
  $lines = [IO.File]::ReadAllLines($f, [Text.Encoding]::UTF8)
  for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    foreach ($ru in $rules) {
      foreach ($m in [regex]::Matches($line, $ru.r)) {
        $v = $m.Value
        if ($allow | Where-Object { $v -match $_ }) { continue }
        [void]$hits.Add("${rel}:$($i+1) : $($ru.n) → $v")
      }
    }
    foreach ($w in $private) {
      if ($line -match "(?i)$w") { [void]$hits.Add("${rel}:$($i+1) : .private-words.txt の語 → $($Matches[0])") }
    }
  }
}

# 電池（基本ルール。RULES 12章）: 画面を離れても止まらないもの（マイク・カメラ・音・Worker）を使うアプリに、止める処理があるか
# 共通の部品 assets/power.js を使わず自分で止めている、裏でも動かないなど、目で確かめたアプリは tools/power-reviewed.txt に「アプリ名 理由」で書く
$powerOk = @{}
$powerList = Join-Path $root 'tools/power-reviewed.txt'
if (Test-Path -LiteralPath $powerList) { Get-Content -LiteralPath $powerList -Encoding UTF8 | Where-Object { $_ -and $_ -notmatch '^\s*#' } | ForEach-Object { $powerOk[($_ -split '\s+')[0]] = $true } }
$powerApps = @($files | ForEach-Object { $_.Substring($root.Length).TrimStart('\') } | Where-Object { $_ -match '\\' } | ForEach-Object { ($_ -split '\\')[0] } | Sort-Object -Unique)
foreach ($a in $powerApps) {
  $dir = Join-Path $root $a
  if ($a -match '^[_.]' -or $a -in 'tools','assets','thumbs','server','node_modules','lib' -or -not (Test-Path -LiteralPath (Join-Path $dir 'index.html'))) { continue }
  $code = (Get-ChildItem -LiteralPath $dir -Recurse -File | Where-Object { $_.Extension -in '.js','.mjs','.html' -and $_.FullName -notmatch '\\(versions|vendor|tools|look|node_modules)\\' } | ForEach-Object { [IO.File]::ReadAllText($_.FullName, [Text.Encoding]::UTF8) }) -join "`n"
  if ($code -match '\bPower\.(on|audio|away)' -and $code -notmatch 'assets/power\.js') { [void]$hits.Add("$a : 電池 → Power を使っているのに assets/power.js を読みこんでいない") }
  if ($powerOk[$a]) { continue }
  if ($code -match 'getUserMedia' -and ($code -notmatch '\bPower\.on\(' -or $code -notmatch 'getTracks\(\)')) { [void]$hits.Add("$a : 電池 → マイク・カメラを、画面を離れたときに閉じていない（Power.on と track.stop。RULES 12章）") }
  if ($code -match 'AudioContext' -and $code -notmatch '\bPower\.(audio|on)\(|\.suspend\(') { [void]$hits.Add("$a : 電池 → AudioContext を、画面を離れたときに止めていない（Power.audio。RULES 12章）") }
  if ($code -match 'new\s+Worker\(' -and $code -notmatch '\bPower\.on\(') { [void]$hits.Add("$a : 電池 → Worker を、画面を離れたときに止めていない（Power.on。RULES 12章）") }
}

if ($hits.Count) {
  Write-Host "公開前チェック: 要確認 $($hits.Count) 件（$($files.Count) ファイルを調べました）" -ForegroundColor Yellow
  $hits | ForEach-Object { Write-Host "  $_" }
  Write-Host "問題がなければ内容を直すか、tools/check-public.ps1 の allow に加えてから、もう一度実行してください。"
  exit 1
}
Write-Host "公開前チェック: 問題なし（$($files.Count) ファイル）" -ForegroundColor Green
exit 0
