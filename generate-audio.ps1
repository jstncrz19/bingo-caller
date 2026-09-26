<#
.SYNOPSIS
  Generates the pre-recorded bingo caller voice files using Piper TTS.

.DESCRIPTION
  Writes 75 call recordings ("B 1" ... "O 75") plus an intro clip into
  audio\calls, and (optionally) the deterministic chime tones into
  audio\chimes. GitHub Pages serves these files directly; the browser app
  (js\audio.js) plays them with fileFor()/playFile().

  Piper runs locally and offline. It is NOT part of the website, the browser
  runtime, or the deployment. Only the resulting .wav files are committed.

  Every recording is generated into a temporary staging folder first and
  validated (RIFF/WAVE header, fmt + data chunks, non-zero duration). The
  committed files are only replaced once *all* recordings pass validation,
  so a failed or interrupted run can never leave partial audio behind.

.PARAMETER VoiceDir
  Folder containing the Piper voice model. Defaults to the environment
  variable BINGO_PIPER_VOICE_DIR, then %LOCALAPPDATA%\BingoCallerPiper\voices.
  Voice models are intentionally kept outside this repository.

.PARAMETER Voice
  Piper voice id, e.g. en_US-amy-medium. See README for alternatives.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File generate-audio.ps1
  Regenerates the 75 call recordings + intro using the default voice.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File generate-audio.ps1 -IncludeChimes
  Also regenerates the chime tones (ding/bell/pop/blower/silent).
#>
[CmdletBinding()]
param(
  [string] $VoiceDir,
  [string] $Voice = "en_US-amy-medium",
  [string] $CallDir,
  [string] $ChimeDir,
  [double] $LengthScale = 1.0,
  [double] $NoiseScale,
  [double] $NoiseWScale,
  [double] $SentenceSilence = 0.0,
  [switch] $IncludeChimes,
  [switch] $SkipIntro
)

$ErrorActionPreference = "Stop"

# Optional Piper tuning flags are only forwarded when explicitly supplied, so
# the voice's own defaults from the .onnx.json config stay in effect otherwise.
$script:UseNoiseScale = $PSBoundParameters.ContainsKey("NoiseScale")
$script:UseNoiseWScale = $PSBoundParameters.ContainsKey("NoiseWScale")

# ---------------------------------------------------------------- locations --
$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

if (-not $CallDir) { $CallDir = Join-Path $scriptRoot "audio\calls" }
if (-not $ChimeDir) { $ChimeDir = Join-Path $scriptRoot "audio\chimes" }
if (-not $VoiceDir) {
  if ($env:BINGO_PIPER_VOICE_DIR) { $VoiceDir = $env:BINGO_PIPER_VOICE_DIR }
  else { $VoiceDir = Join-Path $env:LOCALAPPDATA "BingoCallerPiper\voices" }
}

# B-I-N-G-O column mapping. MUST stay in sync with letterForNumber() in
# js\patterns.js: 1-15 B, 16-30 I, 31-45 N, 46-60 G, 61-75 O.
$Letters = @("B", "I", "N", "G", "O")

function Get-CallSpec {
  param([int] $Number)
  $index = [Math]::Floor(($Number - 1) / 15)
  if ($index -lt 0 -or $index -gt 4) { throw "Number $Number is outside the 75-ball range." }
  $letter = $Letters[$index]
  # Filename contract consumed by fileFor() in js\audio.js.
  $fileName = "{0}-{1}.wav" -f $letter.ToLower(), $Number
  # Spoken phrase. Digits are written as words ("1" -> "one") so the voice
  # engine never reads a ball number as a digit string.
  $phrase = "{0} {1}" -f $letter, (ConvertTo-SpellNumber $Number)
  [pscustomobject]@{ Number = $Number; Letter = $letter; FileName = $fileName; Phrase = $phrase }
}

$NumberWords = @{
  0 = "zero"; 1 = "one"; 2 = "two"; 3 = "three"; 4 = "four"
  5 = "five"; 6 = "six"; 7 = "seven"; 8 = "eight"; 9 = "nine"
  10 = "ten"; 11 = "eleven"; 12 = "twelve"; 13 = "thirteen"; 14 = "fourteen"
  15 = "fifteen"; 16 = "sixteen"; 17 = "seventeen"; 18 = "eighteen"; 19 = "nineteen"
}
$TensWords = @{
  2 = "twenty"; 3 = "thirty"; 4 = "forty"; 5 = "fifty"
  6 = "sixty"; 7 = "seventy"; 8 = "eighty"; 9 = "ninety"
}

