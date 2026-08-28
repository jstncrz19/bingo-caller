const AudioCaller = (function () {
  var player = null;
  var unlocked = false;
  var voices = [];
  var audioCtx = null;

  try {
    player = new Audio();
  } catch (e) {
    player = {};
  }

  var letters = ["B", "I", "N", "G", "O"];

  function fileFor(n) {
    var letter = letterForNumber(n).toLowerCase();
    return "audio/calls/" + letter + "-" + n + ".wav";
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) {}
    try {
      player.src = "audio/chimes/silent.wav";
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
        player.src = src;
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
    return playFile("audio/chimes/" + (name || "ding") + ".wav");
  }

  function playShuffle() {
    unlock();
    return playFile("audio/chimes/blower.wav");
  }

  function previewVoice(voiceURI) {
    unlock();
    return speak("B 12, under the B, 12", voiceURI, 1);
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
