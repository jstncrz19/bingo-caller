const AudioCaller = (function () {
  var player = null;
  var unlocked = false;
  var voices = [];
  var audioCtx = null;
  var cache = {};
  var preloaded = {};
  var preloadStarted = false;

  try {
    player = new Audio();
  } catch (e) {
    player = {};
  }

  var letters = ["B", "I", "N", "G", "O"];

  // ---- recorded audio cache busting ---------------------------------------
  // The call and chime files use fixed filenames, so after audio/calls/*.wav
  // are regenerated a browser (and the GitHub Pages CDN, which serves
  // Cache-Control: max-age=600) would keep handing back the previous
  // recordings. Every audio URL therefore gets a version query appended.
  //
  // This is deliberately separate from the app version (APP_VERSION in
  // index.html / version.json). That version changes on every UI tweak, and
  // tying audio to it would re-download every call file for every user on
  // every release. Bump AUDIO_VERSION only when audio/calls/*.wav changes.
  //
  //   1 = original Windows SAPI recordings
  //   2 = Piper TTS recordings
  var AUDIO_VERSION = "2";

  function audioUrl(path) {
    return path + "?av=" + AUDIO_VERSION;
  }

  function fileFor(n) {
    var letter = letterForNumber(n).toLowerCase();
    return audioUrl("audio/calls/" + letter + "-" + n + ".wav");
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    preloadAll();
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) {}
    try {
      player.src = audioUrl("audio/chimes/silent.wav");
      var p = player.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (e) {}
    if ("speechSynthesis" in window) {
      try {
        speechSynthesis.getVoices();
        speechSynthesis.addEventListener("voiceschanged", loadVoices);
        loadVoices();
      } catch (e) {}
    }
  }

  function loadVoices() {
    try {
      voices = speechSynthesis.getVoices();
    } catch (e) {
      voices = [];
    }
  }

  function getVoices() {
    if (!voices.length && "speechSynthesis" in window) loadVoices();
    return voices;
  }

  function getSrc(src) {
    return cache[src] || src;
  }

  function loadToCache(src) {
    if (preloaded[src]) return Promise.resolve(true);
    preloaded[src] = true;
    return new Promise(function (resolve) {
      if (typeof fetch !== "function") { resolve(false); return; }
      try {
        fetch(src, { cache: "force-cache" }).then(function (r) {
          if (!r.ok) throw 0;
          return r.blob();
        }).then(function (b) {
          try { cache[src] = URL.createObjectURL(b); } catch (e) {}
          resolve(true);
        }).catch(function () { resolve(false); });
      } catch (e) { resolve(false); }
    });
  }

  function preloadAll() {
    if (preloadStarted) return;
    preloadStarted = true;
    var queue = [];
    for (var n = 1; n <= 75; n++) queue.push(fileFor(n));
    queue.push(audioUrl("audio/chimes/ding.wav"));
    queue.push(audioUrl("audio/chimes/bell.wav"));
    queue.push(audioUrl("audio/chimes/pop.wav"));
    queue.push(audioUrl("audio/chimes/blower.wav"));
    var i = 0;
    function next() {
      if (i >= queue.length) return;
      var f = queue[i++];
      loadToCache(f).then(next);
    }
    for (var c = 0; c < 3; c++) next();
  }

  function playFile(src) {
    return new Promise(function (resolve) {
      if (!player || typeof player.play !== "function") {
        resolve();
        return;
      }
      var settled = false;
      function done() {
        if (settled) return;
        settled = true;
        resolve();
      }
      player.onended = done;
      player.onerror = done;
      try {
        player.src = getSrc(src);
        var p = player.play();
        if (p && typeof p.then === "function") p.then(function () {}).catch(done);
        else setTimeout(done, 250);
      } catch (e) {
        done();
      }
    });
  }

  function speak(text, voiceURI, rate) {
    return new Promise(function (resolve) {
      if (!("speechSynthesis" in window)) {
        resolve();
        return;
      }
      var settled = false;
      function done() {
        if (settled) return;
        settled = true;
        resolve();
      }
      try {
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text);
        var voice = findVoice(getVoices(), voiceURI);
        if (voice) u.voice = voice;
        u.rate = rate === undefined ? 1 : rate;
        u.onend = done;
        u.onerror = done;
        speechSynthesis.speak(u);
      } catch (e) {
        done();
      }
    });
  }

  function findVoice(list, uri) {
    if (!list) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].voiceURI === uri) return list[i];
    }
    return null;
  }

  function phraseFor(n, settings) {
    var letter = letterForNumber(n);
    var ones = n % 10;
    var tens = Math.floor(n / 10);
    var parts = [];
    if (settings.callLetters) parts.push(letter);
    parts.push(String(n));
    var text = parts.join(" ");
    if (settings.chatty && n < 10) {
      text = letter + " " + n + ", " + n + " by itself";
    } else if (settings.chatty && settings.callLetters) {
      text = letter + " " + n + ", under the " + letter + ", " + n;
    }
    if (settings.callTwice && n >= 10) {
      text += ". " + letter + ": " + tens + ", " + ones;
    } else if (settings.callTwice) {
      text += ". " + n + " by itself";
    }
    return text;
  }

  function callNumber(n, settings) {
    unlock();
    if (settings.callerType === "speech") {
      return speak(phraseFor(n, settings), settings.voiceURI, settings.speechRate);
    }
    return playFile(fileFor(n)).then(function () {
      if (settings.callTwice) return playFile(fileFor(n));
      return null;
    });
  }

  function playChime(name) {
    unlock();
    return playFile(audioUrl("audio/chimes/" + (name || "ding") + ".wav"));
  }

  function playShuffle() {
    unlock();
    return playFile(audioUrl("audio/chimes/blower.wav"));
  }

  function previewVoice(voiceURI) {
    unlock();
    return playFile(fileFor(12)).then(function () {
      if (voiceURI && "speechSynthesis" in window) return speak("B 12", voiceURI, 1);
      return Promise.resolve();
    });
  }

  return {
    unlock: unlock,
    callNumber: callNumber,
    playChime: playChime,
    playShuffle: playShuffle,
    getVoices: getVoices,
    previewVoice: previewVoice,
    speak: speak,
  };
})();
