Add-Type -AssemblyName System.Speech

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$callDir = Join-Path $root "audio\calls"
$chimeDir = Join-Path $root "audio\chimes"
New-Item -ItemType Directory -Force -Path $callDir, $chimeDir | Out-Null

function Write-PcmWav {
  param(
    [string]$Path,
    [int]$SampleRate,
    [int16[]]$Samples
  )
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
  param([double[]]$Freqs, [double]$Seconds, [double]$Volume = 0.28, [int]$SampleRate = 22050)
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
  param([double]$Seconds, [double]$Volume = 0.12, [int]$SampleRate = 22050)
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

Write-PcmWav (Join-Path $chimeDir "silent.wav") 8000 @(0, 0, 0, 0)
Write-PcmWav (Join-Path $chimeDir "ding.wav") 22050 (New-Tone -Freqs @(880, 1320) -Seconds 0.45)
Write-PcmWav (Join-Path $chimeDir "bell.wav") 22050 (New-Tone -Freqs @(523.25, 659.25, 783.99) -Seconds 0.7)
Write-PcmWav (Join-Path $chimeDir "pop.wav") 22050 (New-Tone -Freqs @(1200) -Seconds 0.18 -Volume 0.22)
Write-PcmWav (Join-Path $chimeDir "blower.wav") 22050 (New-Noise -Seconds 1.6)

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = -1
$synth.Volume = 100
$voice = $synth.GetInstalledVoices() | Where-Object { $_.Enabled } | Select-Object -First 1
if ($voice) { $synth.SelectVoice($voice.VoiceInfo.Name) }

function Speak-ToFile($path, $text) {
  $synth.SetOutputToWaveFile($path)
  $synth.Speak($text)
  $synth.SetOutputToNull()
}

Speak-ToFile (Join-Path $callDir "intro.wav") "Let's play bingo!"

$letters = @("b", "i", "n", "g", "o")
for ($n = 1; $n -le 75; $n++) {
  $letter = $letters[[Math]::Floor(($n - 1) / 15)]
  $spokenLetter = $letter.ToUpper()
  $path = Join-Path $callDir "$letter-$n.wav"
  Speak-ToFile $path "$spokenLetter $n"
  Write-Host "Generated $letter-$n"
}

$synth.Dispose()
Write-Host "Audio generation complete."
