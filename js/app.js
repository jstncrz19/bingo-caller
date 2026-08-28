const STORAGE_KEY = "bingo-caller-settings-v1";

const defaultSettings = {
  theme: "dark",
  layout: "classic",
  cardColor: "red",
  gameNumber: "",
  prize: "",
  patternId: "coverall",
  customPattern: emptyPattern(),
  showPatternTitle: true,
  skipUnused: false,
  showSkipIndicator: true,
  hideUnusedOnBoard: false,
  pauseAfterEnabled: false,
  pauseAfter: 20,
  automaticCalling: true,
  timeBetweenCalls: 8,
  showCountdown: true,
  manualMode: false,
  hotBall: false,
  hotBallNumber: 7,
  hotBallTitle: "Jackpot",
  hotBallPrize: "",
  callerType: "recorded",
  voiceURI: "",
  speechRate: 1,
  callLetters: true,
  chatty: true,
  callTwice: false,
  playChime: true,
  chime: "ding",
  hideControls: false,
  keyboard: true,
  stoplight: false,
  hideShuffle: false,
  showCurrentCall: true,
  showPreviousCalls: true,
  previousCount: 3,
  showPatternMenu: true,
  lockPattern: false,
  lockPatternInPlay: false,
  showLetters: true,
  showGameNumber: true,
  showTotalCalls: true,
  showPreviousCallNumber: false,
  showCurrentCallNumber: false,
  coloredRows: false,
};

const state = {
  settings: loadSettings(),
  gamesPlayed: 0,
  called: [],
  remaining: [],
  playing: false,
  timer: null,
  countdownTimer: null,
  firstCallOfGame: null,
  needsResetConfirm: false,
};

window.__bingoActive = function () {
  return state.called.length > 0 || state.playing;
};

function loadSettings() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return Object.assign({}, defaultSettings);
    return Object.assign({}, defaultSettings, JSON.parse(raw));
  } catch (e) {
    return Object.assign({}, defaultSettings);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  } catch (e) {}
}

function activePattern() {
  if (state.settings.patternId === "custom") return state.settings.customPattern;
  var found = PATTERNS.find(function (p) { return p.id === state.settings.patternId; });
  return found ? found.grid : emptyPattern();
}

function eligibleNumbers() {
  var used = usedColumns(activePattern());
  var all = Array.from({ length: 75 }, function (_, i) { return i + 1; });
  if (!state.settings.skipUnused) return all;
  return all.filter(function (n) { return used[columnIndexForNumber(n)]; });
}

