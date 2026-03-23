(function () {
  "use strict";

  const N = 15;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;
  const DIRS = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  function statsStorageKey() {
    const id =
      typeof window.getArcadeStatsKey === "function"
        ? window.getArcadeStatsKey()
        : "anon";
    return "gomoku15-stats-" + id;
  }

  (function migrateLegacyGomokuStats() {
    try {
      const legacy = localStorage.getItem("gomoku15-stats");
      if (!legacy) return;
      const nk = "gomoku15-stats-anon";
      if (!localStorage.getItem(nk)) {
        localStorage.setItem(nk, legacy);
      }
    } catch {
      /* ignore */
    }
  })();

  /** @type {number[]} */
  let board = emptyBoard();
  let currentTurn = BLACK;
  let gameOver = false;
  let lastMove = null;
  let inputLocked = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let aiTimer = null;
  /** @type {{ board: number[]; lastMove: { r: number; c: number } | null }[]} */
  let undoStack = [];

  const els = {
    board: document.getElementById("board"),
    btnNew: document.getElementById("btn-new"),
    btnUndo: document.getElementById("btn-undo"),
    btnResetStats: document.getElementById("btn-reset-stats"),
    status: document.getElementById("status"),
    thinking: document.getElementById("thinking"),
    statWins: document.getElementById("stat-wins"),
    statLosses: document.getElementById("stat-losses"),
    statDraws: document.getElementById("stat-draws"),
    statGames: document.getElementById("stat-games"),
    statCurWins: document.getElementById("stat-cur-wins"),
    statCurLosses: document.getElementById("stat-cur-losses"),
    statCurDraws: document.getElementById("stat-cur-draws"),
  };

  const cells = [];

  function getDifficulty() {
    const el = document.querySelector('input[name="difficulty"]:checked');
    return el ? /** @type {HTMLInputElement} */ (el).value : "medium";
  }

  function emptyBoard() {
    return new Array(N * N).fill(EMPTY);
  }

  function idx(r, c) {
    return r * N + c;
  }

  function inBounds(r, c) {
    return r >= 0 && r < N && c >= 0 && c < N;
  }

  function getCell(b, r, c) {
    if (!inBounds(r, c)) return -1;
    return b[idx(r, c)];
  }

  function checkWin(b, r, c, side) {
    for (const [dr, dc] of DIRS) {
      let n = 1;
      let rr = r + dr;
      let cc = c + dc;
      while (inBounds(rr, cc) && b[idx(rr, cc)] === side) {
        n++;
        rr += dr;
        cc += dc;
      }
      rr = r - dr;
      cc = c - dc;
      while (inBounds(rr, cc) && b[idx(rr, cc)] === side) {
        n++;
        rr -= dr;
        cc -= dc;
      }
      if (n >= 5) return true;
    }
    return false;
  }

  function isBoardFull(b) {
    return b.every((v) => v !== EMPTY);
  }

  function hasAnyStone(b) {
    return b.some((v) => v !== EMPTY);
  }

  /**
   * Empty cells within Chebyshev distance `dist` of any stone.
   * @param {number[]} b
   * @param {number} dist
   */
  function allEmptyIndices(b) {
    const out = [];
    for (let i = 0; i < b.length; i++) {
      if (b[i] === EMPTY) out.push(i);
    }
    return out;
  }

  function candidateEmptyCells(b, dist) {
    const out = [];
    if (!hasAnyStone(b)) {
      out.push(idx(7, 7));
      return out;
    }
    const seen = new Set();
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (b[idx(r, c)] === EMPTY) continue;
        for (let dr = -dist; dr <= dist; dr++) {
          for (let dc = -dist; dc <= dist; dc++) {
            if (Math.max(Math.abs(dr), Math.abs(dc)) > dist) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (!inBounds(nr, nc)) continue;
            const i = idx(nr, nc);
            if (b[i] !== EMPTY) continue;
            if (!seen.has(i)) {
              seen.add(i);
              out.push(i);
            }
          }
        }
      }
    }
    return out;
  }

  function ensureCandidates(b, dist) {
    const c = candidateEmptyCells(b, dist);
    if (c.length > 0) return c;
    return allEmptyIndices(b);
  }

  function lineInfo(b, r, c, dr, dc, side) {
    let count = 1;
    let a = r + dr;
    let cc = c + dc;
    while (inBounds(a, cc) && b[idx(a, cc)] === side) {
      count++;
      a += dr;
      cc += dc;
    }
    const open1 = inBounds(a, cc) && b[idx(a, cc)] === EMPTY;
    a = r - dr;
    cc = c - dc;
    while (inBounds(a, cc) && b[idx(a, cc)] === side) {
      count++;
      a -= dr;
      cc -= dc;
    }
    const open2 = inBounds(a, cc) && b[idx(a, cc)] === EMPTY;
    return { count, open1, open2 };
  }

  function directionThreatScore(count, open1, open2) {
    if (count >= 5) return 1_000_000;
    if (count === 4 && (open1 || open2)) return 100_000;
    if (count === 4) return 8_000;
    if (count === 3 && open1 && open2) return 5_000;
    if (count === 3 && (open1 || open2)) return 500;
    if (count === 2 && open1 && open2) return 120;
    if (count === 2 && (open1 || open2)) return 20;
    return count;
  }

  /**
   * Heuristic value if `side` places at (r,c); temporarily mutates b[r,c].
   * @param {number[]} b
   */
  function threatScoreAt(b, r, c, side) {
    const i = idx(r, c);
    if (b[i] !== EMPTY) return -Infinity;
    b[i] = side;
    let total = 0;
    for (const [dr, dc] of DIRS) {
      const { count, open1, open2 } = lineInfo(b, r, c, dr, dc, side);
      total += directionThreatScore(count, open1, open2);
    }
    b[i] = EMPTY;
    return total;
  }

  function scoreMoveForAI(b, r, c) {
    const attack = threatScoreAt(b, r, c, WHITE);
    const defense = threatScoreAt(b, r, c, BLACK);
    return attack + defense * 1.08;
  }

  function findWinningMove(b, side) {
    const cands = ensureCandidates(b, 2);
    for (const i of cands) {
      const r = (i / N) | 0;
      const c = i % N;
      b[i] = side;
      const win = checkWin(b, r, c, side);
      b[i] = EMPTY;
      if (win) return i;
    }
    return -1;
  }

  function pickRandom(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function aiMoveEasy(b) {
    let w = findWinningMove(b, WHITE);
    if (w >= 0) return w;
    const block = findWinningMove(b, BLACK);
    if (block >= 0) return block;
    const cands = ensureCandidates(b, 2);
    return pickRandom(cands);
  }

  function aiMoveMedium(b) {
    let w = findWinningMove(b, WHITE);
    if (w >= 0) return w;
    const block = findWinningMove(b, BLACK);
    if (block >= 0) return block;
    const cands = ensureCandidates(b, 2);
    let best = -Infinity;
    const top = [];
    const noise = () => (Math.random() - 0.5) * 80;
    for (const i of cands) {
      const r = (i / N) | 0;
      const c = i % N;
      const s = scoreMoveForAI(b, r, c) + noise();
      if (s > best) {
        best = s;
        top.length = 0;
        top.push(i);
      } else if (Math.abs(s - best) < 1e-6) {
        top.push(i);
      }
    }
    return pickRandom(top.length ? top : cands);
  }

  function staticEval(b) {
    const cands = ensureCandidates(b, 2);
    let maxW = 0;
    let maxB = 0;
    for (const i of cands) {
      const r = (i / N) | 0;
      const c = i % N;
      maxW = Math.max(maxW, threatScoreAt(b, r, c, WHITE));
      maxB = Math.max(maxB, threatScoreAt(b, r, c, BLACK));
    }
    return maxW - maxB * 1.02;
  }

  function cloneBoard(b) {
    return b.slice();
  }

  /**
   * @param {number[]} b
   * @param {boolean} maximizingWhite
   * @param {number} depth
   * @param {number} alpha
   * @param {number} beta
   */
  function minimax(b, maximizingWhite, depth, alpha, beta) {
    const candsAll = ensureCandidates(b, 2);
    const scored = candsAll.map((i) => {
      const r = (i / N) | 0;
      const c = i % N;
      let s;
      if (maximizingWhite) {
        s = scoreMoveForAI(b, r, c);
      } else {
        s = threatScoreAt(b, r, c, BLACK) + threatScoreAt(b, r, c, WHITE) * 0.98;
      }
      return { i, s };
    });
    scored.sort((a, b) => b.s - a.s);
    const K = 12;
    const moves = scored.slice(0, K).map((x) => x.i);

    if (depth === 0) return staticEval(b);

    if (maximizingWhite) {
      let best = -Infinity;
      for (const i of moves) {
        const r = (i / N) | 0;
        const c = i % N;
        b[i] = WHITE;
        if (checkWin(b, r, c, WHITE)) {
          b[i] = EMPTY;
          return 500_000;
        }
        const v = minimax(b, false, depth - 1, alpha, beta);
        b[i] = EMPTY;
        best = Math.max(best, v);
        alpha = Math.max(alpha, v);
        if (beta <= alpha) break;
      }
      return best;
    }

    let best = Infinity;
    for (const i of moves) {
      const r = (i / N) | 0;
      const c = i % N;
      b[i] = BLACK;
      if (checkWin(b, r, c, BLACK)) {
        b[i] = EMPTY;
        return -500_000;
      }
      const v = minimax(b, true, depth - 1, alpha, beta);
      b[i] = EMPTY;
      best = Math.min(best, v);
      beta = Math.min(beta, v);
      if (beta <= alpha) break;
    }
    return best;
  }

  function aiMoveHard(b) {
    let w = findWinningMove(b, WHITE);
    if (w >= 0) return w;
    const block = findWinningMove(b, BLACK);
    if (block >= 0) return block;

    const cands = ensureCandidates(b, 2);
    const scored = cands.map((i) => {
      const r = (i / N) | 0;
      const c = i % N;
      return { i, s: scoreMoveForAI(b, r, c) };
    });
    scored.sort((a, b) => b.s - a.s);
    const topMoves = scored.slice(0, 10);

    let bestI = topMoves[0].i;
    let bestVal = -Infinity;
    const work = cloneBoard(b);

    for (const { i } of topMoves) {
      const r = (i / N) | 0;
      const c = i % N;
      work[i] = WHITE;
      if (checkWin(work, r, c, WHITE)) {
        work[i] = EMPTY;
        return i;
      }
      const v = minimax(work, false, 2, -Infinity, Infinity);
      work[i] = EMPTY;
      if (v > bestVal) {
        bestVal = v;
        bestI = i;
      }
    }
    return bestI;
  }

  function chooseAiMove(difficulty) {
    if (difficulty === "easy") return aiMoveEasy(board);
    if (difficulty === "hard") return aiMoveHard(board);
    return aiMoveMedium(board);
  }

  function defaultStats() {
    const z = () => ({ wins: 0, losses: 0, draws: 0 });
    return {
      total: z(),
      byDifficulty: {
        easy: z(),
        medium: z(),
        hard: z(),
      },
    };
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(statsStorageKey());
      if (!raw) return defaultStats();
      const p = JSON.parse(raw);
      const d = defaultStats();
      if (!p.total || !p.byDifficulty) return d;
      return {
        total: { ...d.total, ...p.total },
        byDifficulty: {
          easy: { ...d.byDifficulty.easy, ...p.byDifficulty.easy },
          medium: { ...d.byDifficulty.medium, ...p.byDifficulty.medium },
          hard: { ...d.byDifficulty.hard, ...p.byDifficulty.hard },
        },
      };
    } catch {
      return defaultStats();
    }
  }

  function saveStats(stats) {
    localStorage.setItem(statsStorageKey(), JSON.stringify(stats));
  }

  let stats = loadStats();

  function renderStats() {
    const t = stats.total;
    els.statWins.textContent = String(t.wins);
    els.statLosses.textContent = String(t.losses);
    els.statDraws.textContent = String(t.draws);
    els.statGames.textContent = String(t.wins + t.losses + t.draws);

    const diff = getDifficulty();
    const cur = stats.byDifficulty[diff];
    els.statCurWins.textContent = String(cur.wins);
    els.statCurLosses.textContent = String(cur.losses);
    els.statCurDraws.textContent = String(cur.draws);
  }

  function recordResult(result) {
    const diff = getDifficulty();
    if (result === "win") {
      stats.total.wins++;
      stats.byDifficulty[diff].wins++;
    } else if (result === "loss") {
      stats.total.losses++;
      stats.byDifficulty[diff].losses++;
    } else {
      stats.total.draws++;
      stats.byDifficulty[diff].draws++;
    }
    saveStats(stats);
    renderStats();
  }

  function buildBoardDom() {
    els.board.innerHTML = "";
    cells.length = 0;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";
        btn.dataset.row = String(r);
        btn.dataset.col = String(c);
        btn.setAttribute("aria-label", `第 ${r + 1} 行第 ${c + 1} 列`);
        const ph = document.createElement("span");
        ph.className = "stone-placeholder";
        ph.setAttribute("aria-hidden", "true");
        btn.appendChild(ph);
        btn.addEventListener("click", () => onCellClick(r, c));
        els.board.appendChild(btn);
        cells[idx(r, c)] = btn;
      }
    }
  }

  function updateCellUi(r, c) {
    const cell = cells[idx(r, c)];
    const v = board[idx(r, c)];
    cell.classList.remove("black", "white", "last-move");
    cell.innerHTML = "";
    const ph = document.createElement("span");
    ph.className = "stone-placeholder";
    ph.setAttribute("aria-hidden", "true");
    if (v === EMPTY) {
      cell.appendChild(ph);
    } else {
      const stone = document.createElement("span");
      stone.className = "stone";
      stone.setAttribute("aria-hidden", "true");
      cell.appendChild(stone);
      cell.classList.add(v === BLACK ? "black" : "white");
    }
    if (lastMove && lastMove.r === r && lastMove.c === c && v !== EMPTY) {
      cell.classList.add("last-move");
    }
  }

  function redrawBoard() {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        updateCellUi(r, c);
      }
    }
    setCellsDisabled();
  }

  function snapshotState() {
    return {
      board: board.slice(),
      lastMove: lastMove ? { r: lastMove.r, c: lastMove.c } : null,
    };
  }

  function restoreState(s) {
    board = s.board.slice();
    lastMove = s.lastMove ? { r: s.lastMove.r, c: s.lastMove.c } : null;
    currentTurn = BLACK;
    gameOver = false;
    inputLocked = false;
  }

  function clearAiTimer() {
    if (aiTimer !== null) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
  }

  function updateUndoButton() {
    const canUndo = !gameOver && undoStack.length > 0;
    els.btnUndo.disabled = !canUndo;
  }

  function setCellsDisabled() {
    const dis = gameOver || inputLocked || currentTurn !== BLACK;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const empty = board[i] === EMPTY;
      cell.disabled = dis || !empty;
      cell.classList.toggle("disabled", cell.disabled);
    }
    updateUndoButton();
  }

  function setStatus(text) {
    els.status.textContent = text;
  }

  function setThinking(on) {
    els.thinking.classList.toggle("hidden", !on);
  }

  function endGame(message, result) {
    gameOver = true;
    inputLocked = false;
    clearAiTimer();
    setThinking(false);
    setStatus(message);
    if (result) recordResult(result);
    undoStack.length = 0;
    setCellsDisabled();
  }

  function onCellClick(r, c) {
    if (gameOver || inputLocked || currentTurn !== BLACK) return;
    const i = idx(r, c);
    if (board[i] !== EMPTY) return;

    undoStack.push(snapshotState());

    board[i] = BLACK;
    lastMove = { r, c };
    redrawBoard();

    if (checkWin(board, r, c, BLACK)) {
      endGame("你獲勝！", "win");
      return;
    }
    if (isBoardFull(board)) {
      endGame("和棋。", "draw");
      return;
    }

    currentTurn = WHITE;
    inputLocked = true;
    setThinking(true);
    setStatus("電腦（白）思考中…");
    setCellsDisabled();

    const delay = 50;
    clearAiTimer();
    aiTimer = setTimeout(() => {
      aiTimer = null;
      const diff = getDifficulty();
      const move = chooseAiMove(diff);
      if (move < 0) {
        endGame("和棋。", "draw");
        return;
      }
      const br = (move / N) | 0;
      const bc = move % N;
      board[move] = WHITE;
      lastMove = { r: br, c: bc };
      redrawBoard();

      if (checkWin(board, br, bc, WHITE)) {
        endGame("電腦獲勝。", "loss");
        return;
      }
      if (isBoardFull(board)) {
        endGame("和棋。", "draw");
        return;
      }

      currentTurn = BLACK;
      inputLocked = false;
      setThinking(false);
      setStatus("輪到你（黑）落子");
      setCellsDisabled();
    }, delay);
  }

  function undoLastRound() {
    if (gameOver || undoStack.length === 0) return;
    clearAiTimer();
    const s = undoStack.pop();
    restoreState(s);
    setThinking(false);
    setStatus("輪到你（黑）落子");
    redrawBoard();
  }

  function newGame() {
    clearAiTimer();
    undoStack.length = 0;
    board = emptyBoard();
    currentTurn = BLACK;
    gameOver = false;
    lastMove = null;
    inputLocked = false;
    setThinking(false);
    setStatus("輪到你（黑）落子");
    redrawBoard();
  }

  els.btnNew.addEventListener("click", newGame);
  els.btnUndo.addEventListener("click", undoLastRound);
  document.querySelectorAll('input[name="difficulty"]').forEach((input) => {
    input.addEventListener("change", () => {
      renderStats();
    });
  });

  els.btnResetStats.addEventListener("click", () => {
    if (!window.confirm("確定要清除所有戰績嗎？此操作無法復原。")) return;
    stats = defaultStats();
    saveStats(stats);
    renderStats();
  });

  buildBoardDom();
  newGame();
  renderStats();
})();
