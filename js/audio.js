window.AudioManager = (() => {
  const state = {
    ctx: null,
    enabled: true,
    volume: 0.58,
    channels: new Map(),
    lastPlayed: new Map(),
    processedEvents: new Set(),
    music: null,
    musicGain: null,
    musicLfo: null
  };

  const CHANNELS = {
    hover: "ui",
    click: "ui",
    start: "effect",
    correct: "effect",
    wrong: "effect",
    danger: "effect",
    hint: "effect",
    timer: "timer",
    coin: "effect",
    achievement: "effect",
    win: "finish",
    lose: "finish",
    pause: "ui",
    resume: "ui"
  };

  const COOLDOWNS = {
    hover: 90,
    click: 90,
    timer: 850,
    correct: 120,
    wrong: 180,
    danger: 250,
    win: 1000,
    lose: 1000
  };

  function context() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext || !state.enabled) return null;
    if (!state.ctx) state.ctx = new AudioContext();
    if (state.ctx.state === "suspended") state.ctx.resume().catch(() => {});
    return state.ctx;
  }

  function setOptions(options = {}) {
    state.enabled = options.sound !== false;
    state.volume = Math.max(0, Math.min(1, Number(options.volume ?? 58) / 100));
    if (state.musicGain) state.musicGain.gain.value = state.volume * 0.13;
    if (!state.enabled) {
      stopAllEffects();
      music(false);
    }
  }

  function register(channel, node) {
    if (!state.channels.has(channel)) state.channels.set(channel, new Set());
    state.channels.get(channel).add(node);
    node.addEventListener("ended", () => state.channels.get(channel)?.delete(node), { once: true });
  }

  function stop(channel) {
    const nodes = state.channels.get(channel);
    if (!nodes) return;
    nodes.forEach((node) => {
      try { node.stop(); } catch (_) {}
    });
    nodes.clear();
  }

  function stopAllEffects() {
    ["ui", "effect", "timer", "finish"].forEach(stop);
  }

  function shouldPlay(name, eventId = "") {
    if (!state.enabled) return false;
    if (eventId) {
      const key = `${name}:${eventId}`;
      if (state.processedEvents.has(key)) return false;
      state.processedEvents.add(key);
      if (state.processedEvents.size > 80) state.processedEvents.delete(state.processedEvents.values().next().value);
    }
    const now = performance.now();
    const cooldown = COOLDOWNS[name] ?? 0;
    const last = state.lastPlayed.get(name) ?? 0;
    if (now - last < cooldown) return false;
    state.lastPlayed.set(name, now);
    return true;
  }

  function tone(channel, freq, duration, type = "sine", endFreq = null, gainLevel = 0.14, delay = 0) {
    const ctx = context();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainLevel * state.volume, start + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
    register(channel, osc);
  }

  function noise(channel, duration = 0.18, gainLevel = 0.08) {
    const ctx = context();
    if (!ctx) return;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = gainLevel * state.volume;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + duration + 0.02);
    register(channel, source);
  }

  function play(name, options = {}) {
    if (!shouldPlay(name, options.eventId)) return;
    const channel = CHANNELS[name] || "effect";
    if (channel !== "timer") stop(channel);

    if (name === "hover") tone(channel, 740, 0.03, "triangle", 980, 0.028);
    if (name === "click") tone(channel, 420, 0.045, "square", 620, 0.07);
    if (name === "start") { tone(channel, 392, 0.09, "triangle", 784, 0.12); tone(channel, 588, 0.12, "sine", 988, 0.1, 0.08); }
    if (name === "correct") { tone(channel, 660, 0.08, "sine", 1080, 0.14); tone(channel, 990, 0.09, "triangle", 1320, 0.1, 0.08); }
    if (name === "wrong") { tone(channel, 220, 0.18, "sawtooth", 82, 0.13); noise(channel, 0.1, 0.03); }
    if (name === "danger") { tone(channel, 180, 0.12, "sawtooth", 130, 0.12); tone(channel, 180, 0.12, "sawtooth", 130, 0.12, 0.18); }
    if (name === "hint") { tone(channel, 520, 0.08, "triangle", 940, 0.12); tone(channel, 1040, 0.11, "sine", 1480, 0.09, 0.08); }
    if (name === "timer") tone(channel, 880, 0.045, "square", 440, 0.045);
    if (name === "coin") { tone(channel, 880, 0.07, "triangle", 1320, 0.11); tone(channel, 1320, 0.08, "sine", 1760, 0.09, 0.07); }
    if (name === "achievement") { [523, 659, 784, 1046].forEach((f, i) => tone(channel, f, 0.09, "triangle", f * 1.12, 0.1, i * 0.07)); }
    if (name === "win") { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(channel, f, 0.12, "triangle", f * 1.08, 0.12, i * 0.08)); }
    if (name === "lose") { tone(channel, 260, 0.28, "sawtooth", 92, 0.13); tone(channel, 180, 0.38, "triangle", 60, 0.075, 0.18); }
    if (name === "pause") tone(channel, 340, 0.08, "sine", 240, 0.075);
    if (name === "resume") tone(channel, 440, 0.08, "sine", 720, 0.075);
  }

  function music(on = true) {
    const ctx = context();
    if (!ctx) return;
    if (!on) {
      if (state.music) state.music.stop();
      if (state.musicLfo) state.musicLfo.stop();
      state.music = null;
      state.musicLfo = null;
      return;
    }
    if (state.music) return;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 110;
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 34;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    gain.gain.value = state.volume * 0.13;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    lfo.start();
    state.music = osc;
    state.musicLfo = lfo;
    state.musicGain = gain;
  }

  window.addEventListener("pointerdown", () => context(), { once: true });
  window.addEventListener("keydown", () => context(), { once: true });

  return { setOptions, play, stop, stopAllEffects, music };
})();

window.HLAudio = window.AudioManager;