function ConvertTo-SpellNumber {
  param([int] $Number)
  if ($Number -lt 20) { return $NumberWords[$Number] }
  if ($Number % 10 -eq 0) { return $TensWords[[int][Math]::Floor($Number / 10)] }
  return "{0}-{1}" -f $TensWords[[int][Math]::Floor($Number / 10)], $NumberWords[$Number % 10]
}

# ------------------------------------------------------------------- piper ---
function Resolve-Piper {
  $cmd = Get-Command "piper" -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw @"
Piper was not found on PATH.

Install it with:
  pip install piper-tts

Then verify with:
  piper --help
"@
  }

  $model = Join-Path $VoiceDir "$Voice.onnx"
  $config = Join-Path $VoiceDir "$Voice.onnx.json"
  if (-not (Test-Path -LiteralPath $model)) {
    throw @"
Piper voice model not found:
  $model

Download the voice into your local voice folder (NOT the repository):
  $VoiceDir

Example (en_US-amy-medium):
  New-Item -ItemType Directory -Force -Path '$VoiceDir'
  Invoke-WebRequest -Uri 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx'      -OutFile '$VoiceDir\en_US-amy-medium.onnx'
  Invoke-WebRequest -Uri 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json' -OutFile '$VoiceDir\en_US-amy-medium.onnx.json'

Or point at a different folder:
  -VoiceDir C:\path\to\voices
"@
  }
  if (-not (Test-Path -LiteralPath $config)) {
    throw "Piper voice config not found: $config`nThe .onnx.json file is required alongside the .onnx model."
  }
  return [pscustomobject]@{ Exe = $cmd.Source; Model = $model; Config = $config }
}

function Invoke-PiperSay {
  param(
    [Parameter(Mandatory = $true)] $Piper,
    [Parameter(Mandatory = $true)] [string] $Text,
    [Parameter(Mandatory = $true)] [string] $OutFile
  )
  if (Test-Path -LiteralPath $OutFile) { Remove-Item -LiteralPath $OutFile -Force }

  $piperArgs = @(
    "-m", $Piper.Model,
    "-c", $Piper.Config,
    "-f", $OutFile,
    "--length-scale", $LengthScale,
    "--sentence-silence", $SentenceSilence
  )
  if ($script:UseNoiseScale) { $piperArgs += @("--noise-scale", $NoiseScale) }
  if ($script:UseNoiseWScale) { $piperArgs += @("--noise-w-scale", $NoiseWScale) }

  # Capture stdout+stderr together. $ErrorActionPreference is relaxed for the
  # call because under "Stop" PowerShell turns Piper's stderr into a
  # terminating error before the redirect can capture it, which hides the
  # real cause (bad model, unreadable config, missing runtime, ...).
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $output = $null
  $code = 1
  try {
    $output = $Text | & $Piper.Exe @piperArgs 2>&1
    $code = $LASTEXITCODE
  } catch {
    $code = 1
    $output = $_.Exception.Message
  } finally {
    $ErrorActionPreference = $prevEap
  }

  $detail = ""
  if ($output) {
    $detail = (($output | ForEach-Object {
      if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.ToString() } else { [string]$_ }
    }) -join " ").Trim()
  }

  if ($code -ne 0 -or -not (Test-Path -LiteralPath $OutFile)) {
    if (Test-Path -LiteralPath $OutFile) { Remove-Item -LiteralPath $OutFile -Force }
    if (-not $detail) { $detail = "no output from piper" }
    if ($detail.Length -gt 500) { $detail = "..." + $detail.Substring($detail.Length - 500) }
    throw "piper failed (exit code $code): $detail"
  }
}