function shuffle(list) {
  var a = list.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

function gameInProgress() {
  return state.called.length > 0;
}

function currentNumber() {
  return state.called[0] || null;
}

function renderBoard() {
  var board = document.getElementById("board");
  var used = usedColumns(activePattern());
  board.innerHTML = "";
  LETTERS.forEach(function (letter, col) {
    var row = document.createElement("div");
    row.className = "board-row" + (state.settings.coloredRows ? " colored-" + letter : "");
    var chip = document.createElement("div");
    chip.className = "letter-chip " + letter;
    chip.textContent = state.settings.showLetters ? letter : "";
    row.appendChild(chip);
    for (var n = col * 15 + 1; n <= col * 15 + 15; n++) {
      var cell = document.createElement("button");
      var called = state.called.indexOf(n) !== -1;
      var unused = state.settings.skipUnused && !used[col];
      cell.className = "cell " + letter;
      if (called) cell.classList.add("called");
      if (unused && state.settings.hideUnusedOnBoard) cell.classList.add("unused");
      if (state.settings.hotBall && n === Number(state.settings.hotBallNumber)) cell.classList.add("hot");
      if (state.settings.manualMode) cell.classList.add("manual");
      cell.textContent = n;
      cell.setAttribute("data-n", n);
      if (state.settings.manualMode) {
        cell.addEventListener("click", (function (num) {
          return function () { toggleManual(num); };
        })(n));
      }
      row.appendChild(cell);
    }
    board.appendChild(row);
  });
}

function renderBall(el, n, sizeClass) {
  var html = "";
  el.className = "ball " + sizeClass;
  if (!n) {
    el.classList.add("placeholder");
    el.innerHTML = '<div class="letter">--</div><div class="num">?</div>';
    return;
  }
  var letter = letterForNumber(n);
  el.classList.add(letter);
  html = state.settings.showLetters ? '<div class="letter">' + letter + "</div>" : "";
  html += '<div class="num">' + n + "</div>";
  el.innerHTML = html;
}

function renderCalls() {
  var current = document.getElementById("current-ball");
  var prevWrap = document.getElementById("previous-balls");
  current.style.display = state.settings.showCurrentCall ? "grid" : "none";
  renderBall(current, currentNumber(), "current");
  prevWrap.innerHTML = "";
  prevWrap.style.display = state.settings.showPreviousCalls ? "flex" : "none";
  var prev = state.called.slice(1, 1 + Number(state.settings.previousCount));
  prev.forEach(function (n) {
    var el = document.createElement("div");
    renderBall(el, n, "prev");
    prevWrap.appendChild(el);
  });
  setText("total-calls", state.called.length);
  setText("current-call-num", currentNumber() ? letterForNumber(currentNumber()) + currentNumber() : "--");
  setText("prev-call-num", state.called[1] ? letterForNumber(state.called[1]) + state.called[1] : "--");
  setText("game-number-display", String(state.gamesPlayed || 0));
  setText("prize-display", state.settings.prize || "--");
  setText("hot-prize", state.settings.hotBall
    ? state.settings.hotBallTitle + (state.settings.hotBallPrize ? ": " + state.settings.hotBallPrize : "")
    : "--");

  var statGame = document.getElementById("stat-game");
  var statTotal = document.getElementById("stat-total");
  var statCurrent = document.getElementById("stat-current");
  var statPrev = document.getElementById("stat-prev");
  var statPrize = document.getElementById("stat-prize");
  var statHot = document.getElementById("stat-hot");
  if (statGame) statGame.hidden = !state.settings.showGameNumber;
  if (statTotal) statTotal.hidden = !state.settings.showTotalCalls;
  if (statCurrent) statCurrent.hidden = !state.settings.showCurrentCallNumber;
  if (statPrev) statPrev.hidden = !state.settings.showPreviousCallNumber;
  if (statPrize) statPrize.hidden = !state.settings.prize;
  if (statHot) statHot.hidden = !state.settings.hotBall;

  var hist = document.getElementById("history-list");
  var chips = "";
  state.called.slice().reverse().forEach(function (n) {
    chips += '<span class="history-chip ' + letterForNumber(n) + '">' + letterForNumber(n) + n + "</span>";
  });
  hist.innerHTML = chips;
}

function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderPattern() {
  var gridEl = document.getElementById("pattern-grid");
  var title = document.getElementById("pattern-title");
  var menu = document.getElementById("pattern-menu");
  var skip = document.getElementById("skip-pill");
  var pattern = PATTERNS.find(function (p) { return p.id === state.settings.patternId; });

  var cur = activePattern();
  var settingsGrid = document.getElementById("settings-pattern-grid");
  if (settingsGrid) {
    settingsGrid.innerHTML = "";
    for (var sr = 0; sr < 5; sr++) {
      for (var sc = 0; sc < 5; sc++) {
        var scEl = document.createElement("span");
        scEl.className = "pattern-cell s" + (cur[sr][sc] ? " on" : "") + (sr === 2 && sc === 2 ? " free" : "");
        settingsGrid.appendChild(scEl);
      }
    }
  }
  setTimeout(function () {
    if (title) title.textContent = state.settings.showPatternTitle ? (pattern ? pattern.name : "Custom") : "Pattern";
    if (skip) skip.classList.toggle("show", state.settings.skipUnused && state.settings.showSkipIndicator);
    if (menu) menu.hidden = !state.settings.showPatternMenu;
  }, 0);
  if (menu && menu.getAttribute("data-ready") !== "1") {
    var opts = "";
    PATTERNS.forEach(function (p) { opts += '<option value="' + p.id + '">' + p.name + "</option>"; });
    menu.innerHTML = opts;
    menu.setAttribute("data-ready", "1");
  }
  if (menu) menu.value = state.settings.patternId;
  var grid = activePattern();
  gridEl.innerHTML = "";
  for (var r = 0; r < 5; r++) {
    for (var c = 0; c < 5; c++) {
      (function (rr, cc) {
        var cell = document.createElement("button");
        cell.className = "pattern-cell" + (grid[rr][cc] ? " on" : "") + (rr === 2 && cc === 2 ? " free" : "");
        cell.addEventListener("click", function () {
          if (state.settings.lockPattern) return;
          if (state.settings.lockPatternInPlay && gameInProgress()) return;
          var next = clonePattern(activePattern());
          next[rr][cc] = !next[rr][cc];
          state.settings.patternId = "custom";
          state.settings.customPattern = next;
          saveSettings();
          renderPattern();
          renderBoard();
        });
        gridEl.appendChild(cell);
      })(r, c);
    }
  }
}

function renderControls() {
  var start = document.getElementById("btn-start");
  var next = document.getElementById("btn-next");
  var play = document.getElementById("btn-play");
  var reset = document.getElementById("btn-reset");
  var repeat = document.getElementById("btn-repeat");
  var shuffleBtn = document.getElementById("btn-shuffle");
  var controls = document.getElementById("controls");
  if (!controls) return;
  controls.hidden = state.settings.hideControls;
  controls.classList.toggle("stoplight", state.settings.stoplight);
  if (shuffleBtn) shuffleBtn.hidden = state.settings.hideShuffle;
  if (play) play.hidden = !state.settings.automaticCalling || state.settings.manualMode;
  if (start) start.hidden = gameInProgress() || state.settings.manualMode;
  if (next) next.hidden = !gameInProgress() || state.settings.manualMode;
  if (next) next.disabled = state.playing || state.remaining.length === 0;
  if (play) play.disabled = !gameInProgress() || state.remaining.length === 0;
  if (play) {
    play.textContent = state.playing ? "Pause" : "Play";
    play.className = "btn " + (state.playing ? "btn-pause" : "btn-play");
  }
  if (reset) reset.disabled = state.playing || !gameInProgress();
  if (repeat) repeat.disabled = !currentNumber();
  var cd = document.getElementById("countdown");
  if (cd) cd.hidden = !(state.settings.showCountdown && (state.settings.automaticCalling || state.settings.manualMode));
}

function renderLayout() {
  document.body.setAttribute("data-theme", state.settings.theme);
  var layout = document.getElementById("layout");
  if (layout) layout.className = "layout " + state.settings.layout;
}

function safeRender() {
  try { renderLayout(); } catch (e) {}
  try { renderBoard(); } catch (e) {}
  try { renderCalls(); } catch (e) {}
  try { renderPattern(); } catch (e) {}
  try { renderControls(); } catch (e) {}
}

function renderAll() {
  safeRender();
}

function announce(n, isFirst) {
  var s = state.settings;
  var settingsParam = Object.assign({}, s, { firstCall: isFirst ? n : null });
  if (s.playChime && s.automaticCalling) {
    return AudioCaller.playChime(s.chime).then(function () {
      return AudioCaller.callNumber(n, settingsParam);
    });
  }
  return AudioCaller.callNumber(n, settingsParam);
}

function callNext(fromAuto) {
  try {
    if (fromAuto !== true) fromAuto = false;
    if (!state.remaining.length) {
      stopAuto();
      return;
    }
    var n = state.remaining.shift();
    var isFirst = state.called.length === 0;
    state.called.unshift(n);
    if (isFirst) state.firstCallOfGame = n;
    safeRender();
    announce(n, isFirst).then(function () {
      if (state.settings.pauseAfterEnabled && state.called.length >= Number(state.settings.pauseAfter)) {
        stopAuto();
        return;
      }
      if (fromAuto && state.playing) startCountdownThen(function () { callNext(true); });
    }).catch(function (err) {
      report(err);
      if (fromAuto && state.playing) startCountdownThen(function () { callNext(true); });
    });
  } catch (e) { report(e); }
}

function startGame() {
  try {
    if (typeof AudioCaller !== "undefined" && AudioCaller.unlock) AudioCaller.unlock();
    state.gamesPlayed += 1;
    state.called = [];
    state.remaining = shuffle(eligibleNumbers());
    if (state.remaining.length === 0) throw new Error("remaining is empty - PATTERNS or eligibleNumbers broken");
    callNext(false);
  } catch (e) { report(e); }
}

function report(e) {
  try {
    if (window.__dbgD) window.__dbgD("HANDLER ERR: " + e.message);
    if (typeof console !== "undefined" && console.error) console.error(e);
  } catch (x) {}
}

function togglePlay() {
  if (!gameInProgress() || !state.settings.automaticCalling) return;
  if (state.playing) stopAuto();
  else startAuto();
}

function toggleManual(n) {
  if (state.called.indexOf(n) !== -1) {
    state.called = state.called.filter(function (x) { return x !== n; });
  } else {
    state.called.unshift(n);
    announce(n, state.called.length === 1);
  }
  safeRender();
}

function repeatNumber() {
  if (currentNumber()) {
    if (typeof AudioCaller !== "undefined") announce(currentNumber(), false);
  }
}

function playShuffleSound() {
  if (typeof AudioCaller !== "undefined") AudioCaller.playShuffle();
}

function startCountdownThen(fn) {
  if (state.countdownTimer) clearInterval(state.countdownTimer);
  var bar = document.querySelector("#countdown span");
  var total = Number(state.settings.timeBetweenCalls) * 1000;
  var start = Date.now();
  if (bar) bar.style.width = "0%";
  state.countdownTimer = setInterval(function () {
    var pct = Math.min(100, ((Date.now() - start) / total) * 100);
    if (bar) bar.style.width = pct + "%";
    if (pct >= 100) {
      if (state.countdownTimer) clearInterval(state.countdownTimer);
      fn();
    }
  }, 50);
}

function startAuto() {
  if (!gameInProgress() || !state.remaining.length) return;
  state.playing = true;
  renderControls();
  startCountdownThen(function () { callNext(true); });
}

function stopAuto() {
  state.playing = false;
  if (state.countdownTimer) clearInterval(state.countdownTimer);
  var bar = document.querySelector("#countdown span");
  if (bar) bar.style.width = "0%";
  renderControls();
}

function resetBoard() {
  stopAuto();
  state.called = [];
  state.remaining = [];
  safeRender();
}

function showResetModal() {
  var m = document.getElementById("reset-modal");
  if (m) m.classList.add("open");
}

function hideResetModal() {
  var m = document.getElementById("reset-modal");
  if (m) m.classList.remove("open");
}

function confirmReset() {
  hideResetModal();
  resetBoard();
}

function openSettings() {
  var s = document.getElementById("settings");
  var o = document.getElementById("overlay");
  if (s) s.classList.add("open");
  if (o) o.classList.add("open");
}

function toggleTheme() {
  state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
  saveSettings();
  renderLayout();
  var sel = document.getElementById("set-theme");
  if (sel) sel.value = state.settings.theme;
}

function toggleFullscreen() {
  var d = document;
  var el = d.documentElement;
  var fs = d.fullscreenElement || d.webkitFullscreenElement;
  var req = el.requestFullscreen || el.webkitRequestFullscreen;
  var exit = d.exitFullscreen || d.webkitExitFullscreen;
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || "") && !window.MSStream;
  if (isIOS) {
    try {
      if (window.__dbgD) window.__dbgD("INFO: iOS Safari doesn't support Fullscreen API. Use Add to Home Screen for fullscreen.");
      if (!(window.navigator.standalone || false)) {
        window.alert("Fullscreen isn't supported in iOS Safari.\n\nTo run this fullscreen: tap the Share button, then \"Add to Home Screen\", and open it from your home screen.");
      }
    } catch (e) {}
    return;
  }
  try {
    if (!fs) {
      if (req) req.call(el);
    } else {
      if (exit) exit.call(d);
    }
  } catch (e) {}
}

