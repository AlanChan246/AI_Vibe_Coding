(function () {
  "use strict";

  const N = 9;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;
  const KOMI = 6.5;
  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  /** 9×9 星位（0-based） */
  const STAR_KEYS = new Set([idx(2, 2), idx(2, 6), idx(6, 2), idx(6, 6), idx(4, 4)]);

  function idx(r, c) {
    return r * N + c;
  }

  function rc(i) {
    return [(i / N) | 0, i % N];
  }

  function inBounds(r, c) {
    return r >= 0 && r < N && c >= 0 && c < N;
  }

  function serialize(b) {
    return b.join("");
  }

  /** @param {number[]} b @param {number} r @param {number} c */
  function getGroup(b, r, c) {
    const color = b[idx(r, c)];
    if (color === EMPTY) return [];
    const out = [];
    const start = idx(r, c);
    const stack = [start];
    const seen = new Set([start]);
    while (stack.length) {
      const i = stack.pop();
      out.push(i);
      const [rr, cc] = rc(i);
      for (const [dr, dc] of DIRS) {
        const nr = rr + dr;
        const nc = cc + dc;
        if (!inBounds(nr, nc)) continue;
        const j = idx(nr, nc);
        if (b[j] !== color || seen.has(j)) continue;
        seen.add(j);
        stack.push(j);
      }
    }
    return out;
  }

  /** @param {number[]} b @param {number[]} group */
  function libertyCount(b, group) {
    const lib = new Set();
    for (const i of group) {
      const [r, c] = rc(i);
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const j = idx(nr, nc);
        if (b[j] === EMPTY) lib.add(j);
      }
    }
    return lib.size;
  }

  /**
   * 移除因落子而無氣的敵方塊，回傳提子數。
   * @param {number[]} b
   */
  function removeDeadOpponent(b, r, c, myColor) {
    const opp = 3 - myColor;
    let captured = 0;
    const doneRoots = new Set();
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const j = idx(nr, nc);
      if (b[j] !== opp) continue;
      const group = getGroup(b, nr, nc);
      const root = Math.min(...group);
      if (doneRoots.has(root)) continue;
      doneRoots.add(root);
      if (libertyCount(b, group) === 0) {
        for (const g of group) {
          b[g] = EMPTY;
          captured++;
        }
      }
    }
    return captured;
  }

  /**
   * @param {number[]} board
   * @param {number|null} koForbidden
   */
  function tryPlay(board, r, c, color, koForbidden) {
    const i = idx(r, c);
    if (board[i] !== EMPTY) return { ok: false, reason: "occupied" };
    const b = board.slice();
    b[i] = color;
    const caps = removeDeadOpponent(b, r, c, color);
    const myGroup = getGroup(b, r, c);
    if (libertyCount(b, myGroup) === 0) {
      return { ok: false, reason: "suicide" };
    }
    const key = serialize(b);
    if (koForbidden !== null && key === koForbidden) {
      return { ok: false, reason: "ko" };
    }
    return { ok: true, board: b, captures: caps };
  }

  /**
   * 簡化數地：空點連通區若只與一方棋子相鄰則計為該方地；雙方相鄰為公氣不計。
   * @param {number[]} b
   */
  function scoreTerritory(b) {
    let blackTerr = 0;
    let whiteTerr = 0;
    const seen = new Set();
    for (let i = 0; i < b.length; i++) {
      if (b[i] !== EMPTY || seen.has(i)) continue;
      const comp = [];
      const stack = [i];
      seen.add(i);
      while (stack.length) {
        const j = stack.pop();
        comp.push(j);
        const [r, c] = rc(j);
        for (const [dr, dc] of DIRS) {
          const nr = r + dr;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const k = idx(nr, nc);
          if (b[k] !== EMPTY || seen.has(k)) continue;
          seen.add(k);
          stack.push(k);
        }
      }
      const touches = { black: false, white: false };
      for (const j of comp) {
        const [r, c] = rc(j);
        for (const [dr, dc] of DIRS) {
          const nr = r + dr;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const v = b[idx(nr, nc)];
          if (v === BLACK) touches.black = true;
          if (v === WHITE) touches.white = true;
        }
      }
      if (touches.black && !touches.white) blackTerr += comp.length;
      else if (touches.white && !touches.black) whiteTerr += comp.length;
    }
    return { blackTerr, whiteTerr };
  }

  let board = new Array(N * N).fill(EMPTY);
  let turn = BLACK;
  let lastMove = null;
  let capturedByBlack = 0;
  let capturedByWhite = 0;
  let koForBlack = null;
  let koForWhite = null;
  let passStreak = 0;
  let gameEnded = false;

  const els = {
    board: document.getElementById("go-board"),
    status: document.getElementById("go-status"),
    capB: document.getElementById("go-cap-b"),
    capW: document.getElementById("go-cap-w"),
    result: document.getElementById("go-result"),
    btnNew: document.getElementById("go-btn-new"),
    btnPass: document.getElementById("go-btn-pass"),
  };

  const cells = [];

  function emptyBoard() {
    return new Array(N * N).fill(EMPTY);
  }

  function reasonText(reason) {
    if (reason === "occupied") return "此處已有棋子";
    if (reason === "suicide") return "無氣（自殺手），請下別處";
    if (reason === "ko") return "打劫：不可立刻還原上一手前的局面";
    return "不可落子";
  }

  function updateHud() {
    els.capB.textContent = String(capturedByBlack);
    els.capW.textContent = String(capturedByWhite);
  }

  function showResult() {
    const { blackTerr, whiteTerr } = scoreTerritory(board);
    const blackTotal = blackTerr + capturedByBlack;
    const whiteTotal = whiteTerr + capturedByWhite + KOMI;
    const diff = blackTotal - whiteTotal;
    let winner;
    if (diff > 0) winner = "黑棋勝";
    else if (diff < 0) winner = "白棋勝";
    else winner = "平手";

    els.result.classList.remove("hidden");
    els.result.innerHTML = [
      `<strong>${winner}</strong>`,
      `黑：地 ${blackTerr} + 提子 ${capturedByBlack} = <strong>${blackTotal}</strong> 目`,
      `白：地 ${whiteTerr} + 提子 ${capturedByWhite} + 貼目 ${KOMI} = <strong>${whiteTotal.toFixed(1)}</strong> 目`,
      `<span class="go-result-note">（簡化規則，僅供休閒參考）</span>`,
    ].join("<br/>");

    document.querySelector(".go-app").classList.add("go-ended");
  }

  function endByDoublePass() {
    gameEnded = true;
    els.btnPass.disabled = true;
    setStatus("對局結束（連續虛手），已計算目數。");
    showResult();
    redrawBoard();
  }

  function setStatus(t) {
    els.status.textContent = t;
  }

  function updateCellUi(r, c) {
    const cell = cells[idx(r, c)];
    const v = board[idx(r, c)];
    cell.classList.remove("black", "white", "last");
    cell.innerHTML = "";
    if (v === BLACK || v === WHITE) {
      const st = document.createElement("span");
      st.className = "go-stone";
      st.setAttribute("aria-hidden", "true");
      cell.appendChild(st);
      cell.classList.add(v === BLACK ? "black" : "white");
    }
    if (lastMove && lastMove.r === r && lastMove.c === c && v !== EMPTY) {
      cell.classList.add("last");
    }
    cell.disabled = gameEnded || v !== EMPTY;
  }

  function redrawBoard() {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        updateCellUi(r, c);
      }
    }
  }

  function buildBoard() {
    els.board.innerHTML = "";
    cells.length = 0;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "go-cell";
        if (STAR_KEYS.has(idx(r, c))) btn.classList.add("star");
        btn.dataset.row = String(r);
        btn.dataset.col = String(c);
        btn.setAttribute("aria-label", `第 ${r + 1} 行第 ${c + 1} 列`);
        btn.addEventListener("click", () => onClick(r, c));
        els.board.appendChild(btn);
        cells[idx(r, c)] = btn;
      }
    }
  }

  function onClick(r, c) {
    if (gameEnded) return;
    const color = turn;
    const ko = color === BLACK ? koForBlack : koForWhite;
    const snapBefore = serialize(board);
    const res = tryPlay(board, r, c, color, ko);
    if (!res.ok) {
      setStatus(`${reasonText(res.reason)}（輪到${color === BLACK ? "黑" : "白"}棋）`);
      return;
    }
    board = res.board;
    if (color === BLACK) {
      capturedByBlack += res.captures;
      koForWhite = snapBefore;
    } else {
      capturedByWhite += res.captures;
      koForBlack = snapBefore;
    }
    lastMove = { r, c };
    passStreak = 0;
    turn = 3 - color;
    updateHud();
    setStatus(`輪到${turn === BLACK ? "黑" : "白"}棋落子`);
    redrawBoard();
  }

  function onPass() {
    if (gameEnded) return;
    passStreak++;
    turn = 3 - turn;
    lastMove = null;
    if (passStreak >= 2) {
      endByDoublePass();
      return;
    }
    setStatus(`虛手。輪到${turn === BLACK ? "黑" : "白"}棋落子（再虛手一次將結束並計地）`);
    redrawBoard();
  }

  function newGame() {
    board = emptyBoard();
    turn = BLACK;
    lastMove = null;
    capturedByBlack = 0;
    capturedByWhite = 0;
    koForBlack = null;
    koForWhite = null;
    passStreak = 0;
    gameEnded = false;
    els.btnPass.disabled = false;
    els.result.classList.add("hidden");
    els.result.textContent = "";
    document.querySelector(".go-app").classList.remove("go-ended");
    updateHud();
    setStatus("輪到黑棋落子");
    redrawBoard();
  }

  els.btnNew.addEventListener("click", newGame);
  els.btnPass.addEventListener("click", onPass);

  buildBoard();
  newGame();
})();
