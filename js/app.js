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

window.__bingoActive = () => state.called.length > 0 || state.playing;

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
}

function activePattern() {
  if (state.settings.patternId === "custom") return state.settings.customPattern;
  const found = PATTERNS.find((p) => p.id === state.settings.patternId);
  return found ? found.grid : emptyPattern();
}

function eligibleNumbers() {
  const used = usedColumns(activePattern());
  const all = Array.from({ length: 75 }, (_, i) => i + 1);
  if (!state.settings.skipUnused) return all;
  return all.filter((n) => used[columnIndexForNumber(n)]);
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
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
  const board = document.getElementById("board");
  const used = usedColumns(activePattern());
  board.innerHTML = "";
  LETTERS.forEach((letter, col) => {
    const row = document.createElement("div");
    row.className = `board-row${state.settings.coloredRows ? ` colored-${letter}` : ""}`;
    const chip = document.createElement("div");
    chip.className = `letter-chip ${letter}`;
    chip.textContent = state.settings.showLetters ? letter : "";
    row.appendChild(chip);
    for (let n = col * 15 + 1; n <= col * 15 + 15; n++) {
      const cell = document.createElement("button");
      const called = state.called.includes(n);
      const unused = state.settings.skipUnused && !used[col];
      cell.className = `cell ${letter}`;
      if (called) cell.classList.add("called");
      if (unused && state.settings.hideUnusedOnBoard) cell.classList.add("unused");
      if (state.settings.hotBall && n === Number(state.settings.hotBallNumber)) cell.classList.add("hot");
      if (state.settings.manualMode) cell.classList.add("manual");
      cell.textContent = n;
      cell.dataset.n = n;
      if (state.settings.manualMode) {
        cell.addEventListener("click", () => toggleManual(n));
      }
      row.appendChild(cell);
    }
    board.appendChild(row);
  });
}

function renderBall(el, n, sizeClass) {
  el.className = `ball ${sizeClass}`;
  if (!n) {
    el.classList.add("placeholder");
    el.innerHTML = `<div class="letter">--</div><div class="num">?</div>`;
    return;
  }
  const letter = letterForNumber(n);
  el.classList.add(letter);
  el.innerHTML = `${state.settings.showLetters ? `<div class="letter">${letter}</div>` : ""}<div class="num">${n}</div>`;
}

function renderCalls() {
  const current = document.getElementById("current-ball");
  const prevWrap = document.getElementById("previous-balls");
  current.style.display = state.settings.showCurrentCall ? "grid" : "none";
  renderBall(current, currentNumber(), "current");
  prevWrap.innerHTML = "";
  prevWrap.style.display = state.settings.showPreviousCalls ? "flex" : "none";
  const prev = state.called.slice(1, 1 + Number(state.settings.previousCount));
  prev.forEach((n) => {
    const el = document.createElement("div");
    renderBall(el, n, "prev");
    prevWrap.appendChild(el);
  });
  document.getElementById("total-calls").textContent = state.called.length;
  document.getElementById("current-call-num").textContent = currentNumber()
    ? `${letterForNumber(currentNumber())}${currentNumber()}`
    : "--";
  document.getElementById("prev-call-num").textContent = state.called[1]
    ? `${letterForNumber(state.called[1])}${state.called[1]}`
    : "--";
  document.getElementById("game-number-display").textContent = String(state.gamesPlayed || 0);
  document.getElementById("prize-display").textContent = state.settings.prize || "--";
  document.getElementById("hot-prize").textContent = state.settings.hotBall
    ? `${state.settings.hotBallTitle}${state.settings.hotBallPrize ? ": " + state.settings.hotBallPrize : ""}`
    : "--";

  document.getElementById("stat-game").hidden = !state.settings.showGameNumber;
  document.getElementById("stat-total").hidden = !state.settings.showTotalCalls;
  document.getElementById("stat-current").hidden = !state.settings.showCurrentCallNumber;
  document.getElementById("stat-prev").hidden = !state.settings.showPreviousCallNumber;
  document.getElementById("stat-prize").hidden = !state.settings.prize;
  document.getElementById("stat-hot").hidden = !state.settings.hotBall;

  const hist = document.getElementById("history-list");
  hist.innerHTML = state.called
    .slice()
    .reverse()
    .map((n) => `<span class="history-chip ${letterForNumber(n)}">${letterForNumber(n)}${n}</span>`)
    .join("");
}