function bindSettings() {
  var s = state.settings;
  var set = function (id, prop, transform) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!s[prop];
    else el.value = s[prop];
    el.addEventListener("change", function () {
      s[prop] = el.type === "checkbox" ? el.checked : (transform ? transform(el.value) : el.value);
      saveSettings();
      if (prop === "patternId") renderPattern();
      safeRender();
    });
  };
  set("set-theme", "theme");
  set("set-layout", "layout");
  set("set-game-number", "gameNumber");
  set("set-prize", "prize");
  set("set-pattern", "patternId");
  set("set-show-pattern-title", "showPatternTitle");
  set("set-skip", "skipUnused");
  set("set-skip-indicator", "showSkipIndicator");
  set("set-hide-unused", "hideUnusedOnBoard");
  set("set-pause-enabled", "pauseAfterEnabled");
  set("set-pause-after", "pauseAfter", Number);
  set("set-auto", "automaticCalling");
  set("set-interval", "timeBetweenCalls", Number);
  set("set-countdown", "showCountdown");
  set("set-manual", "manualMode");
  set("set-hot", "hotBall");
  set("set-hot-number", "hotBallNumber", Number);
  set("set-hot-title", "hotBallTitle");
  set("set-hot-prize", "hotBallPrize");
  set("set-caller-type", "callerType");
  set("set-voice", "voiceURI");
  set("set-rate", "speechRate", Number);
  set("set-letters", "callLetters");
  set("set-chatty", "chatty");
  set("set-twice", "callTwice");
  set("set-chime-on", "playChime");
  set("set-chime", "chime");
  set("set-hide-controls", "hideControls");
  set("set-keyboard", "keyboard");
  set("set-stoplight", "stoplight");
  set("set-hide-shuffle", "hideShuffle");
  set("set-show-current", "showCurrentCall");
  set("set-show-prev", "showPreviousCalls");
  set("set-prev-count", "previousCount", Number);
  set("set-pattern-menu", "showPatternMenu");
  set("set-lock-pattern", "lockPattern");
  set("set-lock-play", "lockPatternInPlay");
  set("set-show-letters", "showLetters");
  set("set-show-game", "showGameNumber");
  set("set-show-total", "showTotalCalls");
  set("set-show-cur-num", "showCurrentCallNumber");
  set("set-show-prev-num", "showPreviousCallNumber");
  set("set-colored", "coloredRows");
}

