window.HLSpeech = (() => {
  const lines = {
    start: ["Welcome challenger.", "Let the legend begin.", "Focus up. This word has secrets."],
    correct: ["Excellent!", "Nice work.", "You're on fire.", "That letter shines."],
    wrong: ["Ouch.", "Not this one.", "Try again.", "The gallows creak."],
    half: ["Careful.", "Half your chances are gone.", "The pressure is rising."],
    last: ["This is your last chance.", "One mistake left.", "Make this count."],
    win: ["Outstanding.", "You've mastered this word.", "Legendary finish."],
    lose: ["Better luck next round.", "The word escaped today.", "Rise again, challenger."],
    hint: ["A little magic for you.", "Here is a clue.", "Use this wisely."]
  };
  let enabled = true;
  let volume = 0.72;
  let previous = "";
  const processedEvents = new Set();

  function setOptions(options = {}) {
    enabled = options.voice !== false;
    volume = Math.max(0, Math.min(1, Number(options.volume ?? 72) / 100));
  }

  function pick(kind) {
    const pool = lines[kind] || lines.start;
    let next = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && next === previous) next = pool[(pool.indexOf(next) + 1) % pool.length];
    previous = next;
    return next;
  }

  function say(kindOrText, eventId = "") {
    if (!enabled || !("speechSynthesis" in window)) return;
    if (eventId) {
      const key = `${kindOrText}:${eventId}`;
      if (processedEvents.has(key)) return;
      processedEvents.add(key);
      if (processedEvents.size > 80) processedEvents.delete(processedEvents.values().next().value);
    }
    const text = lines[kindOrText] ? pick(kindOrText) : kindOrText;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.03;
    utterance.pitch = 1.05;
    utterance.volume = volume;
    window.speechSynthesis.speak(utterance);
  }

  function stop() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  return { setOptions, say, pick, stop };
})();

window.SpeechManager = window.HLSpeech;