# ------------------------------------------------------------- wav checking --
# Validates that a generated file is a real, non-empty, decodable PCM WAV.
function Test-WavFile {
  param(
    [Parameter(Mandatory = $true)] [string] $Path,
    [double] $MinDurationSeconds = 0.05
  )
  if (-not (Test-Path -LiteralPath $Path)) { return "file was not created" }
  $bytes = [IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt 64) { return "file is too small to be valid audio ($($bytes.Length) bytes)" }
  if ([Text.Encoding]::ASCII.GetString($bytes, 0, 4) -ne "RIFF") { return "missing RIFF header" }
  if ([Text.Encoding]::ASCII.GetString($bytes, 8, 4) -ne "WAVE") { return "missing WAVE header" }

  $offset = 12
  $channels = 0; $sampleRate = 0; $bits = 0; $audioFormat = 0
  $dataOffset = -1; $dataSize = 0
  while ($offset -lt ($bytes.Length - 8)) {
    $id = [Text.Encoding]::ASCII.GetString($bytes, $offset, 4)
    $size = [BitConverter]::ToInt32($bytes, $offset + 4)
    if ($size -lt 0) { return "corrupt chunk size" }
    if ($id -eq "fmt ") {
      if ($bytes.Length -lt ($offset + 24)) { return "truncated fmt chunk" }
      $audioFormat = [BitConverter]::ToInt16($bytes, $offset + 8)
      $channels = [BitConverter]::ToInt16($bytes, $offset + 10)
      $sampleRate = [BitConverter]::ToInt32($bytes, $offset + 12)
      $bits = [BitConverter]::ToInt16($bytes, $offset + 22)
    }
    elseif ($id -eq "data") {
      $dataOffset = $offset + 8
      $dataSize = [Math]::Min($size, $bytes.Length - $dataOffset)
    }
    $offset += 8 + $size + ($size % 2)
  }

  if ($audioFormat -eq 0) { return "missing fmt chunk" }
  if ($dataOffset -lt 0 -or $dataSize -le 0) { return "missing or empty data chunk" }
  if ($audioFormat -ne 1) { return "expected PCM (format 1) but found audio format $audioFormat" }
  if ($channels -ne 1) { return "expected mono but found $channels channels" }
  if ($bits -ne 16) { return "expected 16-bit but found $bits-bit" }

  $duration = $dataSize / ($sampleRate * $channels * ($bits / 8))
  if ($duration -lt $MinDurationSeconds) { return ("duration {0:N3}s is too short" -f $duration) }

  return [pscustomobject]@{
    SampleRate = $sampleRate; Channels = $channels; Bits = $bits
    Duration = $duration; Bytes = $bytes.Length
  }
}

# ------------------------------------------------------------------- chimes --
# Deterministic tone synthesis. Unchanged from the original generator so that
# -IncludeChimes reproduces the committed chimes. Chimes are not speech, so
# Piper is not involved.
function Write-PcmWav {
  param([string] $Path, [int] $SampleRate, [int16[]] $Samples)
  $bytes = New-Object byte[] (44 + $Samples.Length * 2)
  [Text.Encoding]::ASCII.GetBytes("RIFF").CopyTo($bytes, 0)
  [BitConverter]::GetBytes([int]($bytes.Length - 8)).CopyTo($bytes, 4)
  [Text.Encoding]::ASCII.GetBytes("WAVE").CopyTo($bytes, 8)
  [Text.Encoding]::ASCII.GetBytes("fmt ").CopyTo($bytes, 12)
  [BitConverter]::GetBytes([int]16).CopyTo($bytes, 16)
  [BitConverter]::GetBytes([int16]1).CopyTo($bytes, 20)
  [BitConverter]::GetBytes([int16]1).CopyTo($bytes, 22)
  [BitConverter]::GetBytes([int]$SampleRate).CopyTo($bytes, 24)
  [BitConverter]::GetBytes([int]($SampleRate * 2)).CopyTo($bytes, 28)
  [BitConverter]::GetBytes([int16]2).CopyTo($bytes, 32)
  [BitConverter]::GetBytes([int16]16).CopyTo($bytes, 34)
  [Text.Encoding]::ASCII.GetBytes("data").CopyTo($bytes, 36)
  [BitConverter]::GetBytes([int]($Samples.Length * 2)).CopyTo($bytes, 40)
  [Buffer]::BlockCopy($Samples, 0, $bytes, 44, $Samples.Length * 2)
  [IO.File]::WriteAllBytes($Path, $bytes)
}

