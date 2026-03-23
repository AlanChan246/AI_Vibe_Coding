(function () {
  "use strict";

  const LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  const boardEl = document.getElementById("ttt-board");
  const statusEl = document.getElementById("ttt-status");
  const thinkEl = document.getElementById("ttt-think");
  const overlay = document.getElementById("ttt-overlay");
  const overlayTitle = document.getElementById("ttt-overlay-title");
  const overlayMsg = document.getElementById("ttt-overlay-msg");
  const btnAgain = document.getElementById("btn-again");
  const btnRestart = document.getElementById("btn-restart");
  const stageEls = document.querySelectorAll(".ttt-stage");

  let cells = Array(9).fill(null);
  let level = 1;
  let locked = false;

  function setStages() {
    stageEls.forEach((el, i) => {
      const n = i + 1;
      el.classList.remove("current", "done");
      if (n < level) el.classList.add("done");
      else if (n === level) el.classList.add("current");
    });
  }

  function winner(board) {
    for (const [a, b, c] of LINES) {
      if (board[a] && board[a] === board[b] && board[b] === board[c]) {
        return board[a];
      }
    }
    return null;
  }

  function full(board) {
    return board.every(Boolean);
  }

  function emptyIndices(board) {
    const out = [];
    for (let i = 0; i < 9; i++) if (board[i] === null) out.push(i);
    return out;
  }

  function randomMove(board) {
    const e = emptyIndices(board);
    return e[Math.floor(Math.random() * e.length)];
  }

  function winOrBlockMove(board, player) {
    for (const i of emptyIndices(board)) {
      const copy = board.slice();
      copy[i] = player;
      if (winner(copy) === player) return i;
    }
    return null;
  }

  function aiMoveLevel2(board) {
    const w = winOrBlockMove(board, "O");
    if (w !== null) return w;
    const b = winOrBlockMove(board, "X");
    if (b !== null) return b;
    if (board[4] === null) return 4;
    const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
    return randomMove(board);
  }

  function minimax(board, aiTurn) {
    const w = winner(board);
    if (w === "O") return { score: 10 };
    if (w === "X") return { score: -10 };
    if (full(board)) return { score: 0 };

    const empties = emptyIndices(board);
    if (aiTurn) {
      let best = { score: -Infinity, index: empties[0] };
      for (const i of empties) {
        const next = board.slice();
        next[i] = "O";
        const s = minimax(next, false).score;
        if (s > best.score) best = { score: s, index: i };
      }
      return best;
    }
    let best = { score: Infinity, index: empties[0] };
    for (const i of empties) {
      const next = board.slice();
      next[i] = "X";
      const s = minimax(next, true).score;
      if (s < best.score) best = { score: s, index: i };
    }
    return best;
  }

  function aiMoveLevel3(board) {
    if (board.every((x) => x === null)) return randomMove(board);
    return minimax(board, true).index;
  }

  function pickAiMove(board) {
    if (level === 1) return randomMove(board);
    if (level === 2) return aiMoveLevel2(board);
    // 完全極小極大時雙方理論上多為和棋；略帶失誤才保留「過關」樂趣
    if (Math.random() < 0.3) return aiMoveLevel2(board);
    return aiMoveLevel3(board);
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ttt-cell";
      btn.setAttribute("aria-label", `格子 ${i + 1}`);
      const v = cells[i];
      if (v) {
        btn.textContent = v;
        btn.classList.add(v === "X" ? "x" : "o");
        btn.disabled = true;
      } else {
        btn.disabled = locked;
        btn.addEventListener("click", () => onPlayerMove(i));
      }
      boardEl.appendChild(btn);
    }
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function showThink(on) {
    thinkEl.classList.toggle("hidden", !on);
    thinkEl.setAttribute("aria-hidden", on ? "false" : "true");
  }

  function showOverlay(title, msg, restartFull, btnLabel) {
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    if (btnLabel) btnAgain.textContent = btnLabel;
    else btnAgain.textContent = restartFull ? "從第一關重來" : "下一關";
    overlay.classList.remove("hidden");
    locked = true;
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function onPlayerMove(i) {
    if (locked || cells[i] !== null) return;
    cells[i] = "X";
    locked = true;
    renderBoard();

    const w = winner(cells);
    if (w === "X") {
      if (level < 3) {
        showOverlay("過關！", `第 ${level} 關勝利。準備進入第 ${level + 1} 關。`, false);
      } else {
        showOverlay("恭喜通關！", "你已連過三關，打敗所有難度的電腦。", true);
      }
      return;
    }
    if (full(cells)) {
      showOverlay("平手", "本關平手，請再挑戰同一關。", false, "再打本關");
      return;
    }

    setStatus(`第 ${level} 關 · 電腦（○）落子中…`);
    showThink(true);
    window.setTimeout(() => {
      const j = pickAiMove(cells);
      cells[j] = "O";
      showThink(false);

      const w2 = winner(cells);
      if (w2 === "O") {
        showOverlay("挑戰失敗", "電腦獲勝，將從第一關重新開始。", true);
        return;
      }
      if (full(cells)) {
        showOverlay("平手", "本關平手，請再挑戰同一關。", false, "再打本關");
        return;
      }

      locked = false;
      setStatus(`第 ${level} 關 · 輪到你（✕）`);
      renderBoard();
    }, 380);
  }

  function resetRound() {
    cells = Array(9).fill(null);
    locked = false;
    setStages();
    setStatus(`第 ${level} 關 · 輪到你（✕）`);
    renderBoard();
  }

  function startFromLevel1() {
    level = 1;
    hideOverlay();
    resetRound();
  }

  btnAgain.addEventListener("click", () => {
    if (btnAgain.textContent === "從第一關重來") {
      startFromLevel1();
      return;
    }
    if (overlayTitle.textContent === "恭喜通關！") {
      startFromLevel1();
      return;
    }
    if (overlayTitle.textContent === "過關！") {
      level += 1;
      hideOverlay();
      resetRound();
      return;
    }
    hideOverlay();
    resetRound();
  });

  btnRestart.addEventListener("click", () => {
    startFromLevel1();
  });

  setStages();
  setStatus(`第 ${level} 關 · 輪到你（✕）`);
  renderBoard();
})();
