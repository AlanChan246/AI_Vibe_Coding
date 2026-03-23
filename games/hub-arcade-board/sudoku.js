(function () {
  "use strict";

  /** 保留提示數：越多越簡單 */
  const CLUES = { easy: 40, medium: 32, hard: 26 };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** @param {number[]} grid @param {number} pos @param {number} num */
  function isValidPlacement(grid, pos, num) {
    if (num === 0) return true;
    const r = (pos / 9) | 0;
    const c = pos % 9;
    for (let i = 0; i < 9; i++) {
      const pRow = r * 9 + i;
      if (pRow !== pos && grid[pRow] === num) return false;
      const pCol = i * 9 + c;
      if (pCol !== pos && grid[pCol] === num) return false;
    }
    const br = (r / 3) | 0;
    const bc = (c / 3) | 0;
    for (let i = br * 3; i < br * 3 + 3; i++) {
      for (let j = bc * 3; j < bc * 3 + 3; j++) {
        const p = i * 9 + j;
        if (p !== pos && grid[p] === num) return false;
      }
    }
    return true;
  }

  /** @param {number[]} grid */
  function solveSudoku(grid) {
    let pos = -1;
    for (let i = 0; i < 81; i++) {
      if (grid[i] === 0) {
        pos = i;
        break;
      }
    }
    if (pos === -1) return true;
    for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (isValidPlacement(grid, pos, n)) {
        grid[pos] = n;
        if (solveSudoku(grid)) return true;
        grid[pos] = 0;
      }
    }
    return false;
  }

  /** @param {number[]} grid */
  function fillDiagonalBoxes(grid) {
    for (let b = 0; b < 3; b++) {
      const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      let k = 0;
      for (let r = b * 3; r < b * 3 + 3; r++) {
        for (let c = b * 3; c < b * 3 + 3; c++) {
          grid[r * 9 + c] = nums[k++];
        }
      }
    }
  }

  /**
   * @param {number} clueCount
   * @returns {{ puzzle: number[]; solution: number[]; given: boolean[] } | null}
   */
  function generatePuzzle(clueCount) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const grid = new Array(81).fill(0);
      fillDiagonalBoxes(grid);
      if (!solveSudoku(grid)) continue;
      const solution = grid.slice();
      const puzzle = solution.slice();
      const positions = shuffle(
        Array.from({ length: 81 }, (_, i) => i)
      );
      const toClear = 81 - clueCount;
      for (let i = 0; i < toClear; i++) {
        puzzle[positions[i]] = 0;
      }
      const given = puzzle.map((v) => v !== 0);
      return { puzzle, solution, given };
    }
    return null;
  }

  /** @param {number[]} grid */
  function conflictSet(grid) {
    const bad = new Set();

    for (let r = 0; r < 9; r++) {
      const byVal = new Map();
      for (let c = 0; c < 9; c++) {
        const p = r * 9 + c;
        const v = grid[p];
        if (v === 0) continue;
        if (!byVal.has(v)) byVal.set(v, []);
        byVal.get(v).push(p);
      }
      for (const arr of byVal.values()) {
        if (arr.length > 1) arr.forEach((p) => bad.add(p));
      }
    }

    for (let c = 0; c < 9; c++) {
      const byVal = new Map();
      for (let r = 0; r < 9; r++) {
        const p = r * 9 + c;
        const v = grid[p];
        if (v === 0) continue;
        if (!byVal.has(v)) byVal.set(v, []);
        byVal.get(v).push(p);
      }
      for (const arr of byVal.values()) {
        if (arr.length > 1) arr.forEach((p) => bad.add(p));
      }
    }

    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const byVal = new Map();
        for (let r = br * 3; r < br * 3 + 3; r++) {
          for (let c = bc * 3; c < bc * 3 + 3; c++) {
            const p = r * 9 + c;
            const v = grid[p];
            if (v === 0) continue;
            if (!byVal.has(v)) byVal.set(v, []);
            byVal.get(v).push(p);
          }
        }
        for (const arr of byVal.values()) {
          if (arr.length > 1) arr.forEach((p) => bad.add(p));
        }
      }
    }

    return bad;
  }

  let solution = new Array(81).fill(0);
  let given = new Array(81).fill(false);
  let grid = new Array(81).fill(0);
  let selected = -1;
  let won = false;

  const els = {
    root: document.querySelector(".sudoku-app"),
    grid: document.getElementById("sudoku-grid"),
    status: document.getElementById("sudoku-status"),
    btnNew: document.getElementById("sudoku-new"),
    btnClear: document.getElementById("sudoku-clear"),
    btnErase: document.getElementById("sudoku-erase"),
  };

  const cells = [];

  function getDifficulty() {
    const el = document.querySelector('input[name="sudoku-diff"]:checked');
    return el ? el.value : "easy";
  }

  function setStatus(t) {
    els.status.textContent = t;
  }

  function isSolved() {
    for (let i = 0; i < 81; i++) {
      if (grid[i] === 0) return false;
      if (grid[i] !== solution[i]) return false;
    }
    return conflictSet(grid).size === 0;
  }

  function render() {
    const conflicts = conflictSet(grid);
    for (let i = 0; i < 81; i++) {
      const btn = cells[i];
      const v = grid[i];
      btn.textContent = v === 0 ? "" : String(v);
      btn.classList.toggle("given", given[i]);
      btn.classList.toggle("selected", selected === i);
      btn.classList.toggle("conflict", conflicts.has(i));
      btn.disabled = won || given[i];
      btn.setAttribute(
        "aria-label",
        `第 ${((i / 9) | 0) + 1} 行第 ${(i % 9) + 1} 列${given[i] ? "，題目提示" : ""}${v ? `，${v}` : "，空白"}`
      );
    }
  }

  function buildDom() {
    els.grid.innerHTML = "";
    cells.length = 0;
    for (let i = 0; i < 81; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sudoku-cell";
      btn.addEventListener("click", () => {
        if (won) return;
        selected = given[i] ? selected : i;
        render();
      });
      els.grid.appendChild(btn);
      cells.push(btn);
    }
  }

  function newGame() {
    won = false;
    selected = -1;
    els.root.classList.remove("sudoku-won");
    const diff = getDifficulty();
    const clues = CLUES[diff] ?? CLUES.easy;
    const gen = generatePuzzle(clues);
    if (!gen) {
      setStatus("產生題目失敗，請再按「新題目」。");
      return;
    }
    solution = gen.solution;
    given = gen.given;
    grid = gen.puzzle.slice();
    setStatus(
      diff === "easy"
        ? "新題目（簡單）。點格子後填入數字。"
        : diff === "medium"
          ? "新題目（普通）。"
          : "新題目（困難）。"
    );
    render();
  }

  function clearUserEntries() {
    if (won) return;
    for (let i = 0; i < 81; i++) {
      if (!given[i]) grid[i] = 0;
    }
    setStatus("已清除所有自行填寫的數字。");
    render();
  }

  function placeDigit(d) {
    if (won || selected < 0 || given[selected]) return;
    grid[selected] = d;
    if (isSolved()) {
      won = true;
      els.root.classList.add("sudoku-won");
      setStatus("恭喜完成！可按「新題目」再玩一局。");
      cells.forEach((c) => c.classList.add("win-pulse"));
      setTimeout(() => {
        cells.forEach((c) => c.classList.remove("win-pulse"));
      }, 700);
    } else {
      const bad = conflictSet(grid);
      setStatus(
        bad.size
          ? "有數字與同行、同列或同宮衝突（紅底標示）。"
          : "繼續加油。"
      );
    }
    render();
  }

  function eraseCell() {
    if (won || selected < 0 || given[selected]) return;
    grid[selected] = 0;
    setStatus("已清除此格。");
    render();
  }

  els.btnNew.addEventListener("click", newGame);
  els.btnClear.addEventListener("click", clearUserEntries);
  els.btnErase.addEventListener("click", eraseCell);

  document.querySelectorAll(".pad-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const d = parseInt(btn.getAttribute("data-digit"), 10);
      if (d >= 1 && d <= 9) placeDigit(d);
    });
  });

  document.querySelectorAll('input[name="sudoku-diff"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!won) setStatus("難度已變更，按「新題目」開始。");
    });
  });

  document.addEventListener("keydown", (e) => {
    if (won) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    const k = e.key;
    if (k >= "1" && k <= "9") {
      e.preventDefault();
      placeDigit(parseInt(k, 10));
    } else if (k === "Backspace" || k === "Delete" || k === "0") {
      e.preventDefault();
      eraseCell();
    }
  });

  buildDom();
  newGame();
})();
