(function () {
  let root;
  try { root = window.parent && window.parent.document ? window.parent.document : document; } catch (error) { root = document; }
  const host = root.defaultView || window;
  const app = root.querySelector('.stApp') || root.body;
  const eventNode = root.querySelector('[data-game-event]') || document.querySelector('[data-game-event]');
  const settingsNode = root.querySelector('[data-game-settings]') || document.querySelector('[data-game-settings]');
  const eventName = eventNode ? eventNode.dataset.gameEvent : '';
  const settings = settingsNode ? JSON.parse(settingsNode.dataset.gameSettings || '{}') : {};
  const volume = Math.max(0, Math.min(1, (settings.volume ?? 75) / 100));

  if (!host.__hangmanAudio) {
    host.__hangmanAudio = { ctx: null, unlocked: false };
  }
  const audio = host.__hangmanAudio;

  function context() {
    const AudioContext = host.AudioContext || host.webkitAudioContext;
    if (!AudioContext || !settings.sound) return null;
    if (!audio.ctx) audio.ctx = new AudioContext();
    if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
    audio.unlocked = true;
    return audio.ctx;
  }

  function tone(freq, duration, type = 'sine', endFreq = null, gainLevel = 0.16) {
    if (!settings.sound) return;
    const ctx = context();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(gainLevel * volume, ctx.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  function sound(name) {
    if (name === 'hover') tone(620, 0.035, 'triangle', 760, 0.055);
    if (name === 'click') tone(420, 0.06, 'square', 640, 0.11);
    if (name === 'correct') { tone(740, 0.09, 'sine', 1120, 0.15); setTimeout(() => tone(1040, 0.08, 'triangle', 1320, 0.12), 70); }
    if (name === 'wrong' || name === 'danger') tone(190, 0.18, 'sawtooth', 80, 0.14);
    if (name === 'hint') { tone(520, 0.08, 'triangle', 880, 0.13); setTimeout(() => tone(980, 0.12, 'sine', 1460, 0.1), 80); }
    if (name === 'start') tone(440, 0.1, 'triangle', 880, 0.12);
    if (name === 'win') { tone(660, 0.12, 'triangle', 990, 0.15); setTimeout(() => tone(990, 0.16, 'triangle', 1480, 0.15), 115); }
    if (name === 'lose') tone(260, 0.34, 'sawtooth', 90, 0.13);
  }

  function speak(text) {
    if (!settings.voice || !text || !('speechSynthesis' in host)) return;
    host.speechSynthesis.cancel();
    const utterance = new host.SpeechSynthesisUtterance(text);
    utterance.rate = 1.04;
    utterance.pitch = 1.08;
    utterance.volume = volume;
    host.speechSynthesis.speak(utterance);
  }

  function confetti() {
    const colors = ['#1685d9', '#2fd47f', '#ffc928', '#f04452', '#35ddce'];
    for (let i = 0; i < 90; i += 1) {
      const piece = root.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.36}s`;
      app.appendChild(piece);
      setTimeout(() => piece.remove(), 2700);
    }
  }

  function bindControls() {
    if (!host.__hangmanInputBound) {
      host.__hangmanInputBound = true;
      root.addEventListener('pointerdown', (event) => {
        context();
        if (event.target && event.target.closest && event.target.closest('button')) sound('click');
      }, true);
      root.addEventListener('keydown', (event) => {
        context();
        const letter = event.key && event.key.length === 1 ? event.key.toUpperCase() : '';
        if (!/^[A-Z]$/.test(letter)) return;
        const buttons = [...root.querySelectorAll('button')];
        const target = buttons.find((button) => button.innerText.trim() === letter && !button.disabled);
        if (target) {
          sound('click');
          target.click();
        }
      }, true);
    }
    root.querySelectorAll('button, .difficulty-card').forEach((node) => {
      if (node.dataset.hangmanHover) return;
      node.dataset.hangmanHover = '1';
      node.addEventListener('mouseenter', () => sound('hover'));
    });
  }

  bindControls();
  if (eventName) {
    setTimeout(() => {
      sound(eventName);
      if (eventName === 'win') confetti();
      if (eventNode) speak(eventNode.dataset.voice || '');
    }, 80);
  }
})();