function populateVoices() {
  try {
    var select = document.getElementById("set-voice");
    var voices = typeof AudioCaller !== "undefined" && AudioCaller.getVoices ? AudioCaller.getVoices() : [];
    if (voices.length) {
      var options = "";
      voices.forEach(function (v) {
        options += '<option value="' + v.voiceURI + '">' + v.name + " (" + v.lang + ")</option>";
      });
      select.innerHTML = options;
    } else {
      select.innerHTML = "<option value=\"\">Default device voice</option>";
    }
    if (state.settings.voiceURI) select.value = state.settings.voiceURI;
  } catch (e) {}
}

function exportSettings() {
  try {
    var blob = new Blob([JSON.stringify(state.settings, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bingo-caller-settings.json";
    a.click();
  } catch (e) {}
}

function importSettings(file) {
  var reader = new FileReader();
  reader.onload = function () {
    try {
      state.settings = Object.assign({}, defaultSettings, JSON.parse(reader.result));
      saveSettings();
      location.reload();
    } catch (e) {
      alert("Could not import that settings file.");
    }
  };
  reader.readAsText(file);
}

function closeSettings() {
  var s = document.getElementById("settings");
  var o = document.getElementById("overlay");
  if (s) s.classList.remove("open");
  if (o) o.classList.remove("open");
  saveSettings();
}

function bindNonCore() {
  var overlay = document.getElementById("overlay");
  if (overlay && !overlay.getAttribute("data-bound")) {
    overlay.addEventListener("click", closeSettings);
    overlay.setAttribute("data-bound", "1");
  }

  var patternSelect = document.getElementById("set-pattern");
  if (patternSelect) {
    var opts = "";
    PATTERNS.forEach(function (p) { opts += '<option value="' + p.id + '">' + p.name + "</option>"; });
    patternSelect.innerHTML = opts;
  }
  bindSettings();
  populateVoices();
  if ("speechSynthesis" in window) {
    try {
      speechSynthesis.addEventListener("voiceschanged", populateVoices);
    } catch (e) {}
  }

  var patternMenu = document.getElementById("pattern-menu");
  if (patternMenu && !patternMenu.getAttribute("data-bound")) {
    patternMenu.addEventListener("change", function (e) {
      state.settings.patternId = e.target.value;
      saveSettings();
      renderPattern();
      renderBoard();
    });
    patternMenu.setAttribute("data-bound", "1");
  }
  var preview = document.getElementById("preview-voice");
  if (preview && !preview.getAttribute("data-bound")) {
    preview.addEventListener("click", function () {
      if (typeof AudioCaller !== "undefined") AudioCaller.previewVoice(state.settings.voiceURI);
    });
    preview.setAttribute("data-bound", "1");
  }
  var exportBtn = document.getElementById("export-settings");
  if (exportBtn && !exportBtn.getAttribute("data-bound")) {
    exportBtn.addEventListener("click", exportSettings);
    exportBtn.setAttribute("data-bound", "1");
  }
  var importInp = document.getElementById("import-settings");
  if (importInp && !importInp.getAttribute("data-bound")) {
    importInp.addEventListener("change", function (e) {
      if (e.target.files[0]) importSettings(e.target.files[0]);
    });
    importInp.setAttribute("data-bound", "1");
  }

  var manualInput = document.getElementById("set-manual");
  if (manualInput && !manualInput.getAttribute("data-bound2")) {
    manualInput.addEventListener("change", function () {
      if (state.settings.manualMode) {
        state.settings.automaticCalling = false;
        var auto = document.getElementById("set-auto");
        if (auto) auto.checked = false;
        stopAuto();
        saveSettings();
        renderControls();
      }
    });
    manualInput.setAttribute("data-bound2", "1");
  }
  var autoInput = document.getElementById("set-auto");
  if (autoInput && !autoInput.getAttribute("data-bound2")) {
    autoInput.addEventListener("change", function () {
      if (state.settings.automaticCalling) {
        state.settings.manualMode = false;
        var manual = document.getElementById("set-manual");
        if (manual) manual.checked = false;
        saveSettings();
        renderControls();
      }
    });
    autoInput.setAttribute("data-bound2", "1");
  }

  window.addEventListener("keydown", function (e) {
    if (!state.settings.keyboard) return;
    if (["INPUT", "SELECT", "TEXTAREA"].indexOf(e.target.tagName) !== -1) return;
    if (e.code === "Space" || e.code === "PageUp") {
      e.preventDefault();
      if (state.settings.automaticCalling) togglePlay();
    }
    if (e.code === "ArrowRight" || e.code === "PageDown") {
      e.preventDefault();
      if (!gameInProgress()) startGame();
      else if (!state.playing) callNext(false);
    }
    if ((e.key || "").toLowerCase() === "r") {
      showResetModal();
    }
    if (e.key === "Enter" && document.getElementById("reset-modal")) {
      if (document.getElementById("reset-modal").classList.contains("open")) {
        resetBoard();
        hideResetModal();
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  try { bindNonCore(); } catch (e) {}
  try { safeRender(); } catch (e) {}
  document.body.addEventListener("click", function () {
    if (typeof AudioCaller !== "undefined" && AudioCaller.unlock) AudioCaller.unlock();
  }, { once: true });
});
