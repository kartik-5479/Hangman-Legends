window.HLParticles = (() => {
  function starfield(root, count = 96) {
    const layer = root.querySelector(".stars");
    if (!layer || layer.childElementCount) return;
    for (let i = 0; i < count; i += 1) {
      const star = document.createElement("span");
      star.className = "star";
      star.style.left = `${Math.random() * 100}%`;
      star.style.animationDuration = `${8 + Math.random() * 18}s`;
      star.style.animationDelay = `${Math.random() * -20}s`;
      star.style.opacity = `${0.25 + Math.random() * 0.75}`;
      layer.appendChild(star);
    }
  }

  function burst(root, x, y, colors = ["var(--cyan)", "var(--pink)", "var(--gold)", "var(--green)"], amount = 22) {
    const layer = root.querySelector(".mouse-trail") || root;
    for (let i = 0; i < amount; i += 1) {
      const particle = document.createElement("span");
      particle.className = "particle";
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.background = colors[i % colors.length];
      particle.style.setProperty("--dx", `${(Math.random() - 0.5) * 150}px`);
      particle.style.animationDelay = `${Math.random() * 80}ms`;
      layer.appendChild(particle);
      setTimeout(() => particle.remove(), 900);
    }
  }

  function confetti(root, amount = 120) {
    const layer = root.querySelector(".confetti");
    if (!layer) return;
    const colors = ["#42f5e9", "#ff4db8", "#ffd35a", "#68ff9d", "#a780ff"];
    for (let i = 0; i < amount; i += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.5}s`;
      piece.style.setProperty("--fall-x", `${(Math.random() - 0.5) * 180}px`);
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), 3300);
    }
  }

  function flash(root, kind) {
    const layer = root.querySelector(".screen-flash");
    if (!layer) return;
    layer.className = `screen-flash ${kind}`;
    setTimeout(() => { layer.className = "screen-flash"; }, 560);
  }

  function mouseTrail(root, event) {
    if (Math.random() > 0.36) return;
    burst(root, event.clientX, event.clientY, ["rgba(66,245,233,.65)", "rgba(255,255,255,.65)"], 2);
  }

  return { starfield, burst, confetti, flash, mouseTrail };
})();
