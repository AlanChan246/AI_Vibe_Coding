(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const elScore = document.getElementById("score");
  const elTime = document.getElementById("time");
  const elStatus = document.getElementById("status");
  const btnStart = document.getElementById("btn-start");
  const btnReset = document.getElementById("btn-reset");
  const elDifficulty = document.getElementById("difficulty");
  const elDifficultyHint = document.getElementById("difficulty-hint");
  const elGameMode = document.getElementById("game-mode");
  const elBattleBar = document.getElementById("battle-bar");
  const elBattleP1 = document.getElementById("battle-p1");
  const elBattleP2 = document.getElementById("battle-p2");
  const elLobbyOverlay = document.getElementById("lobby-overlay");
  const btnEnterPlay = document.getElementById("btn-enter-play");
  const btnBackLobby = document.getElementById("btn-back-lobby");
  const elPlaySettingsSummary = document.getElementById("play-settings-summary");

  const HOOK_TOP = 0.08;
  const LINE_SPEED = 1.35;
  const REEL_SPEED = 1.05;

  /** @type {Record<'easy'|'normal'|'hard', { label: string, duration: number, fishMin: number, fishMax: number, speedMul: number, lineMul: number, reelMul: number }>} */
  const DIFFICULTY = {
    easy: { label: "簡單", duration: 75, fishMin: 9, fishMax: 12, speedMul: 0.84, lineMul: 1.12, reelMul: 1.08 },
    normal: { label: "中等", duration: 60, fishMin: 11, fishMax: 15, speedMul: 1, lineMul: 1, reelMul: 1 },
    hard: { label: "困難", duration: 45, fishMin: 13, fishMax: 18, speedMul: 1.14, lineMul: 0.9, reelMul: 0.92 },
  };

  /** @type {'easy'|'normal'|'hard'} */
  let committedDifficulty = "normal";
  /** @type {'solo'|'battle'} */
  let committedGameMode = "solo";
  /** @type {null|'p1'|'after_p1'|'p2'|'done'} */
  let battleState = null;
  /** @type {number|null} */
  let scoreP1 = null;
  /** @type {number|null} */
  let scoreP2 = null;

  function getDifficultyKey() {
    const v = elDifficulty.value;
    if (v === "easy" || v === "hard") return v;
    return "normal";
  }

  function currentDifficultyCfg() {
    return DIFFICULTY[getDifficultyKey()];
  }

  function getGameModeKey() {
    return elGameMode.value === "battle" ? "battle" : "solo";
  }

  function syncBattleBarVisibility() {
    const on = getGameModeKey() === "battle";
    elBattleBar.classList.toggle("hidden", !on);
  }

  function updateBattleBar() {
    elBattleP1.textContent = scoreP1 == null ? "—" : String(scoreP1);
    elBattleP2.textContent = scoreP2 == null ? "—" : String(scoreP2);
  }

  function refreshStartButton() {
    if (getGameModeKey() === "battle") {
      if (battleState === "after_p1") {
        btnStart.textContent = "下一位（玩家二）";
        return;
      }
      if (battleState === null || battleState === "done") {
        btnStart.textContent = battleState === "done" ? "再對戰一局" : "開始對戰";
        return;
      }
    }
    btnStart.textContent = "開始";
  }

  function updatePlaySettingsSummary() {
    const modeLabel = getGameModeKey() === "battle" ? "雙人對戰" : "單人";
    const dk = getDifficultyKey();
    const cfg = DIFFICULTY[dk];
    elPlaySettingsSummary.textContent = `${modeLabel} · ${cfg.label} · 每局 ${cfg.duration} 秒`;
  }

  function syncPlayChrome() {
    btnStart.disabled = running;
    btnBackLobby.disabled = running || elGameMode.disabled;
  }

  function catchStatusPrefix() {
    if (committedGameMode !== "battle" || !running) return "";
    if (battleState === "p2") return "玩家二 ";
    if (battleState === "p1") return "玩家一 ";
    return "";
  }

  function hookPalette() {
    if (committedGameMode === "battle" && battleState === "p2") {
      return {
        line: "rgba(254, 215, 170, 0.78)",
        hookStroke: "#ea580c",
        hookFill: "#ffedd5",
      };
    }
    return {
      line: "rgba(255,255,255,0.55)",
      hookStroke: "#94a3b8",
      hookFill: "#cbd5e1",
    };
  }

  function rarityWeightMul(rarity) {
    const k = getDifficultyKey();
    if (k === "easy") return rarity === 1 ? 1.42 : rarity === 2 ? 1.12 : 0.52;
    if (k === "hard") return rarity === 1 ? 0.78 : rarity === 2 ? 1.02 : 1.52;
    return 1;
  }

  /**
   * @typedef {{
   *   kind: string,
   *   name: string,
   *   x: number,
   *   baseY: number,
   *   y: number,
   *   vx: number,
   *   r: number,
   *   hitR: number,
   *   pts: number,
   *   hue: number,
   *   hue2: number,
   *   caught: boolean,
   *   bobAmp: number,
   *   bobSpeed: number,
   *   bobPhase: number,
   *   lengthMul: number,
   *   bodyY: number,
   * }} Fish
   */

  /** @type {{ kind: string, name: string, weight: number, rarity: 1 | 2 | 3, rMin: number, rMax: number, spdMin: number, spdMax: number, ptsMin: number, ptsMax: number, hue: [number, number], hue2?: [number, number], hitMul?: number, lengthMul?: number, bobAmp?: number, bobSpeed?: number, bodyY?: number }[]} */
  const SPECIES = [
    { kind: "shrimp", name: "小蝦", weight: 20, rarity: 1, rMin: 0.02, rMax: 0.03, spdMin: 0.72, spdMax: 1.15, ptsMin: 6, ptsMax: 20, hue: [12, 32], hitMul: 0.88, bobAmp: 0.006, bobSpeed: 1.1 },
    { kind: "minnow", name: "柳葉魚", weight: 18, rarity: 1, rMin: 0.026, rMax: 0.036, spdMin: 0.48, spdMax: 0.88, ptsMin: 25, ptsMax: 55, hue: [198, 225], hitMul: 1 },
    { kind: "grass", name: "草魚", weight: 16, rarity: 2, rMin: 0.032, rMax: 0.048, spdMin: 0.32, spdMax: 0.58, ptsMin: 65, ptsMax: 110, hue: [95, 125], hue2: [75, 100], hitMul: 1.05 },
    { kind: "carp", name: "鯉魚", weight: 12, rarity: 2, rMin: 0.034, rMax: 0.052, spdMin: 0.3, spdMax: 0.55, ptsMin: 85, ptsMax: 145, hue: [8, 22], hue2: [28, 48], hitMul: 1.08 },
    { kind: "goldfish", name: "金魚", weight: 10, rarity: 2, rMin: 0.03, rMax: 0.045, spdMin: 0.22, spdMax: 0.42, ptsMin: 75, ptsMax: 130, hue: [28, 42], hue2: [15, 28], hitMul: 1.1, bodyY: 0.08 },
    { kind: "angelfish", name: "神仙魚", weight: 9, rarity: 2, rMin: 0.028, rMax: 0.04, spdMin: 0.35, spdMax: 0.62, ptsMin: 120, ptsMax: 200, hue: [210, 235], hue2: [45, 55], hitMul: 1.12, bodyY: 0 },
    { kind: "sword", name: "旗魚", weight: 6, rarity: 3, rMin: 0.024, rMax: 0.034, spdMin: 0.85, spdMax: 1.35, ptsMin: 180, ptsMax: 320, hue: [200, 220], hue2: [175, 195], hitMul: 1.35, lengthMul: 2.35 },
    { kind: "puffer", name: "河豚", weight: 4, rarity: 3, rMin: 0.038, rMax: 0.055, spdMin: 0.18, spdMax: 0.32, ptsMin: 220, ptsMax: 420, hue: [160, 185], hitMul: 1.25, bobAmp: 0.004, bobSpeed: 0.75 },
    { kind: "grouper", name: "石斑", weight: 5, rarity: 3, rMin: 0.042, rMax: 0.062, spdMin: 0.2, spdMax: 0.38, ptsMin: 150, ptsMax: 280, hue: [215, 240], hue2: [260, 285], hitMul: 1.2 },
  ];

  function pickSpecies() {
    let tw = 0;
    const weights = SPECIES.map((s) => {
      const ww = s.weight * rarityWeightMul(s.rarity);
      tw += ww;
      return ww;
    });
    let t = Math.random() * tw;
    for (let i = 0; i < SPECIES.length; i++) {
      t -= weights[i];
      if (t <= 0) return SPECIES[i];
    }
    return SPECIES[SPECIES.length - 1];
  }

  const RARITY_LABEL = /** @type {Record<1 | 2 | 3, string>} */ ({ 1: "常見", 2: "中等", 3: "稀有" });

  function pctLabel(mul) {
    return `${Math.round(mul * 100)}%`;
  }

  function renderOverviewTables() {
    const root = document.getElementById("overview-root");
    if (!root) return;
    root.textContent = "";

    const hFish = document.createElement("h3");
    hFish.className = "overview-heading";
    hFish.textContent = "魚種總覽";
    root.appendChild(hFish);

    const tblFish = document.createElement("table");
    tblFish.className = "ov-table";
    const cap = document.createElement("caption");
    cap.textContent =
      "「基礎權重」為相對出現率；實際還會依所選難度調整（簡單偏常見魚、困難偏稀有魚）。";
    tblFish.appendChild(cap);
    const thead = document.createElement("thead");
    thead.innerHTML =
      "<tr><th scope=\"col\">魚種</th><th scope=\"col\">稀有度</th><th scope=\"col\">分值（約）</th><th scope=\"col\">基礎權重</th><th scope=\"col\">游速</th></tr>";
    tblFish.appendChild(thead);
    const tbFish = document.createElement("tbody");
    for (const s of SPECIES) {
      const avgSpd = (s.spdMin + s.spdMax) / 2;
      const spdWord = avgSpd >= 0.72 ? "快" : avgSpd >= 0.4 ? "中" : "慢";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${s.name}</td><td>${RARITY_LABEL[s.rarity]}</td><td>${s.ptsMin}～${s.ptsMax}</td><td>${s.weight}</td><td>${spdWord}</td>`;
      tbFish.appendChild(tr);
    }
    tblFish.appendChild(tbFish);
    root.appendChild(tblFish);

    const hDif = document.createElement("h3");
    hDif.className = "overview-heading";
    hDif.textContent = "難度總覽";
    root.appendChild(hDif);

    const tblDif = document.createElement("table");
    tblDif.className = "ov-table";
    const theadD = document.createElement("thead");
    theadD.innerHTML =
      "<tr><th scope=\"col\">難度</th><th scope=\"col\">限時</th><th scope=\"col\">魚數量</th><th scope=\"col\">魚速</th><th scope=\"col\">下鉤</th><th scope=\"col\">收線</th></tr>";
    tblDif.appendChild(theadD);
    const tbDif = document.createElement("tbody");
    for (const key of ["easy", "normal", "hard"]) {
      const d = DIFFICULTY[/** @type {"easy" | "normal" | "hard"} */ (key)];
      const tr = document.createElement("tr");
      tr.innerHTML = `<th scope="row">${d.label}</th><td>${d.duration} 秒</td><td>${d.fishMin}～${d.fishMax}</td><td>${pctLabel(d.speedMul)}</td><td>${pctLabel(d.lineMul)}</td><td>${pctLabel(d.reelMul)}</td>`;
      tbDif.appendChild(tr);
    }
    tblDif.appendChild(tbDif);
    root.appendChild(tblDif);

    const noteDif = document.createElement("p");
    noteDif.className = "overview-note";
    noteDif.textContent =
      "魚速／下鉤／收線以「中等＝100%」為基準；百分比愈高表示該動作愈快（時間內位移愈多）。";
    root.appendChild(noteDif);

    const hMode = document.createElement("h3");
    hMode.className = "overview-heading";
    hMode.textContent = "模式總覽";
    root.appendChild(hMode);

    const tblMode = document.createElement("table");
    tblMode.className = "ov-table";
    tblMode.innerHTML = `<thead><tr><th scope="col">模式</th><th scope="col">說明</th></tr></thead><tbody>
      <tr><th scope="row">單人</th><td>一局內累積分數，時間結束後顯示總分。</td></tr>
      <tr><th scope="row">雙人對戰</th><td>兩人各玩完整一局（同難度；第二局池內魚會重刷），依總分勝負。第一局結束後換人，再按「下一位（玩家二）」。</td></tr>
    </tbody>`;
    root.appendChild(tblMode);
  }

  let w = 400;
  let h = 400;
  let running = false;
  let timeLeft = DIFFICULTY.normal.duration;
  let lastTs = 0;
  let score = 0;
  let pointerX = 0.5;
  let pointerDown = false;
  /** @type {Fish[]} */
  let fishes = [];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.round(rect.width * dpr));
    h = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = w;
    canvas.height = h;
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  /** @param {Fish} f */
  function respawnFishAtEdge(f) {
    const s = pickSpecies();
    const fromLeft = Math.random() < 0.5;
    applySpeciesToFish(f, s, fromLeft);
  }

  /**
   * @param {Fish} f
   * @param {typeof SPECIES[0]} s
   * @param {boolean} fromLeft
   */
  function applySpeciesToFish(f, s, fromLeft) {
    const cfg = currentDifficultyCfg();
    const r = rand(s.rMin, s.rMax) * h;
    const spd = rand(s.spdMin, s.spdMax) * w * 0.001 * cfg.speedMul;
    f.kind = s.kind;
    f.name = s.name;
    f.r = r;
    f.hitR = r * (s.hitMul ?? 1);
    f.vx = (fromLeft ? 1 : -1) * spd;
    f.x = fromLeft ? -r * 2.5 : w + r * 2.5;
    f.baseY = rand(h * 0.22, h * 0.88);
    f.y = f.baseY;
    f.pts = Math.round(rand(s.ptsMin, s.ptsMax));
    f.hue = rand(s.hue[0], s.hue[1]);
    f.hue2 = s.hue2 ? rand(s.hue2[0], s.hue2[1]) : f.hue + rand(-12, 12);
    f.caught = false;
    f.bobAmp = (s.bobAmp ?? 0) * h;
    f.bobSpeed = s.bobSpeed ?? 0;
    f.bobPhase = rand(0, Math.PI * 2);
    f.lengthMul = s.lengthMul ?? 1;
    f.bodyY = s.bodyY ?? 0;
  }

  function spawnFish() {
    const s = pickSpecies();
    const fromLeft = Math.random() < 0.5;
    /** @type {Fish} */
    const f = {
      kind: "",
      name: "",
      x: 0,
      baseY: 0,
      y: 0,
      vx: 0,
      r: 0,
      hitR: 0,
      pts: 0,
      hue: 0,
      hue2: 0,
      caught: false,
      bobAmp: 0,
      bobSpeed: 0,
      bobPhase: 0,
      lengthMul: 1,
      bodyY: 0,
    };
    applySpeciesToFish(f, s, fromLeft);
    fishes.push(f);
  }

  function initFish() {
    fishes = [];
    const cfg = currentDifficultyCfg();
    const span = cfg.fishMax - cfg.fishMin + 1;
    const n = cfg.fishMin + Math.floor(Math.random() * span);
    for (let i = 0; i < n; i++) spawnFish();
  }

  const hook = {
    x: 0.5,
    depth: 0,
    maxDepth: 1,
  };

  function resetRound() {
    const cfg = currentDifficultyCfg();
    score = 0;
    timeLeft = cfg.duration;
    hook.depth = 0;
    hook.x = 0.5;
    initFish();
    elScore.textContent = "0";
    elTime.textContent = String(cfg.duration);
  }

  function setGameSetupLocked(locked) {
    elDifficulty.disabled = locked;
    elGameMode.disabled = locked;
    elDifficultyHint.classList.toggle("visible", locked);
    syncPlayChrome();
  }

  function syncTimeDisplay() {
    if (running) return;
    const cfg = currentDifficultyCfg();
    elTime.textContent = String(cfg.duration);
  }

  function clientToNorm(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    return {
      nx: Math.min(1, Math.max(0, nx)),
      ny: Math.min(1, Math.max(0, ny)),
    };
  }

  canvas.addEventListener("pointermove", (e) => {
    const { nx } = clientToNorm(e.clientX, e.clientY);
    pointerX = nx;
    if (!running) hook.x = nx;
  });

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointerDown = true;
    const { nx } = clientToNorm(e.clientX, e.clientY);
    pointerX = nx;
  });

  canvas.addEventListener("pointerup", (e) => {
    pointerDown = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  });

  canvas.addEventListener("pointerleave", () => {
    pointerDown = false;
  });

  function drawWater() {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#38bdf8");
    g.addColorStop(0.45, "#0284c7");
    g.addColorStop(1, "#0c4a6e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 5; i++) {
      const y = (h * 0.15 + i * h * 0.18 + (lastTs * 0.02 + i * 40) % 80) % h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 24) {
        ctx.lineTo(x, y + Math.sin((x + lastTs) * 0.02) * 6);
      }
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** @param {Fish} f */
  function drawStandardBody(f, bodyRyMul, tailW) {
    const { r, vx, hue, hue2 } = f;
    const len = r * 1.1 * f.lengthMul;
    const ry = r * bodyRyMul;
    const g = ctx.createLinearGradient(-len, 0, len, 0);
    g.addColorStop(0, `hsl(${hue2} 55% 38%)`);
    g.addColorStop(0.5, `hsl(${hue} 68% 46%)`);
    g.addColorStop(1, `hsl(${hue2} 60% 34%)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, f.bodyY * r, len, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `hsl(${hue2} 58% 32%)`;
    ctx.beginPath();
    ctx.moveTo(-len * 0.92, f.bodyY * r);
    ctx.lineTo(-len * tailW, -ry * 0.95 + f.bodyY * r);
    ctx.lineTo(-len * tailW, ry * 0.95 + f.bodyY * r);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.beginPath();
    ctx.arc(len * 0.25, -ry * 0.25 + f.bodyY * r, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(len * 0.32, -ry * 0.22 + f.bodyY * r, r * 0.085, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @param {Fish} f */
  function drawCarpScales(f) {
    const { r, hue } = f;
    const len = r * 1.1 * f.lengthMul;
    const ry = r * 0.62;
    ctx.strokeStyle = `hsla(${hue} 40% 22% / 0.45)`;
    ctx.lineWidth = Math.max(1, r * 0.08);
    for (let i = 0; i < 4; i++) {
      const ox = -len * 0.15 + i * len * 0.22;
      ctx.beginPath();
      ctx.arc(ox, f.bodyY * r, ry * 0.55, -Math.PI * 0.55, Math.PI * 0.55);
      ctx.stroke();
    }
  }

  /** @param {Fish} f */
  function drawAngelfishStripes(f) {
    const { r, hue2 } = f;
    const len = r * 1.05 * f.lengthMul;
    const ry = r * 0.95;
    ctx.fillStyle = `hsla(${hue2} 70% 18% / 0.55)`;
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(i * len * 0.22 - r * 0.06, -ry + f.bodyY * r, r * 0.1, ry * 2);
    }
  }

  /** @param {Fish} f */
  function drawGrouperSpots(f) {
    const { r, hue } = f;
    const len = r * 1.05 * f.lengthMul;
    const ry = r * 0.68;
    ctx.fillStyle = `hsla(${hue} 30% 20% / 0.4)`;
    const seeds = [0.2, 0.45, 0.65, 0.35, 0.55];
    for (let i = 0; i < seeds.length; i++) {
      const px = -len * 0.5 + seeds[i] * len;
      const py = (Math.sin(i * 2.1) * 0.35) * ry + f.bodyY * r;
      ctx.beginPath();
      ctx.arc(px, py, r * (0.12 + (i % 3) * 0.02), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** @param {Fish} f */
  function drawSwordBill(f) {
    const { r, hue } = f;
    const len = r * 1.1 * f.lengthMul;
    ctx.fillStyle = `hsl(${hue} 25% 42%)`;
    ctx.beginPath();
    ctx.moveTo(len * 1.05, f.bodyY * r);
    ctx.lineTo(len * 2.5, f.bodyY * r);
    ctx.lineTo(len * 1.05, r * 0.12 + f.bodyY * r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `hsl(${hue} 35% 30%)`;
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.stroke();
  }

  /** @param {Fish} f */
  function drawPufferSpikes(f) {
    const { r } = f;
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const cx = Math.cos(a) * r * 1.05;
      const cy = Math.sin(a) * r * 1.05 + f.bodyY * r;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r * 0.22, cy + Math.sin(a) * r * 0.22);
      ctx.lineTo(cx + Math.cos(a + 0.25) * r * 0.12, cy + Math.sin(a + 0.25) * r * 0.12);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** @param {Fish} f */
  function drawShrimp(f) {
    const { r, hue } = f;
    ctx.strokeStyle = `hsl(${hue} 65% 42%)`;
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(r * 0.9, -r * 1.1);
    ctx.quadraticCurveTo(r * 1.5, -r * 1.5, r * 2, -r * 1.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.9, r * 1.05);
    ctx.quadraticCurveTo(r * 1.45, r * 1.45, r * 1.95, r * 1.25);
    ctx.stroke();

    const segs = 4;
    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1);
      const px = -r * 0.9 + t * r * 1.7;
      const py = Math.sin(t * Math.PI) * r * 0.35;
      ctx.fillStyle = i % 2 === 0 ? `hsl(${hue} 70% 58%)` : `hsl(${hue} 55% 48%)`;
      ctx.beginPath();
      ctx.ellipse(px, py, r * 0.32, r * 0.22, t * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `hsl(${hue} 75% 35%)`;
    ctx.beginPath();
    ctx.ellipse(r * 0.95, 0, r * 0.2, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(r * 1.05, -r * 0.04, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @param {Fish} f */
  function drawAngelfishShape(f) {
    const { r, hue, hue2 } = f;
    const wBody = r * 0.55 * f.lengthMul;
    const hBody = r * 1.35;
    const g = ctx.createLinearGradient(0, -hBody, 0, hBody);
    g.addColorStop(0, `hsl(${hue} 65% 42%)`);
    g.addColorStop(0.5, `hsl(${hue2} 55% 52%)`);
    g.addColorStop(1, `hsl(${hue} 60% 36%)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -hBody);
    ctx.lineTo(wBody * 1.2, 0);
    ctx.lineTo(0, hBody);
    ctx.lineTo(-wBody * 1.15, 0);
    ctx.closePath();
    ctx.fill();

    drawAngelfishStripes({ ...f, r, lengthMul: f.lengthMul * 0.95 });

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(wBody * 0.35, -hBody * 0.25, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(wBody * 0.4, -hBody * 0.22, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @param {Fish} f */
  function drawFish(f) {
    if (f.caught) return;
    const { x, y, vx } = f;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(vx > 0 ? 1 : -1, 1);

    switch (f.kind) {
      case "shrimp":
        drawShrimp(f);
        break;
      case "minnow":
        drawStandardBody(f, 0.58, 1.75);
        break;
      case "grass":
        drawStandardBody(f, 0.64, 1.82);
        break;
      case "carp":
        drawStandardBody(f, 0.62, 1.88);
        drawCarpScales(f);
        break;
      case "goldfish":
        drawStandardBody(f, 0.72, 1.45);
        break;
      case "angelfish":
        drawAngelfishShape(f);
        break;
      case "sword":
        drawStandardBody(f, 0.52, 1.55);
        drawSwordBill(f);
        break;
      case "puffer": {
        const { r, hue, hue2 } = f;
        const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r * 1.1);
        g.addColorStop(0, `hsl(${hue} 55% 52%)`);
        g.addColorStop(1, `hsl(${hue2} 60% 38%)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, f.bodyY * r, r * 1.02, 0, Math.PI * 2);
        ctx.fill();
        drawPufferSpikes(f);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.arc(r * 0.25, -r * 0.28 + f.bodyY * r, r * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(r * 0.35, -r * 0.26 + f.bodyY * r, r * 0.07, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "grouper":
        drawStandardBody(f, 0.7, 1.65);
        drawGrouperSpots(f);
        break;
      default:
        drawStandardBody(f, 0.62, 1.8);
    }

    ctx.restore();
  }

  function drawHookAndLine() {
    const topY = h * HOOK_TOP;
    const hx = hook.x * w;
    const hy = topY + hook.depth * (h - topY - h * 0.04);
    const pal = hookPalette();

    ctx.strokeStyle = pal.line;
    ctx.lineWidth = Math.max(1, w * 0.004);
    ctx.beginPath();
    ctx.moveTo(hx, topY - h * 0.02);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    ctx.strokeStyle = pal.hookStroke;
    ctx.lineWidth = Math.max(1.5, w * 0.006);
    ctx.beginPath();
    ctx.arc(hx, hy, h * 0.022, Math.PI * 0.1, Math.PI * 1.4, true);
    ctx.stroke();

    ctx.fillStyle = pal.hookFill;
    ctx.beginPath();
    ctx.arc(hx + h * 0.018, hy + h * 0.02, h * 0.012, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDock() {
    const topY = h * HOOK_TOP;
    ctx.fillStyle = "#78350f";
    ctx.fillRect(0, 0, w, topY + h * 0.04);
    ctx.fillStyle = "#92400e";
    ctx.fillRect(0, topY, w, h * 0.025);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(0, topY + h * 0.01, w, h * 0.008);
  }

  function hookHitbox() {
    const topY = h * HOOK_TOP;
    const hx = hook.x * w;
    const hy = topY + hook.depth * (h - topY - h * 0.04);
    const rr = h * 0.04;
    return { hx, hy, rr };
  }

  function tryCatch() {
    const { hx, hy, rr } = hookHitbox();
    for (const f of fishes) {
      if (f.caught) continue;
      const dx = f.x - hx;
      const dy = f.y - hy;
      const dist = Math.hypot(dx, dy);
      if (dist < f.hitR + rr * 0.85) {
        f.caught = true;
        score += f.pts;
        elScore.textContent = String(score);
        const pre = catchStatusPrefix();
        elStatus.textContent = `${pre}釣到「${f.name}」+${f.pts} 分！`;
        window.setTimeout(() => {
          if (running) elStatus.textContent = `${catchStatusPrefix()}繼續釣！`;
        }, 900);
        spawnFish();
      }
    }
  }

  function tick(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(32, ts - lastTs);
    lastTs = ts;

    if (running) {
      timeLeft -= dt / 1000;
      if (timeLeft <= 0) {
        timeLeft = 0;
        running = false;
        const diffLabel = DIFFICULTY[committedDifficulty].label;

        if (committedGameMode === "battle") {
          if (battleState === "p1") {
            scoreP1 = score;
            updateBattleBar();
            battleState = "after_p1";
            elStatus.textContent = `玩家一 時間到！（${diffLabel}）得分 ${scoreP1}。請交給玩家二，再按「下一位（玩家二）」。`;
            setGameSetupLocked(true);
            refreshStartButton();
          } else if (battleState === "p2") {
            scoreP2 = score;
            updateBattleBar();
            battleState = "done";
            const s1 = scoreP1 ?? 0;
            const s2 = scoreP2 ?? 0;
            let verdict;
            if (s2 > s1) verdict = `玩家二 獲勝！${s2} 比 ${s1}。`;
            else if (s1 > s2) verdict = `玩家一 獲勝！${s1} 比 ${s2}。`;
            else verdict = `平手！雙方皆 ${s1} 分。`;
            elStatus.textContent = `對戰結束（${diffLabel}）。${verdict} 可再按「再對戰一局」或調整難度後開局。`;
            setGameSetupLocked(false);
            refreshStartButton();
          }
        } else {
          elStatus.textContent = `時間到！（${diffLabel}）總分 ${score}。按「開始」再玩一局。`;
          setGameSetupLocked(false);
          refreshStartButton();
        }
        syncPlayChrome();
      }
      elTime.textContent = String(Math.max(0, Math.ceil(timeLeft)));

      const cfg = currentDifficultyCfg();
      hook.x += (pointerX - hook.x) * 0.14;
      if (pointerDown) {
        hook.depth = Math.min(1, hook.depth + (LINE_SPEED * cfg.lineMul * dt) / 1000);
      } else {
        hook.depth = Math.max(0, hook.depth - (REEL_SPEED * cfg.reelMul * dt) / 1000);
      }

      for (const f of fishes) {
        if (f.caught) continue;
        f.x += f.vx * (dt / 16.67);
        if (f.bobAmp > 0 && f.bobSpeed > 0) {
          f.bobPhase += (dt / 1000) * f.bobSpeed * 2.8;
          f.y = f.baseY + Math.sin(f.bobPhase) * f.bobAmp;
        } else {
          f.y = f.baseY;
        }
        if (f.x < -f.r * 4 || f.x > w + f.r * 4) {
          respawnFishAtEdge(f);
        }
      }

      tryCatch();
    }

    drawWater();
    for (const f of fishes) drawFish(f);
    drawDock();
    drawHookAndLine();

    requestAnimationFrame(tick);
  }

  btnStart.addEventListener("click", () => {
    if (running) return;

    committedDifficulty = getDifficultyKey();
    committedGameMode = getGameModeKey();

    if (committedGameMode === "battle") {
      if (battleState === null || battleState === "done") {
        battleState = "p1";
        scoreP1 = null;
        scoreP2 = null;
        updateBattleBar();
      } else if (battleState === "after_p1") {
        battleState = "p2";
      } else {
        return;
      }
    } else {
      battleState = null;
      scoreP1 = null;
      scoreP2 = null;
      updateBattleBar();
    }

    setGameSetupLocked(true);
    resetRound();
    running = true;

    const diffLabel = DIFFICULTY[committedDifficulty].label;
    if (committedGameMode === "battle") {
      const who = battleState === "p2" ? "玩家二" : "玩家一";
      elStatus.textContent = `進行中（對戰｜${who}｜${diffLabel}）：按住下放、放開收回，對準魚身。`;
    } else {
      elStatus.textContent = `進行中（${diffLabel}）：按住下放、放開收回，對準魚身。`;
    }
    refreshStartButton();
    syncPlayChrome();
  });

  btnReset.addEventListener("click", () => {
    running = false;
    battleState = null;
    scoreP1 = null;
    scoreP2 = null;
    updateBattleBar();
    setGameSetupLocked(false);
    resetRound();
    elStatus.textContent = "已重設。按「開始」開局。";
    refreshStartButton();
    syncPlayChrome();
  });

  btnEnterPlay.addEventListener("click", () => {
    elLobbyOverlay.classList.add("hidden");
    elLobbyOverlay.setAttribute("aria-hidden", "true");
    committedDifficulty = getDifficultyKey();
    committedGameMode = getGameModeKey();
    updatePlaySettingsSummary();
    syncBattleBarVisibility();
    updateBattleBar();
    syncTimeDisplay();
    refreshStartButton();
    resize();
    syncPlayChrome();
    window.requestAnimationFrame(() => {
      try {
        btnStart.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    });
  });

  btnBackLobby.addEventListener("click", () => {
    if (btnBackLobby.disabled) return;
    elLobbyOverlay.classList.remove("hidden");
    elLobbyOverlay.setAttribute("aria-hidden", "false");
    btnEnterPlay.focus({ preventScroll: true });
  });

  elDifficulty.addEventListener("change", () => {
    if (elDifficulty.disabled) {
      elDifficulty.value = committedDifficulty;
      return;
    }
    committedDifficulty = getDifficultyKey();
    syncTimeDisplay();
    updatePlaySettingsSummary();
  });

  elGameMode.addEventListener("change", () => {
    if (elGameMode.disabled) {
      elGameMode.value = committedGameMode;
      return;
    }
    committedGameMode = getGameModeKey();
    syncBattleBarVisibility();
    if (committedGameMode === "solo") {
      battleState = null;
      scoreP1 = null;
      scoreP2 = null;
      updateBattleBar();
    } else {
      updateBattleBar();
    }
    syncTimeDisplay();
    refreshStartButton();
    updatePlaySettingsSummary();
  });

  window.addEventListener("resize", () => {
    resize();
  });

  renderOverviewTables();
  committedDifficulty = getDifficultyKey();
  committedGameMode = getGameModeKey();
  syncBattleBarVisibility();
  updateBattleBar();
  syncTimeDisplay();
  updatePlaySettingsSummary();
  refreshStartButton();
  resize();
  resetRound();
  syncPlayChrome();
  requestAnimationFrame(tick);
})();
