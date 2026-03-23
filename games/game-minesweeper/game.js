(function () {
  "use strict";

  const STORAGE_KEY = "minesGameBalance";
  const DEFAULT_BALANCE = 100;
  const GRID_MIN = 5;
  const GRID_MAX = 24;

  /** Payout tuning (see payoutMultiplier). */
  const PAYOUT_H = 0.05; // house edge (0..1)
  const PAYOUT_B0 = 100; // scale bet for growth
  const PAYOUT_ALPHA = 0.5; // growth exponent (0 < alpha <= 1)
  const PAYOUT_MCAP = 1000; // max multiplier; use Infinity for no cap

  const balanceDisplay = document.getElementById("balanceDisplay");
  const gridSizeInput = document.getElementById("gridSize");
  const mineCountInput = document.getElementById("mineCount");
  const betAmountInput = document.getElementById("betAmount");
  const safeCellsToWinInput = document.getElementById("safeCellsToWin");
  const newGameBtn = document.getElementById("newGameBtn");
  const statusText = document.getElementById("statusText");
  const boardEl = document.getElementById("board");

  /** @type {number} */
  let balance = DEFAULT_BALANCE;
  /** @type {'idle' | 'playing' | 'won' | 'lost'} */
  let phase = "idle";
  /** @type {number} */
  let n = 8;
  /** @type {number} */
  let minesTarget = 10;
  /** @type {number} */
  let currentBet = 0;
  /** @type {number} Safe reveals to win this round (ceil(bet × 1.5) at start). */
  let roundRequiredSafe = 0;
  /** @type {boolean[]} */
  let isMine = [];
  /** @type {boolean[]} */
  let revealed = [];
  /** @type {boolean} */
  let minesPlaced = false;

  function loadBalance() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return DEFAULT_BALANCE;
      const v = Number.parseInt(raw, 10);
      return Number.isFinite(v) && v >= 0 ? v : DEFAULT_BALANCE;
    } catch {
      return DEFAULT_BALANCE;
    }
  }

  function saveBalance() {
    try {
      localStorage.setItem(STORAGE_KEY, String(balance));
    } catch {
      /* ignore quota / private mode */
    }
  }

  function formatMoney(x) {
    return "$" + x;
  }

  /** Bet dollars : required safe cell clicks = 1 : 1.5 (rounded up). */
  function requiredSafeCellsForBet(bet) {
    return Math.ceil(bet * 1.5);
  }

  function updateSafeCellsToWinDisplay() {
    if (phase === "playing") {
      safeCellsToWinInput.value = String(roundRequiredSafe);
      return;
    }
    const bet = Number.parseInt(betAmountInput.value, 10);
    const b = Number.isFinite(bet) && bet >= 1 ? bet : 1;
    safeCellsToWinInput.value = String(requiredSafeCellsForBet(b));
  }

  function updateBalanceUI() {
    balanceDisplay.textContent = "Balance: " + formatMoney(balance);
    const maxBet = Math.max(1, balance);
    betAmountInput.max = String(maxBet);
    if (Number(betAmountInput.value) > maxBet) {
      betAmountInput.value = String(maxBet);
    }
    updateSafeCellsToWinDisplay();
    newGameBtn.disabled = balance < 1 || phase === "playing";
  }

  /**
   * x: bet, y: required safe cells, totalCells: N×N grid size.
   * Returns M so total credit on win is floor(x * M) (stake already deducted at round start).
   */
  function payoutMultiplier(x, y, totalCells) {
    const p = y / totalCells;
    if (p <= 0) return 0;
    const fair = (1 - PAYOUT_H) / p;
    const g = 1 + Math.pow(x / PAYOUT_B0, PAYOUT_ALPHA);
    const M = fair * g;
    return Math.min(M, PAYOUT_MCAP);
  }

  function maxMinesFor(gridN) {
    return gridN * gridN - 1;
  }

  function syncMineInputBounds() {
    const max = maxMinesFor(n);
    mineCountInput.max = String(max);
    let m = Number.parseInt(mineCountInput.value, 10);
    if (!Number.isFinite(m)) m = 1;
    m = Math.max(1, Math.min(max, m));
    mineCountInput.value = String(m);
    minesTarget = m;
  }

  function setStatus(msg) {
    statusText.textContent = msg;
  }

  function setControlsPlaying(playing) {
    gridSizeInput.disabled = playing;
    mineCountInput.disabled = playing;
    betAmountInput.disabled = playing;
    safeCellsToWinInput.disabled = playing;
  }

  /** Fisher–Yates shuffle first `count` indices of `arr` */
  function shuffleSlice(arr, count) {
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
  }

  function placeMines(safeIndex) {
    const total = n * n;
    const indices = [];
    for (let i = 0; i < total; i++) {
      if (i !== safeIndex) indices.push(i);
    }
    shuffleSlice(indices, indices.length);
    isMine = new Array(total).fill(false);
    for (let k = 0; k < minesTarget; k++) {
      isMine[indices[k]] = true;
    }
    minesPlaced = true;
  }

  function countRevealedSafe() {
    let c = 0;
    const total = n * n;
    for (let i = 0; i < total; i++) {
      if (revealed[i] && !isMine[i]) c++;
    }
    return c;
  }

  function revealAllMines() {
    const total = n * n;
    for (let i = 0; i < total; i++) {
      if (isMine[i]) revealed[i] = true;
    }
  }

  function syncCellButton(btn, index) {
    const mine = isMine[index];
    const rev = revealed[index];
    btn.classList.remove("revealed", "safe", "mine");
    if (rev) {
      btn.classList.add("revealed", mine ? "mine" : "safe");
      btn.textContent = mine ? "✕" : "";
      btn.disabled = true;
    } else {
      btn.textContent = "";
      btn.disabled = phase !== "playing";
    }
  }

  function buildGrid() {
    boardEl.replaceChildren();
    boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    const total = n * n;
    isMine = new Array(total).fill(false);
    revealed = new Array(total).fill(false);
    minesPlaced = false;

    for (let i = 0; i < total; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell";
      btn.dataset.index = String(i);
      btn.addEventListener("click", () => onCellClick(i));
      syncCellButton(btn, i);
      boardEl.appendChild(btn);
    }
  }

  function refreshAllCells() {
    const buttons = boardEl.querySelectorAll(".cell");
    buttons.forEach((btn, i) => syncCellButton(btn, i));
  }

  function setBoardIdleVisual(idle) {
    boardEl.classList.toggle("is-idle", idle);
  }

  function startNewGame() {
    n = Number.parseInt(gridSizeInput.value, 10);
    if (!Number.isFinite(n)) n = 8;
    n = Math.max(GRID_MIN, Math.min(GRID_MAX, n));
    gridSizeInput.value = String(n);

    syncMineInputBounds();
    minesTarget = Number.parseInt(mineCountInput.value, 10);
    if (!Number.isFinite(minesTarget)) minesTarget = 1;
    minesTarget = Math.max(1, Math.min(maxMinesFor(n), minesTarget));
    mineCountInput.value = String(minesTarget);

    const bet = Number.parseInt(betAmountInput.value, 10);
    if (!Number.isFinite(bet) || bet < 1) {
      setStatus("Enter a valid bet (at least $1).");
      return;
    }
    if (bet > balance) {
      setStatus("Bet cannot exceed your balance.");
      return;
    }

    const needSafe = requiredSafeCellsForBet(bet);
    const maxSafe = n * n - minesTarget;
    if (needSafe > maxSafe) {
      setStatus(
        `This bet needs ${needSafe} safe cells, but the board only has ${maxSafe}. Increase grid size, reduce mines, or lower the bet.`
      );
      return;
    }

    roundRequiredSafe = needSafe;
    balance -= bet;
    currentBet = bet;
    saveBalance();
    updateBalanceUI();

    phase = "playing";
    setControlsPlaying(true);
    newGameBtn.disabled = true;
    setBoardIdleVisual(false);
    updateSafeCellsToWinDisplay();
    setStatus(
      `Click safe cells (${0} / ${roundRequiredSafe}). First click is always safe.`
    );
    buildGrid();
  }

  function onCellClick(index) {
    if (phase !== "playing") return;

    if (revealed[index]) return;

    if (!minesPlaced) {
      placeMines(index);
    }

    revealed[index] = true;

    if (isMine[index]) {
      phase = "lost";
      revealAllMines();
      refreshAllCells();
      setControlsPlaying(false);
      updateBalanceUI();
      setStatus("Hit a mine — you lose this round.");
      return;
    }

    refreshAllCells();

    const revealedSafe = countRevealedSafe();
    if (phase === "playing") {
      setStatus(`Reveal safe cells: ${revealedSafe} / ${roundRequiredSafe}.`);
    }

    if (revealedSafe >= roundRequiredSafe) {
      phase = "won";
      const totalCells = n * n;
      const M = payoutMultiplier(currentBet, roundRequiredSafe, totalCells);
      const payout = Math.floor(currentBet * M);
      balance += payout;
      saveBalance();
      revealAllMines();
      refreshAllCells();
      setControlsPlaying(false);
      updateBalanceUI();
      const net = payout - currentBet;
      setStatus(
        `Hit ${roundRequiredSafe} safe cells! Payout ${formatMoney(payout)} (×${M.toFixed(2)}, net ${formatMoney(net)}).`
      );
    }
  }

  function init() {
    balance = loadBalance();
    saveBalance();
    updateBalanceUI();

    n = Number.parseInt(gridSizeInput.value, 10);
    if (!Number.isFinite(n)) n = 8;
    n = Math.max(GRID_MIN, Math.min(GRID_MAX, n));
    gridSizeInput.value = String(n);
    syncMineInputBounds();

    phase = "idle";
    setControlsPlaying(false);
    setBoardIdleVisual(true);
    setStatus("Set options and press New game to stake your bet.");
    buildGrid();
    refreshAllCells();
  }

  gridSizeInput.addEventListener("change", () => {
    if (phase === "playing") return;
    n = Number.parseInt(gridSizeInput.value, 10);
    if (!Number.isFinite(n)) n = 8;
    n = Math.max(GRID_MIN, Math.min(GRID_MAX, n));
    gridSizeInput.value = String(n);
    syncMineInputBounds();
    buildGrid();
    refreshAllCells();
  });

  mineCountInput.addEventListener("change", () => {
    if (phase === "playing") return;
    syncMineInputBounds();
  });

  betAmountInput.addEventListener("input", () => {
    if (phase === "playing") return;
    updateSafeCellsToWinDisplay();
  });

  betAmountInput.addEventListener("change", () => {
    if (phase === "playing") return;
    updateBalanceUI();
  });

  newGameBtn.addEventListener("click", () => {
    if (phase === "playing") return;
    startNewGame();
  });

  init();
})();
