(function () {
  "use strict";

  const SIZE = 10;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;

  const CENTER = Math.floor((SIZE - 1) / 2);

  const DIRS = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  const DIFFICULTIES = ["easy", "normal", "hard"];
  const STORAGE_KEY = "gomoku-stats-v1";

  /** 十路棋盤：天元＋四星 */
  const STAR_KEYS = new Set([
    idx(2, 2),
    idx(2, 7),
    idx(CENTER, CENTER),
    idx(7, 2),
    idx(7, 7),
  ]);

  function idx(r, c) {
    return r * SIZE + c;
  }

  function inBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  function createBoard() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
  }

  function cloneBoard(board) {
    return board.map((row) => row.slice());
  }

  function countLine(board, r, c, dr, dc, color) {
    let n = 0;
    let rr = r + dr;
    let cc = c + dc;
    while (inBounds(rr, cc) && board[rr][cc] === color) {
      n++;
      rr += dr;
      cc += dc;
    }
    rr = r - dr;
    cc = c - dc;
    while (inBounds(rr, cc) && board[rr][cc] === color) {
      n++;
      rr -= dr;
      cc -= dc;
    }
    return n + 1;
  }

  function checkWinFrom(board, r, c, color) {
    for (const [dr, dc] of DIRS) {
      if (countLine(board, r, c, dr, dc, color) >= 5) return true;
    }
    return false;
  }

  function isBoardFull(board) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === EMPTY) return false;
      }
    }
    return true;
  }

  /**
   * Empty cells inside the bounding box of all stones expanded by 2 (Chebyshev padding).
   * Covers bridging plays between clusters; falls back to center on empty board.
   */
  function getCandidateMoves(board) {
    let minR = SIZE;
    let maxR = -1;
    let minC = SIZE;
    let maxC = -1;
    let found = false;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === EMPTY) continue;
        found = true;
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
    if (!found) return [[CENTER, CENTER]];
    minR = Math.max(0, minR - 2);
    maxR = Math.min(SIZE - 1, maxR + 2);
    minC = Math.max(0, minC - 2);
    maxC = Math.min(SIZE - 1, maxC + 2);
    const out = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (board[r][c] === EMPTY) out.push([r, c]);
      }
    }
    return out.length > 0 ? out : allEmptyMoves(board);
  }

  function allEmptyMoves(board) {
    const out = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === EMPTY) out.push([r, c]);
      }
    }
    return out;
  }

  function findWinningMove(board, color) {
    const cands = getCandidateMoves(board);
    for (const [r, c] of cands) {
      if (board[r][c] !== EMPTY) continue;
      board[r][c] = color;
      const w = checkWinFrom(board, r, c, color);
      board[r][c] = EMPTY;
      if (w) return [r, c];
    }
    return null;
  }

  function lineEnds(board, r, c, dr, dc, color) {
    let len = 1;
    let rr = r + dr;
    let cc = c + dc;
    while (inBounds(rr, cc) && board[rr][cc] === color) {
      len++;
      rr += dr;
      cc += dc;
    }
    const beyondA = inBounds(rr, cc) ? board[rr][cc] : -1;
    rr = r - dr;
    cc = c - dc;
    while (inBounds(rr, cc) && board[rr][cc] === color) {
      len++;
      rr -= dr;
      cc -= dc;
    }
    const beyondB = inBounds(rr, cc) ? board[rr][cc] : -1;
    const openA = beyondA === EMPTY;
    const openB = beyondB === EMPTY;
    return { len, openA, openB };
  }

  function directionThreatScore({ len, openA, openB }) {
    const openEnds = (openA ? 1 : 0) + (openB ? 1 : 0);
    if (len >= 5) return 1_000_000;
    if (len === 4) {
      if (openA && openB) return 80_000;
      if (openEnds === 1) return 9_000;
      return 400;
    }
    if (len === 3) {
      if (openA && openB) return 2_200;
      if (openEnds === 1) return 280;
      return 40;
    }
    if (len === 2) {
      if (openA && openB) return 90;
      if (openEnds === 1) return 18;
      return 3;
    }
    return openEnds > 0 ? 2 : 0;
  }

  /** Score if `color` places at (r,c); board must have EMPTY at (r,c). */
  function scoreMoveAt(board, r, c, color) {
    board[r][c] = color;
    let s = 0;
    for (const [dr, dc] of DIRS) {
      s += directionThreatScore(lineEnds(board, r, c, dr, dc, color));
    }
    board[r][c] = EMPTY;
    return s;
  }

  function evaluatePositionFor(board, color) {
    const cands = getCandidateMoves(board);
    let own = 0;
    let opp = other(color);
    for (const [r, c] of cands) {
      if (board[r][c] !== EMPTY) continue;
      own += scoreMoveAt(board, r, c, color) * 0.35;
      own -= scoreMoveAt(board, r, c, opp) * 0.32;
    }
    return own;
  }

  function other(color) {
    return color === BLACK ? WHITE : BLACK;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function chooseMoveEasy(board, color) {
    let moves = getCandidateMoves(board);
    if (moves.length === 0) moves = allEmptyMoves(board);
    shuffle(moves);
    const near = moves.filter(([r, c]) => {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (inBounds(nr, nc) && board[nr][nc] !== EMPTY) return true;
        }
      }
      return false;
    });
    const pool = near.length > 0 ? near : moves;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function chooseMoveNormal(board, color) {
    const opp = other(color);
    const win = findWinningMove(board, color);
    if (win) return win;
    const block = findWinningMove(board, opp);
    if (block) return block;

    let moves = getCandidateMoves(board);
    if (moves.length === 0) moves = allEmptyMoves(board);
    shuffle(moves);

    let best = -Infinity;
    const scored = [];
    for (const [r, c] of moves) {
      if (board[r][c] !== EMPTY) continue;
      const attack = scoreMoveAt(board, r, c, color);
      const defend = scoreMoveAt(board, r, c, opp);
      const noise = Math.random() * 85;
      const s = attack * 1.05 + defend * 0.98 + noise;
      scored.push({ r, c, s });
      if (s > best) best = s;
    }
    const top = scored.filter((x) => x.s >= best - 120);
    const pick = top[Math.floor(Math.random() * top.length)];
    return [pick.r, pick.c];
  }

  function gameOverScore(board, lastR, lastC, lastColor) {
    if (lastR < 0) return null;
    if (checkWinFrom(board, lastR, lastC, lastColor)) {
      return lastColor === WHITE ? 1_000_000 : -1_000_000;
    }
    if (isBoardFull(board)) return 0;
    return null;
  }

  function minimax(board, depth, alpha, beta, maximizing, aiColor, lastMove) {
    const opp = other(aiColor);
    const terminal = gameOverScore(board, lastMove.r, lastMove.c, lastMove.color);
    if (terminal !== null) return terminal;
    if (depth === 0) {
      return evaluatePositionFor(board, aiColor);
    }

    const toPlay = maximizing ? aiColor : opp;
    const moves = getCandidateMoves(board);
    shuffle(moves);

    if (maximizing) {
      let maxEval = -Infinity;
      for (const [r, c] of moves) {
        if (board[r][c] !== EMPTY) continue;
        board[r][c] = toPlay;
        const quick = checkWinFrom(board, r, c, toPlay);
        const ev = quick
          ? 1_000_000
          : minimax(board, depth - 1, alpha, beta, false, aiColor, { r, c, color: toPlay });
        board[r][c] = EMPTY;
        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    }

    let minEval = Infinity;
    for (const [r, c] of moves) {
      if (board[r][c] !== EMPTY) continue;
      board[r][c] = toPlay;
      const quick = checkWinFrom(board, r, c, toPlay);
      const ev = quick
        ? -1_000_000
        : minimax(board, depth - 1, alpha, beta, true, aiColor, { r, c, color: toPlay });
      board[r][c] = EMPTY;
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) break;
    }
    return minEval;
  }

  function chooseMoveHard(board, color) {
    const opp = other(color);
    const win = findWinningMove(board, color);
    if (win) return win;
    const block = findWinningMove(board, opp);
    if (block) return block;

    let moves = getCandidateMoves(board);
    if (moves.length === 0) moves = allEmptyMoves(board);
    shuffle(moves);

    const depth = 3;
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const [r, c] of moves) {
      if (board[r][c] !== EMPTY) continue;
      board[r][c] = color;
      const instant = checkWinFrom(board, r, c, color);
      let sc;
      if (instant) sc = 1_000_000;
      else {
        sc = minimax(board, depth - 1, -Infinity, Infinity, false, color, {
          r,
          c,
          color,
        });
      }
      board[r][c] = EMPTY;

      if (sc > bestScore) {
        bestScore = sc;
        bestMoves = [[r, c]];
      } else if (sc === bestScore) {
        bestMoves.push([r, c]);
      }
    }

    if (bestMoves.length === 0) return chooseMoveNormal(board, color);
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  function chooseMove(board, color, difficulty) {
    if (difficulty === "easy") return chooseMoveEasy(board, color);
    if (difficulty === "hard") return chooseMoveHard(board, color);
    return chooseMoveNormal(board, color);
  }

  /* ---------- Stats ---------- */
  function defaultStats() {
    const o = {};
    for (const d of DIFFICULTIES) o[d] = { w: 0, l: 0, d: 0 };
    return o;
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultStats();
      const p = JSON.parse(raw);
      const base = defaultStats();
      for (const d of DIFFICULTIES) {
        if (p[d] && typeof p[d] === "object") {
          base[d].w = Number(p[d].w) || 0;
          base[d].l = Number(p[d].l) || 0;
          base[d].d = Number(p[d].d) || 0;
        }
      }
      return base;
    } catch {
      return defaultStats();
    }
  }

  function saveStats(stats) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }

  /* ---------- UI / Game loop ---------- */
  const els = {
    board: document.getElementById("board"),
    difficulty: document.getElementById("difficulty"),
    btnNew: document.getElementById("btn-new"),
    btnClear: document.getElementById("btn-clear-stats"),
    turnLabel: document.getElementById("turn-label"),
    thinkLabel: document.getElementById("think-label"),
    statsGrid: document.getElementById("stats-grid"),
    overlay: document.getElementById("overlay"),
    overlayCry: document.getElementById("overlay-cry"),
    overlayMsg: document.getElementById("overlay-msg"),
    btnAgain: document.getElementById("btn-again"),
  };

  let board = createBoard();
  let currentTurn = BLACK;
  let gameOver = false;
  let lastMove = { r: -1, c: -1 };
  /** Difficulty locked for current match (from select at game start / new game). */
  let activeDifficulty = els.difficulty.value;
  let stats = loadStats();
  let thinking = false;

  const labels = { easy: "簡單", normal: "普通", hard: "困難" };

  function renderStats() {
    els.statsGrid.innerHTML = "";
    for (const d of DIFFICULTIES) {
      const s = stats[d];
      const card = document.createElement("div");
      card.className = "stat-card";
      card.innerHTML = `<strong>${labels[d]}</strong>勝 ${s.w}　負 ${s.l}　和 ${s.d}`;
      els.statsGrid.appendChild(card);
    }
    const total = DIFFICULTIES.reduce(
      (acc, d) => {
        acc.w += stats[d].w;
        acc.l += stats[d].l;
        acc.d += stats[d].d;
        return acc;
      },
      { w: 0, l: 0, d: 0 }
    );
    const sum = document.createElement("div");
    sum.className = "stat-card";
    sum.innerHTML = `<strong>總計</strong>勝 ${total.w}　負 ${total.l}　和 ${total.d}`;
    els.statsGrid.appendChild(sum);
  }

  function setTurnLabel() {
    if (gameOver) {
      els.turnLabel.textContent = "對局已結束";
      return;
    }
    if (currentTurn === BLACK) els.turnLabel.textContent = "輪到：星星（你）";
    else els.turnLabel.textContent = "輪到：月亮（電腦）";
  }

  function setThinking(on) {
    thinking = on;
    els.thinkLabel.classList.toggle("hidden", !on);
    els.thinkLabel.setAttribute("aria-hidden", on ? "false" : "true");
  }

  function cellKey(r, c) {
    return `cell-${r}-${c}`;
  }

  function buildBoardDom() {
    els.board.innerHTML = "";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.id = cellKey(r, c);
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.setAttribute("role", "gridcell");
        if (STAR_KEYS.has(idx(r, c))) {
          const star = document.createElement("span");
          star.className = "star";
          cell.appendChild(star);
        }
        cell.addEventListener("click", () => onCellClick(r, c));
        els.board.appendChild(cell);
      }
    }
  }

  function paintCell(r, c) {
    const cell = document.getElementById(cellKey(r, c));
    if (!cell) return;
    cell.classList.remove("last-move");
    cell.innerHTML = "";
    if (STAR_KEYS.has(idx(r, c))) {
      const star = document.createElement("span");
      star.className = "star";
      cell.appendChild(star);
    }
    const v = board[r][c];
    if (v === EMPTY) return;
    const stone = document.createElement("span");
    stone.className = "stone " + (v === BLACK ? "black" : "white");
    cell.appendChild(stone);
  }

  function highlightLast(r, c) {
    document.querySelectorAll(".cell.last-move").forEach((el) => el.classList.remove("last-move"));
    if (r >= 0 && c >= 0) {
      const cell = document.getElementById(cellKey(r, c));
      if (cell) cell.classList.add("last-move");
    }
  }

  function refreshBoard() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        paintCell(r, c);
      }
    }
    highlightLast(lastMove.r, lastMove.c);
    updateCellsDisabled();
  }

  function updateCellsDisabled() {
    const disabled = gameOver || thinking || currentTurn !== BLACK;
    document.querySelectorAll(".cell").forEach((cell) => {
      cell.classList.toggle("disabled", disabled);
      cell.disabled = disabled;
    });
  }

  function endGame(result) {
    gameOver = true;
    const d = activeDifficulty;
    if (result === "win") stats[d].w++;
    else if (result === "lose") stats[d].l++;
    else stats[d].d++;
    saveStats(stats);
    renderStats();

    let msg = "";
    if (result === "win") msg = "你獲勝！";
    else if (result === "lose") msg = "電腦獲勝。";
    else msg = "和棋。";

    els.overlayMsg.textContent = `${msg}（${labels[d]}）`;

    if (result === "lose") {
      els.overlayCry.classList.remove("hidden");
      els.overlayCry.setAttribute("aria-hidden", "false");
      els.overlayCry.classList.remove("modal-cry-animate");
      void els.overlayCry.offsetWidth;
      els.overlayCry.classList.add("modal-cry-animate");
    } else {
      els.overlayCry.classList.add("hidden");
      els.overlayCry.setAttribute("aria-hidden", "true");
      els.overlayCry.classList.remove("modal-cry-animate");
    }

    els.overlay.classList.remove("hidden");
    setTurnLabel();
    updateCellsDisabled();
  }

  function onCellClick(r, c) {
    if (gameOver || thinking || currentTurn !== BLACK) return;
    if (board[r][c] !== EMPTY) return;

    board[r][c] = BLACK;
    lastMove = { r, c };
    paintCell(r, c);
    highlightLast(r, c);

    if (checkWinFrom(board, r, c, BLACK)) {
      endGame("win");
      return;
    }
    if (isBoardFull(board)) {
      endGame("draw");
      return;
    }

    currentTurn = WHITE;
    setTurnLabel();
    updateCellsDisabled();

    setThinking(true);
    window.setTimeout(() => {
      const [ar, ac] = chooseMove(board, WHITE, activeDifficulty);
      board[ar][ac] = WHITE;
      lastMove = { r: ar, c: ac };
      refreshBoard();

      if (checkWinFrom(board, ar, ac, WHITE)) {
        setThinking(false);
        endGame("lose");
        return;
      }
      if (isBoardFull(board)) {
        setThinking(false);
        endGame("draw");
        return;
      }

      currentTurn = BLACK;
      setThinking(false);
      setTurnLabel();
      updateCellsDisabled();
    }, 280);
  }

  function newGame() {
    activeDifficulty = els.difficulty.value;
    board = createBoard();
    currentTurn = BLACK;
    gameOver = false;
    lastMove = { r: -1, c: -1 };
    thinking = false;
    setThinking(false);
    els.overlay.classList.add("hidden");
    els.overlayCry.classList.add("hidden");
    els.overlayCry.setAttribute("aria-hidden", "true");
    els.overlayCry.classList.remove("modal-cry-animate");
    refreshBoard();
    setTurnLabel();
  }

  els.btnNew.addEventListener("click", newGame);
  els.btnAgain.addEventListener("click", newGame);
  els.btnClear.addEventListener("click", () => {
    if (!window.confirm("確定要清除所有難度的戰績？此操作無法復原。")) return;
    stats = defaultStats();
    saveStats(stats);
    renderStats();
  });

  buildBoardDom();
  renderStats();
  newGame();
})();
