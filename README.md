# Let's Play Bingo — Caller

A hall-style 75-ball bingo caller inspired by [letsplaybingo.io](https://letsplaybingo.io/). Every number is spoken out loud when it is called.

## Features

- Classic B-I-N-G-O board with current and previous balls
- **Recorded audio for every ball (B1–O75)** plus an optional speech-synthesis caller
- Autoplay, manual board clicks, repeat, shuffle/blower, and keyboard controls
- Pattern card with presets and draw-your-own
- Skip unused letters, hot ball, countdown, dark/light theme
- Printable card generator
- Settings saved in the browser (export/import)

## Run locally

Open `index.html` in Chrome or Edge, or from this folder:

```powershell
python -m http.server 8080
```

Then visit http://localhost:8080

Click **Start Game** once so the browser allows sound.

## Host on GitHub Pages

1. Create a new GitHub repository (for example `bingo-caller`).
2. Push this folder to the `main` branch.
3. In the repo: **Settings → Pages → Deploy from a branch → main / root**.
4. Your site will be at `https://YOUR_USERNAME.github.io/bingo-caller/`.

Live at https://jstncrz19.github.io/bingo-caller/

## Regenerate call audio

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File generate-audio.ps1
```

This uses the Windows speech engine to write WAV files into `audio/calls` and `audio/chimes`.