function renderPattern() {
  const gridEl = document.getElementById("pattern-grid");
  const title = document.getElementById("pattern-title");
  const menu = document.getElementById("pattern-menu");
  const skip = document.getElementById("skip-pill");
  const pattern = PATTERNS.find((p) => p.id === state.settings.patternId);
  title.textContent = state.settings.showPatternTitle ? (pattern ? pattern.name : "Custom") : "Pattern";
  skip.classList.toggle("show", state.settings.skipUnused && state.settings.showSkipIndicator);
  menu.hidden = !state.settings.showPatternMenu;
  if (menu.dataset.ready !== "1") {
    menu.innerHTML = PATTERNS.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
    menu.dataset.ready = "1";
  }
  menu.value = state.settings.patternId;
  const grid = activePattern();
  gridEl.innerHTML = "";
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = document.createElement("button");
      cell.className = "pattern-cell" + (grid[r][c] ? " on" : "") + (r === 2 && c === 2 ? " free" : "");
      cell.addEventListener("click", () => {
        if (state.settings.lockPattern) return;
        if (state.settings.lockPatternInPlay && gameInProgress()) return;
        const next = clonePattern(activePattern());
        next[r][c] = !next[r][c];
        state.settings.patternId = "custom";
        state.settings.customPattern = next;
        saveSettings();
        renderPattern();
        renderBoard();
      });
      gridEl.appendChild(cell);
    }
  }
}

function renderControls() {
  const start = document.getElementById("btn-start");
  const next = document.getElementById("btn-next");
  const play = document.getElementById("btn-play");
  const reset = document.getElementById("btn-reset");
  const repeat = document.getElementById("btn-repeat");
  const shuffleBtn = document.getElementById("btn-shuffle");
  const controls = document.getElementById("controls");
  controls.hidden = state.settings.hideControls;
  controls.classList.toggle("stoplight", state.settings.stoplight);
  shuffleBtn.hidden = state.settings.hideShuffle;
  play.hidden = !state.settings.automaticCalling || state.settings.manualMode;
  start.hidden = gameInProgress() || state.settings.manualMode;
  next.hidden = !gameInProgress() || state.settings.manualMode;
  next.disabled = state.playing || state.remaining.length === 0;
  play.disabled = !gameInProgress() || state.remaining.length === 0;
  play.textContent = state.playing ? "Pause" : "Play";
  play.className = `btn ${state.playing ? "btn-pause" : "btn-play"}`;
  reset.disabled = state.playing || !gameInProgress();
  repeat.disabled = !currentNumber();
  document.getElementById("countdown").hidden = !(state.settings.showCountdown && (state.settings.automaticCalling || state.settings.manualMode));
}

function renderLayout() {
  document.body.dataset.theme = state.settings.theme;
  const layout = document.getElementById("layout");
  layout.className = `layout ${state.settings.layout}`;
}

function renderAll() {
  renderLayout();
  renderBoard();
  renderCalls();
  renderPattern();
  renderControls();
}

async function announce(n, isFirst) {
  const s = state.settings;
  if (s.playChime && s.automaticCalling) {
    await AudioCaller.playChime(s.chime);
  }
  await AudioCaller.callNumber(n, Object.assign({}, s, {
    firstCall: isFirst ? n : null,
  }));
}

async function callNext(fromAuto = false) {
  if (!state.remaining.length) {
    stopAuto();
    return;
  }
  const n = state.remaining.shift();
  const isFirst = state.called.length === 0;
  state.called.unshift(n);
  if (isFirst) state.firstCallOfGame = n;
  renderAll();
  await announce(n, isFirst);
  if (state.settings.pauseAfterEnabled && state.called.length >= Number(state.settings.pauseAfter)) {
    stopAuto();
    return;
  }
  if (fromAuto && state.playing) startCountdownThen(callNext.bind(null, true));
}

function startGame() {
  AudioCaller.unlock();
  state.gamesPlayed += 1;
  state.called = [];
  state.remaining = shuffle(eligibleNumbers());
  callNext(false);
}

function toggleManual(n) {
  if (state.called.includes(n)) {
    state.called = state.called.filter((x) => x !== n);
  } else {
    state.called.unshift(n);
    announce(n, state.called.length === 1);
  }
  renderAll();
}

function startCountdownThen(fn) {
  clearInterval(state.countdownTimer);
  const bar = document.querySelector("#countdown span");
  const total = Number(state.settings.timeBetweenCalls) * 1000;
  const start = Date.now();
  bar.style.width = "0%";
  state.countdownTimer = setInterval(() => {
    const pct = Math.min(100, ((Date.now() - start) / total) * 100);
    bar.style.width = pct + "%";
    if (pct >= 100) {
      clearInterval(state.countdownTimer);
      fn();
    }
  }, 50);
}

function startAuto() {
  if (!gameInProgress() || !state.remaining.length) return;
  state.playing = true;
  renderControls();
  startCountdownThen(() => callNext(true));
}

function stopAuto() {
  state.playing = false;
  clearInterval(state.countdownTimer);
  document.querySelector("#countdown span").style.width = "0%";
  renderControls();
}

function resetBoard() {
  stopAuto();
  state.called = [];
  state.remaining = [];
  renderAll();
}