function New-Tone {
  param([double[]] $Freqs, [double] $Seconds, [double] $Volume = 0.28, [int] $SampleRate = 22050)
  $n = [int]($SampleRate * $Seconds)
  $samples = New-Object int16[] $n
  for ($i = 0; $i -lt $n; $i++) {
    $env = 1.0
    $t = $i / $n
    if ($t -lt 0.08) { $env = $t / 0.08 }
    elseif ($t -gt 0.7) { $env = (1 - $t) / 0.3 }
    $v = 0.0
    foreach ($f in $Freqs) { $v += [Math]::Sin(2 * [Math]::PI * $f * $i / $SampleRate) }
    $v = ($v / $Freqs.Length) * $Volume * $env
    $samples[$i] = [int16]([Math]::Max(-32767, [Math]::Min(32767, $v * 32767)))
  }
  return $samples
}

function New-Noise {
  param([double] $Seconds, [double] $Volume = 0.12, [int] $SampleRate = 22050)
  $n = [int]($SampleRate * $Seconds)
  $samples = New-Object int16[] $n
  $rand = New-Object Random 7
  for ($i = 0; $i -lt $n; $i++) {
    $env = 0.4 + 0.6 * [Math]::Sin([Math]::PI * $i / $n)
    $v = (($rand.NextDouble() * 2) - 1) * $Volume * $env
    $samples[$i] = [int16]($v * 32767)
  }
  return $samples
}

$RequiredChimes = @("ding.wav", "bell.wav", "pop.wav", "blower.wav", "silent.wav")

# --------------------------------------------------------------------- main ---
Write-Host ""
Write-Host "Bingo caller audio generator (Piper TTS)" -ForegroundColor Cyan
Write-Host "  Voice dir : $VoiceDir"
Write-Host "  Calls dir : $CallDir"
Write-Host "  Chimes dir: $ChimeDir"
Write-Host ""

try { $piper = Resolve-Piper } catch { Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }
Write-Host "Piper: $($piper.Exe)" -ForegroundColor DarkGray
Write-Host "Model: $($piper.Model)" -ForegroundColor DarkGray

if (-not (Test-Path -LiteralPath $CallDir)) { New-Item -ItemType Directory -Force -Path $CallDir | Out-Null }
if (-not (Test-Path -LiteralPath $ChimeDir)) { New-Item -ItemType Directory -Force -Path $ChimeDir | Out-Null }

$stage = Join-Path ([IO.Path]::GetTempPath()) ("bingo-audio-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $stage | Out-Null

$failures = New-Object System.Collections.Generic.List[string]
$report = New-Object System.Collections.Generic.List[object]
$started = Get-Date

try {
  # ---- calls -------------------------------------------------------------
  $specs = @(1..75 | ForEach-Object { Get-CallSpec -Number $_ })
  $index = 0
  foreach ($spec in $specs) {
    $index++
    $out = Join-Path $stage $spec.FileName
    $status = "ok"
    try {
      Invoke-PiperSay -Piper $piper -Text $spec.Phrase -OutFile $out
      $check = Test-WavFile -Path $out
      if ($check -is [string]) { $status = $check }
      else {
        $report.Add([pscustomobject]@{
          File = $spec.FileName; Phrase = $spec.Phrase; Letter = $spec.Letter; Number = $spec.Number
          Duration = [math]::Round($check.Duration, 2); KB = [math]::Round($check.Bytes / 1KB, 1)
          Rate = $check.SampleRate
        })
      }
    } catch {
      $status = $_.Exception.Message
    }
    if ($status -ne "ok") {
      $failures.Add(("{0} ({1}): {2}" -f $spec.FileName, $spec.Phrase, $status))
      Write-Host ("  [{0,2}/75] FAIL {1,-10} {2}" -f $index, $spec.FileName, $status) -ForegroundColor Red
    } elseif ($index % 10 -eq 0 -or $index -eq 1) {
      Write-Host ("  [{0,2}/75] ok   {1,-10} '{2}'" -f $index, $spec.FileName, $spec.Phrase) -ForegroundColor DarkGray
    }
  }

  # ---- intro (optional) --------------------------------------------------
  $introName = $null
  if (-not $SkipIntro) {
    $introName = "intro.wav"
    $introOut = Join-Path $stage $introName
    try {
      Invoke-PiperSay -Piper $piper -Text "Let's play bingo!" -OutFile $introOut
      $check = Test-WavFile -Path $introOut
      if ($check -is [string]) { $failures.Add("intro.wav: $check") }
    } catch {
      $failures.Add("intro.wav: $($_.Exception.Message)")
    }
  }

  # ---- chimes ------------------------------------------------------------
  if ($IncludeChimes) {
    Write-Host ""
    Write-Host "Regenerating chimes..."
    Write-PcmWav (Join-Path $ChimeDir "silent.wav") 8000 @(0, 0, 0, 0)
    Write-PcmWav (Join-Path $ChimeDir "ding.wav") 22050 (New-Tone -Freqs @(880, 1320) -Seconds 0.45)
    Write-PcmWav (Join-Path $ChimeDir "bell.wav") 22050 (New-Tone -Freqs @(523.25, 659.25, 783.99) -Seconds 0.7)
    Write-PcmWav (Join-Path $ChimeDir "pop.wav") 22050 (New-Tone -Freqs @(1200) -Seconds 0.18 -Volume 0.22)
    Write-PcmWav (Join-Path $ChimeDir "blower.wav") 22050 (New-Noise -Seconds 1.6)
  }

  # ---- verify chimes survive (silent.wav is required by unlock()) --------
  $missingChimes = @($RequiredChimes | Where-Object { -not (Test-Path -LiteralPath (Join-Path $ChimeDir $_)) })
  if ($missingChimes.Count -gt 0) {
    $failures.Add(("missing required chime file(s): {0} (silent.wav is required by the audio unlock flow - rerun with -IncludeChimes)" -f ($missingChimes -join ", ")))
  }

  # ---- abort before touching the repo if anything failed ------------------
  if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "GENERATION FAILED - committed audio was left untouched." -ForegroundColor Red
    foreach ($f in $failures) { Write-Host "  - $f" -ForegroundColor Red }
    exit 1
  }

  # ---- promote staged files into the repository ---------------------------
  $expected = @($specs | ForEach-Object { $_.FileName })
  if ($introName) { $expected += $introName }

  $copied = 0
  foreach ($name in $expected) {
    $src = Join-Path $stage $name
    $dst = Join-Path $CallDir $name
    Copy-Item -LiteralPath $src -Destination $dst -Force
    $copied++
  }

  $stray = @(Get-ChildItem -LiteralPath $CallDir -Filter "*.wav" -File |
    Where-Object { $expected -notcontains $_.Name } |
    Select-Object -ExpandProperty Name)
}
finally {
  if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue }
}

