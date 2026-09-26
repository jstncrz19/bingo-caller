# Let's Play Bingo — Caller

A hall-style 75-ball bingo caller inspired by [letsplaybingo.io](https://letsplaybingo.io/). Every number is spoken out loud when it is called.

## Features

- Classic B-I-N-G-O board with current and previous balls
- **Recorded Piper (neural TTS) audio for every ball (B1–O75)** plus an optional speech-synthesis caller
- Autoplay, manual board clicks, repeat, shuffle/blower, and keyboard controls
- Pattern card with presets and draw-your-own
- Skip unused letters, hot ball, countdown, dark/light theme
- Printable card generator
- Settings saved in the browser (export/import)

## Run locally

Use the bundled dev server, which watches `css/`, `js/` and `icons/` and pushes
updates to the open page:

```powershell
node server.js
```

Then visit http://localhost:8080

Edits to `css/styles.css` are hot-swapped (the running game is preserved); edits
to JS or HTML trigger a full page reload. Set `LIVE_RELOAD=0` to turn watching
off, or `PORT=3000` to use a different port.

> Do not use `python -m http.server` or open `index.html` from disk for
> development - neither can watch files, so CSS changes need a manual refresh.

Click **Start Game** once so the browser allows sound.

## Host on GitHub Pages

1. Create a new GitHub repository (for example `bingo-caller`).
2. Push this folder to the `main` branch.
3. In the repo: **Settings → Pages → Deploy from a branch → main / root**.
4. Your site will be at `https://YOUR_USERNAME.github.io/bingo-caller/`.

Live at https://jstncrz19.github.io/bingo-caller/

## Regenerate call audio

The call recordings are generated offline with [Piper](https://github.com/OHF-Voice/piper1-gpl)
(neural TTS), then committed to this repo. Players never run Piper — the app only
plays the pre-rendered WAV files.

### One-time setup

1. Install Piper (Python 3.9+). It must be on your `PATH`, because the script
   resolves it with `Get-Command piper`:

   ```powershell
   pip install piper-tts
   piper --help
   ```

2. Download a voice. The model lives **outside** this repo — `.gitignore`
   already excludes `*.onnx`, `*.onnx.json` and `voices/`. The committed
   recordings use `en_US-amy-medium` (clear, neutral US English); grab both
   `en_US-amy-medium.onnx` and `en_US-amy-medium.onnx.json` from the Piper
   voices release and put them in:

   ```
   %LOCALAPPDATA%\BingoCallerPiper\voices\     <- the default
   ```

   Point the script elsewhere with `-VoiceDir <path>` or the
   `BINGO_PIPER_VOICE_DIR` environment variable.

### Generating

With the default voice folder, no arguments are needed:

```powershell
powershell -ExecutionPolicy Bypass -File generate-audio.ps1
```

This writes `audio/calls/b-1.wav` … `o-75.wav` plus `intro.wav` as canonical
16-bit PCM WAV, 22050 Hz, mono (Piper's native output, so no conversion step is
needed). `audio/chimes/` is left untouched unless you pass `-IncludeChimes`.

| Switch | Default | Effect |
| --- | --- | --- |
| `-Voice <name>` | `en_US-amy-medium` | Voice file to use inside `-VoiceDir` |
| `-VoiceDir <path>` | `%LOCALAPPDATA%\BingoCallerPiper\voices` | Folder holding the `.onnx` / `.onnx.json` |
| `-CallDir` / `-ChimeDir` | `audio\calls` / `audio\chimes` | Write somewhere else |
| `-SkipIntro` | off | Don't generate `intro.wav` |
| `-IncludeChimes` | off | Also regenerate `ding`/`bell`/`pop`/`blower` (never `silent.wav`) |
| `-LengthScale <n>` | `1.0` | Speech speed; `<1` is faster |
| `-NoiseScale <n>` | voice default | Expressiveness; higher is more varied |
| `-NoiseWScale <n>` | voice default | Per-phoneme noise variation |
| `-SentenceSilence <n>` | `0.0` | Silence appended to each file, seconds |

`-NoiseScale`, `-NoiseWScale` and `-SentenceSilence` are only forwarded to Piper
when you actually pass them, so the voice's own `.onnx.json` defaults stay in
effect otherwise.

The script generates into a staging directory and only replaces the committed
files once all 75 recordings pass a format/size check, so a failed run (missing
model, corrupt config, Piper error) leaves the existing audio untouched.

### After regenerating

Bump `AUDIO_VERSION` in `js/audio.js`. The app appends `?av=<AUDIO_VERSION>` to
every audio URL, which is what makes browsers and the GitHub Pages CDN pick up
new recordings — they otherwise keep serving cached copies of the same
filenames. The app version in `index.html` / `version.json` only needs a bump
when the app itself changes, so a UI tweak doesn't force every user to
re-download ~4 MB of audio.
