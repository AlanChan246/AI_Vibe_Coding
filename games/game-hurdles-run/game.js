(function () {
  "use strict";

  const LOGICAL_W = 960;
  const LOGICAL_H = 540;
  const HIGH_SCORE_KEY = "hurdlesRunnerBest";

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const root = document.getElementById("game-root");
  const elScore = document.getElementById("score-value");
  const elHigh = document.getElementById("high-value");
  const overlayMenu = document.getElementById("overlay-menu");
  const overlayGameover = document.getElementById("overlay-gameover");
  const elFinalScore = document.getElementById("final-score");

  const GROUND_TOP = LOGICAL_H - 130;
  const GROUND_THICK = 110;
  const SKY_BOTTOM = GROUND_TOP;

  const PLAYER_X = 170;
  const PLAYER_W = 44;
  const PLAYER_H = 72;
  const HIT_INSET = 4;

  const GRAVITY = 0.58;
  const JUMP_V = -13.2;
  const MAX_FALL_SPEED = 22;
  const COYOTE_FRAMES = 6;
  const MAX_JUMPS_PER_AIR = 2;
  const MAX_DT = 1000 / 30;

  const BASE_SPEED = 6.2;
  const SPEED_PER_SCORE = 0.0045;
  const MAX_SPEED = 14;

  const SPAWN_GAP_MIN = 220;
  const SPAWN_GAP_MAX = 780;
  const SPAWN_AHEAD = LOGICAL_W + 520;
  const MIN_PIT_SPACING = 900;
  const MAX_ACTIVE_PITS = 1;

  const TYPES = ["hurdle", "cactus", "bush", "pit"];

  const OBSTACLE_COLORS = {
    hurdlePost: "#f97316",
    hurdleBar: "#fb923c",
    hurdleStroke: "#c2410c",
    cactusBody: "#4ade80",
    cactusArm: "#16a34a",
    cactusShadow: "#14532d",
    bushLight: "#c084fc",
    bushDark: "#7c3aed",
    pitVoid: "#1e3a8a",
    pitVoidDeep: "#172554",
    pitRim: "#3b82f6",
    pitShade: "rgba(59, 130, 246, 0.35)",
  };

  let dpr = 1;
  let highScore = 0;

  let mode = "menu";
  let cameraX = 0;
  let score = 0;
  let scrollSpeed = BASE_SPEED;
  let obstacles = [];
  let nextSpawnX = 0;
  let lastPitX = -1e9;

  let playerY = GROUND_TOP - PLAYER_H;
  let vy = 0;
  let onGround = true;
  let coyote = 0;
  let jumpsUsedThisAir = 0;

  function loadHigh() {
    const v = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || "0", 10);
    highScore = Number.isFinite(v) ? v : 0;
    elHigh.textContent = String(highScore);
  }

  function saveHigh() {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
      elHigh.textContent = String(highScore);
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(LOGICAL_W * dpr);
    canvas.height = Math.floor(LOGICAL_H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setOverlays() {
    overlayMenu.classList.toggle("visible", mode === "menu");
    overlayGameover.classList.toggle("visible", mode === "gameover");
  }

  function playerWorldRect() {
    const left = cameraX + PLAYER_X;
    return {
      left,
      top: playerY,
      right: left + PLAYER_W,
      bottom: playerY + PLAYER_H,
    };
  }

  function hitRect(pr) {
    return {
      left: pr.left + HIT_INSET,
      top: pr.top + HIT_INSET,
      right: pr.right - HIT_INSET,
      bottom: pr.bottom - HIT_INSET,
    };
  }

  function footInterval() {
    const pr = playerWorldRect();
    const pad = 6;
    return { L: pr.left + pad, R: pr.right - pad };
  }

  function isFootingSupported(L, R, pits) {
    if (R <= L) return true;
    const relevant = pits
      .filter((p) => p.x < R && p.x + p.w > L)
      .map((p) => ({ a: Math.max(L, p.x), b: Math.min(R, p.x + p.w) }))
      .filter((seg) => seg.b > seg.a)
      .sort((u, v) => u.a - v.a);

    let cur = L;
    for (let i = 0; i < relevant.length; i++) {
      const seg = relevant[i];
      if (seg.a > cur) return true;
      cur = Math.max(cur, seg.b);
      if (cur >= R) return false;
    }
    return cur < R;
  }

  function solidHitbox(o) {
    const padX = o.type === "bush" ? 10 : o.type === "cactus" ? 6 : 8;
    const padY = o.type === "bush" ? 8 : 6;
    return {
      left: o.x + padX,
      top: o.y + padY,
      right: o.x + o.w - padX,
      bottom: o.y + o.h - padY,
    };
  }

  function aabbOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function pickType(spawnRightX) {
    const pitCount = obstacles.filter((o) => o.type === "pit").length;
    const nextLeftX = spawnRightX + SPAWN_GAP_MIN;
    const canPit =
      pitCount < MAX_ACTIVE_PITS &&
      nextLeftX - lastPitX > MIN_PIT_SPACING;

    const weights = TYPES.map((t) => {
      if (t === "pit" && !canPit) return 0;
      if (t === "hurdle") return 0.28;
      if (t === "cactus") return 0.26;
      if (t === "bush") return 0.24;
      if (t === "pit") return 0.22;
      return 0;
    });
    const sum = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < TYPES.length; i++) {
      r -= weights[i];
      if (r <= 0) return TYPES[i];
    }
    return "hurdle";
  }

  function makeObstacle(type, x) {
    if (type === "hurdle") {
      return { type, x, y: GROUND_TOP - 62, w: 52, h: 62 };
    }
    if (type === "cactus") {
      return { type, x, y: GROUND_TOP - 96, w: 38, h: 96 };
    }
    if (type === "bush") {
      return { type, x, y: GROUND_TOP - 42, w: 86, h: 42 };
    }
    if (type === "pit") {
      const w = 100 + Math.floor(Math.random() * 70);
      return { type, x, y: GROUND_TOP, w, h: 0 };
    }
    return { type: "hurdle", x, y: GROUND_TOP - 62, w: 52, h: 62 };
  }

  function randomSpawnGap() {
    return SPAWN_GAP_MIN + Math.random() * (SPAWN_GAP_MAX - SPAWN_GAP_MIN);
  }

  function ensureSpawned() {
    let rightmost = nextSpawnX;
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      rightmost = Math.max(rightmost, o.x + o.w);
    }

    while (rightmost < cameraX + SPAWN_AHEAD) {
      const t = pickType(rightmost);
      let gap = randomSpawnGap();
      let x = rightmost + gap;
      if (t === "pit") {
        const minLeft = lastPitX + MIN_PIT_SPACING;
        if (x < minLeft) x = minLeft;
      }
      if (x < rightmost + SPAWN_GAP_MIN) x = rightmost + SPAWN_GAP_MIN;

      const o = makeObstacle(t, x);
      obstacles.push(o);
      rightmost = x + o.w;
      if (t === "pit") lastPitX = x;
    }
    nextSpawnX = rightmost;
  }

  function cullObstacles() {
    const cutoff = cameraX - 200;
    obstacles = obstacles.filter((o) => o.x + o.w > cutoff);
  }

  function resetGame() {
    cameraX = 0;
    score = 0;
    scrollSpeed = BASE_SPEED;
    obstacles = [];
    nextSpawnX = cameraX + LOGICAL_W * 0.85;
    lastPitX = -1e9;
    playerY = GROUND_TOP - PLAYER_H;
    vy = 0;
    onGround = true;
    coyote = 0;
    jumpsUsedThisAir = 0;
    elScore.textContent = "0";
    elFinalScore.textContent = "";
  }

  function tryJump() {
    if (mode === "menu" || mode === "gameover") {
      mode = "playing";
      resetGame();
      setOverlays();
      return;
    }
    if (mode !== "playing") return;
    if (jumpsUsedThisAir >= MAX_JUMPS_PER_AIR) return;

    if (onGround || coyote > 0) {
      vy = JUMP_V;
      onGround = false;
      coyote = 0;
      jumpsUsedThisAir++;
      return;
    }
    if (jumpsUsedThisAir < MAX_JUMPS_PER_AIR) {
      vy = JUMP_V;
      jumpsUsedThisAir++;
    }
  }

  function gameOver() {
    mode = "gameover";
    elFinalScore.textContent = "Score: " + String(Math.floor(score));
    saveHigh();
    setOverlays();
  }

  function pitsList() {
    return obstacles.filter((o) => o.type === "pit");
  }

  function update(dt) {
    if (mode !== "playing") return;

    const t = Math.min(dt / 16.67, 2.2);
    score += (scrollSpeed * t) / 3.2;
    elScore.textContent = String(Math.floor(score));

    scrollSpeed = Math.min(
      MAX_SPEED,
      BASE_SPEED + score * SPEED_PER_SCORE
    );

    cameraX += scrollSpeed * t;

    ensureSpawned();
    cullObstacles();

    const pits = pitsList();
    const feet = footInterval();
    const supported = isFootingSupported(feet.L, feet.R, pits);

    vy = Math.min(vy + GRAVITY * t, MAX_FALL_SPEED);
    playerY += vy * t;

    const groundY = GROUND_TOP - PLAYER_H;
    if (playerY >= groundY) {
      if (supported) {
        playerY = groundY;
        vy = 0;
        onGround = true;
        jumpsUsedThisAir = 0;
      } else {
        onGround = false;
      }
    } else {
      onGround = false;
    }

    if (onGround) coyote = COYOTE_FRAMES;
    else if (coyote > 0) coyote -= t;

    if (!supported && playerY >= groundY && vy >= 0) {
      gameOver();
      return;
    }

    const ph = hitRect(playerWorldRect());
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (o.type === "pit") continue;
      if (aabbOverlap(ph, solidHitbox(o))) {
        gameOver();
        return;
      }
    }
  }

  function drawSky() {
    const grd = ctx.createLinearGradient(0, 0, 0, SKY_BOTTOM);
    grd.addColorStop(0, "#6ec8ff");
    grd.addColorStop(1, "#b8e6ff");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, LOGICAL_W, SKY_BOTTOM);
  }

  function drawClouds() {
    ctx.save();
    const shift = (cameraX * 0.08) % 400;
    for (let i = 0; i < 5; i++) {
      const bx = i * 220 - shift;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(bx + 80, 70, 52, 28, 0, 0, Math.PI * 2);
      ctx.ellipse(bx + 120, 65, 44, 22, 0, 0, Math.PI * 2);
      ctx.ellipse(bx + 150, 78, 38, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGroundAndPits() {
    const pits = pitsList();
    const segments = [];
    let cur = cameraX - 50;
    const endWorld = cameraX + LOGICAL_W + 80;
    const sorted = pits.slice().sort((a, b) => a.x - b.x);

    function addSeg(a, b) {
      if (b > a) segments.push({ a, b });
    }

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      if (p.x > cur) addSeg(cur, p.x);
      cur = Math.max(cur, p.x + p.w);
    }
    addSeg(cur, endWorld);

    ctx.fillStyle = "#3d2914";
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const sx = s.a - cameraX;
      const sw = s.b - s.a;
      ctx.fillRect(sx, GROUND_TOP, sw, GROUND_THICK);
    }

    ctx.fillStyle = OBSTACLE_COLORS.pitVoidDeep;
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const sx = p.x - cameraX;
      if (sx + p.w < 0 || sx > LOGICAL_W) continue;
      ctx.fillRect(sx, GROUND_TOP, p.w, GROUND_THICK + 40);
    }
    ctx.fillStyle = OBSTACLE_COLORS.pitVoid;
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const sx = p.x - cameraX;
      if (sx + p.w < 0 || sx > LOGICAL_W) continue;
      ctx.fillRect(sx + 3, GROUND_TOP + 6, p.w - 6, GROUND_THICK + 28);
    }

    ctx.strokeStyle = "#5c3d1e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_TOP);
    ctx.lineTo(LOGICAL_W, GROUND_TOP);
    ctx.stroke();

    ctx.fillStyle = "#5a7c3e";
    ctx.fillRect(0, GROUND_TOP - 6, LOGICAL_W, 8);
  }

  function drawHurdle(o, sx) {
    const y = o.y;
    const c = OBSTACLE_COLORS;
    ctx.fillStyle = c.hurdlePost;
    ctx.fillRect(sx + 6, y + 20, 8, o.h - 20);
    ctx.fillRect(sx + o.w - 14, y + 20, 8, o.h - 20);
    ctx.fillStyle = c.hurdleBar;
    ctx.fillRect(sx, y + 8, o.w, 12);
    ctx.strokeStyle = c.hurdleStroke;
    ctx.strokeRect(sx, y + 8, o.w, 12);
  }

  function drawCactus(o, sx) {
    const cx = sx + o.w / 2;
    const c = OBSTACLE_COLORS;
    ctx.fillStyle = c.cactusBody;
    ctx.beginPath();
    ctx.ellipse(cx, o.y + o.h - 18, 16, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, o.y + o.h - 50, 12, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, o.y + 28, 10, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.cactusArm;
    for (let i = 0; i < 5; i++) {
      const py = o.y + 20 + i * 16;
      ctx.fillRect(cx + 8, py, 14, 4);
      ctx.fillRect(cx - 22, py + 8, 14, 4);
    }
    ctx.fillStyle = c.cactusShadow;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(cx - 4, o.y + 24 + i * 22, 5, 14);
    }
  }

  function drawBush(o, sx) {
    const c = OBSTACLE_COLORS;
    ctx.fillStyle = c.bushDark;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(sx + 18 + i * 18, o.y + 22, 20, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = c.bushLight;
    ctx.beginPath();
    ctx.ellipse(sx + o.w / 2, o.y + 18, 28, 20, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPit(o, sx) {
    const c = OBSTACLE_COLORS;
    ctx.fillStyle = c.pitShade;
    ctx.fillRect(sx, GROUND_TOP + 4, o.w, 8);
    ctx.strokeStyle = c.pitRim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, GROUND_TOP + 4);
    ctx.lineTo(sx + o.w, GROUND_TOP + 4);
    ctx.stroke();
  }

  function drawObstacles() {
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      const sx = o.x - cameraX;
      if (sx + o.w < -20 || sx > LOGICAL_W + 20) continue;
      if (o.type === "pit") drawPit(o, sx);
      else if (o.type === "hurdle") drawHurdle(o, sx);
      else if (o.type === "cactus") drawCactus(o, sx);
      else if (o.type === "bush") drawBush(o, sx);
    }
  }

  function drawPlayer() {
    const x = PLAYER_X;
    const y = playerY;
    ctx.save();
    ctx.fillStyle = "#2a3a5c";
    ctx.strokeStyle = "#1a2438";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + PLAYER_W / 2, y + 16, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#d94b4b";
    ctx.fillRect(x + 10, y + 28, 24, 26);
    ctx.fillStyle = "#2a3a5c";
    ctx.fillRect(x + 8, y + 52, 10, 20);
    ctx.fillRect(x + 26, y + 52, 10, 20);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    drawSky();
    drawClouds();
    drawGroundAndPits();
    drawObstacles();
    drawPlayer();
  }

  let lastTs = 0;
  function frame(ts) {
    if (!lastTs) lastTs = ts;
    let dt = ts - lastTs;
    lastTs = ts;
    if (dt > MAX_DT) dt = MAX_DT;

    update(dt);
    draw();

    requestAnimationFrame(frame);
  }

  function onKeyDown(e) {
    if (e.code !== "Space") return;
    e.preventDefault();
    if (e.repeat) return;
    tryJump();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", resize);

  root.addEventListener("pointerdown", () => root.focus());

  loadHigh();
  resize();
  setOverlays();
  root.focus();
  requestAnimationFrame(frame);
})();
