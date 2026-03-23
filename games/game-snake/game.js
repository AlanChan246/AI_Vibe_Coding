(function () {
  "use strict";

  const COLS = 20;
  const ROWS = 20;
  const CELL = 20;
  const TICK_MS = 110;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const overlay = document.getElementById("overlay");
  const finalScoreEl = document.getElementById("final-score");
  const restartBtn = document.getElementById("restart-btn");

  /** @type {{ label: string, fill: string, stroke: string, score: number, draw: (c: CanvasRenderingContext2D, x: number, y: number, s: number) => void }[]} */
  const FRUIT_TYPES = [
    {
      label: "蘋果",
      fill: "#e53935",
      stroke: "#b71c1c",
      score: 10,
      draw(c, x, y, s) {
        c.fillStyle = this.fill;
        c.beginPath();
        c.arc(x + s * 0.5, y + s * 0.52, s * 0.38, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = this.stroke;
        c.lineWidth = 1;
        c.stroke();
        c.strokeStyle = "#33691e";
        c.beginPath();
        c.moveTo(x + s * 0.5, y + s * 0.18);
        c.quadraticCurveTo(x + s * 0.62, y + s * 0.08, x + s * 0.7, y + s * 0.22);
        c.stroke();
      },
    },
    {
      label: "橘子",
      fill: "#fb8c00",
      stroke: "#e65100",
      score: 10,
      draw(c, x, y, s) {
        c.fillStyle = this.fill;
        c.beginPath();
        c.arc(x + s * 0.5, y + s * 0.5, s * 0.4, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = this.stroke;
        c.lineWidth = 1;
        c.stroke();
        c.strokeStyle = "rgba(255,255,255,0.35)";
        c.beginPath();
        c.arc(x + s * 0.42, y + s * 0.42, s * 0.08, 0, Math.PI * 2);
        c.stroke();
      },
    },
    {
      label: "葡萄",
      fill: "#7b1fa2",
      stroke: "#4a148c",
      score: 15,
      draw(c, x, y, s) {
        const r = s * 0.16;
        const pts = [
          [0.35, 0.35],
          [0.65, 0.35],
          [0.5, 0.52],
          [0.28, 0.58],
          [0.72, 0.58],
        ];
        c.fillStyle = this.fill;
        pts.forEach(([px, py]) => {
          c.beginPath();
          c.arc(x + s * px, y + s * py, r, 0, Math.PI * 2);
          c.fill();
        });
        c.strokeStyle = this.stroke;
        c.lineWidth = 1;
        pts.forEach(([px, py]) => {
          c.beginPath();
          c.arc(x + s * px, y + s * py, r, 0, Math.PI * 2);
          c.stroke();
        });
      },
    },
    {
      label: "香蕉",
      fill: "#ffeb3b",
      stroke: "#f9a825",
      score: 12,
      draw(c, x, y, s) {
        c.fillStyle = this.fill;
        c.beginPath();
        c.moveTo(x + s * 0.22, y + s * 0.65);
        c.quadraticCurveTo(x + s * 0.5, y + s * 0.2, x + s * 0.78, y + s * 0.38);
        c.quadraticCurveTo(x + s * 0.55, y + s * 0.72, x + s * 0.22, y + s * 0.65);
        c.closePath();
        c.fill();
        c.strokeStyle = this.stroke;
        c.lineWidth = 1;
        c.stroke();
      },
    },
    {
      label: "西瓜",
      fill: "#2e7d32",
      stroke: "#1b5e20",
      score: 20,
      draw(c, x, y, s) {
        c.fillStyle = this.fill;
        c.beginPath();
        c.arc(x + s * 0.5, y + s * 0.55, s * 0.42, Math.PI * 0.05, Math.PI * 0.95, false);
        c.lineTo(x + s * 0.5, y + s * 0.55);
        c.closePath();
        c.fill();
        c.strokeStyle = this.stroke;
        c.lineWidth = 1;
        c.stroke();
        c.fillStyle = "#ff5252";
        c.beginPath();
        c.arc(x + s * 0.5, y + s * 0.52, s * 0.12, 0, Math.PI * 2);
        c.fill();
      },
    },
    {
      label: "草莓",
      fill: "#ec407a",
      stroke: "#ad1457",
      score: 15,
      draw(c, x, y, s) {
        c.fillStyle = this.fill;
        c.beginPath();
        c.moveTo(x + s * 0.5, y + s * 0.78);
        c.quadraticCurveTo(x + s * 0.22, y + s * 0.45, x + s * 0.5, y + s * 0.28);
        c.quadraticCurveTo(x + s * 0.78, y + s * 0.45, x + s * 0.5, y + s * 0.78);
        c.closePath();
        c.fill();
        c.strokeStyle = this.stroke;
        c.lineWidth = 1;
        c.stroke();
        c.fillStyle = "#fff";
        [[0.38, 0.48], [0.55, 0.42], [0.62, 0.55]].forEach(([px, py]) => {
          c.beginPath();
          c.arc(x + s * px, y + s * py, 1.2, 0, Math.PI * 2);
          c.fill();
        });
      },
    },
  ];

  let snake;
  let dir;
  let nextDir;
  /** @type {{ x: number, y: number, typeIndex: number } | null} */
  let fruit;
  let score;
  let gameOver;
  let hissPlayedThisGameOver;
  let tickTimer;

  let audioCtx = null;
  let audioPrimed = false;

  function getAudioContext() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    return audioCtx;
  }

  function primeAudio() {
    const ctx = getAudioContext();
    if (!ctx || audioPrimed) return;
    if (ctx.state === "suspended") {
      ctx.resume().then(function () {
        audioPrimed = true;
      });
    } else {
      audioPrimed = true;
    }
  }

  /**
   * Short band-limited noise burst — reads as a hiss, not a tone.
   */
  function playHiss() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const duration = 0.35;
    const sampleRate = ctx.sampleRate;
    const n = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, n, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.85;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 2800;
    bandpass.Q.value = 0.65;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 5200;

    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.42, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, t0 + duration);

    noise.connect(bandpass);
    bandpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);

    noise.start(t0);
    noise.stop(t0 + duration);
  }

  function triggerGameOver() {
    if (gameOver) return;
    gameOver = true;
    if (!hissPlayedThisGameOver) {
      hissPlayedThisGameOver = true;
      playHiss();
    }
    finalScoreEl.textContent = String(score);
    overlay.classList.remove("hidden");
  }

  function opposite(a, b) {
    return a.x === -b.x && a.y === -b.y;
  }

  function randomInt(max) {
    return Math.floor(Math.random() * max);
  }

  function cellKey(x, y) {
    return x + "," + y;
  }

  function spawnFruit() {
    const occupied = new Set();
    for (let i = 0; i < snake.length; i++) {
      occupied.add(cellKey(snake[i].x, snake[i].y));
    }
    const empty = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!occupied.has(cellKey(x, y))) empty.push({ x, y });
      }
    }
    if (empty.length === 0) {
      fruit = null;
      return;
    }
    const spot = empty[randomInt(empty.length)];
    fruit = {
      x: spot.x,
      y: spot.y,
      typeIndex: randomInt(FRUIT_TYPES.length),
    };
  }

  function resetGame() {
    gameOver = false;
    hissPlayedThisGameOver = false;
    score = 0;
    scoreEl.textContent = "0";
    overlay.classList.add("hidden");

    const midX = Math.floor(COLS / 2);
    const midY = Math.floor(ROWS / 2);
    snake = [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY },
    ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    spawnFruit();
  }

  function applyBufferedDirection() {
    if (nextDir.x === 0 && nextDir.y === 0) return;
    if (!opposite(nextDir, dir)) {
      dir = { x: nextDir.x, y: nextDir.y };
    }
  }

  function tick() {
    if (gameOver) return;

    applyBufferedDirection();

    const head = snake[0];
    const nx = head.x + dir.x;
    const ny = head.y + dir.y;

    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      triggerGameOver();
      return;
    }

    for (let i = 0; i < snake.length; i++) {
      if (snake[i].x === nx && snake[i].y === ny) {
        triggerGameOver();
        return;
      }
    }

    const newHead = { x: nx, y: ny };
    snake.unshift(newHead);

    let ate = false;
    if (fruit && fruit.x === nx && fruit.y === ny) {
      const ft = FRUIT_TYPES[fruit.typeIndex];
      score += ft.score;
      scoreEl.textContent = String(score);
      ate = true;
      spawnFruit();
    }

    if (!ate) {
      snake.pop();
    }
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, ROWS * CELL);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(COLS * CELL, y * CELL);
      ctx.stroke();
    }
  }

  function drawSnake() {
    for (let i = snake.length - 1; i >= 0; i--) {
      const seg = snake[i];
      const px = seg.x * CELL;
      const py = seg.y * CELL;
      const pad = i === 0 ? 2 : 3;
      const w = CELL - pad * 2;
      const r = i === 0 ? 5 : 4;

      const g = ctx.createLinearGradient(px, py, px + CELL, py + CELL);
      if (i === 0) {
        g.addColorStop(0, "#81c784");
        g.addColorStop(1, "#2e7d32");
      } else {
        const t = i / Math.max(snake.length - 1, 1);
        g.addColorStop(0, `rgb(${Math.round(100 + t * 40)}, ${Math.round(160 - t * 30)}, ${Math.round(90 - t * 20)})`);
        g.addColorStop(1, "#1b5e20");
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      const x0 = px + pad;
      const y0 = py + pad;
      ctx.roundRect(x0, y0, w, w, r);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      if (i === 0) {
        ctx.fillStyle = "#1b1b1b";
        const ex = dir.x === 1 ? 0.65 : dir.x === -1 ? 0.28 : 0.48;
        const ey = dir.y === 1 ? 0.65 : dir.y === -1 ? 0.28 : 0.48;
        ctx.beginPath();
        ctx.arc(px + CELL * ex, py + CELL * 0.42, 2.2, 0, Math.PI * 2);
        ctx.arc(px + CELL * (ex + (dir.x !== 0 ? 0 : 0.14)), py + CELL * (dir.y !== 0 ? 0.42 : 0.52), 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawFruit() {
    if (!fruit) return;
    const ft = FRUIT_TYPES[fruit.typeIndex];
    const px = fruit.x * CELL;
    const py = fruit.y * CELL;
    ft.draw(ctx, px, py, CELL);
  }

  function render() {
    ctx.fillStyle = "#1b3d1f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawFruit();
    drawSnake();
  }

  function loop() {
    render();
    requestAnimationFrame(loop);
  }

  const KEY_MAP = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 },
    W: { x: 0, y: -1 },
    s: { x: 0, y: 1 },
    S: { x: 0, y: 1 },
    a: { x: -1, y: 0 },
    A: { x: -1, y: 0 },
    d: { x: 1, y: 0 },
    D: { x: 1, y: 0 },
  };

  window.addEventListener("keydown", function (e) {
    primeAudio();

    if (e.code === "Space") {
      e.preventDefault();
      if (gameOver) {
        resetGame();
      }
      return;
    }

    const d = KEY_MAP[e.key];
    if (!d) return;
    e.preventDefault();
    nextDir = { x: d.x, y: d.y };
  });

  restartBtn.addEventListener("click", function () {
    primeAudio();
    if (gameOver) resetGame();
  });

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const rad = Math.min(r, w / 2, h / 2);
      this.moveTo(x + rad, y);
      this.arcTo(x + w, y, x + w, y + h, rad);
      this.arcTo(x + w, y + h, x, y + h, rad);
      this.arcTo(x, y + h, x, y, rad);
      this.arcTo(x, y, x + w, y, rad);
      this.closePath();
    };
  }

  resetGame();
  tickTimer = setInterval(tick, TICK_MS);
  requestAnimationFrame(loop);
})();
