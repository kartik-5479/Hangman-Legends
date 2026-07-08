(() => {
  const root = document.getElementById("game-root");
  const rawWordNode = document.getElementById("word-data");
  const words = safeJson(rawWordNode ? rawWordNode.textContent : "[]", []);
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

  function safeJson(value, fallback) {
    try { return JSON.parse(value); } catch (_) { return fallback; }
  }

  function cleanWord(item) {
    const fallback = { word: "python", category: "Programming", hint: "A programming language.", description: "A programming language.", difficulty: "Medium" };
    if (!item || typeof item.word !== "string") return fallback;
    const word = item.word.toLowerCase().replace(/[^a-z]/g, "");
    if (!word) return fallback;
    return {
      word,
      category: item.category || "Mystery",
      hint: item.hint || item.clue || "No hint available.",
      description: item.description || item.hint || item.clue || "A mystery word.",
      difficulty: item.difficulty || "Medium"
    };
  }

  const Storage = {
    load(key, fallback) {
      const parsed = safeJson(this.get(key) || "null", null);
      return parsed && typeof parsed === "object" ? { ...fallback, ...parsed } : { ...fallback };
    },
    get(key) {
      try { return window.localStorage?.getItem(key) || null; } catch (_) { return null; }
    },
    save(key, value) {
      try { window.localStorage?.setItem(key, JSON.stringify(value)); } catch (_) {}
    },
    remove(key) {
      try { window.localStorage?.removeItem(key); } catch (_) {}
    }
  };

  const GameStateManager = {
    hydrate() {
      const saved = Storage.load("hl_active_round", {});
      if (!saved.word) return null;
      const difficulty = DIFFICULTIES[saved.difficulty] ? saved.difficulty : "Medium";
      const cfg = DIFFICULTIES[difficulty];
      const startedAt = Number(saved.startedAt || Date.now());
      const endsAt = Number(saved.endsAt || startedAt + cfg.timer * 1000);
      return {
        screen: saved.screen === "game" ? "game" : "home",
        difficulty,
        word: cleanWord(saved.word),
        guessed: new Set(Array.isArray(saved.guessed) ? saved.guessed : []),
        wrong: new Set(Array.isArray(saved.wrong) ? saved.wrong : []),
        hints: Number(saved.hints || 0),
        hintText: saved.hintText || saved.word.hint || "",
        startedAt,
        endsAt,
        paused: !!saved.paused,
        pauseLeft: Number(saved.pauseLeft || 0),
        daily: !!saved.daily,
        endResult: saved.endResult || null,
        completedRoundId: saved.completedRoundId || ""
      };
    },
    persist() {
      if (!state.word) {
        Storage.remove("hl_active_round");
        return;
      }
      Storage.save("hl_active_round", {
        screen: state.screen,
        difficulty: state.difficulty,
        word: state.word,
        guessed: [...state.guessed],
        wrong: [...state.wrong].filter((letter) => /^[a-z]$/.test(letter)),
        hints: state.hints,
        hintText: state.hintText,
        startedAt: state.startedAt,
        endsAt: state.endsAt,
        paused: state.paused,
        pauseLeft: state.pauseLeft,
        daily: state.daily,
        endResult: state.endResult,
        completedRoundId: state.completedRoundId
      });
    },
    saveAll() {
      Storage.save("hl_settings", state.settings);
      Storage.save("hl_stats", state.stats);
      this.persist();
    },
    newRound(difficulty = state.difficulty, daily = false) {
      const cfg = DIFFICULTIES[difficulty] || DIFFICULTIES.Medium;
      state.difficulty = difficulty;
      state.word = pickWord(difficulty, daily);
      state.guessed = new Set();
      state.wrong = new Set();
      state.hints = 0;
      state.hintText = state.word.hint;
      state.startedAt = Date.now();
      state.endsAt = state.startedAt + cfg.timer * 1000;
      state.paused = false;
      state.pauseLeft = 0;
      state.daily = daily;
      state.endResult = null;
      state.completedRoundId = "";
      state.screen = "game";
      transient.screenChanged = true;
      this.saveAll();
      EventBus.emit("start", { speech: "start", toast: ["Round started", `${difficulty} mode`], render: true });
    }
  };

  const TimerManager = {
    current() {
      if (!state.word) return { timeLeft: 0, timePercent: 0 };
      const cfg = DIFFICULTIES[state.difficulty] || DIFFICULTIES.Medium;
      const timeLeft = state.paused ? state.pauseLeft : Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
      return { timeLeft, timePercent: Math.max(0, Math.round((timeLeft / cfg.timer) * 100)) };
    },
    pause() {
      if (state.paused || state.screen !== "game") return;
      state.pauseLeft = this.current().timeLeft;
      state.paused = true;
      GameStateManager.saveAll();
      EventBus.emit("pause", { speechText: "Paused.", render: true });
    },
    resume() {
      if (!state.paused) return;
      state.endsAt = Date.now() + state.pauseLeft * 1000;
      state.paused = false;
      GameStateManager.saveAll();
      EventBus.emit("resume", { speechText: "The round resumes.", render: true });
    },
    tick() {
      if (state.screen !== "game" || !state.word || state.paused || state.endResult) return;
      const g = currentGame();
      updateTimer(g);
      if (g.timeLeft <= 10 && g.timeLeft > 0) AudioManager.play("timer", { eventId: `timer-${state.startedAt}-${g.timeLeft}` });
      if (g.lost) finish(false, "timeout");
    }
  };

  const ThemeManager = {
    apply() {
      root.className = `theme-${state.settings.theme}`;
      root.classList.toggle("high-contrast", !!state.settings.highContrast);
      root.classList.toggle("colorblind", !!state.settings.colorblind);
      root.classList.toggle("reduced-motion", !state.settings.animations);
      AudioManager.setOptions(state.settings);
      SpeechManager.setOptions(state.settings);
      AudioManager.music(state.settings.music && state.settings.sound);
    },
    next() {
      state.settings.theme = THEMES[(THEMES.indexOf(state.settings.theme) + 1) % THEMES.length];
      GameStateManager.saveAll();
      this.apply();
      render();
    }
  };

  const NotificationManager = {
    show(title, body = "") {
      const stack = root.querySelector("#toast-stack");
      if (!stack) return;
      const node = document.createElement("div");
      node.className = "toast";
      node.innerHTML = `<b>${escapeHtml(title)}</b>${body ? `<div>${escapeHtml(body)}</div>` : ""}`;
      stack.appendChild(node);
      setTimeout(() => node.classList.add("removing"), 2600);
      setTimeout(() => node.remove(), 2900);
    }
  };

  const AnimationManager = {
    intro() {
      if (!state.settings.animations || !window.gsap || !transient.screenChanged) return;
      gsap.fromTo(".glass", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.32, stagger: 0.025, ease: "power3.out" });
    },
    event(kind, source) {
      if (!state.settings.animations) return;
      if (kind === "correct") HLParticles.flash(root, "good");
      if (kind === "wrong" || kind === "danger") {
        HLParticles.flash(root, "bad");
        root.querySelector(".app-shell")?.classList.add("shake");
        setTimeout(() => root.querySelector(".app-shell")?.classList.remove("shake"), 430);
      }
      if (kind === "win" && state.settings.particles) HLParticles.confetti(root);
      if (source && state.settings.particles) {
        const box = source.getBoundingClientRect();
        HLParticles.burst(root, box.left + box.width / 2, box.top + box.height / 2);
      }
    }
  };

  const EventBus = {
    seen: new Set(),
    nextId(kind) {
      state.eventCounter += 1;
      return `${state.startedAt || Date.now()}-${state.eventCounter}-${kind}`;
    },
    emit(kind, options = {}) {
      const eventId = options.eventId || this.nextId(kind);
      if (this.seen.has(eventId)) return;
      this.seen.add(eventId);
      if (this.seen.size > 100) this.seen.delete(this.seen.values().next().value);
      if (options.render) render();
      AudioManager.play(kind, { eventId });
      if (options.speech) SpeechManager.say(options.speech, eventId);
      if (options.speechText) SpeechManager.say(options.speechText, eventId);
      if (options.toast) NotificationManager.show(options.toast[0], options.toast[1] || "");
      AnimationManager.event(kind, options.source);
    }
  };

  const savedRound = GameStateManager.hydrate();
  const state = {
    screen: savedRound?.screen || "home",
    difficulty: savedRound?.difficulty || "Medium",
    word: savedRound?.word || null,
    guessed: savedRound?.guessed || new Set(),
    wrong: savedRound?.wrong || new Set(),
    hints: savedRound?.hints || 0,
    hintText: savedRound?.hintText || "",
    startedAt: savedRound?.startedAt || 0,
    endsAt: savedRound?.endsAt || 0,
    paused: savedRound?.paused || false,
    pauseLeft: savedRound?.pauseLeft || 0,
    selectedTab: "stats",
    daily: savedRound?.daily || false,
    settings: Storage.load("hl_settings", defaultSettings),
    stats: Storage.load("hl_stats", defaultStats),
    endResult: savedRound?.endResult || null,
    completedRoundId: savedRound?.completedRoundId || "",
    eventCounter: 0,
    lastInputAt: 0,
    timerId: null
  };
  const transient = { screenChanged: true, revealed: "", newWrongCount: 0, modal: "" };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function todaySeed() {
    return Number(new Date().toISOString().slice(0, 10).replaceAll("-", ""));
  }

  function seeded(seed) {
    let value = seed % 2147483647 || 1;
    return () => {
      value = value * 16807 % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  function pickWord(difficulty, daily = false) {
    const cfg = DIFFICULTIES[difficulty] || DIFFICULTIES.Medium;
    const clean = words.map(cleanWord).filter((item) => item.word.length >= 3);
    const pool = clean.filter((item) => cfg.range(item.word) && (difficulty !== "Nightmare" || item.difficulty === "Nightmare" || item.word.length >= 10));
    const source = pool.length ? pool : clean.length ? clean : [cleanWord(null)];
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
      EventBus.emit("achievement", { toast: [`Level ${state.stats.level}`, "Bonus coins awarded."] });
      needed = xpForLevel(state.stats.level);
    }
  }

  function currentGame() {
    if (!state.word) return { won: false, lost: false, done: false, timeLeft: 0, timePercent: 0, livesLeft: 0 };
    const cfg = DIFFICULTIES[state.difficulty] || DIFFICULTIES.Medium;
    const timer = TimerManager.current();
    const won = state.word.word.split("").every((letter) => state.guessed.has(letter));
    const lost = state.wrong.size >= cfg.lives || timer.timeLeft <= 0;
    return {
      won,
      lost: lost && !won,
      done: won || lost || !!state.endResult,
      timeLeft: timer.timeLeft,
      timePercent: timer.timePercent,
      livesLeft: Math.max(0, cfg.lives - state.wrong.size)
    };
  }

  function accuracy() {
    const total = state.stats.correctLetters + state.stats.wrongLetters;
    return total ? Math.round((state.stats.correctLetters / total) * 100) : 100;
  }

  function favorite(map) {
    const entries = Object.entries(map || {});
    return entries.length ? entries.sort((a, b) => b[1] - a[1])[0][0] : "None";
  }

  function timerColor(time) {
    if (time <= 10) return "var(--red)";
    if (time <= 20) return "var(--gold)";
    if (time <= 35) return "#ff9f43";
    return "var(--green)";
  }

  function icon(name) {
    const paths = {
      play: "M8 5v14l11-7z",
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
          <button class="icon-btn" data-action="toggle-sound" aria-label="Mute">${icon(state.settings.sound ? "volume" : "mute")}</button>
          <button class="icon-btn" data-action="theme" aria-label="Change theme">${icon("spark")}</button>
          <button class="icon-btn" data-action="open-settings" aria-label="Settings">${icon("gear")}</button>
          <button class="icon-btn" data-action="fullscreen" aria-label="Fullscreen">${icon("expand")}</button>
          ${state.screen === "game" ? `<button class="icon-btn" data-action="pause" aria-label="Pause">${icon("pause")}</button>` : ""}
        </div>
      </nav>`;
  }

  function home() {
    const s = state.stats;
    return shell(`
      <div class="home-screen">
        <section class="hero-panel glass">
          <span class="eyebrow">AAA browser-style word arcade</span>
          <h1 class="game-logo">Hangman <span>Legends</span></h1>
          <p class="subtitle">Stable rounds, clean audio channels, polished effects, local achievements, daily challenges, responsive themes, and arcade-fast feedback.</p>
          <div class="hero-actions">
            <button class="primary-btn" data-action="play">${icon("play")} Play ${escapeHtml(state.difficulty)}</button>
            <button class="ghost-btn" data-action="daily">${icon("spark")} Daily Challenge</button>
            <button class="ghost-btn" data-action="continue" ${state.word && !state.endResult ? "" : "disabled"}>${icon("home")} Continue</button>
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
            <div class="speech-bubble"><b>Today:</b> ${new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}<br>Choose a mode. The round will stay stable until you start a new one.</div>
          </section>
          <section class="difficulty-grid" aria-label="Difficulty selection">
            ${Object.entries(DIFFICULTIES).map(([name, cfg]) => `
              <button class="difficulty-card glass ${state.difficulty === name ? "selected" : ""}" data-difficulty="${name}">
                <h3>${name}</h3><p>${cfg.note}</p>
                <div class="meta"><span>${cfg.lives} lives</span><span>${cfg.timer}s</span><span>${name === "Nightmare" ? "No hints" : "3 hints"}</span></div>
              </button>`).join("")}
          </section>
        </aside>
      </div>`);
  }

  function game() {
    const g = currentGame();
    const word = state.word || cleanWord(null);
    return shell(`
      <div class="game-screen">
        <section class="stage-panel glass">
          <div class="timer-ring ${g.timeLeft <= 10 ? "danger" : ""}" style="--timer:${g.timePercent}%;--timer-color:${timerColor(g.timeLeft)}"><b>${g.timeLeft}</b><span>sec</span></div>
          ${hangmanSvg(state.wrong.size, g.lost)}
        </section>
        <section class="board-panel glass">
          <div class="board-head">
            <span class="category-chip">${escapeHtml(word.category)}</span>
            <span class="hint-chip">${escapeHtml(state.difficulty)}${state.daily ? " Daily" : ""}</span>
          </div>
          <div class="word-slots" aria-label="Word">${word.word.split("").map((letter, index) => letterSlot(letter, index)).join("")}</div>
          <div class="wrong-row">Wrong guesses: ${[...state.wrong].map((x) => x.toUpperCase()).join(" ") || "None"}</div>
          <div class="hint-card ${transient.hintPulse ? "hint-pulse" : ""}">${escapeHtml(state.hintText || word.description)}</div>
          <div class="board-actions">
            <button class="primary-btn" data-action="hint" ${state.hints >= 3 || state.difficulty === "Nightmare" || g.done ? "disabled" : ""}>${icon("spark")} Hint ${state.hints}/3</button>
            <button class="ghost-btn" data-action="restart">Restart</button>
            <button class="ghost-btn" data-action="home">${icon("home")} Home</button>
          </div>
        </section>
        <section class="keyboard-panel glass">
          <div class="keyboard">
            ${"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => keyButton(letter, g.done)).join("")}
          </div>
        </section>
      </div>`);
  }

  function letterSlot(letter, index) {
    const revealed = state.guessed.has(letter);
    const just = revealed && transient.revealed === letter ? "just-revealed" : "";
    return `<span class="letter-slot ${revealed ? "revealed" : ""} ${just}" data-index="${index}">${revealed ? letter.toUpperCase() : ""}</span>`;
  }

  function keyButton(letter, done) {
    const lower = letter.toLowerCase();
    const correct = state.guessed.has(lower);
    const wrong = state.wrong.has(lower);
    const status = correct ? "correct used" : wrong ? "wrong used" : "";
    return `<button class="key-btn ${status}" data-letter="${letter}" ${done || correct || wrong ? "disabled" : ""} aria-label="Guess ${letter}">${letter}</button>`;
  }

  function hangmanSvg(wrong, lost = false, mascot = false) {
    const visible = (index) => wrong >= index || mascot ? "visible" : "";
    const fresh = (index) => !mascot && transient.newWrongCount === index ? "new-draw" : "";
    const eye = lost ? `<path class="draw visible new-draw" d="M242 179l9 9m0-9-9 9M272 179l9 9m0-9-9 9" stroke="var(--red)" stroke-width="5"/>` : `<circle class="draw ${visible(4)} ${fresh(4)}" cx="248" cy="182" r="4" fill="var(--text)"/><circle class="draw ${visible(4)} ${fresh(4)}" cx="276" cy="182" r="4" fill="var(--text)"/>`;
    return `
      <svg class="hangman-svg ${lost ? "lost" : ""}" viewBox="0 0 520 520" role="img" aria-label="Animated hangman">
        <defs><filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <path class="draw ${visible(1)} ${fresh(1)}" d="M96 444h292" stroke="var(--cyan)" stroke-width="16" filter="url(#glow)"/>
        <path class="draw ${visible(1)} ${fresh(1)}" d="M148 444V82" stroke="var(--cyan)" stroke-width="16"/>
        <path class="draw ${visible(2)} ${fresh(2)}" d="M148 82h226" stroke="var(--cyan)" stroke-width="16"/>
        <path class="draw ${visible(3)} ${fresh(3)}" d="M374 82v78" stroke="var(--gold)" stroke-width="10"/>
        <g class="person">
          <circle class="draw ${visible(4)} ${fresh(4)}" cx="260" cy="190" r="42" fill="rgba(255,255,255,.08)" stroke="var(--text)" stroke-width="12"/>
          ${eye}
          <path class="draw ${visible(5)} ${fresh(5)}" d="M260 232v104" stroke="var(--text)" stroke-width="13"/>
          <path class="draw ${visible(6)} ${fresh(6)}" d="M260 258l-62 58" stroke="var(--text)" stroke-width="13"/>
          <path class="draw ${visible(7)} ${fresh(7)}" d="M260 258l62 58" stroke="var(--text)" stroke-width="13"/>
          <path class="draw ${visible(8)} ${fresh(8)}" d="M260 334l-54 74" stroke="var(--text)" stroke-width="13"/>
          <path class="draw ${visible(9)} ${fresh(9)}" d="M260 334l54 74" stroke="var(--text)" stroke-width="13"/>
        </g>
        ${lost ? `<circle cx="204" cy="430" r="4" fill="var(--gold)"/><circle cx="318" cy="426" r="3" fill="var(--gold)"/><circle cx="360" cy="445" r="5" fill="var(--gold)"/>` : ""}
      </svg>`;
  }

  function render() {
    ThemeManager.apply();
    root.innerHTML = state.screen === "game" ? game() : home();
    HLParticles.starfield(root, state.settings.particles ? 96 : 0);
    bind();
    AnimationManager.intro();
    if (transient.modal) openPanel(transient.modal, false);
    transient.screenChanged = false;
    setTimeout(() => {
      transient.revealed = "";
      transient.newWrongCount = 0;
      transient.hintPulse = false;
    }, 0);
  }

  function bind() {
    root.querySelectorAll("button").forEach((button) => {
      button.addEventListener("mouseenter", () => AudioManager.play("hover"));
      button.addEventListener("pointerdown", (event) => {
        if (!button.matches("[data-letter]") && !button.disabled) AudioManager.play("click");
        if (state.settings.particles && !button.disabled) HLParticles.burst(root, event.clientX, event.clientY, undefined, 7);
      });
    });
    root.querySelectorAll("[data-difficulty]").forEach((button) => {
      button.addEventListener("click", () => {
        state.difficulty = button.dataset.difficulty;
        GameStateManager.saveAll();
        render();
      });
      button.addEventListener("dblclick", () => GameStateManager.newRound(button.dataset.difficulty));
    });
    root.querySelectorAll("[data-letter]").forEach((button) => button.addEventListener("click", () => guess(button.dataset.letter, button)));
    root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => action(button.dataset.action)));
  }

  function action(name) {
    if (isDebounced()) return;
    if (name === "play") GameStateManager.newRound(state.difficulty);
    if (name === "daily") GameStateManager.newRound(state.difficulty, true);
    if (name === "continue" && state.word && !state.endResult) { state.screen = "game"; transient.screenChanged = true; GameStateManager.saveAll(); render(); }
    if (name === "home") { state.screen = "home"; transient.screenChanged = true; GameStateManager.saveAll(); render(); }
    if (name === "restart") GameStateManager.newRound(state.difficulty, state.daily);
    if (name === "hint") useHint();
    if (name === "toggle-sound") { state.settings.sound = !state.settings.sound; GameStateManager.saveAll(); render(); }
    if (name === "theme") ThemeManager.next();
    if (name === "fullscreen") document.documentElement.requestFullscreen?.().catch?.(() => {});
    if (name === "pause") state.paused ? TimerManager.resume() : TimerManager.pause();
    if (name === "open-settings") openPanel("settings");
    if (name === "open-leaderboard") openPanel("leaderboard");
    if (name === "open-achievements") openPanel("achievements");
    if (name === "open-stats") openPanel("stats");
  }

  function isDebounced(ms = 170) {
    const now = performance.now();
    if (now - state.lastInputAt < ms) return true;
    state.lastInputAt = now;
    return false;
  }

  function guess(letter, button = null) {
    if (isDebounced(105)) return;
    const g = currentGame();
    if (!state.word || g.done || state.paused) return;
    const lower = letter.toLowerCase();
    if (!/^[a-z]$/.test(lower) || state.guessed.has(lower) || state.wrong.has(lower)) return;
    button?.setAttribute("disabled", "true");

    if (state.word.word.includes(lower)) {
      state.guessed.add(lower);
      transient.revealed = lower;
      state.stats.correctLetters += state.word.word.split("").filter((x) => x === lower).length;
      GameStateManager.saveAll();
      render();
      EventBus.emit("correct", { speech: "correct", toast: ["Correct!", `${letter.toUpperCase()} is in the word.`], source: button });
      if (currentGame().won) finish(true, "solved");
    } else {
      state.wrong.add(lower);
      transient.newWrongCount = Math.min(9, state.wrong.size);
      state.stats.wrongLetters += 1;
      const cfg = DIFFICULTIES[state.difficulty];
      const kind = state.wrong.size >= cfg.lives - 1 ? "danger" : "wrong";
      GameStateManager.saveAll();
      render();
      EventBus.emit(kind, { speech: state.wrong.size >= cfg.lives - 1 ? "last" : state.wrong.size >= Math.ceil(cfg.lives / 2) ? "half" : "wrong", toast: ["Wrong Guess!", `${letter.toUpperCase()} is not there.`], source: button });
      if (state.wrong.size >= cfg.lives) finish(false, "mistakes");
    }
  }

  function useHint() {
    const g = currentGame();
    if (!state.word || state.hints >= 3 || state.difficulty === "Nightmare" || g.done) return;
    state.hints += 1;
    transient.hintPulse = true;
    const hidden = [...new Set(state.word.word.split(""))].filter((letter) => !state.guessed.has(letter));
    if (state.hints === 1 && hidden.length) {
      const letter = hidden[Math.floor(Math.random() * hidden.length)];
      state.guessed.add(letter);
      transient.revealed = letter;
      state.hintText = `Revealed letter: ${letter.toUpperCase()}`;
    } else if (state.hints === 2) {
      state.hintText = `Category insight: ${state.word.description}`;
    } else {
      state.hintText = `Meaning: ${state.word.hint}`;
    }
    state.stats.coins = Math.max(0, state.stats.coins - 10);
    GameStateManager.saveAll();
    EventBus.emit("hint", { speech: "hint", toast: ["Hint Used!", `${3 - state.hints} remaining.`], render: true });
    if (currentGame().won) finish(true, "hint-solved");
  }

  function finish(won, reason) {
    if (!state.word || state.endResult) return;
    const roundId = `${state.startedAt}:${state.word.word}:${won}:${reason}`;
    if (state.completedRoundId === roundId) return;
    const elapsed = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
    const cfg = DIFFICULTIES[state.difficulty];
    const timeLeft = Math.max(0, Math.round((state.endsAt - Date.now()) / 1000));
    const mult = { Easy: 1, Medium: 1.8, Hard: 2.7, Nightmare: 4 }[state.difficulty];
    const perfect = state.wrong.size === 0;
    const score = won ? Math.max(0, Math.round((120 + timeLeft * 3 + (cfg.lives - state.wrong.size) * 32 - state.hints * 25) * mult)) : 0;
    const xp = won ? Math.round(38 * mult + timeLeft * 0.3) : 8;
    const coins = won ? Math.round(14 * mult + (perfect ? 20 : 0) + (state.hints === 0 ? 12 : 0)) : 3;
    const stars = won ? (perfect ? 3 : state.wrong.size <= 2 ? 2 : 1) : 0;
    const result = { won, score, xp, coins, stars, elapsed, wrong: state.wrong.size, hints: state.hints, difficulty: state.difficulty };
    state.endResult = result;
    state.completedRoundId = roundId;
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
    GameStateManager.saveAll();
    EventBus.emit(won ? "win" : "lose", { speech: won ? "win" : "lose", toast: [won ? "Victory!" : "Defeat!", won ? `Time bonus: ${timeLeft}s` : `Word: ${state.word.word.toUpperCase()}`], render: true });
    setTimeout(openEndModal, 240);
  }

  function unlock(result) {
    Object.entries(ACHIEVEMENTS).forEach(([key, [name, test]]) => {
      if (!state.stats.achievements.includes(key) && test(state.stats, result)) {
        state.stats.achievements.push(key);
        EventBus.emit("achievement", { toast: ["Achievement Unlocked!", name] });
      }
    });
  }

  function updateTimer(g) {
    const ring = root.querySelector(".timer-ring");
    if (!ring) return;
    ring.style.setProperty("--timer", `${g.timePercent}%`);
    ring.style.setProperty("--timer-color", timerColor(g.timeLeft));
    ring.classList.toggle("danger", g.timeLeft <= 10);
    const label = ring.querySelector("b");
    if (label && label.textContent !== String(g.timeLeft)) label.textContent = g.timeLeft;
  }

  function openPanel(tab, remember = true) {
    const layer = root.querySelector("#modal-layer");
    if (!layer) return;
    if (remember) transient.modal = tab;
    state.selectedTab = tab;
    layer.classList.add("open");
    layer.innerHTML = `<section class="modal glass">${modalTabs()}${modalContent(tab)}<div class="board-actions"><button class="primary-btn" data-close>Close</button></div></section>`;
    layer.querySelector("[data-close]")?.addEventListener("click", closeModal);
    layer.querySelectorAll("[data-tab]").forEach((btn) => btn.addEventListener("click", () => openPanel(btn.dataset.tab)));
    layer.querySelectorAll("[data-setting]").forEach((input) => input.addEventListener("input", () => updateSetting(input)));
    layer.querySelector("[data-reset]")?.addEventListener("click", resetProgress);
  }

  function modalTabs() {
    return `<div class="tabs">${["stats", "leaderboard", "achievements", "settings"].map((tab) => `<button class="tab-btn ${state.selectedTab === tab ? "active" : ""}" data-tab="${tab}">${tab[0].toUpperCase() + tab.slice(1)}</button>`).join("")}</div>`;
  }

  function modalContent(tab) {
    if (tab === "leaderboard") {
      const rows = state.stats.leaderboard.length ? state.stats.leaderboard : [{ score: 0, word: "PLAY", difficulty: "Any", seconds: 0 }];
      return `<h2>Leaderboard</h2><div class="list">${rows.map((row, i) => `<div class="list-row"><b>#${i + 1} ${escapeHtml(row.word)}</b><span>${row.score} pts - ${escapeHtml(row.difficulty)} - ${row.seconds}s</span></div>`).join("")}</div>`;
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
      <div class="list-row"><b>Favorite Category</b><span>${escapeHtml(favorite(state.stats.categoryCounts))}</span></div>
      <div class="list-row"><b>Favorite Difficulty</b><span>${escapeHtml(favorite(state.stats.difficultyCounts))}</span></div>
      <div class="list-row"><b>Total XP / Coins</b><span>${state.stats.xp} / ${state.stats.coins}</span></div>
    </div>`;
  }

  function toggleRow(label, key) {
    return `<div class="setting-row"><b>${label}</b><input data-setting="${key}" type="checkbox" ${state.settings[key] ? "checked" : ""}></div>`;
  }

  function updateSetting(input) {
    const key = input.dataset.setting;
    state.settings[key] = input.type === "checkbox" ? input.checked : input.type === "range" ? Number(input.value) : input.value;
    GameStateManager.saveAll();
    ThemeManager.apply();
  }

  function closeModal() {
    transient.modal = "";
    const layer = root.querySelector("#modal-layer");
    if (layer) { layer.classList.remove("open"); layer.innerHTML = ""; }
  }

  function openEndModal() {
    const r = state.endResult;
    const layer = root.querySelector("#modal-layer");
    if (!r || !layer) return;
    layer.classList.add("open");
    layer.innerHTML = `
      <section class="modal glass end-card">
        <h2>${r.won ? "Victory" : "Defeat"}</h2>
        <p class="subtitle">The word was <b>${state.word.word.toUpperCase()}</b>. ${escapeHtml(state.word.description)}</p>
        <div class="reward-row"><span>Score ${r.score}</span><span>XP +${r.xp}</span><span>Coins +${r.coins}</span><span>Stars +${r.stars}</span></div>
        <div class="board-actions"><button class="primary-btn" data-next>Next Round</button><button class="ghost-btn" data-home>Home</button></div>
      </section>`;
    layer.querySelector("[data-next]")?.addEventListener("click", () => GameStateManager.newRound(state.difficulty));
    layer.querySelector("[data-home]")?.addEventListener("click", () => { closeModal(); state.screen = "home"; transient.screenChanged = true; GameStateManager.saveAll(); render(); });
  }

  function resetProgress() {
    state.stats = { ...defaultStats, leaderboard: [], achievements: [], categoryCounts: {}, difficultyCounts: {} };
    GameStateManager.saveAll();
    openPanel("stats");
    NotificationManager.show("Progress reset", "Your local save has been cleared.");
  }

  function splash() {
    let splashSeen = false;
    try { splashSeen = window.sessionStorage?.getItem("hl_splash_seen") === "1"; } catch (_) { splashSeen = true; }
    if (splashSeen) {
      render();
      return;
    }
    try { window.sessionStorage?.setItem("hl_splash_seen", "1"); } catch (_) {}
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
      if (label) label.textContent = messages[index];
    }, 420);
    setTimeout(() => { clearInterval(id); render(); }, 1800);
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
    if (event.key === " " && state.screen === "game") {
      event.preventDefault();
      state.paused ? TimerManager.resume() : TimerManager.pause();
      return;
    }
    const letter = event.key?.toUpperCase();
    if (/^[A-Z]$/.test(letter)) guess(letter, root.querySelector(`[data-letter="${letter}"]`));
  });
  window.addEventListener("pointermove", (event) => {
    root.style.setProperty("--mx", `${event.clientX}px`);
    root.style.setProperty("--my", `${event.clientY}px`);
    if (state.settings.particles) HLParticles.mouseTrail(root, event);
  });
  window.addEventListener("beforeunload", () => GameStateManager.persist());

  ThemeManager.apply();
  splash();
  state.timerId = setInterval(TimerManager.tick.bind(TimerManager), 1000);
})();
