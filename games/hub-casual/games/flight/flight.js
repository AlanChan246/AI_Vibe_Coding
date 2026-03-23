(function () {
  "use strict";

  const L = 32;
  const ENTRY = [0, 8, 16, 24];
  const NAMES = ["紅方", "黃方", "藍方", "綠方"];
  const NUM_P = 4;
  const PER = 4;

  /** @type {{ r: number, c: number }[]} */
  const PATH_LAYOUT = [];
  for (let c = 0; c < 8; c++) PATH_LAYOUT.push({ r: 0, c });
  for (let c = 7; c >= 0; c--) PATH_LAYOUT.push({ r: 1, c });
  for (let c = 0; c < 8; c++) PATH_LAYOUT.push({ r: 2, c });
  for (let c = 7; c >= 0; c--) PATH_LAYOUT.push({ r: 3, c });

  const invPath = new Map();
  for (let i = 0; i < L; i++) {
    const p = PATH_LAYOUT[i];
    invPath.set(`${p.r},${p.c}`, i);
  }

  /**
   * @typedef {{ id: number, pl: number, pos: number, left: boolean, done: boolean }} Piece
   */

  /** @type {Piece[]} */
  let pieces = [];
  let turn = 0;
  /** @type {number|null} */
  let diceVal = null;
  /** @type {number|null} */
  let selectedId = null;

  const elBoard = document.getElementById("board");
  const elHangars = document.getElementById("hangars");
  const elDice = document.getElementById("dice");
  const elTurn = document.getElementById("turn-label");
  const elStatus = document.getElementById("status");
  const btnRoll = document.getElementById("btn-roll");
  const btnNew = document.getElementById("btn-new");

  function pieceAt(pos) {
    return pieces.filter((p) => !p.done && p.pos === pos);
  }

  function hangarCount(pl) {
    return pieces.filter((p) => p.pl === pl && p.pos < 0 && !p.done).length;
  }

  function canLaunch(pl) {
    const e = ENTRY[pl];
    const on = pieceAt(e).filter((p) => p.pl === pl);
    return on.length === 0;
  }

  /** @param {Piece} pc @param {number} d */
  function tryMove(pc, d) {
    const E = ENTRY[pc.pl];
    let pos = pc.pos;
    let left = pc.left;

    for (let s = 1; s <= d; s++) {
      pos = (pos + 1) % L;
      if (pos === E && left) {
        if (s === d) {
          pc.done = true;
          pc.pos = -2;
          return true;
        }
        const bounce = d - s;
        pos = (E - bounce + L) % L;
        pc.pos = pos;
        pc.left = true;
        captureAt(pc);
        return true;
      }
      if (pos === E && !left) {
        left = true;
      }
    }

    const block = pieceAt(pos).find((x) => x.pl === pc.pl);
    if (block && block.id !== pc.id) {
      return false;
    }

    pc.pos = pos;
    pc.left = left;
    captureAt(pc);
    return true;
  }

  /** @param {Piece} mover */
  function captureAt(mover) {
    const at = pieceAt(mover.pos).filter((p) => p.id !== mover.id && p.pl !== mover.pl);
    for (const v of at) {
      v.pos = -1;
      v.left = false;
    }
  }

  /** @param {Piece} pc @param {number} d */
  function previewLegal(pc, d) {
    if (pc.done) return false;
    if (pc.pos < 0) {
      if (d !== 5 && d !== 6) return false;
      if (!canLaunch(pc.pl)) return false;
      return true;
    }
    const E = ENTRY[pc.pl];
    let pos = pc.pos;
    let left = pc.left;
    for (let s = 1; s <= d; s++) {
      pos = (pos + 1) % L;
      if (pos === E && left) {
        if (s === d) return true;
        const bounce = d - s;
        pos = (E - bounce + L) % L;
        const block = pieceAt(pos).filter((x) => x.pl === pc.pl && x.id !== pc.id);
        return block.length === 0;
      }
      if (pos === E && !left) left = true;
    }
    const block = pieceAt(pos).find((x) => x.pl === pc.pl && x.id !== pc.id);
    return !block;
  }

  function legalPiecesForTurn() {
    if (diceVal == null) return [];
    return pieces.filter((p) => p.pl === turn && !p.done && previewLegal(p, diceVal));
  }

  function initPieces() {
    pieces = [];
    let id = 0;
    for (let pl = 0; pl < NUM_P; pl++) {
      for (let i = 0; i < PER; i++) {
        pieces.push({ id: id++, pl, pos: -1, left: false, done: false });
      }
    }
  }

  function winner() {
    for (let pl = 0; pl < NUM_P; pl++) {
      if (pieces.filter((p) => p.pl === pl && p.done).length === PER) return pl;
    }
    return null;
  }

  function buildBoardDom() {
    elBoard.innerHTML = "";
    elBoard.style.gridTemplateRows = `repeat(4, 1fr)`;
    const cells = [];
    for (let r = 0; r < 4; r++) {
      cells[r] = [];
      for (let c = 0; c < 8; c++) {
        const idx = invPath.get(`${r},${c}`);
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.path = String(idx);
        for (let pl = 0; pl < NUM_P; pl++) {
          if (ENTRY[pl] === idx) cell.classList.add(`entry-${pl}`);
        }
        cell.innerHTML = `<span style="opacity:.35">${idx}</span>`;
        elBoard.appendChild(cell);
        cells[r][c] = cell;
      }
    }
  }

  function buildHangars() {
    elHangars.innerHTML = "";
    for (let pl = 0; pl < NUM_P; pl++) {
      const box = document.createElement("div");
      box.className = `hangar-box p${pl}`;
      box.innerHTML = `<h3>${NAMES[pl]}</h3><div class="tokens" data-pl="${pl}"></div>`;
      elHangars.appendChild(box);
    }
  }

  function render() {
    document.querySelectorAll(".cell").forEach((cell) => {
      const idx = Number(cell.dataset.path);
      cell.querySelectorAll(".token").forEach((t) => t.remove());
      const ps = pieceAt(idx);
      for (const p of ps) {
        const t = document.createElement("span");
        t.className = `token p${p.pl}`;
        t.title = `${NAMES[p.pl]} #${p.id}`;
        cell.appendChild(t);
      }
      cell.classList.remove("selectable");
    });

    for (let pl = 0; pl < NUM_P; pl++) {
      const box = elHangars.querySelector(`[data-pl="${pl}"]`);
      if (!box) continue;
      box.innerHTML = "";
      const hang = pieces.filter((p) => p.pl === pl && p.pos === -1 && !p.done);
      const legal = legalPiecesForTurn();
      for (const p of hang) {
        const t = document.createElement("span");
        t.className = `token p${pl}`;
        if (legal.some((x) => x.id === p.id)) t.classList.add("selectable");
        t.addEventListener("click", () => onPick(p.id));
        box.appendChild(t);
      }
    }

    const legal = legalPiecesForTurn();
    for (const p of legal) {
      if (p.pos >= 0) {
        const cell = elBoard.querySelector(`[data-path="${p.pos}"]`);
        if (cell) {
          cell.classList.add("selectable");
          cell.onclick = () => onPick(p.id);
        }
      }
    }

    elTurn.textContent = `${NAMES[turn]} 的回合`;
    const w = winner();
    if (w != null) {
      elStatus.textContent = `🎉 ${NAMES[w]} 四機全數返航，獲勝！`;
      btnRoll.disabled = true;
      return;
    }
    btnRoll.disabled = diceVal != null;
    if (diceVal == null) {
      elStatus.textContent = "請擲骰，再點選要移動的己方飛機（停機坪或棋格上）。";
    } else {
      const n = legal.length;
      elStatus.textContent =
        n > 0
          ? `點數 ${diceVal}：請選擇一架可移動的飛機（綠框）。`
          : `點數 ${diceVal}：無可走機，換下家。`;
    }
  }

  function onPick(id) {
    const legal = legalPiecesForTurn();
    const pc = legal.find((p) => p.id === id);
    if (!pc || diceVal == null) return;
    if (pc.pos < 0) {
      if (diceVal !== 5 && diceVal !== 6) return;
      if (!canLaunch(pc.pl)) return;
      const e = ENTRY[pc.pl];
      const enemies = pieceAt(e).filter((p) => p.pl !== pc.pl);
      for (const v of enemies) {
        v.pos = -1;
        v.left = false;
      }
      pc.pos = e;
      pc.left = false;
    } else {
      tryMove(pc, diceVal);
    }
    diceVal = null;
    elDice.textContent = "—";
    if (!winner()) {
      turn = (turn + 1) % NUM_P;
      const n = legalPiecesForTurn();
      if (n.length === 0 && diceVal == null) {
        /* already advanced */
      }
    }
    render();
  }

  function roll() {
    if (winner() != null) return;
    if (diceVal != null) return;
    diceVal = 1 + (Math.random() * 6) | 0;
    elDice.textContent = String(diceVal);
    const legal = legalPiecesForTurn();
    if (legal.length === 0) {
      elStatus.textContent = `點數 ${diceVal}：無可走機，換下家。`;
      diceVal = null;
      elDice.textContent = "—";
      turn = (turn + 1) % NUM_P;
    }
    render();
  }

  btnRoll.addEventListener("click", roll);
  btnNew.addEventListener("click", () => {
    turn = 0;
    diceVal = null;
    initPieces();
    btnRoll.disabled = false;
    render();
  });

  buildBoardDom();
  buildHangars();
  initPieces();
  render();
})();
