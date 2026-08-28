const AudioCaller = (() => {
  const player = new Audio();
  let unlocked = false;
  let voices = [];
  let audioCtx = null;

  const letters = ["B", "I", "N", "G", "O"];

  function fileFor(n) {
    const letter = letterForNumber(n).toLowerCase();
    return `audio/calls/${letter}-${n}.wav`;
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch {}
    player.src = "audio/chimes/silent.wav";
    player.play().catch(() => {});
    if ("speechSynthesis" in window) {
      speechSynthesis.getVoices();
      speechSynthesis.addEventListener("voiceschanged", loadVoices);
      loadVoices();
    }
  }

  function loadVoices() {
    voices = speechSynthesis.getVoices();
  }

  function getVoices() {
    if (!voices.length && "speechSynthesis" in window) loadVoices();
    return voices;
  }

  function playFile(src) {
    return new Promise((resolve) => {
      player.onended = () => resolve();
      player.onerror = () => resolve();
      player.src = src;
      player.play().then(() => {}).catch(() => resolve());
    });
  }

  function speak(text, voiceURI, rate = 1) {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = getVoices().find((v) => v.voiceURI === voiceURI);
      if (voice) u.voice = voice;
      u.rate = rate;
      u.onend = resolve;
      u.onerror = resolve;
      speechSynthesis.speak(u);
    });
  }

  function phraseFor(n, settings) {
    const letter = letterForNumber(n);
    const ones = n % 10;
    const tens = Math.floor(n / 10);
    let parts = [];
    if (settings.callLetters) parts.push(letter);
    parts.push(String(n));
    let text = parts.join(" ");
    if (settings.chatty && n < 10) {
      text = `${letter} ${n}, ${n} by itself`;
    } else if (settings.chatty && settings.callLetters) {
      text = `${letter} ${n}, under the ${letter}, ${n}`;
    }
    if (settings.callTwice && n >= 10) {
      text += `. ${letter}: ${tens}, ${ones}`;
    } else if (settings.callTwice) {
      text += `. ${n} by itself`;
    }
    return text;
  }

  async function callNumber(n, settings) {
    unlock();
    if (settings.callerType === "speech") {
      await speak(phraseFor(n, settings), settings.voiceURI, settings.speechRate);
      return;
    }
    await playFile(fileFor(n));
    if (settings.callTwice) {
      await playFile(fileFor(n));
    }
  }

  async function playChime(name = "ding") {
    unlock();
    await playFile(`audio/chimes/${name}.wav`);
  }

  async function playShuffle() {
    unlock();
    await playFile("audio/chimes/blower.wav");
  }

  async function previewVoice(voiceURI) {
    unlock();
    await speak("B 12. Let's play bingo!", voiceURI, 1);
  }

  return { unlock, callNumber, playChime, playShuffle, getVoices, previewVoice, speak };
})();