function bindSettings() {
  const s = state.settings;
  const set = (id, prop, transform = (v) => v) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!s[prop];
    else el.value = s[prop];
    el.addEventListener("change", () => {
      s[prop] = el.type === "checkbox" ? el.checked : transform(el.value);
      saveSettings();
      if (prop === "patternId") renderPattern();
      renderAll();
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
  const select = document.getElementById("set-voice");
  const voices = AudioCaller.getVoices();
  select.innerHTML = voices.length
    ? voices.map((v) => `<option value="${v.voiceURI}">${v.name} (${v.lang})</option>`).join("")
    : `<option value="">Default device voice</option>`;
  if (state.settings.voiceURI) select.value = state.settings.voiceURI;
}

function exportSettings() {
  const blob = new Blob([JSON.stringify(state.settings, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "bingo-caller-settings.json";
  a.click();
}

function importSettings(file) {
  const reader = new FileReader();
  reader.onload = () => {
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

document.addEventListener("DOMContentLoaded", () => {
  const patternSelect = document.getElementById("set-pattern");
  patternSelect.innerHTML = PATTERNS.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  bindSettings();
  populateVoices();
  if ("speechSynthesis" in window) {
    speechSynthesis.addEventListener("voiceschanged", populateVoices);
  }
  renderAll();

  document.getElementById("btn-start").addEventListener("click", startGame);
  document.getElementById("btn-next").addEventListener("click", () => callNext(false));
  document.getElementById("btn-play").addEventListener("click", () => {
    if (state.playing) stopAuto();
    else startAuto();
  });
  document.getElementById("btn-repeat").addEventListener("click", () => {
    if (currentNumber()) announce(currentNumber(), false);
  });
  document.getElementById("btn-shuffle").addEventListener("click", () => AudioCaller.playShuffle());
  document.getElementById("btn-reset").addEventListener("click", () => {
    document.getElementById("reset-modal").classList.add("open");
  });
  document.getElementById("confirm-reset").addEventListener("click", () => {
    document.getElementById("reset-modal").classList.remove("open");
    resetBoard();
  });
  document.getElementById("cancel-reset").addEventListener("click", () => {
    document.getElementById("reset-modal").classList.remove("open");
  });

  document.getElementById("btn-settings").addEventListener("click", () => {
    document.getElementById("settings").classList.add("open");
    document.getElementById("overlay").classList.add("open");
  });
  document.getElementById("btn-close-settings").addEventListener("click", closeSettings);
  document.getElementById("overlay").addEventListener("click", closeSettings);

  document.getElementById("btn-theme").addEventListener("click", () => {
    state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    saveSettings();
    renderLayout();
    document.getElementById("set-theme").value = state.settings.theme;
  });
  document.getElementById("btn-fs").addEventListener("click", () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  });
  document.getElementById("pattern-menu").addEventListener("change", (e) => {
    state.settings.patternId = e.target.value;
    saveSettings();
    renderPattern();
    renderBoard();
  });
  document.getElementById("preview-voice").addEventListener("click", () => {
    AudioCaller.previewVoice(state.settings.voiceURI);
  });
  document.getElementById("export-settings").addEventListener("click", exportSettings);
  document.getElementById("import-settings").addEventListener("change", (e) => {
    if (e.target.files[0]) importSettings(e.target.files[0]);
  });

  document.body.addEventListener("click", () => AudioCaller.unlock(), { once: true });

  document.getElementById("set-manual").addEventListener("change", () => {
    if (state.settings.manualMode) {
      state.settings.automaticCalling = false;
      document.getElementById("set-auto").checked = false;
      stopAuto();
      saveSettings();
      renderControls();
    }
  });
  document.getElementById("set-auto").addEventListener("change", () => {
    if (state.settings.automaticCalling) {
      state.settings.manualMode = false;
      document.getElementById("set-manual").checked = false;
      saveSettings();
      renderControls();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (!state.settings.keyboard) return;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
    if (e.code === "Space" || e.code === "PageUp") {
      e.preventDefault();
      if (!state.settings.automaticCalling) return;
      if (state.playing) stopAuto();
      else startAuto();
    }
    if (e.code === "ArrowRight" || e.code === "PageDown") {
      e.preventDefault();
      if (!gameInProgress()) startGame();
      else if (!state.playing) callNext(false);
    }
    if (e.key.toLowerCase() === "r") {
      document.getElementById("reset-modal").classList.add("open");
    }
    if (e.key === "Enter" && document.getElementById("reset-modal").classList.contains("open")) {
      resetBoard();
      document.getElementById("reset-modal").classList.remove("open");
    }
  });
});

function closeSettings() {
  document.getElementById("settings").classList.remove("open");
  document.getElementById("overlay").classList.remove("open");
  saveSettings();
}
