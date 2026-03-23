(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const els = {
    phaseLabel: document.getElementById("phase-label"),
    phaseMsg: document.getElementById("phase-msg"),
    meterWrap: document.getElementById("meter-wrap"),
    meterFill: document.getElementById("meter-fill"),
    overlayMenu: document.getElementById("overlay-menu"),
    overlayPick: document.getElementById("overlay-pick"),
    overlayResult: document.getElementById("overlay-result"),
    animalGrid: document.getElementById("animal-grid"),
    btnPlay: document.getElementById("btn-play"),
    btnHow: document.getElementById("btn-how"),
    howPanel: document.getElementById("how-panel"),
    btnAgain: document.getElementById("btn-again"),
    btnMenu: document.getElementById("btn-menu"),
    inflateBar: document.getElementById("inflate-bar"),
    btnInflate: document.getElementById("btn-inflate"),
    soundOn: document.getElementById("sound-on"),
    resultEmoji: document.getElementById("result-emoji"),
    resultTitle: document.getElementById("result-title"),
    resultDesc: document.getElementById("result-desc"),
  };

  const ANIMALS = [
    {
      id: "puppy",
      name: "Cartoon Puppy",
      twists: 4,
      hue: 330,
      emoji: "🐶",
      blurb: "Perky ears and a bouncy nose — classic balloon dog energy.",
    },
    {
      id: "bunny",
      name: "Spring Bunny",
      twists: 5,
      hue: 145,
      emoji: "🐰",
      blurb: "Long ears and a fluffy tail twist — hop, hop, done!",
    },
    {
      id: "butterfly",
      name: "Sky Butterfly",
      twists: 6,
      hue: 265,
      emoji: "🦋",
      blurb: "Wings need extra folds — your patience paid off!",
    },
  ];

  const INFLATE = {
    minOk: 0.4,
    maxOk: 0.88,
    popAt: 0.98,
    risePerSec: 0.55,
    fallPerSec: 0.35,
  };

  let state = "menu";
  let selected = null;
  let pressure = 0;
  let inflating = false;
  let twistIndex = 0;
  let twistPulse = 0;
  let shakeT = 0;
  let sculptRevealAll = false;
  let audioCtx = null;
  let inflateOsc = null;
  let inflateGain = null;

  function soundEnabled() {
    return els.soundOn.checked;
  }

  function ensureAudio() {
    if (!soundEnabled()) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function stopInflateSound() {
    try {
      if (inflateOsc) {
        inflateOsc.stop();
        inflateOsc.disconnect();
      }
      if (inflateGain) inflateGain.disconnect();
    } catch (_) {}
    inflateOsc = null;
    inflateGain = null;
  }

  function startInflateSound() {
    const ac = ensureAudio();
    if (!ac) return;
    stopInflateSound();
    inflateOsc = ac.createOscillator();
    inflateGain = ac.createGain();
    inflateOsc.type = "triangle";
    inflateOsc.frequency.value = 220;
    inflateGain.gain.value = 0.06;
    inflateOsc.connect(inflateGain);
    inflateGain.connect(ac.destination);
    inflateOsc.start();
  }

  function updateInflateSoundPitch() {
    if (!inflateOsc) return;
    const base = 200 + pressure * 320;
    inflateOsc.frequency.setTargetAtTime(base, audioCtx.currentTime, 0.02);
  }

  function beep(freq, dur, type = "sine", gain = 0.12) {
    const ac = ensureAudio();
    if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(ac.destination);
    const t = ac.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function playPop() {
    const ac = ensureAudio();
    if (!ac) return;
    const bufferSize = ac.sampleRate * 0.18;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (buffer.length * 0.25));
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const g = ac.createGain();
    g.gain.value = 0.35;
    src.connect(g);
    g.connect(ac.destination);
    src.start();
  }

  function playTwistOk() {
    beep(660, 0.08, "sine", 0.1);
    setTimeout(() => beep(880, 0.1, "sine", 0.09), 70);
  }

  function playWin() {
    const ac = ensureAudio();
    if (!ac) return;
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => {
      setTimeout(() => beep(f, 0.14, "triangle", 0.11), i * 120);
    });
  }

  function playFailSoft() {
    beep(180, 0.2, "sawtooth", 0.07);
  }

  function setHud(title, msg) {
    els.phaseLabel.textContent = title;
    els.phaseMsg.textContent = msg;
  }

  function showMeter(on) {
    els.meterWrap.classList.toggle("hidden", !on);
  }

  function setOverlays(menu, pick, result) {
    els.overlayMenu.classList.toggle("hidden", !menu);
    els.overlayPick.classList.toggle("hidden", !pick);
    els.overlayResult.classList.toggle("hidden", !result);
  }

  function goMenu() {
    state = "menu";
    selected = null;
    pressure = 0;
    twistIndex = 0;
    sculptRevealAll = false;
    stopInflateSound();
    setHud("Menu", "Press Play when you are ready.");
    showMeter(false);
    els.inflateBar.classList.add("hidden");
    setOverlays(true, false, false);
  }

  function goPick() {
    state = "pick";
    pressure = 0;
    twistIndex = 0;
    sculptRevealAll = false;
    stopInflateSound();
    setHud("Choose", "Pick the balloon animal you want to sculpt.");
    showMeter(false);
    els.inflateBar.classList.add("hidden");
    setOverlays(false, true, false);
    buildAnimalGrid();
  }

  function buildAnimalGrid() {
    els.animalGrid.innerHTML = "";
    ANIMALS.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn animal-pick";
      b.innerHTML = `<span class="name">${a.emoji} ${a.name}</span><span class="meta">${a.twists} twists · cartoon sculpt</span>`;
      b.addEventListener("click", () => startInflatePhase(a));
      els.animalGrid.appendChild(b);
    });
  }

  function startInflatePhase(animal) {
    ensureAudio();
    selected = animal;
    state = "inflate";
    pressure = 0;
    inflating = false;
    sculptRevealAll = false;
    stopInflateSound();
    setHud("Inflate", `Hold inflate until the meter sits in the green zone, then release.`);
    showMeter(true);
    els.meterFill.style.width = "0%";
    els.inflateBar.classList.remove("hidden");
    setOverlays(false, false, false);
  }

  function startTwistPhase() {
    state = "twist";
    twistIndex = 0;
    twistPulse = 0;
    sculptRevealAll = false;
    stopInflateSound();
    showMeter(false);
    els.inflateBar.classList.add("hidden");
    setHud(
      "Shape the balloon",
      `Twist ${twistIndex + 1} of ${selected.twists} — click the pulsing fold; the animal grows as you go.`
    );
    playTwistOk();
  }

  function goResult(win, title, desc, emoji) {
    state = win ? "result_win" : "result_fail";
    stopInflateSound();
    showMeter(false);
    els.inflateBar.classList.add("hidden");
    if (win) {
      playWin();
      els.resultEmoji.textContent = emoji || "🎈";
      els.resultTitle.textContent = title || "Sculpture complete!";
      els.resultDesc.textContent = desc || "";
    } else {
      playFailSoft();
      els.resultEmoji.textContent = "💨";
      els.resultTitle.textContent = title || "Oops!";
      els.resultDesc.textContent = desc || "";
    }
    setOverlays(false, false, true);
  }

  function balloonLayout() {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w * 0.5;
    const baseY = h * 0.62;
    const scale = 0.55 + pressure * 0.95;
    const bodyLen = 120 + pressure * 220;
    const bodyW = 34 + pressure * 52;
    return { w, h, cx, baseY, scale, bodyLen, bodyW };
  }

  /** Completed twists = how many knots already locked; sculpt grows with this. */
  function sculptCompleted() {
    if (sculptRevealAll && selected) return selected.twists;
    return state === "twist" ? twistIndex : 0;
  }

  function fillBalloonBlob(cx, cy, rx, ry, rotation) {
    const grd = ctx.createRadialGradient(
      cx - rx * 0.35,
      cy - ry * 0.35,
      Math.max(4, rx * 0.12),
      cx,
      cy,
      Math.max(rx, ry) * 1.25
    );
    grd.addColorStop(0, "#ffffffaa");
    grd.addColorStop(0.38, balloonColor());
    grd.addColorStop(1, balloonColor());
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(43,45,66,0.22)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function drawNozzle(L, attachX, attachY) {
    const s = L.scale;
    const nw = 20 * s;
    const nh = 18 * s;
    const nr = Math.min(6, nw * 0.3);
    const nx = attachX - nw * 0.5;
    const ny = attachY - nh * 0.35;
    ctx.fillStyle = "#f5c542";
    ctx.beginPath();
    ctx.moveTo(nx + nr, ny);
    ctx.arcTo(nx + nw, ny, nx + nw, ny + nh, nr);
    ctx.arcTo(nx + nw, ny + nh, nx, ny + nh, nr);
    ctx.arcTo(nx, ny + nh, nx, ny, nr);
    ctx.arcTo(nx, ny, nx + nw, ny, nr);
    ctx.closePath();
    ctx.fill();
  }

  function drawBalloonString(L, attachX, attachY) {
    ctx.strokeStyle = "rgba(43,45,66,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(attachX, attachY);
    ctx.quadraticCurveTo(attachX + 28, attachY + 100, attachX + 8, attachY + 190);
    ctx.stroke();
  }

  function drawSculptTube(L) {
    const cx = L.cx;
    const s = L.scale;
    const bw = L.bodyW * s;
    const halfLen = L.bodyLen * 0.5 * s;
    fillBalloonBlob(cx, L.baseY, bw, halfLen, 0);
    const nozzleY = L.baseY + halfLen + 2 * s;
    drawNozzle(L, cx, nozzleY);
    drawBalloonString(L, cx, nozzleY + 14 * s);
  }

  function drawSculptPuppy(L, done) {
    const cx = L.cx;
    const s = L.scale;
    const bw = L.bodyW * s;
    const halfLen = L.bodyLen * 0.5 * s;

    if (done < 1) {
      drawSculptTube(L);
      return;
    }

    let bodyRy = halfLen * 0.78;
    let bodyCy = L.baseY + halfLen * 0.1;
    fillBalloonBlob(cx, bodyCy, bw * 0.92, bodyRy, 0);

    const headY = bodyCy - bodyRy - bw * 0.62;
    fillBalloonBlob(cx, headY, bw * 0.78, bw * 0.72, 0);
    fillBalloonBlob(cx + bw * 0.58, headY + bw * 0.12, bw * 0.4, bw * 0.3, 0.15);

    if (done >= 2) {
      fillBalloonBlob(cx - bw * 0.98, headY - bw * 0.08, bw * 0.3, bw * 0.88, -0.55);
      fillBalloonBlob(cx + bw * 0.98, headY - bw * 0.08, bw * 0.3, bw * 0.88, 0.55);
    }
    if (done >= 3) {
      fillBalloonBlob(cx - bw * 0.58, bodyCy + bodyRy * 0.52, bw * 0.36, bw * 0.52, 0.15);
      fillBalloonBlob(cx + bw * 0.58, bodyCy + bodyRy * 0.52, bw * 0.36, bw * 0.52, -0.15);
    }
    if (done >= 4) {
      fillBalloonBlob(cx - bw * 1.18, bodyCy + bw * 0.05, bw * 0.52, bw * 0.34, -0.45);
    }

    const nozzleY = bodyCy + bodyRy + 2 * s;
    drawNozzle(L, cx, nozzleY);
    drawBalloonString(L, cx, nozzleY + 14 * s);
  }

  function drawSculptBunny(L, done) {
    const cx = L.cx;
    const s = L.scale;
    const bw = L.bodyW * s;
    const halfLen = L.bodyLen * 0.5 * s;

    if (done < 1) {
      drawSculptTube(L);
      return;
    }

    const bellyRy = halfLen * 0.68;
    const bellyCy = L.baseY + halfLen * 0.14;
    fillBalloonBlob(cx, bellyCy, bw * 1.05, bellyRy, 0);

    const headY = bellyCy - bellyRy - bw * 0.55;
    fillBalloonBlob(cx, headY, bw * 0.82, bw * 0.76, 0);
    fillBalloonBlob(cx + bw * 0.42, headY + bw * 0.22, bw * 0.22, bw * 0.2, 0);

    if (done >= 2) {
      fillBalloonBlob(cx - bw * 0.42, headY - bw * 1.05, bw * 0.34, bw * 1.25, -0.08);
      fillBalloonBlob(cx + bw * 0.42, headY - bw * 1.05, bw * 0.34, bw * 1.25, 0.08);
    }
    if (done >= 3) {
      fillBalloonBlob(cx - bw * 0.35, bellyCy - bellyRy * 0.25, bw * 0.45, bw * 0.48, -0.2);
      fillBalloonBlob(cx + bw * 0.35, bellyCy - bellyRy * 0.25, bw * 0.45, bw * 0.48, 0.2);
    }
    if (done >= 4) {
      fillBalloonBlob(cx + bw * 1.05, bellyCy - bw * 0.15, bw * 0.36, bw * 0.36, 0.3);
    }
    if (done >= 5) {
      fillBalloonBlob(cx - bw * 0.55, bellyCy + bellyRy * 0.62, bw * 0.32, bw * 0.38, 0.1);
      fillBalloonBlob(cx + bw * 0.55, bellyCy + bellyRy * 0.62, bw * 0.32, bw * 0.38, -0.1);
    }

    const nozzleY = bellyCy + bellyRy + 2 * s;
    drawNozzle(L, cx, nozzleY);
    drawBalloonString(L, cx, nozzleY + 14 * s);
  }

  function drawSculptButterfly(L, done) {
    const cx = L.cx;
    const s = L.scale;
    const bw = L.bodyW * s;
    const halfLen = L.bodyLen * 0.5 * s;

    if (done < 1) {
      drawSculptTube(L);
      return;
    }

    const bodyRy = halfLen * 0.88;
    const bodyRx = bw * 0.38;
    const bodyCy = L.baseY;
    fillBalloonBlob(cx, bodyCy, bodyRx, bodyRy, 0);

    const wingY = bodyCy - bodyRy * 0.15;
    if (done >= 4) {
      fillBalloonBlob(cx - bw * 1.35, wingY + bw * 0.52, bw * 0.78, bw * 0.62, -0.25);
    } else if (done >= 2) {
      fillBalloonBlob(cx - bw * 1.15, wingY - bw * 0.08, bw * 0.62, bw * 0.48, -0.35);
    }
    if (done >= 5) {
      fillBalloonBlob(cx + bw * 1.35, wingY + bw * 0.52, bw * 0.78, bw * 0.62, 0.25);
    } else if (done >= 3) {
      fillBalloonBlob(cx + bw * 1.15, wingY - bw * 0.08, bw * 0.62, bw * 0.48, 0.35);
    }
    if (done >= 6) {
      ctx.strokeStyle = "rgba(43,45,66,0.45)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - bw * 0.18, bodyCy - bodyRy * 0.92);
      ctx.quadraticCurveTo(cx - bw * 0.55, bodyCy - bodyRy * 1.35, cx - bw * 0.42, bodyCy - bodyRy * 1.55);
      ctx.moveTo(cx + bw * 0.18, bodyCy - bodyRy * 0.92);
      ctx.quadraticCurveTo(cx + bw * 0.55, bodyCy - bodyRy * 1.35, cx + bw * 0.42, bodyCy - bodyRy * 1.55);
      ctx.stroke();
      fillBalloonBlob(cx - bw * 0.48, bodyCy - bodyRy * 1.62, bw * 0.14, bw * 0.14, 0);
      fillBalloonBlob(cx + bw * 0.48, bodyCy - bodyRy * 1.62, bw * 0.14, bw * 0.14, 0);
    }

    const nozzleY = bodyCy + bodyRy + 2 * s;
    drawNozzle(L, cx, nozzleY);
    drawBalloonString(L, cx, nozzleY + 14 * s);
  }

  function drawTwistSculpture(L) {
    const done = sculptCompleted();
    if (!selected) {
      drawSculptTube(L);
      return;
    }
    switch (selected.id) {
      case "puppy":
        drawSculptPuppy(L, done);
        break;
      case "bunny":
        drawSculptBunny(L, done);
        break;
      case "butterfly":
        drawSculptButterfly(L, done);
        break;
      default:
        drawSculptTube(L);
    }
  }

  function twistNodePositions() {
    if (!selected) return [];
    const L = balloonLayout();
    const s = L.scale;
    const bw = L.bodyW * s;
    const halfLen = L.bodyLen * 0.5 * s;
    const cx = L.cx;
    const yTop = L.baseY - halfLen;
    const yBot = L.baseY + halfLen;
    const r = 22 * s;

    const kits = {
      puppy: [
        { x: cx, y: yTop + halfLen * 0.2, r },
        { x: cx, y: yTop + halfLen * 0.48, r },
        { x: cx, y: L.baseY + halfLen * 0.12, r },
        { x: cx - bw * 0.95, y: L.baseY + halfLen * 0.38, r },
      ],
      bunny: [
        { x: cx, y: yTop + halfLen * 0.18, r },
        { x: cx, y: yTop + halfLen * 0.4, r },
        { x: cx - bw * 0.35, y: yTop + halfLen * 0.22, r },
        { x: cx + bw * 0.35, y: yTop + halfLen * 0.22, r },
        { x: cx + bw * 0.85, y: L.baseY + halfLen * 0.08, r },
      ],
      butterfly: [
        { x: cx, y: yTop + halfLen * 0.22, r },
        { x: cx, y: L.baseY - halfLen * 0.08, r },
        { x: cx - bw * 1.05, y: L.baseY - halfLen * 0.22, r },
        { x: cx + bw * 1.05, y: L.baseY - halfLen * 0.22, r },
        { x: cx - bw * 1.22, y: L.baseY + halfLen * 0.32, r },
        { x: cx, y: L.baseY - halfLen * 0.92, r },
      ],
    };

    const list = kits[selected.id];
    if (!list || list.length !== selected.twists) {
      const pts = [];
      for (let i = 0; i < selected.twists; i++) {
        const t = selected.twists === 1 ? 0.5 : i / (selected.twists - 1);
        const y = yTop + (yBot - yTop) * (0.12 + t * 0.76);
        pts.push({ x: cx, y, r });
      }
      return pts;
    }
    return list;
  }

  function drawCloud(x, y, s) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(x, y, 28 * s, 0, Math.PI * 2);
    ctx.arc(x + 32 * s, y - 6 * s, 34 * s, 0, Math.PI * 2);
    ctx.arc(x + 68 * s, y, 30 * s, 0, Math.PI * 2);
    ctx.arc(x + 36 * s, y + 14 * s, 26 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#b7e7ff");
    g.addColorStop(1, "#ffe8f3");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawCloud(90, 90, 1);
    drawCloud(720, 70, 0.85);
    drawCloud(520, 130, 0.7);
  }

  function balloonColor() {
    const hue = selected ? selected.hue : 200;
    return `hsl(${hue} 92% 62%)`;
  }

  function drawBalloon() {
    const L = balloonLayout();
    ctx.save();
    if (shakeT > 0) {
      const mag = shakeT * 6;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    if (state === "twist" && selected) {
      drawTwistSculpture(L);
    } else {
      drawSculptTube(L);
    }

    ctx.restore();
  }

  function drawTwistGhosts() {
    const pts = twistNodePositions();
    const pulse = 0.65 + Math.sin(twistPulse * 6) * 0.35;
    pts.forEach((p, i) => {
      const done = i < twistIndex;
      const active = i === twistIndex;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      if (done) {
        ctx.fillStyle = "rgba(46,213,115,0.35)";
        ctx.strokeStyle = "rgba(46,213,115,0.85)";
      } else if (active) {
        ctx.fillStyle = `rgba(255,107,157,${0.25 + 0.35 * pulse})`;
        ctx.strokeStyle = `rgba(255,107,157,${0.65 + 0.25 * pulse})`;
        ctx.lineWidth = 4 + 3 * pulse;
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.strokeStyle = "rgba(43,45,66,0.2)";
        ctx.lineWidth = 2;
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#2b2d42";
      ctx.font = `700 ${Math.round(14 + 8 * (selected ? balloonLayout().scale : 1))}px Fredoka, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), p.x, p.y);
    });
  }

  function render() {
    drawBackground();
    if (state === "menu" || state === "pick") {
      drawBalloon();
    } else if (state === "inflate" || state === "twist") {
      drawBalloon();
      if (state === "twist") drawTwistGhosts();
    } else {
      drawBalloon();
    }
  }

  let lastTs = performance.now();
  function tick(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    if (state === "inflate") {
      if (inflating) {
        pressure += INFLATE.risePerSec * dt;
        if (pressure >= INFLATE.popAt) {
          pressure = 1;
          inflating = false;
          stopInflateSound();
          playPop();
          goResult(false, "Pop!", "That was a bit too much air. Try again and release in the green zone.");
        }
      } else {
        pressure = Math.max(0, pressure - INFLATE.fallPerSec * dt);
      }
      const pct = Math.min(100, pressure * 100);
      els.meterFill.style.width = pct + "%";
    }

    if (state === "twist") {
      twistPulse += dt;
    }

    if (shakeT > 0) {
      shakeT = Math.max(0, shakeT - dt * 1.8);
    }

    render();
    requestAnimationFrame(tick);
  }

  function onInflateDown(e) {
    if (state !== "inflate") return;
    e.preventDefault();
    inflating = true;
    startInflateSound();
  }

  function onInflateUp(e) {
    if (state !== "inflate") return;
    e.preventDefault();
    inflating = false;
    stopInflateSound();
    updateInflateSoundPitch();

    if (pressure >= INFLATE.popAt) return;

    if (pressure < INFLATE.minOk) {
      playFailSoft();
      shakeT = 0.35;
      setHud("Inflate", "A little more air — grow into the green zone, then release.");
      return;
    }
    if (pressure > INFLATE.maxOk) {
      playPop();
      goResult(false, "Pop!", "You released a bit late. Keep an eye on the top of the orange bar.");
      pressure = 0;
      return;
    }
    playTwistOk();
    startTwistPhase();
  }

  function canvasCoords(ev) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ("touches" in ev ? ev.touches[0].clientX : ev.clientX) - rect.left;
    const y = ("touches" in ev ? ev.touches[0].clientY : ev.clientY) - rect.top;
    return { x: x * scaleX, y: y * scaleY };
  }

  function onCanvasClick(ev) {
    if (state !== "twist" || !selected || sculptRevealAll) return;
    if (twistIndex >= selected.twists) return;
    const { x, y } = canvasCoords(ev);
    const pts = twistNodePositions();
    if (!pts.length) return;
    const target = pts[twistIndex];
    const dx = x - target.x;
    const dy = y - target.y;
    const hit = dx * dx + dy * dy <= target.r * target.r * 1.15;

    if (hit) {
      twistIndex += 1;
      playTwistOk();
      if (twistIndex >= selected.twists) {
        sculptRevealAll = true;
        setHud("Ta-da!", "Your balloon animal is taking shape…");
        setTimeout(() => {
          sculptRevealAll = false;
          goResult(
            true,
            `${selected.emoji} ${selected.name}!`,
            selected.blurb,
            selected.emoji
          );
        }, 520);
      } else {
        setHud(
          "Shape the balloon",
          `Twist ${twistIndex + 1} of ${selected.twists} — watch the animal appear as you lock each fold.`
        );
      }
    } else {
      let anyNear = false;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const d = (x - p.x) ** 2 + (y - p.y) ** 2;
        if (d <= p.r * p.r * 1.4) anyNear = true;
      }
      if (anyNear) {
        playFailSoft();
        shakeT = 0.28;
        setHud("Shape the balloon", "Not that fold yet — follow the pink pulse in order!");
      }
    }
  }

  els.btnPlay.addEventListener("click", () => {
    ensureAudio();
    goPick();
  });

  els.btnHow.addEventListener("click", () => {
    els.howPanel.classList.toggle("hidden");
    const expanded = !els.howPanel.classList.contains("hidden");
    els.btnHow.setAttribute("aria-expanded", String(expanded));
  });

  els.btnAgain.addEventListener("click", () => {
    goPick();
  });

  els.btnMenu.addEventListener("click", () => {
    goMenu();
  });

  els.btnInflate.addEventListener("mousedown", onInflateDown);
  els.btnInflate.addEventListener("mouseup", onInflateUp);
  els.btnInflate.addEventListener("mouseleave", (e) => {
    if (inflating) onInflateUp(e);
  });
  els.btnInflate.addEventListener("touchstart", onInflateDown, { passive: false });
  els.btnInflate.addEventListener("touchend", onInflateUp, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && state === "inflate") {
      e.preventDefault();
      onInflateDown(e);
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" && state === "inflate") {
      e.preventDefault();
      onInflateUp(e);
    }
  });

  canvas.addEventListener("click", onCanvasClick);
  canvas.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      onCanvasClick(e.changedTouches[0] ? { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY } : e);
    },
    { passive: false }
  );

  goMenu();
  requestAnimationFrame(tick);
})();
