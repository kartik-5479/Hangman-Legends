(() => {
  const root = document.getElementById("game-root");
  const words = JSON.parse(document.getElementById("word-data").textContent);
  const DIFFICULTIES = {
    Easy: { lives: 8, timer: 90, note: "3-5 letters", range: (word) => word.length >= 3 && word.length <= 5 },
    Medium: { lives: 6, timer: 60, note: "6-8 letters", range: (word) => word.length >= 6 && word.length <= 8 },
    Hard: { lives: 5, timer: 45, note: "9+ letters", range: (word) => word.length >= 9 },
    Nightmare: { lives: 5, timer: 30, note: "Long words, no hints", range: (word) => word.length >= 10 }
  };
  const THEMES = ["cyberpunk", "neon", "forest", "galaxy", "ocean", "retro", "paper", "light"];
  const ACHIEVEMENTS = {
    firstWin: ["First Win", (s) => s.wins >= 1],
    tenWins: ["10 Wins", (s) => s.wins >= 10],
    hundredWins: ["100 Wins", (s) => s.wins >= 100],
    perfect: ["Perfect Round", (_s, r) => r && r.won && r.wrong === 0],
    speed: ["Speed Runner", (_s, r) => r && r.won && r.elapsed <= 20],
    nightmare: ["Nightmare Winner", (_s, r) => r && r.won && r.difficulty === "Nightmare"],
    noWrong: ["No Wrong Guess", (_s, r) => r && r.won && r.wrong === 0],
    noHint: ["No Hint Used", (_s, r) => r && r.won && r.hints === 0],
    letters500: ["500 Correct Letters", (s) => s.correctLetters >= 500],
    legend: ["Legend Player", (s) => s.level >= 25]
  };

  const defaultSettings = {
    sound: true,
    music: true,
    voice: true,
    particles: true,
    animations: true,
    highContrast: false,
    colorblind: false,
    theme: "cyberpunk",
    volume: 62
  };
  const defaultStats = {
    games: 0,
    wins: 0,
    losses: 0,
    xp: 0,
    coins: 120,
    stars: 0,
    level: 1,
    currentScore: 0,
    highestScore: 0,
    streak: 0,
    bestStreak: 0,
    correctLetters: 0,
    wrongLetters: 0,
    totalTime: 0,
    categoryCounts: {},
    difficultyCounts: {},
    achievements: [],
    leaderboard: []
  };

  let state = {
    screen: "home",
    difficulty: "Medium",
    word: null,
    guessed: new Set(),
    wrong: new Set(),
    hints: 0,
    hintText: "",
    startedAt: 0,
    endsAt: 0,
    paused: false,
    pauseLeft: 0,
    selectedTab: "stats",
    daily: false,
    settings: load("hl_settings", defaultSettings),
    stats: load("hl_stats", defaultStats),
    endResult: null,
    timerId: null
  };

  function load(key, fallback) {
    try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || "{}") }; }
    catch { return { ...fallback }; }
  }

  function save() {
    localStorage.setItem("hl_settings", JSON.stringify(state.settings));
    localStorage.setItem("hl_stats", JSON.stringify(state.stats));
  }

  function todaySeed() {
    const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    return Number(stamp);
  }

  function seeded(seed) {
    let value = seed % 2147483647;
    return () => {
      value = value * 16807 % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  function pickWord(difficulty, daily = false) {
    const config = DIFFICULTIES[difficulty];
    const pool = words.filter((item) => config.range(item.word) && (difficulty !== "Nightmare" || item.difficulty === "Nightmare" || item.word.length >= 10));
    const source = pool.length ? pool : words;
    const rand = daily ? seeded(todaySeed() + difficulty.length)() : Math.random();
    return source[Math.floor(rand * source.length)];
  }

  function xpForLevel(level) {
    return 160 + level * 90;
  }

  function syncLevel() {
    let needed = xpForLevel(state.stats.level);
    while (state.stats.xp >= needed) {
      state.stats.xp -= needed;
      state.stats.level += 1;
      state.stats.coins += 35;
      toast(`Level ${state.stats.level} unlocked`, "New cosmetics and bragging rights earned.");
      HLAudio.play("achievement");
      needed = xpForLevel(state.stats.level);
    }
  }

  function applySettings() {
    root.className = `theme-${state.settings.theme}`;
    root.classList.toggle("high-contrast", !!state.settings.highContrast);
    root.classList.toggle("colorblind", !!state.settings.colorblind);
    root.classList.toggle("reduced-motion", !state.settings.animations);
    HLAudio.setOptions(state.settings);
    HLSpeech.setOptions(state.settings);
    HLAudio.music(state.settings.music && state.settings.sound);
  }

  function icon(name) {
    const paths = {
      play: "M8 5v14l11-7z",
      trophy: "M7 4h10v3a5 5 0 0 1-4 4.9V15h3v3H8v-3h3v-3.1A5 5 0 0 1 7 7V4zm-2 1H3v2a4 4 0 0 0 4 4M19 5h2v2a4 4 0 0 1-4 4",
      chart: "M5 19V9m7 10V5m7 14v-7",
      gear: "M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8zm8 4a8 8 0 0 0-.1-1.3l2-1.5-2-3.5-2.4 1a8 8 0 0 0-2.2-1.2L15 3h-6l-.3 2.5a8 8 0 0 0-2.2 1.2l-2.4-1-2 3.5 2 1.5A8 8 0 0 0 4 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 2.2 1.2L9 21h6l.3-2.5a8 8 0 0 0 2.2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.9.1-1.3z",
      volume: "M4 9v6h4l5 4V5L8 9H4zm12 1a4 4 0 0 1 0 4m2-7a8 8 0 0 1 0 10",
      mute: "M4 9v6h4l5 4V5L8 9H4zm13 0 4 4m0-4-4 4",
      pause: "M8 5h3v14H8zm5 0h3v14h-3z",
      home: "M3 11 12 4l9 7v9h-6v-6H9v6H3z",
      spark: "M12 2l2.2 6.4H21l-5.5 4 2.1 6.6L12 15l-5.6 4 2.1-6.6L3 8.4h6.8z",
      expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
    };
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.spark}"/></svg>`;
  }

  function shell(content) {
    return `
      <div class="aurora"></div><div class="stars"></div><div class="mouse-trail"></div><div class="confetti"></div><div class="screen-flash"></div>
      <section class="app-shell">
        ${nav()}
        <section class="screen">${content}</section>
      </section>
      <div class="modal-layer" id="modal-layer"></div>
      <div class="toast-stack" id="toast-stack"></div>
    `;
  }

  function nav() {
    const s = state.stats;
    const soundIcon = state.settings.sound ? "volume" : "mute";
    return `
      <nav class="top-nav glass">
        <div class="brand"><span class="brand-badge">HL</span><span>Hangman Legends</span></div>
        <div class="hud" aria-label="Player status">
          <span class="hud-pill">Coins <b>${s.coins}</b></span>
          <span class="hud-pill">XP <b>${s.xp}/${xpForLevel(s.level)}</b></span>
          <span class="hud-pill">Score <b>${s.currentScore}</b></span>
          <span class="hud-pill">Level <b>${s.level}</b></span>
          <span class="hud-pill">Streak <b>${s.streak}</b></span>
        </div>
        <div class="nav-actions">
          <button class="icon-btn" data-action="toggle-sound" aria-label="Mute">${icon(soundIcon)}</button>
          <button class="icon-btn" data-action="theme" aria-label="Change theme">${icon("spark")}</button>
          <button class="icon-btn" data-action="open-settings" aria-label="Settings">${icon("gear")}</button>
          <button class="icon-btn" data-action="fullscreen" aria-label="Fullscreen">${icon("expand")}</button>
          ${state.screen === "game" ? `<button class="icon-btn" data-action="pause" aria-label="Pause">${icon("pause")}</button>` : ""}
        </div>
      </nav>
    `;
  }

  function home() {
    const s = state.stats;
    return shell(`
      <div class="home-screen">
        <section class="hero-panel glass">
          <span class="eyebrow">AAA browser-style word arcade</span>
          <h1 class="game-logo">Hangman <span>Legends</span></h1>
          <p class="subtitle">Animated SVG gallows, neon keyboard, speech reactions, local achievements, daily challenges, scoring combos, themes, particles, and sound-packed rounds.</p>
          <div class="hero-actions">
            <button class="primary-btn" data-action="play">${icon("play")} Play ${state.difficulty}</button>
            <button class="ghost-btn" data-action="daily">${icon("spark")} Daily Challenge</button>
            <button class="ghost-btn" data-action="continue">${icon("home")} Continue</button>
          </div>
          <div class="hero-stats">
            <div class="stat-tile"><span>Games Won</span><b>${s.wins}</b></div>
            <div class="stat-tile"><span>Best Score</span><b>${s.highestScore}</b></div>
            <div class="stat-tile"><span>Achievements</span><b>${s.achievements.length}/10</b></div>
          </div>
          <div class="mini-grid">
            <button class="mini-tile glass" data-action="open-leaderboard"><span>Leaderboard</span><b>${s.leaderboard[0]?.score || 0}</b></button>
            <button class="mini-tile glass" data-action="open-achievements"><span>Badges</span><b>${s.achievements.length}</b></button>
            <button class="mini-tile glass" data-action="open-stats"><span>Accuracy</span><b>${accuracy()}%</b></button>
          </div>
        </section>
        <aside class="home-side">
          <section class="mascot-card glass">
            ${hangmanSvg(4, false, true)}
            <div class="speech-bubble"><b>Today:</b> ${new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}<br>Pick a mode and let the gallows tell the story.</div>
          </section>
          <section class="difficulty-grid" aria-label="Difficulty selection">
            ${Object.entries(DIFFICULTIES).map(([name, cfg]) => `
              <button class="difficulty-card glass ${state.difficulty === name ? "selected" : ""}" data-difficulty="${name}">
                <h3>${name}</h3><p>${cfg.note}</p>
                <div class="meta"><span>${cfg.lives} lives</span><span>${cfg.timer}s</span><span>${name === "Nightmare" ? "No hints" : "3 hints"}</span></div>
              </button>
            `).join("")}
          </section>
        </aside>
      </div>
    `);
  }

  function game() {
    const g = currentGame();
    return shell(`
      <div class="game-screen">
        <section class="stage-panel glass ${g.lost ? "shake" : ""}">
          <div class="timer-ring ${g.timeLeft <= 10 ? "danger" : ""}" style="--timer:${g.timePercent}%;--timer-color:${timerColor(g.timeLeft)}"><b>${g.timeLeft}</b><span>sec</span></div>
          ${hangmanSvg(state.wrong.size, g.lost)}
        </section>
        <section class="board-panel glass">
          <div class="board-head">
            <span class="category-chip">${state.word.category}</span>
            <span class="hint-chip">${state.difficulty}${state.daily ? " Daily" : ""}</span>
          </div>
          <div class="word-slots" aria-label="Word">${state.word.word.split("").map((letter) => `<span class="letter-slot ${state.guessed.has(letter) ? "revealed" : ""}">${state.guessed.has(letter) ? letter.toUpperCase() : ""}</span>`).join("")}</div>
          <div class="wrong-row">Wrong guesses: ${[...state.wrong].map((x) => x.toUpperCase()).join(" ") || "None"}</div>
          <div class="hint-card">${state.hintText || state.word.description}</div>
          <div class="board-actions">
            <button class="primary-btn" data-action="hint" ${state.hints >= 3 || state.difficulty === "Nightmare" || g.done ? "disabled" : ""}>${icon("spark")} Hint ${state.hints}/3</button>
            <button class="ghost-btn" data-action="restart">Restart</button>
            <button class="ghost-btn" data-action="home">${icon("home")} Home</button>
          </div>
        </section>
        <section class="keyboard-panel glass">
          <div class="keyboard">
            ${"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => {
              const lower = letter.toLowerCase();
              const status = state.guessed.has(lower) ? "correct used" : state.wrong.has(lower) ? "wrong used" : "";
              return `<button class="key-btn ${status}" data-letter="${letter}" ${g.done || status ? "disabled" : ""} aria-label="Guess ${letter}">${letter}</button>`;
            }).join("")}
          </div>
        </section>
      </div>
    `);
  }

  function hangmanSvg(wrong, lost = false, mascot = false) {
    const visible = (index) => wrong >= index || mascot ? "visible" : "";
    const eye = lost ? `<path class="draw visible" d="M242 179l9 9m0-9-9 9M272 179l9 9m0-9-9 9" stroke="var(--red)" stroke-width="5"/>` : `<circle class="draw ${visible(4)}" cx="248" cy="182" r="4" fill="var(--text)"/><circle class="draw ${visible(4)}" cx="276" cy="182" r="4" fill="var(--text)"/>`;
    return `
      <svg class="hangman-svg ${lost ? "lost" : ""}" viewBox="0 0 520 520" role="img" aria-label="Animated hangman">
        <defs><filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <path class="draw ${visible(1)}" d="M96 444h292" stroke="var(--cyan)" stroke-width="16" filter="url(#glow)"/>
        <path class="draw ${visible(1)}" d="M148 444V82" stroke="var(--cyan)" stroke-width="16"/>
        <path class="draw ${visible(2)}" d="M148 82h226" stroke="var(--cyan)" stroke-width="16"/>
        <path class="draw ${visible(3)}" d="M374 82v78" stroke="var(--gold)" stroke-width="10"/>
        <g class="person">
          <circle class="draw ${visible(4)}" cx="260" cy="190" r="42" fill="rgba(255,255,255,.08)" stroke="var(--text)" stroke-width="12"/>
          ${eye}
          <path class="draw ${visible(5)}" d="M260 232v104" stroke="var(--text)" stroke-width="13"/>
          <path class="draw ${visible(6)}" d="M260 258l-62 58" stroke="var(--text)" stroke-width="13"/>
          <path class="draw ${visible(7)}" d="M260 258l62 58" stroke="var(--text)" stroke-width="13"/>
          <path class="draw ${visible(8)}" d="M260 334l-54 74" stroke="var(--text)" stroke-width="13"/>
          <path class="draw ${visible(9)}" d="M260 334l54 74" stroke="var(--text)" stroke-width="13"/>
        </g>
        ${lost ? `<circle cx="204" cy="430" r="4" fill="var(--gold)"/><circle cx="318" cy="426" r="3" fill="var(--gold)"/><circle cx="360" cy="445" r="5" fill="var(--gold)"/>` : ""}
      </svg>
    `;
  }

  function currentGame() {
    if (!state.word) return {};
    const now = Date.now();
    const timeLeft = state.paused ? state.pauseLeft : Math.max(0, Math.ceil((state.endsAt - now) / 1000));
    const cfg = DIFFICULTIES[state.difficulty];
    const won = state.word.word.split("").every((letter) => state.guessed.has(letter));
    const lost = state.wrong.size >= cfg.lives || timeLeft <= 0;
    return {
      won,
      lost: lost && !won,
      done: won || lost,
      timeLeft,
      livesLeft: Math.max(0, cfg.lives - state.wrong.size),
      timePercent: Math.max(0, Math.round((timeLeft / cfg.timer) * 100))
    };
  }

  function startGame(difficulty = state.difficulty, daily = false) {
    state.difficulty = difficulty;
    state.word = pickWord(difficulty, daily);
    state.guessed = new Set();
    state.wrong = new Set();
    state.hints = 0;
    state.hintText = state.word.hint;
    state.startedAt = Date.now();
    state.endsAt = Date.now() + DIFFICULTIES[difficulty].timer * 1000;
    state.paused = false;
    state.daily = daily;
    state.endResult = null;
    state.screen = "game";
    HLAudio.play("start");
    HLSpeech.say("start");
    render();
  }

  function guess(letter, button = null) {
    const g = currentGame();
    if (!state.word || g.done || state.paused) return;
    const lower = letter.toLowerCase();
    if (state.guessed.has(lower) || state.wrong.has(lower)) return;
    if (state.word.word.includes(lower)) {
      state.guessed.add(lower);
      state.stats.correctLetters += state.word.word.split("").filter((x) => x === lower).length;
      feedback("correct", button);
      if (currentGame().won) finish(true);
    } else {
      state.wrong.add(lower);
      state.stats.wrongLetters += 1;
      const cfg = DIFFICULTIES[state.difficulty];
      feedback(state.wrong.size >= cfg.lives - 1 ? "danger" : "wrong", button);
      if (state.wrong.size >= cfg.lives) finish(false);
    }
    save();
    render();
  }

  function feedback(kind, button) {
    HLAudio.play(kind);
    if (kind === "correct") {
      HLSpeech.say("correct");
      HLParticles.flash(root, "good");
    } else {
      const cfg = DIFFICULTIES[state.difficulty];
      HLSpeech.say(state.wrong.size >= cfg.lives - 1 ? "last" : state.wrong.size >= Math.ceil(cfg.lives / 2) ? "half" : "wrong");
      HLParticles.flash(root, "bad");
      root.querySelector(".app-shell")?.classList.add("shake");
      setTimeout(() => root.querySelector(".app-shell")?.classList.remove("shake"), 430);
    }
    if (button && state.settings.particles) {
      const box = button.getBoundingClientRect();
      HLParticles.burst(root, box.left + box.width / 2, box.top + box.height / 2);
    }
  }

  function useHint() {
    const g = currentGame();
    if (state.hints >= 3 || state.difficulty === "Nightmare" || g.done) return;
    state.hints += 1;
    const hidden = [...new Set(state.word.word.split(""))].filter((letter) => !state.guessed.has(letter));
    if (state.hints === 1 && hidden.length) {
      const letter = hidden[Math.floor(Math.random() * hidden.length)];
      state.guessed.add(letter);
      state.hintText = `Revealed letter: ${letter.toUpperCase()}`;
    } else if (state.hints === 2) {
      state.hintText = `Category insight: ${state.word.description}`;
    } else {
      state.hintText = `Meaning: ${state.word.hint}`;
    }
    state.stats.coins = Math.max(0, state.stats.coins - 10);
    HLAudio.play("hint");
    HLSpeech.say("hint");
    save();
    render();
    if (currentGame().won) finish(true);
  }

  function finish(won) {
    if (state.endResult) return;
    const elapsed = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
    const cfg = DIFFICULTIES[state.difficulty];
    const timeLeft = Math.max(0, Math.round((state.endsAt - Date.now()) / 1000));
    const mult = { Easy: 1, Medium: 1.8, Hard: 2.7, Nightmare: 4 }[state.difficulty];
    const perfect = state.wrong.size === 0;
    const score = won ? Math.round((120 + timeLeft * 3 + (cfg.lives - state.wrong.size) * 32 - state.hints * 25) * mult) : 0;
    const xp = won ? Math.round(38 * mult + timeLeft * 0.3) : 8;
    const coins = won ? Math.round(14 * mult + (perfect ? 20 : 0) + (state.hints === 0 ? 12 : 0)) : 3;
    const stars = won ? (perfect ? 3 : state.wrong.size <= 2 ? 2 : 1) : 0;
    const result = { won, score, xp, coins, stars, elapsed, wrong: state.wrong.size, hints: state.hints, difficulty: state.difficulty };
    state.endResult = result;
    state.stats.games += 1;
    state.stats.wins += won ? 1 : 0;
    state.stats.losses += won ? 0 : 1;
    state.stats.currentScore = score;
    state.stats.highestScore = Math.max(state.stats.highestScore, score);
    state.stats.xp += xp;
    state.stats.coins += coins;
    state.stats.stars += stars;
    state.stats.streak = won ? state.stats.streak + 1 : 0;
    state.stats.bestStreak = Math.max(state.stats.bestStreak, state.stats.streak);
    state.stats.totalTime += elapsed;
    state.stats.categoryCounts[state.word.category] = (state.stats.categoryCounts[state.word.category] || 0) + 1;
    state.stats.difficultyCounts[state.difficulty] = (state.stats.difficultyCounts[state.difficulty] || 0) + 1;
    if (won) {
      state.stats.leaderboard.unshift({ score, word: state.word.word.toUpperCase(), difficulty: state.difficulty, seconds: elapsed, date: new Date().toLocaleDateString() });
      state.stats.leaderboard = state.stats.leaderboard.sort((a, b) => b.score - a.score).slice(0, 12);
    }
    unlock(result);
    syncLevel();
    save();
    HLAudio.play(won ? "win" : "lose");
    HLSpeech.say(won ? "win" : "lose");
    if (won && state.settings.particles) HLParticles.confetti(root);
    setTimeout(() => openEndModal(), 280);
  }

  function unlock(result) {
    Object.entries(ACHIEVEMENTS).forEach(([key, [name, test]]) => {
      if (!state.stats.achievements.includes(key) && test(state.stats, result)) {
        state.stats.achievements.push(key);
        toast("Achievement unlocked", name);
        HLAudio.play("achievement");
      }
    });
  }

  function accuracy() {
    const total = state.stats.correctLetters + state.stats.wrongLetters;
    return total ? Math.round((state.stats.correctLetters / total) * 100) : 100;
  }

  function favorite(map) {
    const entries = Object.entries(map || {});
    if (!entries.length) return "None";
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }

  function timerColor(time) {
    if (time <= 10) return "var(--red)";
    if (time <= 20) return "var(--gold)";
    if (time <= 35) return "#ff9f43";
    return "var(--green)";
  }

  function render() {
    applySettings();
    root.innerHTML = state.screen === "game" ? game() : home();
    HLParticles.starfield(root, state.settings.particles ? 96 : 0);
    bind();
    animateIn();
  }

  function animateIn() {
    if (!state.settings.animations || !window.gsap) return;
    gsap.fromTo(".glass", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, stagger: 0.035, ease: "power3.out" });
    gsap.fromTo(".letter-slot", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, stagger: 0.025, ease: "back.out(1.8)" });
  }

  function bind() {
    root.querySelectorAll("button").forEach((button) => {
      button.addEventListener("mouseenter", () => HLAudio.play("hover"));
      button.addEventListener("pointerdown", (event) => {
        HLAudio.play("click");
        if (state.settings.particles) HLParticles.burst(root, event.clientX, event.clientY, undefined, 8);
      });
    });
    root.querySelectorAll("[data-difficulty]").forEach((button) => {
      button.addEventListener("click", () => { state.difficulty = button.dataset.difficulty; save(); render(); });
      button.addEventListener("dblclick", () => startGame(button.dataset.difficulty));
    });
    root.querySelectorAll("[data-letter]").forEach((button) => button.addEventListener("click", () => guess(button.dataset.letter, button)));
    root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => action(button.dataset.action)));
  }

  function action(name) {
    if (name === "play") startGame(state.difficulty);
    if (name === "daily") startGame(state.difficulty, true);
    if (name === "continue") state.word ? (state.screen = "game", render()) : startGame(state.difficulty);
    if (name === "home") { state.screen = "home"; render(); }
    if (name === "restart") startGame(state.difficulty, state.daily);
    if (name === "hint") useHint();
    if (name === "toggle-sound") { state.settings.sound = !state.settings.sound; save(); render(); }
    if (name === "theme") { state.settings.theme = THEMES[(THEMES.indexOf(state.settings.theme) + 1) % THEMES.length]; save(); render(); }
    if (name === "fullscreen") document.documentElement.requestFullscreen?.();
    if (name === "pause") togglePause();
    if (name === "open-settings") openPanel("settings");
    if (name === "open-leaderboard") openPanel("leaderboard");
    if (name === "open-achievements") openPanel("achievements");
    if (name === "open-stats") openPanel("stats");
  }

  function togglePause() {
    if (state.screen !== "game") return;
    if (state.paused) {
      state.endsAt = Date.now() + state.pauseLeft * 1000;
      state.paused = false;
      HLAudio.play("resume");
      HLSpeech.say("The round resumes.");
    } else {
      state.pauseLeft = currentGame().timeLeft;
      state.paused = true;
      HLAudio.play("pause");
      HLSpeech.say("Paused.");
    }
    render();
  }

  function openPanel(tab) {
    const layer = root.querySelector("#modal-layer");
    if (!layer) return;
    state.selectedTab = tab;
    layer.classList.add("open");
    layer.innerHTML = `<section class="modal glass">${modalTabs()}${modalContent(tab)}<div class="board-actions"><button class="primary-btn" data-close>Close</button></div></section>`;
    layer.querySelector("[data-close]").addEventListener("click", closeModal);
    layer.querySelectorAll("[data-tab]").forEach((btn) => btn.addEventListener("click", () => openPanel(btn.dataset.tab)));
    layer.querySelectorAll("[data-setting]").forEach((input) => input.addEventListener("input", () => updateSetting(input)));
    layer.querySelector("[data-reset]")?.addEventListener("click", resetProgress);
  }

  function modalTabs() {
    return `<div class="tabs">${["stats", "leaderboard", "achievements", "settings"].map((tab) => `<button class="tab-btn ${state.selectedTab === tab ? "active" : ""}" data-tab="${tab}">${tab[0].toUpperCase() + tab.slice(1)}</button>`).join("")}</div>`;
  }

  function modalContent(tab) {
    if (tab === "leaderboard") {
      const rows = state.stats.leaderboard.length ? state.stats.leaderboard : [{ score: 0, word: "PLAY", difficulty: "Any", seconds: 0, date: "Today" }];
      return `<h2>Leaderboard</h2><div class="list">${rows.map((row, i) => `<div class="list-row"><b>#${i + 1} ${row.word}</b><span>${row.score} pts - ${row.difficulty} - ${row.seconds}s</span></div>`).join("")}</div>`;
    }
    if (tab === "achievements") {
      return `<h2>Achievements</h2><div class="list">${Object.entries(ACHIEVEMENTS).map(([key, [name]]) => `<div class="list-row achievement-card ${state.stats.achievements.includes(key) ? "unlocked" : ""}"><b>${name}</b><span>${state.stats.achievements.includes(key) ? "Unlocked" : "Locked"}</span></div>`).join("")}</div>`;
    }
    if (tab === "settings") {
      return `<h2>Settings</h2><div class="list">
        ${toggleRow("Music", "music")} ${toggleRow("Voice", "voice")} ${toggleRow("Animations", "animations")} ${toggleRow("Particles", "particles")} ${toggleRow("High Contrast", "highContrast")} ${toggleRow("Color Blind Friendly", "colorblind")}
        <div class="setting-row"><b>Volume</b><input data-setting="volume" type="range" min="0" max="100" value="${state.settings.volume}"></div>
        <div class="setting-row"><b>Theme</b><select data-setting="theme">${THEMES.map((t) => `<option value="${t}" ${state.settings.theme === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div class="setting-row"><b>Reset Progress</b><button class="ghost-btn" data-reset>Reset</button></div>
      </div>`;
    }
    return `<h2>Statistics</h2><div class="list">
      <div class="list-row"><b>Games Played</b><span>${state.stats.games}</span></div>
      <div class="list-row"><b>Wins / Losses</b><span>${state.stats.wins} / ${state.stats.losses}</span></div>
      <div class="list-row"><b>Accuracy</b><span>${accuracy()}%</span></div>
      <div class="list-row"><b>Average Time</b><span>${state.stats.games ? Math.round(state.stats.totalTime / state.stats.games) : 0}s</span></div>
      <div class="list-row"><b>Favorite Category</b><span>${favorite(state.stats.categoryCounts)}</span></div>
      <div class="list-row"><b>Favorite Difficulty</b><span>${favorite(state.stats.difficultyCounts)}</span></div>
      <div class="list-row"><b>Total XP / Coins</b><span>${state.stats.xp} / ${state.stats.coins}</span></div>
    </div>`;
  }

  function toggleRow(label, key) {
    return `<div class="setting-row"><b>${label}</b><input data-setting="${key}" type="checkbox" ${state.settings[key] ? "checked" : ""}></div>`;
  }

  function updateSetting(input) {
    const key = input.dataset.setting;
    state.settings[key] = input.type === "checkbox" ? input.checked : input.type === "range" ? Number(input.value) : input.value;
    save();
    applySettings();
  }

  function closeModal() {
    const layer = root.querySelector("#modal-layer");
    if (layer) { layer.classList.remove("open"); layer.innerHTML = ""; }
  }

  function openEndModal() {
    const r = state.endResult;
    if (!r) return;
    const layer = root.querySelector("#modal-layer");
    if (!layer) return;
    layer.classList.add("open");
    layer.innerHTML = `
      <section class="modal glass end-card">
        <h2>${r.won ? "Victory" : "Defeat"}</h2>
        <p class="subtitle">The word was <b>${state.word.word.toUpperCase()}</b>. ${state.word.description}</p>
        <div class="reward-row"><span>Score ${r.score}</span><span>XP +${r.xp}</span><span>Coins +${r.coins}</span><span>Stars +${r.stars}</span></div>
        <div class="board-actions"><button class="primary-btn" data-next>Next Round</button><button class="ghost-btn" data-home>Home</button></div>
      </section>`;
    layer.querySelector("[data-next]").addEventListener("click", () => startGame(state.difficulty));
    layer.querySelector("[data-home]").addEventListener("click", () => { closeModal(); state.screen = "home"; render(); });
  }

  function resetProgress() {
    state.stats = { ...defaultStats, leaderboard: [], achievements: [], categoryCounts: {}, difficultyCounts: {} };
    save();
    openPanel("stats");
    toast("Progress reset", "Your local save has been cleared.");
  }

  function toast(title, body = "") {
    const stack = root.querySelector("#toast-stack");
    if (!stack) return;
    const node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = `<b>${title}</b>${body ? `<div>${body}</div>` : ""}`;
    stack.appendChild(node);
    setTimeout(() => node.classList.add("removing"), 2800);
    setTimeout(() => node.remove(), 3100);
  }

  function tick() {
    if (state.screen === "game" && state.word && !state.paused) {
      const g = currentGame();
      if (!g.done) {
        const ring = root.querySelector(".timer-ring");
        if (ring) {
          ring.style.setProperty("--timer", `${g.timePercent}%`);
          ring.style.setProperty("--timer-color", timerColor(g.timeLeft));
          ring.classList.toggle("danger", g.timeLeft <= 10);
          ring.querySelector("b").textContent = g.timeLeft;
        }
        if (g.timeLeft <= 10 && g.timeLeft > 0) HLAudio.play("timer");
      }
      if (g.lost && !state.endResult) {
        state.wrong = new Set([...state.wrong, "#"]);
        finish(false);
        render();
      }
    }
  }

  function splash() {
    const messages = ["Preparing dictionary...", "Drawing the gallows...", "Sharpening the pencil...", "Loading sound effects...", "Generating today's challenge..."];
    root.innerHTML = `
      <div class="splash">
        <section class="splash-card glass">
          <span class="logo-mark">HL</span>
          <h1 class="game-logo">Hangman <span>Legends</span></h1>
          <p class="subtitle">A premium Streamlit-powered browser arcade game.</p>
          <div class="loader-text">${messages[0]}</div>
          <div class="progress"><span></span></div>
        </section>
      </div>`;
    let index = 0;
    const label = root.querySelector(".loader-text");
    const id = setInterval(() => {
      index = (index + 1) % messages.length;
      label.textContent = messages[index];
    }, 420);
    setTimeout(() => { clearInterval(id); render(); }, 2400);
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
    if (event.key === " " && state.screen === "game") togglePause();
    const letter = event.key?.toUpperCase();
    if (/^[A-Z]$/.test(letter)) guess(letter, root.querySelector(`[data-letter="${letter}"]`));
  });
  window.addEventListener("pointermove", (event) => {
    root.style.setProperty("--mx", `${event.clientX}px`);
    root.style.setProperty("--my", `${event.clientY}px`);
    if (state.settings.particles) HLParticles.mouseTrail(root, event);
  });

  applySettings();
  splash();
  state.timerId = setInterval(tick, 1000);
})();
