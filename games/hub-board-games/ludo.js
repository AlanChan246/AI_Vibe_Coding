/**
 * 飛行棋 — 簡化規則、可本地四人輪流或 1 人 + 3 電腦
 */
(function () {
  "use strict";

  const MAIN_LEN = 52;
  const START = [0, 13, 26, 39];
  const PLAYER_NAMES = ["紅", "藍", "黃", "綠"];
  const PLAYER_COLORS = ["#e11d48", "#2563eb", "#eab308", "#16a34a"];
  const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 46]);

  function beforeHome(p) {
    return (START[p] - 1 + MAIN_LEN) % MAIN_LEN;
  }

  function createPiece() {
    return {
      hangar: true,
      track: 0,
      mainSteps: 0,
      home: null,
    };
  }

  function clonePiece(p) {
    return {
      hangar: p.hangar,
      track: p.track,
      mainSteps: p.mainSteps,
      home: p.home,
    };
  }

  function canLaunchFromHangar(dice) {
    return dice % 2 === 0;
  }

  function simulateMove(piece, player, dice) {
    if (piece.hangar) {
      if (!canLaunchFromHangar(dice)) return null;
      return {
        hangar: false,
        track: START[player],
        mainSteps: 0,
        home: null,
      };
    }
    if (piece.home !== null && piece.home < 5) {
      if (piece.home + dice > 5) return null;
      const nh = piece.home + dice;
      return {
        hangar: false,
        track: piece.track,
        mainSteps: piece.mainSteps,
        home: nh,
      };
    }
    if (piece.home === 5) return null;

    let track = piece.track;
    let mainSteps = piece.mainSteps;
    let home = piece.home;
    let left = dice;

    while (left > 0) {
      const bh = beforeHome(player);
      if (mainSteps >= MAIN_LEN && track === bh && home === null) {
        home = 0;
        left--;
        continue;
      }
      if (home !== null && home < 5) {
        if (home + left > 5) return null;
        home += left;
        left = 0;
        break;
      }
      track = (track + 1) % MAIN_LEN;
      mainSteps++;
      left--;
    }

    return {
      hangar: false,
      track,
      mainSteps,
      home: home === null ? null : home,
    };
  }

  function isDone(p) {
    return p.hangar === false && p.home === 5;
  }

  function countDone(playerPieces) {
    return playerPieces.filter(isDone).length;
  }

  function applyMove(state, player, pieceIdx, dice) {
    const piece = state[player][pieceIdx];
    const next = simulateMove(piece, player, dice);
    if (!next) return null;

    const newState = state.map((row, pi) =>
      row.map((pc, idx) => {
        if (pi === player && idx === pieceIdx) return next;
        return clonePiece(pc);
      })
    );

    if (!next.hangar && next.home === null) {
      const cell = next.track;
      if (!SAFE.has(cell)) {
        for (let pl = 0; pl < 4; pl++) {
          if (pl === player) continue;
          for (let k = 0; k < 4; k++) {
            const op = newState[pl][k];
            if (!op.hangar && op.home === null && op.track === cell) {
              newState[pl][k] = createPiece();
            }
          }
        }
      }
    }

    return newState;
  }

  function listValidMoves(state, player, dice) {
    const out = [];
    for (let i = 0; i < 4; i++) {
      if (simulateMove(state[player][i], player, dice)) out.push(i);
    }
    return out;
  }

  /* --- Canvas layout --- */
  const canvas = document.getElementById("ludo-canvas");
  const ctx = canvas.getContext("2d");
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const W = 560;
  const H = 560;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.scale(DPR, DPR);

  const cx = W / 2;
  const cy = H / 2;
  const rx = 228;
  const ry = 228;

  const pathXY = [];
  for (let i = 0; i < MAIN_LEN; i++) {
    const t = (i / MAIN_LEN) * Math.PI * 2 - Math.PI / 2;
    pathXY.push({
      x: cx + rx * Math.cos(t),
      y: cy + ry * Math.sin(t),
    });
  }

  function hangarSlot(player, index) {
    const corners = [
      { x: 56, y: H - 56 },
      { x: W - 56, y: H - 56 },
      { x: W - 56, y: 56 },
      { x: 56, y: 56 },
    ];
    const c = corners[player];
    const ox = (index % 2) * 34 - 17;
    const oy = Math.floor(index / 2) * 34 - 17;
    return { x: c.x + ox, y: c.y + oy };
  }

  function homeSlot(player, index) {
    const inner = 0.42;
    const sx = cx + (pathXY[START[player]].x - cx) * inner;
    const sy = cy + (pathXY[START[player]].y - cy) * inner;
    const tx = cx;
    const ty = cy;
    const t = (index + 1) / 6;
    return {
      x: sx + (tx - sx) * t,
      y: sy + (ty - sy) * t,
    };
  }

  function pieceXY(player, pieceIdx, state) {
    const p = state[player][pieceIdx];
    if (p.hangar) return hangarSlot(player, pieceIdx);
    if (p.home !== null && p.home < 5) return homeSlot(player, p.home);
    if (p.home === 5) {
      const j = player * 4 + pieceIdx;
      const a = (j / 16) * Math.PI * 2;
      return { x: cx + Math.cos(a) * 18, y: cy + Math.sin(a) * 18 };
    }
    const pt = pathXY[p.track];
    const stack = state[player].filter(
      (q) => !q.hangar && q.home === null && q.track === p.track
    ).length;
    const idxInStack = state[player]
      .slice(0, pieceIdx + 1)
      .filter((q) => !q.hangar && q.home === null && q.track === p.track).length;
    const off = (idxInStack - (stack + 1) / 2) * 7;
    return { x: pt.x + off, y: pt.y - 4 };
  }

  let state = null;
  let mode = "ai3";
  let currentPlayer = 0;
  let lastDice = null;
  let rolled = false;
  let validPieceIndices = [];
  let selectedPiece = null;
  let message = "";
  let logLines = [];
  let sixChain = 0;
  let gameOver = false;
  let winner = null;

  function humanPlayer(p) {
    if (mode === "human4") return true;
    if (mode === "ai3") return p === 0;
    return true;
  }

  function resetGame() {
    state = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => createPiece())
    );
    currentPlayer = 0;
    lastDice = null;
    rolled = false;
    validPieceIndices = [];
    selectedPiece = null;
    message = "擲骰子開始。";
    logLines = [];
    sixChain = 0;
    gameOver = false;
    winner = null;
    pushLog("新局開始。");
    draw();
  }

  function pushLog(line) {
    logLines.unshift(line);
    if (logLines.length > 14) logLines.pop();
    const el = document.getElementById("ludo-log");
    if (el) el.innerHTML = logLines.map((l) => `<p>${l}</p>`).join("");
  }

  function checkWinner(st) {
    for (let p = 0; p < 4; p++) {
      if (countDone(st[p]) === 4) return p;
    }
    return null;
  }

  function endTurn() {
    rolled = false;
    lastDice = null;
    validPieceIndices = [];
    selectedPiece = null;
    sixChain = 0;
    currentPlayer = (currentPlayer + 1) % 4;
    message = `${PLAYER_NAMES[currentPlayer]}方擲骰。`;
    draw();
    maybeAiTurn();
  }

  function afterMoveApplied(newState, pieceIdx, dice) {
    state = newState;
    const w = checkWinner(state);
    if (w !== null) {
      gameOver = true;
      winner = w;
      message = `🎉 ${PLAYER_NAMES[w]}方勝利！`;
      pushLog(message);
      showOverlay();
      draw();
      return;
    }

    const gotSix = dice === 6;
    if (gotSix) {
      sixChain++;
      if (sixChain >= 3) {
        pushLog(`${PLAYER_NAMES[currentPlayer]}方連續三個 6，暫停一輪。`);
        sixChain = 0;
        endTurn();
        return;
      }
      rolled = false;
      lastDice = null;
      message = `${PLAYER_NAMES[currentPlayer]}方再擲一次（已連 ${sixChain} 個 6）。`;
      pushLog(`${PLAYER_NAMES[currentPlayer]} 擲到 6，再擲。`);
      draw();
      maybeAiTurn();
      return;
    }

    sixChain = 0;
    endTurn();
  }

  function tryMovePiece(pieceIdx) {
    if (gameOver || !rolled || !validPieceIndices.includes(pieceIdx)) return;
    const dice = lastDice;
    const ns = applyMove(state, currentPlayer, pieceIdx, dice);
    if (!ns) return;
    pushLog(
      `${PLAYER_NAMES[currentPlayer]} 移動第 ${pieceIdx + 1} 子（點數 ${dice}）。`
    );
    afterMoveApplied(ns, pieceIdx, dice);
  }

  function rollDice() {
    if (gameOver) return;
    if (rolled) return;
    const dice = 1 + Math.floor(Math.random() * 6);
    lastDice = dice;
    const valid = listValidMoves(state, currentPlayer, dice);
    rolled = true;
    validPieceIndices = valid;
    selectedPiece = null;

    document.getElementById("dice-face").textContent = String(dice);
    pushLog(`${PLAYER_NAMES[currentPlayer]} 擲出 ${dice}。`);

    if (valid.length === 0) {
      message = `${PLAYER_NAMES[currentPlayer]} 無可走步，換下家。`;
      pushLog(message);
      rolled = false;
      lastDice = null;
      sixChain = 0;
      currentPlayer = (currentPlayer + 1) % 4;
      message = `${PLAYER_NAMES[currentPlayer]}方擲骰。`;
      draw();
      maybeAiTurn();
      return;
    }

    message = `${PLAYER_NAMES[currentPlayer]} 請點選要移動的飛機（高亮可選）。`;
    draw();
  }

  function maybeAiTurn() {
    if (gameOver) return;
    if (humanPlayer(currentPlayer)) return;

    const btn = document.getElementById("btn-roll");
    if (btn) btn.disabled = true;

    setTimeout(() => {
      if (gameOver) return;
      if (!rolled) {
        rollDiceAi();
      } else {
        const choices = validPieceIndices;
        if (choices.length) {
          const pick = choices[Math.floor(Math.random() * choices.length)];
          tryMovePiece(pick);
        }
      }
      if (btn) btn.disabled = false;
    }, 520);
  }

  function rollDiceAi() {
    if (gameOver || humanPlayer(currentPlayer)) return;
    const dice = 1 + Math.floor(Math.random() * 6);
    lastDice = dice;
    const valid = listValidMoves(state, currentPlayer, dice);
    rolled = true;
    validPieceIndices = valid;
    document.getElementById("dice-face").textContent = String(dice);
    pushLog(`${PLAYER_NAMES[currentPlayer]}（電腦）擲出 ${dice}。`);

    if (valid.length === 0) {
      message = `${PLAYER_NAMES[currentPlayer]} 無可走步。`;
      rolled = false;
      lastDice = null;
      sixChain = 0;
      currentPlayer = (currentPlayer + 1) % 4;
      message = `${PLAYER_NAMES[currentPlayer]}方擲骰。`;
      draw();
      maybeAiTurn();
      return;
    }

    const pick = valid[Math.floor(Math.random() * valid.length)];
    const ns = applyMove(state, currentPlayer, pick, dice);
    if (ns) {
      pushLog(`${PLAYER_NAMES[currentPlayer]}（電腦）移動第 ${pick + 1} 子。`);
      afterMoveApplied(ns, pick, dice);
    }
    draw();
  }

  function hitTest(mx, my) {
    for (let pi = 0; pi < 4; pi++) {
      for (let k = 0; k < 4; k++) {
        const { x, y } = pieceXY(pi, k, state);
        const dx = mx - x;
        const dy = my - y;
        if (dx * dx + dy * dy < 18 * 18) return { player: pi, piece: k };
      }
    }
    return null;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0c1220";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < MAIN_LEN; i++) {
      const { x, y } = pathXY[i];
      ctx.beginPath();
      ctx.arc(x, y, SAFE.has(i) ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = SAFE.has(i)
        ? "rgba(250,204,21,0.25)"
        : "rgba(255,255,255,0.12)";
      ctx.fill();
      ctx.stroke();
    }

    for (let p = 0; p < 4; p++) {
      const s = START[p];
      const { x, y } = pathXY[s];
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = PLAYER_COLORS[p];
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = PLAYER_COLORS[p];
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 36, 0, Math.PI * 2);
    ctx.stroke();

    for (let p = 0; p < 4; p++) {
      for (let k = 0; k < 4; k++) {
        const { x, y } = hangarSlot(p, k);
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.strokeRect(x - 14, y - 14, 28, 28);
      }
    }

    for (let p = 0; p < 4; p++) {
      for (let k = 0; k < 4; k++) {
        const { x, y } = pieceXY(p, k, state);
        const hi =
          rolled &&
          p === currentPlayer &&
          validPieceIndices.includes(k) &&
          (selectedPiece === k || selectedPiece === null);
        ctx.beginPath();
        ctx.arc(x, y, 13, 0, Math.PI * 2);
        ctx.fillStyle = PLAYER_COLORS[p];
        ctx.fill();
        if (hi) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 3;
          ctx.stroke();
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.35)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "bold 11px Segoe UI, PingFang TC, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(k + 1), x, y);
      }
    }

    const st = document.getElementById("ludo-status");
    if (st) {
      st.innerHTML = gameOver
        ? `<strong>遊戲結束</strong> — ${PLAYER_NAMES[winner]}方獲勝`
        : `${message}`;
    }

    const rollBtn = document.getElementById("btn-roll");
    if (rollBtn) {
      const human = humanPlayer(currentPlayer);
      rollBtn.disabled = gameOver || (rolled && validPieceIndices.length > 0) || !human;
    }
  }

  function showOverlay() {
    const o = document.getElementById("ludo-overlay");
    const t = document.getElementById("overlay-winner");
    if (o && t) {
      t.textContent = `${PLAYER_NAMES[winner]}方把所有飛機都飛進終點了！`;
      o.classList.remove("hidden");
    }
  }

  function hideOverlay() {
    const o = document.getElementById("ludo-overlay");
    if (o) o.classList.add("hidden");
  }

  canvas.addEventListener("click", (e) => {
    if (gameOver) return;
    if (!humanPlayer(currentPlayer)) return;
    const r = canvas.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W;
    const my = ((e.clientY - r.top) / r.height) * H;
    const hit = hitTest(mx, my);
    if (!hit || hit.player !== currentPlayer) return;
    if (!rolled || !validPieceIndices.includes(hit.piece)) return;
    selectedPiece = hit.piece;
    draw();
    tryMovePiece(hit.piece);
  });

  document.getElementById("btn-roll").addEventListener("click", () => {
    if (!humanPlayer(currentPlayer)) return;
    rollDice();
  });

  document.getElementById("btn-new").addEventListener("click", () => {
    hideOverlay();
    resetGame();
    maybeAiTurn();
  });

  document.getElementById("btn-again").addEventListener("click", () => {
    hideOverlay();
    resetGame();
    maybeAiTurn();
  });

  document.getElementById("mode-select").addEventListener("change", (e) => {
    mode = e.target.value;
    resetGame();
    maybeAiTurn();
  });

  resetGame();
  maybeAiTurn();
})();
