(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score-value");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMsg = document.getElementById("overlay-msg");
  const btnStart = document.getElementById("btn-start");
  const kidPortrait = document.getElementById("kid-portrait");
  const kidCtx = kidPortrait ? kidPortrait.getContext("2d") : null;

  const COL = {
    skyTop: "#38bdf8",
    skyBot: "#7dd3fc",
    sun: "#fbbf24",
    sunRing: "#f97316",
    ground: "#2d5a6e",
    groundLight: "#3d7a92",
    rail: "#94a3b8",
    railDark: "#64748b",
    sleeper: "#5c4a3a",
    wall: "#4a6fa5",
    pillar: "#3b5998",
    cloud: "#ffffff",
    outline: "#0f172a",
    runnerBody: "#f472b6",
    runnerHood: "#c026d3",
    copBlue: "#2563eb",
    copBadge: "#fbbf24",
    stripeA: "#111827",
    stripeB: "#facc15",
    lime: "#a3e635",
  };

  const LANES = 3;
  const WIN_SCORE = 700;

  const goalHint = document.getElementById("goal-hint");
  if (goalHint) {
    goalHint.textContent =
      "Get exactly " + WIN_SCORE + " points on the dot to win";
  }

  let W = 800;
  let H = 600;

  let playing = false;
  let laneIndex = 1;
  let laneVisual = 1;
  let laneLerp = 1;
  let squash = 1;
  let squashVel = 0;

  let worldSpeed = 220;
  let speedTimer = 0;
  let score = 0;
  let copPhase = 0;
  let shake = 0;

  let parallaxFar = 0;
  let parallaxMid = 0;
  let trackPhase = 0;

  const obstacles = [];
  let spawnAcc = 0;
  const dust = [];

  function horizonY() {
    return H * 0.1;
  }

  function bottomY() {
    return H * 0.94;
  }

  function playerY() {
    return H * 0.8;
  }

  function copY() {
    return H * 0.68;
  }

  function laneT(y) {
    const h = horizonY();
    const b = bottomY();
    const t = (y - h) / (b - h);
    return Math.max(0, Math.min(1, t));
  }

  function trackEdgeX(y, side) {
    const t = laneT(y);
    const vpX = W * 0.5;
    const margin = W * 0.18;
    const outer = side < 0 ? margin : W - margin;
    return vpX + (outer - vpX) * t;
  }

  function laneCenterX(lane, y) {
    const margin = W * 0.18;
    const vpX = W * 0.5;
    const bottoms = [];
    for (let i = 0; i < LANES; i++) {
      bottoms.push(margin + ((i + 0.5) * (W - 2 * margin)) / LANES);
    }
    const t = laneT(y);
    const ln = Math.max(0, Math.min(LANES - 1, lane));
    const i0 = Math.floor(ln);
    const i1 = Math.min(LANES - 1, Math.ceil(ln));
    const f = ln - i0;
    const bottomX = bottoms[i0] * (1 - f) + bottoms[i1] * f;
    return vpX + (bottomX - vpX) * t;
  }

  function scaleAtY(y) {
    return 0.18 + 0.82 * laneT(y);
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.floor(r.width * dpr);
    H = Math.floor(r.height * dpr);
    canvas.width = W;
    canvas.height = H;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawRunnerAt(c, cx, cy, sc, bob, squashAmt) {
    c.save();
    c.translate(cx, cy + bob);
    c.scale(1, squashAmt);

    c.fillStyle = COL.outline;
    c.beginPath();
    c.ellipse(0, 5 * sc, 22 * sc, 28 * sc, 0, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = COL.runnerBody;
    c.beginPath();
    c.ellipse(0, 0, 18 * sc, 24 * sc, 0, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = COL.runnerHood;
    c.beginPath();
    c.ellipse(0, -8 * sc, 16 * sc, 14 * sc, 0, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = "rgba(255,255,255,0.55)";
    c.beginPath();
    c.ellipse(-6 * sc, -6 * sc, 5 * sc, 8 * sc, -0.3, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = COL.outline;
    c.beginPath();
    c.ellipse(-10 * sc, 10 * sc, 7 * sc, 9 * sc, 0.2, 0, Math.PI * 2);
    c.ellipse(10 * sc, 10 * sc, 7 * sc, 9 * sc, -0.2, 0, Math.PI * 2);
    c.fill();

    c.restore();
  }

  function drawKidPortrait() {
    if (!kidPortrait || !kidCtx) return;
    const kw = kidPortrait.width;
    const kh = kidPortrait.height;
    kidCtx.clearRect(0, 0, kw, kh);
    const bg = kidCtx.createLinearGradient(0, 0, 0, kh);
    bg.addColorStop(0, "#7dd3fc");
    bg.addColorStop(1, "#bae6fd");
    kidCtx.fillStyle = bg;
    kidCtx.fillRect(0, 0, kw, kh);
    const sc = Math.min(kw, kh) / 100;
    drawRunnerAt(kidCtx, kw * 0.5, kh * 0.58, sc, Math.sin(performance.now() * 0.005) * 2, 1);
  }

  function showOverlay(title, msg, showBtn, showKid) {
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    btnStart.style.display = showBtn ? "inline-block" : "none";
    if (kidPortrait) {
      if (showKid) {
        kidPortrait.classList.remove("hidden");
        kidPortrait.setAttribute("aria-hidden", "false");
        drawKidPortrait();
      } else {
        kidPortrait.classList.add("hidden");
        kidPortrait.setAttribute("aria-hidden", "true");
      }
    }
    overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
    if (kidPortrait) {
      kidPortrait.classList.add("hidden");
      kidPortrait.setAttribute("aria-hidden", "true");
    }
  }

  function startGame() {
    playing = true;
    laneIndex = 1;
    laneVisual = 1;
    laneLerp = 1;
    worldSpeed = 220;
    speedTimer = 0;
    score = 0;
    obstacles.length = 0;
    dust.length = 0;
    spawnAcc = 0;
    squash = 1;
    shake = 0;
    scoreEl.textContent = "0";
    hideOverlay();
  }

  function gameOver() {
    playing = false;
    showOverlay(
      "Hit the barrier!",
      "The kid got caught — Score: " +
        Math.floor(score) +
        " — Space or Start to try again",
      true,
      true
    );
  }

  function winGame() {
    playing = false;
    score = WIN_SCORE;
    scoreEl.textContent = String(WIN_SCORE);
    showOverlay(
      "You Win!",
      "You hit " +
        WIN_SCORE +
        " points on the dot — Space or Start to play again",
      true,
      true
    );
  }

  function tryLane(dir) {
    if (!playing) return;
    const next = laneIndex + dir;
    if (next >= 0 && next < LANES) {
      laneIndex = next;
      squashVel = -0.12;
      for (let i = 0; i < 6; i++) {
        dust.push({
          x: laneCenterX(laneIndex, playerY()) + (Math.random() - 0.5) * 40,
          y: playerY() + 20,
          vx: (Math.random() - 0.5) * 80,
          vy: -Math.random() * 120 - 40,
          life: 0.4 + Math.random() * 0.3,
          s: 4 + Math.random() * 5,
        });
      }
    }
  }

  function spawnObstacle() {
    const lane = Math.floor(Math.random() * LANES);
    obstacles.push({
      lane,
      y: horizonY() - 40 - Math.random() * 80,
    });
  }

  function collides(px, py, pw, ph, ox, oy, ow, oh) {
    return Math.abs(px - ox) < (pw + ow) * 0.5 && Math.abs(py - oy) < (ph + oh) * 0.5;
  }

  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (playing) {
      speedTimer += dt;
      if (speedTimer > 2.5) {
        speedTimer = 0;
        worldSpeed = Math.min(520, worldSpeed + 18);
      }
      score += worldSpeed * dt * 0.08;
      if (score >= WIN_SCORE) {
        score = WIN_SCORE;
        winGame();
      } else {
        scoreEl.textContent = String(Math.floor(score));
      }

      if (playing) {
        laneLerp += (laneIndex - laneLerp) * Math.min(1, dt * 14);
        laneVisual = laneLerp;

        squashVel += dt * 6;
        squash += squashVel * dt * 40;
        squash = Math.max(0.88, Math.min(1.08, squash));
        squashVel *= 0.85;
        if (squash > 1) squash -= dt * 2;

        copPhase += dt * 8;

        parallaxFar += worldSpeed * 0.08 * dt;
        parallaxMid += worldSpeed * 0.22 * dt;
        trackPhase += worldSpeed * dt;

        spawnAcc += dt * worldSpeed * 0.012;
        if (spawnAcc > 1) {
          spawnAcc -= 1;
          if (Math.random() > 0.35) spawnObstacle();
        }
        if (obstacles.length < 8 && Math.random() < 0.02 * dt * 60) spawnObstacle();

        for (let i = obstacles.length - 1; i >= 0; i--) {
          const o = obstacles[i];
          o.y += worldSpeed * dt;
          if (o.y > H + 80) obstacles.splice(i, 1);
        }

        const py = playerY();
        const px = laneCenterX(laneVisual, py);
        const ps = scaleAtY(py);
        const pw = 52 * ps;
        const ph = 78 * ps;

        for (let i = obstacles.length - 1; i >= 0; i--) {
          const o = obstacles[i];
          const ox = laneCenterX(o.lane, o.y);
          const os = scaleAtY(o.y);
          const ow = 48 * os;
          const oh = 62 * os;
          if (collides(px, py, pw * 0.55, ph * 0.5, ox, o.y, ow * 0.55, oh * 0.5)) {
            gameOver();
            break;
          }
        }

        for (let i = dust.length - 1; i >= 0; i--) {
          const p = dust[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.life <= 0) dust.splice(i, 1);
        }
      }
    }

    shake *= Math.pow(0.92, dt * 60);

    draw(shake);
    if (kidPortrait && !kidPortrait.classList.contains("hidden")) {
      drawKidPortrait();
    }
    requestAnimationFrame(frame);
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COL.skyTop);
    g.addColorStop(0.55, COL.skyBot);
    g.addColorStop(1, COL.groundLight);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const sunX = W * 0.78;
    const sunY = H * 0.14;
    const rg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * 0.2);
    rg.addColorStop(0, COL.sun);
    rg.addColorStop(0.5, "rgba(251,191,36,0.35)");
    rg.addColorStop(1, "rgba(125,211,252,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H * 0.45);

    ctx.strokeStyle = "rgba(249,115,22,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sunX, sunY, H * 0.065, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawClouds(offset) {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    for (let i = 0; i < 7; i++) {
      const baseX = ((i * 197 + offset * 0.3) % (W + 200)) - 100;
      const cy = horizonY() + 20 + (i % 3) * 18;
      const s = 40 + (i % 4) * 12;
      blobCloud(baseX, cy, s);
    }
  }

  function blobCloud(x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.6, 0, Math.PI * 2);
    ctx.arc(x + s * 0.5, y - s * 0.1, s * 0.55, 0, Math.PI * 2);
    ctx.arc(x + s, y, s * 0.5, 0, Math.PI * 2);
    ctx.arc(x + s * 0.45, y + s * 0.25, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMidground(offset) {
    const h = horizonY();
    const w = W;
    ctx.fillStyle = COL.wall;
    ctx.beginPath();
    ctx.moveTo(0, h + 5);
    ctx.lineTo(w * 0.08, h - 30);
    ctx.lineTo(w * 0.92, h - 30);
    ctx.lineTo(w, h + 5);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < 12; i++) {
      const px = ((i * 90 - offset * 0.5) % (w + 100)) - 50;
      const t = 0.3 + (i % 5) * 0.08;
      const x = W * 0.5 + (px - W * 0.5) * t;
      const pw = 20 * t + 8;
      const ph = (H * 0.25) * t;
      ctx.fillStyle = COL.pillar;
      ctx.fillRect(x - pw * 0.5, h - ph, pw, ph);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(x - pw * 0.25, h - ph, pw * 0.35, ph);
    }
  }

  function drawTracks() {
    const h = horizonY();
    const b = bottomY();
    const vpX = W * 0.5;
    const m = W * 0.18;

    ctx.fillStyle = COL.ground;
    ctx.beginPath();
    ctx.moveTo(vpX, h);
    ctx.lineTo(m, b);
    ctx.lineTo(W - m, b);
    ctx.closePath();
    ctx.fill();

    const stripes = 24;
    for (let s = 0; s < stripes; s++) {
      const u = s / stripes;
      const v = (s + 0.5) / stripes;
      const y1 = h + (b - h) * u;
      const y2 = h + (b - h) * v;
      const w1 = (W * 0.96 * laneT(y1)) * 0.5;
      const w2 = (W * 0.96 * laneT(y2)) * 0.5;
      ctx.fillStyle = s % 2 === 0 ? "rgba(45,90,110,0.4)" : "rgba(61,122,146,0.35)";
      ctx.beginPath();
      ctx.moveTo(vpX - w1, y1);
      ctx.lineTo(vpX + w1, y1);
      ctx.lineTo(vpX + w2, y2);
      ctx.lineTo(vpX - w2, y2);
      ctx.closePath();
      ctx.fill();
    }

    const sleeperCount = 18;
    for (let i = 0; i < sleeperCount; i++) {
      const u = (i / sleeperCount + (trackPhase * 0.0015) % 1) % 1;
      const y = h + (b - h) * u;
      const t = laneT(y);
      const halfW = (W * 0.44) * t;
      ctx.fillStyle = COL.sleeper;
      ctx.strokeStyle = COL.outline;
      ctx.lineWidth = 2 * t;
      roundRect(vpX - halfW, y - 3 * t, halfW * 2, 6 * t, 2 * t);
      ctx.fill();
      ctx.stroke();
    }

    for (let side = -1; side <= 1; side += 2) {
      ctx.strokeStyle = COL.railDark;
      ctx.lineWidth = 4;
      ctx.beginPath();
      const steps = 32;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const y = h + (b - h) * u;
        const rx = trackEdgeX(y, side);
        if (i === 0) ctx.moveTo(rx, y);
        else ctx.lineTo(rx, y);
      }
      ctx.stroke();
      ctx.strokeStyle = COL.rail;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const y = h + (b - h) * u;
        const rx = trackEdgeX(y, side);
        if (i === 0) ctx.moveTo(rx, y);
        else ctx.lineTo(rx, y);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.setLineDash([12 * (W / 800), 10 * (W / 800)]);
    ctx.lineWidth = 2;
    for (let lane = 0; lane < LANES - 1; lane++) {
      ctx.beginPath();
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const y = h + (b - h) * u;
        const x0 = laneCenterX(lane, y);
        const x1 = laneCenterX(lane + 1, y);
        const mx = (x0 + x1) * 0.5;
        if (i === 0) ctx.moveTo(mx, y);
        else ctx.lineTo(mx, y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawHazardBarrier(cx, cy, sc) {
    const w = 46 * sc;
    const h = 56 * sc;
    ctx.fillStyle = "rgba(15,23,42,0.25)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.55, w * 0.55, 10 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = COL.outline;
    ctx.lineWidth = 3 * sc;
    roundRect(-w * 0.5, -h * 0.5, w, h, 6 * sc);
    ctx.fillStyle = COL.stripeA;
    ctx.fill();
    ctx.stroke();

    const stripes = 5;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? COL.stripeB : COL.stripeA;
      ctx.fillRect(-w * 0.5 + (i * w) / stripes, -h * 0.5, w / stripes + 0.5, h);
    }
    ctx.strokeStyle = COL.outline;
    ctx.lineWidth = 2 * sc;
    roundRect(-w * 0.5, -h * 0.5, w, h, 6 * sc);
    ctx.stroke();
    ctx.restore();
  }

  function drawRunner(cx, cy, sc, bob) {
    drawRunnerAt(ctx, cx, cy, sc, bob, squash);
  }

  function drawCop(cx, cy, sc, phase) {
    const bob = Math.sin(phase) * 4 * sc;
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.scale(0.82, 0.82);

    ctx.fillStyle = COL.outline;
    ctx.beginPath();
    ctx.ellipse(0, 5 * sc, 20 * sc, 26 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COL.copBlue;
    ctx.beginPath();
    ctx.ellipse(0, 2 * sc, 17 * sc, 22 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COL.copBadge;
    ctx.beginPath();
    ctx.moveTo(2 * sc, -2 * sc);
    ctx.lineTo(10 * sc, -2 * sc);
    ctx.lineTo(8 * sc, 6 * sc);
    ctx.lineTo(2 * sc, 6 * sc);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COL.outline;
    ctx.lineWidth = 1.5 * sc;
    ctx.stroke();

    ctx.fillStyle = COL.outline;
    ctx.beginPath();
    ctx.ellipse(0, -14 * sc, 14 * sc, 8 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COL.copBlue;
    ctx.beginPath();
    ctx.ellipse(0, -13 * sc, 12 * sc, 6 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawDust() {
    for (const p of dust) {
      const a = Math.max(0, p.life * 2);
      ctx.fillStyle = `rgba(200,230,255,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s * a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw(shakeAmt) {
    ctx.save();
    if (shakeAmt > 0.1) {
      ctx.translate(
        (Math.random() - 0.5) * shakeAmt,
        (Math.random() - 0.5) * shakeAmt
      );
    }

    drawSky();
    drawClouds(parallaxFar);
    drawMidground(parallaxMid);
    drawTracks();

    const py = playerY();
    const px = laneCenterX(laneVisual, py);
    const cpy = copY();
    const cpx = laneCenterX(laneVisual, cpy);
    const csc = scaleAtY(cpy);
    const psc = scaleAtY(py);

    drawCop(cpx, cpy, csc, copPhase);

    for (const o of obstacles) {
      const ox = laneCenterX(o.lane, o.y);
      const osc = scaleAtY(o.y);
      drawHazardBarrier(ox, o.y, osc);
    }

    const bob = Math.sin(performance.now() * 0.012) * 3 * psc;
    drawRunner(px, py, psc, bob);
    drawDust();

    ctx.restore();
  }

  window.addEventListener("resize", resize);
  resize();

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (!playing) startGame();
      return;
    }
    if (!playing) return;
    if (e.code === "ArrowLeft" || e.key === "a" || e.key === "A") {
      e.preventDefault();
      tryLane(-1);
    }
    if (e.code === "ArrowRight" || e.key === "d" || e.key === "D") {
      e.preventDefault();
      tryLane(1);
    }
  });

  btnStart.addEventListener("click", () => {
    if (!playing) startGame();
  });

  showOverlay("Lane Chase", "Press Space to start", true, false);
  requestAnimationFrame(frame);
})();