$elapsed = (Get-Date) - $started

Write-Host ""
Write-Host "SUCCESS" -ForegroundColor Green
Write-Host ("  Generated {0} call recordings in {1:N1}s" -f $report.Count, $elapsed.TotalSeconds)
if ($introName) { Write-Host "  Plus intro.wav" }

if ($report.Count -gt 0) {
  $totalDur = ($report | Measure-Object -Property Duration -Sum).Sum
  $totalKB = ($report | Measure-Object -Property KB -Sum).Sum
  $avgDur = $totalDur / $report.Count
  $minDur = ($report | Measure-Object -Property Duration -Minimum).Minimum
  $maxDur = ($report | Measure-Object -Property Duration -Maximum).Maximum
  $rates = ($report | Select-Object -ExpandProperty Rate -Unique) -join ", "
  Write-Host ("  Format: {0} Hz mono 16-bit PCM" -f $rates)
  Write-Host ("  Duration: avg {0:N2}s (min {1:N2}s / max {2:N2}s)" -f $avgDur, $minDur, $maxDur)
  Write-Host ("  Total call audio: {0:N1} KB" -f $totalKB)
}

$byLetter = $report | Group-Object -Property Letter | Sort-Object -Property Name
foreach ($g in $byLetter) {
  $nums = ($g.Group | Sort-Object -Property Number | ForEach-Object { $_.Number })
  Write-Host ("  {0}: {1,2} files  numbers {2}-{3}" -f $g.Name, $g.Count, $nums[0], $nums[-1]) -ForegroundColor DarkGray
}

if ($stray -and $stray.Count -gt 0) {
  Write-Host ""
  Write-Host "Note: unexpected .wav files present in $CallDir (left alone):" -ForegroundColor Yellow
  foreach ($s in $stray) { Write-Host "  - $s" -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "Audio changed. Bump AUDIO_VERSION in js/audio.js so browsers refetch it:" -ForegroundColor Cyan
Write-Host "  var AUDIO_VERSION = `"<new value>`"  // only when audio/calls/*.wav changes" -ForegroundColor DarkGray
Write-Host "The app version (index.html / version.json) does NOT need a bump for audio-only changes." -ForegroundColor DarkGray
Write-Host ""
