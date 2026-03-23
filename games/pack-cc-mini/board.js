(function () {
  var SIZE = 5;

  var PLAYERS = {
    white: { label: "White", className: "piece piece--white" },
    black: { label: "Black", className: "piece piece--black" },
  };

  var boardEl = document.getElementById("board");
  var statusEl = document.getElementById("status");
  var turnEl = document.getElementById("turn-indicator");
  var btnNew = document.getElementById("btn-new-game");

  if (!boardEl || !statusEl || !btnNew) return;

  var state = {
    cells: [],
    current: "white",
    winner: null,
    winning: null,
  };

  function emptyBoard() {
    var rows = [];
    for (var r = 0; r < SIZE; r++) {
      var row = [];
      for (var c = 0; c < SIZE; c++) row.push(null);
      rows.push(row);
    }
    return rows;
  }

  function allLines() {
    var lines = [];
    var r, c, i;
    for (r = 0; r < SIZE; r++) {
      var row = [];
      for (c = 0; c < SIZE; c++) row.push([r, c]);
      lines.push(row);
    }
    for (c = 0; c < SIZE; c++) {
      var col = [];
      for (r = 0; r < SIZE; r++) col.push([r, c]);
      lines.push(col);
    }
    var d1 = [];
    var d2 = [];
    for (i = 0; i < SIZE; i++) {
      d1.push([i, i]);
      d2.push([i, SIZE - 1 - i]);
    }
    lines.push(d1, d2);
    return lines;
  }

  var LINES = allLines();

  function checkWinner(cells) {
    for (var L = 0; L < LINES.length; L++) {
      var line = LINES[L];
      var first = cells[line[0][0]][line[0][1]];
      if (!first) continue;
      var ok = true;
      for (var k = 1; k < line.length; k++) {
        var p = cells[line[k][0]][line[k][1]];
        if (p !== first) {
          ok = false;
          break;
        }
      }
      if (ok) return { side: first, coords: line };
    }
    return null;
  }

  function boardFull(cells) {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (!cells[r][c]) return false;
      }
    }
    return true;
  }

  function setStatus() {
    statusEl.classList.remove("win", "draw");
    statusEl.removeAttribute("data-side");

    if (state.winner === "draw") {
      statusEl.textContent = "Draw — board full.";
      statusEl.classList.add("draw");
      if (turnEl) turnEl.hidden = true;
      return;
    }

    if (state.winner) {
      statusEl.textContent = PLAYERS[state.winner].label + " wins — five in a row.";
      statusEl.classList.add("win");
      statusEl.setAttribute("data-side", state.winner);
      if (turnEl) turnEl.hidden = true;
      return;
    }

    statusEl.textContent = PLAYERS[state.current].label + " to move";
    statusEl.setAttribute("data-side", state.current);
    if (turnEl) {
      turnEl.hidden = false;
      var dot = turnEl.querySelector(".turn-dot");
      if (dot) {
        dot.className = "turn-dot turn-dot--" + state.current;
      }
    }
  }

  function render() {
    boardEl.innerHTML = "";
    var winSet = {};
    if (state.winning) {
      for (var w = 0; w < state.winning.length; w++) {
        var pr = state.winning[w];
        winSet[pr[0] + "," + pr[1]] = true;
      }
    }

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var sq = document.createElement("button");
        sq.type = "button";
        sq.className =
          "square square--" + ((r + c) % 2 === 0 ? "light" : "dark");
        sq.setAttribute("aria-label", "Row " + (r + 1) + ", column " + (c + 1));
        if (winSet[r + "," + c]) sq.classList.add("square--win");

        var side = state.cells[r][c];
        if (side) {
          var piece = document.createElement("span");
          piece.className = PLAYERS[side].className;
          piece.setAttribute("aria-hidden", "true");
          sq.appendChild(piece);
        }

        var gameOver = state.winner !== null;
        sq.disabled = gameOver || side !== null;

        sq.addEventListener("click", (function (row, col) {
          return function () {
            if (state.winner || state.cells[row][col]) return;
            state.cells[row][col] = state.current;
            var result = checkWinner(state.cells);
            if (result) {
              state.winner = result.side;
              state.winning = result.coords;
            } else if (boardFull(state.cells)) {
              state.winner = "draw";
            } else {
              state.current = state.current === "white" ? "black" : "white";
            }
            render();
            setStatus();
          };
        })(r, c));

        boardEl.appendChild(sq);
      }
    }
    setStatus();
  }

  function newGame() {
    state.cells = emptyBoard();
    state.current = "white";
    state.winner = null;
    state.winning = null;
    render();
  }

  btnNew.addEventListener("click", newGame);
  newGame();
})();
