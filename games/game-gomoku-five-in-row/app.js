(function () {
  "use strict";

  const BOARD_SIZE = 15;
  const DIRS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  function emptyBoard() {
    return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  }

  function cloneBoard(board) {
    return board.map(function (row) {
      return row.slice();
    });
  }

  function initialState() {
    return {
      board: emptyBoard(),
      toMove: 1,
      result: "playing",
    };
  }

  function checkWin(board, row, col, player) {
    if (player === 0) return false;
    for (let d = 0; d < DIRS.length; d++) {
      const dr = DIRS[d][0];
      const dc = DIRS[d][1];
      let count = 1;
      let k;
      for (k = 1; k < BOARD_SIZE; k++) {
        const r = row + dr * k;
        const c = col + dc * k;
        if (
          r < 0 ||
          r >= BOARD_SIZE ||
          c < 0 ||
          c >= BOARD_SIZE ||
          board[r][c] !== player
        )
          break;
        count++;
      }
      for (k = 1; k < BOARD_SIZE; k++) {
        const r = row - dr * k;
        const c = col - dc * k;
        if (
          r < 0 ||
          r >= BOARD_SIZE ||
          c < 0 ||
          c >= BOARD_SIZE ||
          board[r][c] !== player
        )
          break;
        count++;
      }
      if (count >= 5) return true;
    }
    return false;
  }

  function boardFull(board) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === 0) return false;
      }
    }
    return true;
  }

  function applyMove(state, row, col, player) {
    if (state.result !== "playing") return null;
    if (state.toMove !== player) return null;
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE)
      return null;
    if (state.board[row][col] !== 0) return null;

    const board = cloneBoard(state.board);
    board[row][col] = player;

    let result = "playing";
    if (checkWin(board, row, col, player)) {
      result = player === 1 ? "black_win" : "white_win";
    } else if (boardFull(board)) {
      result = "draw";
    }

    const toMove = player === 1 ? 2 : 1;
    return { board: board, toMove: toMove, result: result };
  }

  const STORAGE_KEY = "five-in-a-row-stats";

  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { wins: 0, losses: 0 };
      const o = JSON.parse(raw);
      if (typeof o !== "object" || o === null) return { wins: 0, losses: 0 };
      return {
        wins: Number(o.wins) || 0,
        losses: Number(o.losses) || 0,
      };
    } catch (e) {
      return { wins: 0, losses: 0 };
    }
  }

  function saveStats(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }

  function recordWin() {
    const s = loadStats();
    s.wins += 1;
    saveStats(s);
    return s;
  }

  function recordLoss() {
    const s = loadStats();
    s.losses += 1;
    saveStats(s);
    return s;
  }

  function resetStats() {
    const s = { wins: 0, losses: 0 };
    saveStats(s);
    return s;
  }

  function getCandidateMoves(board) {
    let hasStone = false;
    let r;
    let c;
    for (r = 0; r < BOARD_SIZE; r++) {
      for (c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] !== 0) {
          hasStone = true;
          break;
        }
      }
      if (hasStone) break;
    }
    if (!hasStone) return [[7, 7]];

    const out = [];
    const seen = {};
    for (r = 0; r < BOARD_SIZE; r++) {
      for (c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] !== 0) continue;
        let near = false;
        let dr;
        let dc;
        for (dr = -2; dr <= 2; dr++) {
          for (dc = -2; dc <= 2; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (
              nr >= 0 &&
              nr < BOARD_SIZE &&
              nc >= 0 &&
              nc < BOARD_SIZE &&
              board[nr][nc] !== 0
            ) {
              near = true;
              break;
            }
          }
          if (near) break;
        }
        if (near) {
          const k = r + "," + c;
          if (!seen[k]) {
            seen[k] = true;
            out.push([r, c]);
          }
        }
      }
    }
    if (out.length === 0) {
      for (r = 0; r < BOARD_SIZE; r++) {
        for (c = 0; c < BOARD_SIZE; c++) {
          if (board[r][c] === 0) out.push([r, c]);
        }
      }
    }
    return out;
  }

  function immediateWinningMove(board, player) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] !== 0) continue;
        board[r][c] = player;
        const w = checkWin(board, r, c, player);
        board[r][c] = 0;
        if (w) return [r, c];
      }
    }
    return null;
  }

  function randomEmpty(board) {
    const empty = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === 0) empty.push([r, c]);
      }
    }
    return empty[Math.floor(Math.random() * empty.length)];
  }

  function moveHeuristic(board, r, c, p) {
    if (p === 0 || board[r][c] !== 0) return -1e9;
    board[r][c] = p;
    let score = 0;
    let d;
    for (d = 0; d < DIRS.length; d++) {
      const dr = DIRS[d][0];
      const dc = DIRS[d][1];
      let len = 1;
      let openA = false;
      let openB = false;
      let k = 1;
      while (true) {
        const nr = r + dr * k;
        const nc = c + dc * k;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
        if (board[nr][nc] === p) len++;
        else {
          openA = board[nr][nc] === 0;
          break;
        }
        k++;
      }
      k = 1;
      while (true) {
        const nr = r - dr * k;
        const nc = c - dc * k;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
        if (board[nr][nc] === p) len++;
        else {
          openB = board[nr][nc] === 0;
          break;
        }
        k++;
      }
      const opens = (openA ? 1 : 0) + (openB ? 1 : 0);
      if (len >= 5) score += 1000000;
      else if (len === 4 && opens >= 1) score += 50000;
      else if (len === 4 && opens === 0) score += 500;
      else if (len === 3 && opens === 2) score += 5000;
      else if (len === 3 && opens === 1) score += 400;
      else if (len === 2 && opens === 2) score += 200;
      else if (len === 2 && opens === 1) score += 50;
      else if (len === 3 && opens === 0) score += 80;
      else score += len * 10;
    }
    board[r][c] = 0;
    return score;
  }

  function evaluateBoard(board) {
    const moves = getCandidateMoves(board);
    let w = 0;
    let b = 0;
    let i;
    for (i = 0; i < moves.length; i++) {
      const r = moves[i][0];
      const c = moves[i][1];
      w += moveHeuristic(board, r, c, 2);
      b += moveHeuristic(board, r, c, 1);
    }
    return w - b;
  }

  function orderMoves(board, moves, p) {
    return moves.slice().sort(function (a, bb) {
      return (
        moveHeuristic(board, bb[0], bb[1], p) -
        moveHeuristic(board, a[0], a[1], p)
      );
    });
  }

  const WIN_SCORE = 1000000;
  const HARD_DEPTH = 3;

  function minimax(board, depth, alpha, beta, maximizing) {
    const moves = getCandidateMoves(board);
    if (maximizing) {
      let maxEval = -Infinity;
      const ordered = orderMoves(board, moves, 2);
      let i;
      for (i = 0; i < ordered.length; i++) {
        const r = ordered[i][0];
        const c = ordered[i][1];
        if (board[r][c] !== 0) continue;
        board[r][c] = 2;
        let val;
        if (checkWin(board, r, c, 2)) val = WIN_SCORE;
        else if (depth === 0) val = evaluateBoard(board);
        else val = minimax(board, depth - 1, alpha, beta, false);
        board[r][c] = 0;
        maxEval = Math.max(maxEval, val);
        alpha = Math.max(alpha, val);
        if (beta <= alpha) break;
      }
      return maxEval === -Infinity ? evaluateBoard(board) : maxEval;
    }
    let minEval = Infinity;
    const orderedMin = orderMoves(board, moves, 1);
    for (let j = 0; j < orderedMin.length; j++) {
      const r = orderedMin[j][0];
      const c = orderedMin[j][1];
      if (board[r][c] !== 0) continue;
      board[r][c] = 1;
      let val;
      if (checkWin(board, r, c, 1)) val = -WIN_SCORE;
      else if (depth === 0) val = evaluateBoard(board);
      else val = minimax(board, depth - 1, alpha, beta, true);
      board[r][c] = 0;
      minEval = Math.min(minEval, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return minEval === Infinity ? evaluateBoard(board) : minEval;
  }

  function chooseHard(boardIn) {
    const win = immediateWinningMove(boardIn, 2);
    if (win) return win;
    const block = immediateWinningMove(boardIn, 1);
    if (block) return block;

    const moves = getCandidateMoves(boardIn);
    let bestMove = moves[0];
    let bestScore = -Infinity;
    const board = cloneBoard(boardIn);
    const ordered = orderMoves(board, moves, 2);
    let idx;
    for (idx = 0; idx < ordered.length; idx++) {
      const r = ordered[idx][0];
      const c = ordered[idx][1];
      if (board[r][c] !== 0) continue;
      board[r][c] = 2;
      let score;
      if (checkWin(board, r, c, 2)) score = WIN_SCORE;
      else
        score = minimax(board, HARD_DEPTH - 1, -Infinity, Infinity, false);
      board[r][c] = 0;
      if (score > bestScore) {
        bestScore = score;
        bestMove = [r, c];
      }
    }
    return bestMove;
  }

  function chooseMedium(board) {
    const win = immediateWinningMove(board, 2);
    if (win) return win;
    const block = immediateWinningMove(board, 1);
    if (block) return block;

    const moves = getCandidateMoves(board);
    let best = moves[0];
    let bestScore = -Infinity;
    let i;
    for (i = 0; i < moves.length; i++) {
      const r = moves[i][0];
      const c = moves[i][1];
      const attack = moveHeuristic(board, r, c, 2);
      const defense = moveHeuristic(board, r, c, 1);
      const center = 15 - Math.abs(r - 7) - Math.abs(c - 7);
      const s = attack * 1.1 + defense + center * 2;
      if (s > bestScore) {
        bestScore = s;
        best = [r, c];
      }
    }
    return best;
  }

  function chooseEasy(board) {
    const win = immediateWinningMove(board, 2);
    if (win && Math.random() < 0.72) return win;
    const block = immediateWinningMove(board, 1);
    if (block && Math.random() < 0.62) return block;
    return randomEmpty(board);
  }

  function chooseAIMove(state, difficulty) {
    const board = state.board;
    if (state.toMove !== 2 || state.result !== "playing") {
      return [7, 7];
    }
    if (difficulty === "easy") return chooseEasy(board);
    if (difficulty === "hard") return chooseHard(board);
    return chooseMedium(board);
  }

  function buildNukeVictoryState() {
    var board = emptyBoard();
    var row = 7;
    var c;
    for (c = 0; c < 5; c++) {
      board[row][c] = 1;
    }
    return {
      board: board,
      toMove: 2,
      result: "black_win",
    };
  }

  var marchAnimFrame = null;

  function dismissMarchSalute() {
    var el = document.getElementById("march-salute-overlay");
    if (el) {
      el.remove();
    }
    if (marchAnimFrame !== null) {
      cancelAnimationFrame(marchAnimFrame);
      marchAnimFrame = null;
    }
  }

  function showNukeExplosion(done) {
    var old = document.getElementById("nuke-overlay");
    if (old) {
      old.remove();
    }

    var ov = document.createElement("div");
    ov.id = "nuke-overlay";
    ov.className = "nuke-overlay nuke-active";
    ov.innerHTML =
      '<div class="nuke-flash" aria-hidden="true"></div>' +
      '<div class="nuke-fireball" aria-hidden="true"></div>' +
      '<div class="nuke-shockwave" aria-hidden="true"></div>' +
      '<div class="nuke-smoke" aria-hidden="true"></div>';

    document.body.classList.add("nuke-shaking");
    document.body.appendChild(ov);

    window.setTimeout(function () {
      document.body.classList.remove("nuke-shaking");
    }, 2800);

    window.setTimeout(function () {
      var n = document.getElementById("nuke-overlay");
      if (n) {
        n.remove();
      }
      if (typeof done === "function") {
        done();
      }
    }, 3050);
  }

  function showMarchSaluteOverlay() {
    dismissMarchSalute();

    var ov = document.createElement("div");
    ov.id = "march-salute-overlay";
    ov.className = "march-overlay";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-label", "Victory march");

    var canvas = document.createElement("canvas");
    var label = document.createElement("div");
    label.className = "march-label";
    label.textContent = "1000 troops salute the nuke";
    var hint = document.createElement("p");
    hint.className = "march-hint";
    hint.textContent = "Click anywhere to continue";

    ov.appendChild(canvas);
    ov.appendChild(label);
    ov.appendChild(hint);

    var cols = 100;
    var rows = 10;
    var people = [];
    var pr;
    var pc;
    for (pr = 0; pr < rows; pr++) {
      for (pc = 0; pc < cols; pc++) {
        people.push({
          gx: pc + (pr % 2) * 0.5,
          gy: pr,
          phase: Math.random() * 6.28318,
        });
      }
    }

    function resizeCanvas() {
      var dpr = window.devicePixelRatio || 1;
      var w = window.innerWidth;
      var h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      return { cw: canvas.width, ch: canvas.height, dpr: dpr };
    }

    var dims = resizeCanvas();
    var ctx = canvas.getContext("2d");

    var onResize = function () {
      dims = resizeCanvas();
    };
    window.addEventListener("resize", onResize);

    var startTime = performance.now();

    function drawPerson(px, py, scale, legPhase, saluteT) {
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(scale, scale);

      var leg = Math.sin(legPhase) * 2.5;
      ctx.fillStyle = "#1e2d3d";
      ctx.fillRect(-4, 2, 3, 9 + leg);
      ctx.fillRect(1, 2, 3, 9 - leg);

      ctx.fillStyle="#3d4f63";
      ctx.fillRect(-5, -6, 10, 9);

      ctx.fillStyle = "#e8c4a0";
      ctx.beginPath();
      ctx.arc(0, -10, 3.5, 0, 6.28318);
      ctx.fill();

      ctx.strokeStyle = "#1e2d3d";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(5, -2);
      var armAngle = -1.15 - saluteT * 1.35;
      ctx.lineTo(5 + Math.cos(armAngle) * 12, -2 + Math.sin(armAngle) * 12);
      ctx.stroke();

      ctx.restore();
    }

    function loop(now) {
      if (!document.getElementById("march-salute-overlay")) {
        marchAnimFrame = null;
        return;
      }

      var cw = dims.cw;
      var ch = dims.ch;
      var t = (now - startTime) * 0.001;
      var legStep = now * 0.007;
      var saluteT = Math.sin(t * 1.85) * 0.5 + 0.5;
      if (t < 0.7) {
        saluteT = saluteT * (t / 0.7);
      }

      var g = ctx.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, "#3d5a80");
      g.addColorStop(0.45, "#1a2744");
      g.addColorStop(1, "#0b1018");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);

      var cellW = cw / 99;
      var rowH = ch * 0.065;
      var startY = ch * 0.17;
      var marchPx = (t * cellW * 18) % (cellW * 2);

      var idx;
      for (idx = 0; idx < people.length; idx++) {
        var p = people[idx];
        var baseX = p.gx * cellW + marchPx - cellW * 0.5;
        while (baseX < -cellW * 3) {
          baseX += cw + cellW * 4;
        }
        while (baseX > cw + cellW * 2) {
          baseX -= cw + cellW * 4;
        }
        var baseY =
          startY + p.gy * rowH + Math.sin(legStep * 0.018 + p.phase) * 2.5;
        var sc = Math.min(cellW, rowH) * 0.11;
        drawPerson(baseX, baseY, sc, legStep + p.phase, saluteT);
      }

      marchAnimFrame = requestAnimationFrame(loop);
    }

    function closeMarch() {
      window.removeEventListener("resize", onResize);
      dismissMarchSalute();
      showWinCrawl();
    }

    ov.addEventListener("click", closeMarch);

    document.body.appendChild(ov);
    marchAnimFrame = requestAnimationFrame(loop);
  }

  var NUKE_PASSWORD = "alanwalker";

  function onNukeSystemClick() {
    if (document.getElementById("nuke-overlay")) {
      return;
    }

    var entered = window.prompt(
      "Nuke mode is locked. Enter password (lowercase, no caps):",
    );
    if (entered === null) {
      return;
    }
    if (entered !== NUKE_PASSWORD) {
      window.alert("Access denied. Wrong password.");
      return;
    }

    dismissWinCrawl();
    dismissMarchSalute();

    var prevResult = state.result;

    showNukeExplosion(function () {
      state = buildNukeVictoryState();
      render();

      if (prevResult !== "black_win") {
        recordWin();
        statsRecorded = true;
        updateStatsDisplay();
      } else {
        statsRecorded = true;
      }

      showMarchSaluteOverlay();
    });
  }

  let state = initialState();
  let statsRecorded = false;
  let difficulty = "medium";

  const app = document.querySelector("#app");
  app.innerHTML =
    '<div class="shell">' +
    "<header>" +
    "<h1>Five in a Row</h1>" +
    '<p class="sub">You are <strong>black</strong> · Computer is <strong>white</strong> · First to five in a row wins</p>' +
    "</header>" +
    '<div class="stats">' +
    '<span>Wins: <strong id="wins">0</strong></span>' +
    '<span>Losses: <strong id="losses">0</strong></span>' +
    "</div>" +
    '<div class="toolbar">' +
    "<label>" +
    "Difficulty " +
    '<select id="difficulty" aria-label="AI difficulty">' +
    '<option value="easy">Easy</option>' +
    '<option value="medium" selected>Medium</option>' +
    '<option value="hard">Hard</option>' +
    "</select>" +
    "</label>" +
    '<button type="button" class="btn" id="new-game">New game</button>' +
    '<button type="button" class="btn secondary" id="reset-stats">Reset stats</button>' +
    '<button type="button" class="btn nuke-btn" id="nuke-system">Nuke system</button>' +
    "</div>" +
    '<p class="status" id="status" role="status"></p>' +
    '<div class="board-wrap">' +
    '<div class="board" id="board" role="grid" aria-label="Game board 15 by 15"></div>' +
    "</div>" +
    "</div>";

  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const winsEl = document.getElementById("wins");
  const lossesEl = document.getElementById("losses");
  const difficultyEl = document.getElementById("difficulty");

  const cells = [];
  let rr;
  let cc;
  for (rr = 0; rr < BOARD_SIZE; rr++) {
    const row = [];
    for (cc = 0; cc < BOARD_SIZE; cc++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.row = String(rr);
      cell.dataset.col = String(cc);
      cell.setAttribute("aria-label", "Cell row " + (rr + 1) + " column " + (cc + 1));
      (function (r, c) {
        cell.addEventListener("click", function () {
          onCellClick(r, c);
        });
      })(rr, cc);
      boardEl.appendChild(cell);
      row.push(cell);
    }
    cells.push(row);
  }

  function updateStatsDisplay() {
    const s = loadStats();
    winsEl.textContent = String(s.wins);
    lossesEl.textContent = String(s.losses);
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  function render() {
    let r;
    let c;
    for (r = 0; r < BOARD_SIZE; r++) {
      for (c = 0; c < BOARD_SIZE; c++) {
        const btn = cells[r][c];
        btn.replaceChildren();
        const v = state.board[r][c];
        if (v === 1) {
          const stone = document.createElement("span");
          stone.className = "stone black";
          btn.appendChild(stone);
        } else if (v === 2) {
          const stone = document.createElement("span");
          stone.className = "stone white";
          btn.appendChild(stone);
        }
        const playable =
          state.result === "playing" && state.toMove === 1 && v === 0;
        btn.disabled = !playable;
      }
    }

    if (state.result === "playing") {
      if (state.toMove === 1) {
        setStatus("Your turn (black).", "");
      } else {
        setStatus("Computer is thinking…", "");
      }
    } else if (state.result === "black_win") {
      setStatus("You win!", "win");
    } else if (state.result === "white_win") {
      setStatus("Computer wins.", "lose");
    } else {
      setStatus("Draw — board is full.", "draw");
    }
  }

  function buildSixtySevenWall() {
    var parts = [];
    var i;
    for (i = 0; i < 2200; i++) {
      parts.push("67");
    }
    return parts.join(" ");
  }

  function dismissWinCrawl() {
    var el = document.getElementById("sw-win-overlay");
    if (el) {
      el.remove();
    }
    document.removeEventListener("keydown", onWinCrawlKey);
  }

  function onWinCrawlKey(ev) {
    if (ev.key === "Escape") {
      dismissWinCrawl();
    }
  }

  function showWinCrawl() {
    if (document.getElementById("sw-win-overlay")) {
      return;
    }

    var wall = buildSixtySevenWall();
    var overlay = document.createElement("div");
    overlay.id = "sw-win-overlay";
    overlay.className = "sw-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Victory crawl");

    var blockHtml =
      '<p class="sw-crawl-body">' +
      wall +
      "</p>" +
      '<h2 class="sw-crawl-title">Episode 67: You Win</h2>';

    overlay.innerHTML =
      '<div class="sw-stars" aria-hidden="true"></div>' +
      '<p class="sw-crawl-hint">Click or press Escape to continue</p>' +
      '<div class="sw-crawl-stage">' +
      '<div class="sw-crawl-tilt">' +
      '<div class="sw-crawl-track">' +
      '<div class="sw-crawl-block">' +
      blockHtml +
      "</div>" +
      '<div class="sw-crawl-block">' +
      blockHtml +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>";

    overlay.addEventListener("click", dismissWinCrawl);
    document.addEventListener("keydown", onWinCrawlKey);
    document.body.appendChild(overlay);
  }

  function recordEndStats() {
    if (statsRecorded) return;
    if (state.result === "black_win") {
      recordWin();
      statsRecorded = true;
      updateStatsDisplay();
      showWinCrawl();
      return;
    }
    if (state.result === "white_win") {
      recordLoss();
      statsRecorded = true;
    }
    updateStatsDisplay();
  }

  function onCellClick(r, c) {
    if (state.result !== "playing" || state.toMove !== 1) return;
    const next = applyMove(state, r, c, 1);
    if (!next) return;
    state = next;
    render();
    recordEndStats();
    if (state.result !== "playing") return;
    window.setTimeout(function () {
      runAiTurn();
    }, 30);
  }

  function runAiTurn() {
    if (state.result !== "playing" || state.toMove !== 2) return;
    setStatus("Computer is thinking…", "");
    const move = chooseAIMove(state, difficulty);
    const r = move[0];
    const c = move[1];
    const next = applyMove(state, r, c, 2);
    if (!next) return;
    state = next;
    render();
    recordEndStats();
  }

  function newGame() {
    dismissWinCrawl();
    dismissMarchSalute();
    var nukeEl = document.getElementById("nuke-overlay");
    if (nukeEl) {
      nukeEl.remove();
      document.body.classList.remove("nuke-shaking");
    }
    state = initialState();
    statsRecorded = false;
    render();
  }

  difficultyEl.addEventListener("change", function () {
    difficulty = difficultyEl.value;
  });

  document.getElementById("new-game").addEventListener("click", newGame);
  document.getElementById("reset-stats").addEventListener("click", function () {
    resetStats();
    updateStatsDisplay();
  });
  document.getElementById("nuke-system").addEventListener("click", onNukeSystemClick);

  updateStatsDisplay();
  render();
})();
