(function () {
  "use strict";

  var BOARD_DIM = 8;
  var WIN_LEN = 5;
  var STORAGE_KEY = "gomoku_3d_v1";
  var CPU_NAME = "Cat";

  var boardEl = document.getElementById("board");
  var ctx = boardEl.getContext("2d");
  var statusEl = document.getElementById("status");
  var btnNew = document.getElementById("btn-new-game");
  var nameBlackEl = document.getElementById("name-black");
  var nameWhiteEl = document.getElementById("name-white");
  var statsCurrentEl = document.getElementById("stats-current");
  var statsLeaderEl = document.getElementById("stats-leaderboard");
  var modeHintEl = document.getElementById("mode-hint");
  var layerPrevBtn = document.getElementById("layer-prev");
  var layerNextBtn = document.getElementById("layer-next");
  var layerIndicatorEl = document.getElementById("layer-indicator");

  var cpuTimer = null;
  var cpuThinking = false;
  var hoverCell = null;
  var dpr = 1;

  var layoutW = 0;
  var layoutH = 0;
  var viewScale = 1;
  var originX = 0;
  var originY = 0;
  var basePieceR = 1;
  var pickRadius = 18;
  var viewYaw = 0.65;
  var viewPitch = 0.5;
  var PERSP = 5.8;

  var dragBoard = false;
  var lastDragX = 0;
  var lastDragY = 0;
  var dragMoved = 0;
  var suppressClickUntil = 0;
  var audioCtx = null;

  var DIRS_3D = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [1, -1, 0],
    [1, 0, 1],
    [1, 0, -1],
    [0, 1, 1],
    [0, 1, -1],
    [1, 1, 1],
    [1, 1, -1],
    [1, -1, 1],
    [1, -1, -1],
  ];

  var grid = [];
  var currentZ = 0;
  var current = "black";
  var gameOver = false;
  var lastMove = null;

  function emptyGrid() {
    var g = [];
    var z;
    var r;
    var c;
    for (z = 0; z < BOARD_DIM; z++) {
      g[z] = [];
      for (r = 0; r < BOARD_DIM; r++) {
        g[z][r] = [];
        for (c = 0; c < BOARD_DIM; c++) g[z][r][c] = null;
      }
    }
    return g;
  }

  function inBounds3(c, r, z) {
    return (
      c >= 0 &&
      c < BOARD_DIM &&
      r >= 0 &&
      r < BOARD_DIM &&
      z >= 0 &&
      z < BOARD_DIM
    );
  }

  function lineLength3(c, r, z, dc, dr, dz, board) {
    var b = board || grid;
    var color = b[z][r][c];
    var total = 1;
    for (var s = 0; s < 2; s++) {
      var sign = s === 0 ? 1 : -1;
      var nc = c + sign * dc;
      var nr = r + sign * dr;
      var nz = z + sign * dz;
      while (inBounds3(nc, nr, nz) && b[nz][nr][nc] === color) {
        total++;
        nc += sign * dc;
        nr += sign * dr;
        nz += sign * dz;
      }
    }
    return total;
  }

  function checkWinAt(z, r, c) {
    var i;
    for (i = 0; i < DIRS_3D.length; i++) {
      var d = DIRS_3D[i];
      if (lineLength3(c, r, z, d[0], d[1], d[2], grid) >= WIN_LEN) {
        return true;
      }
    }
    return false;
  }

  function checkWinOnBoard3(b, z, r, c) {
    var i;
    for (i = 0; i < DIRS_3D.length; i++) {
      var d = DIRS_3D[i];
      if (lineLength3(c, r, z, d[0], d[1], d[2], b) >= WIN_LEN) {
        return true;
      }
    }
    return false;
  }

  function cloneBoard() {
    var b = [];
    var z;
    var r;
    for (z = 0; z < BOARD_DIM; z++) {
      b[z] = [];
      for (r = 0; r < BOARD_DIM; r++) {
        b[z][r] = grid[z][r].slice();
      }
    }
    return b;
  }

  function boardHasStones3(b) {
    var z;
    var r;
    var c;
    for (z = 0; z < BOARD_DIM; z++) {
      for (r = 0; r < BOARD_DIM; r++) {
        for (c = 0; c < BOARD_DIM; c++) {
          if (b[z][r][c] !== null) return true;
        }
      }
    }
    return false;
  }

  function getCandidateMoves3(b) {
    var out = [];
    var seen = Object.create(null);
    var z;
    var r;
    var c;
    var dz;
    var dr;
    var dc;
    var nz;
    var nr;
    var nc;
    var k;
    if (!boardHasStones3(b)) {
      var mid = (BOARD_DIM / 2) | 0;
      return [[mid, mid, mid]];
    }
    for (z = 0; z < BOARD_DIM; z++) {
      for (r = 0; r < BOARD_DIM; r++) {
        for (c = 0; c < BOARD_DIM; c++) {
          if (b[z][r][c] === null) continue;
          for (dz = -2; dz <= 2; dz++) {
            for (dr = -2; dr <= 2; dr++) {
              for (dc = -2; dc <= 2; dc++) {
                nz = z + dz;
                nr = r + dr;
                nc = c + dc;
                if (
                  !inBounds3(nc, nr, nz) ||
                  b[nz][nr][nc] !== null
                ) {
                  continue;
                }
                k = nz + "," + nr + "," + nc;
                if (seen[k]) continue;
                seen[k] = true;
                out.push([nz, nr, nc]);
              }
            }
          }
        }
      }
    }
    if (out.length === 0) {
      for (z = 0; z < BOARD_DIM; z++) {
        for (r = 0; r < BOARD_DIM; r++) {
          for (c = 0; c < BOARD_DIM; c++) {
            if (b[z][r][c] === null) out.push([z, r, c]);
          }
        }
      }
    }
    return out;
  }

  function maxLineAfterPlace3(b, z, r, c, color) {
    b[z][r][c] = color;
    var m = 0;
    var i;
    for (i = 0; i < DIRS_3D.length; i++) {
      var d = DIRS_3D[i];
      m = Math.max(m, lineLength3(c, r, z, d[0], d[1], d[2], b));
    }
    b[z][r][c] = null;
    return m;
  }

  function chooseComputerMove() {
    var b = cloneBoard();
    var me = "white";
    var opp = "black";
    var cand = getCandidateMoves3(b);
    var i;
    var z;
    var r;
    var c;
    var score;
    var bestScore = -1e12;
    var best = null;

    for (i = 0; i < cand.length; i++) {
      z = cand[i][0];
      r = cand[i][1];
      c = cand[i][2];
      b[z][r][c] = me;
      if (checkWinOnBoard3(b, z, r, c)) {
        b[z][r][c] = null;
        return { z: z, r: r, c: c };
      }
      b[z][r][c] = null;
    }

    for (i = 0; i < cand.length; i++) {
      z = cand[i][0];
      r = cand[i][1];
      c = cand[i][2];
      b[z][r][c] = opp;
      if (checkWinOnBoard3(b, z, r, c)) {
        b[z][r][c] = null;
        return { z: z, r: r, c: c };
      }
      b[z][r][c] = null;
    }

    for (i = 0; i < cand.length; i++) {
      z = cand[i][0];
      r = cand[i][1];
      c = cand[i][2];
      score =
        maxLineAfterPlace3(b, z, r, c, me) * 120 +
        maxLineAfterPlace3(b, z, r, c, opp) * 95 +
        Math.random();
      if (score > bestScore) {
        bestScore = score;
        best = { z: z, r: r, c: c };
      }
    }

    if (!best) {
      for (z = 0; z < BOARD_DIM; z++) {
        for (r = 0; r < BOARD_DIM; r++) {
          for (c = 0; c < BOARD_DIM; c++) {
            if (b[z][r][c] === null) return { z: z, r: r, c: c };
          }
        }
      }
    }

    return best;
  }

  function isCpuMode() {
    var el = document.querySelector('input[name="game-mode"]:checked');
    return !!(el && el.value === "cpu");
  }

  function clearCpuTimer() {
    if (cpuTimer !== null) {
      clearTimeout(cpuTimer);
      cpuTimer = null;
    }
  }

  function syncModeUi() {
    var cpu = isCpuMode();
    if (cpu) {
      nameWhiteEl.disabled = true;
      nameWhiteEl.value = CPU_NAME;
      if (modeHintEl) modeHintEl.hidden = false;
    } else {
      nameWhiteEl.disabled = false;
      if (nameWhiteEl.value === CPU_NAME) nameWhiteEl.value = "";
      if (modeHintEl) modeHintEl.hidden = true;
    }
  }

  function humanInputBlocked() {
    return (
      gameOver ||
      cpuThinking ||
      (isCpuMode() && current === "white")
    );
  }

  function updateBoardCursor() {
    if (humanInputBlocked()) {
      boardEl.classList.add("is-idle");
      boardEl.classList.remove("is-grab", "is-grabbing");
    } else {
      boardEl.classList.remove("is-idle");
      if (!boardEl.classList.contains("is-grabbing")) {
        boardEl.classList.add("is-grab");
      }
    }
  }

  function maybeScheduleComputerMove() {
    if (!isCpuMode() || gameOver) return;
    if (current !== "white") return;
    clearCpuTimer();
    cpuThinking = true;
    updateBoardCursor();
    setStatus(CPU_NAME + " (cat) is thinking…", null);
    redraw();
    cpuTimer = setTimeout(function () {
      cpuTimer = null;
      if (gameOver || current !== "white" || !isCpuMode()) {
        cpuThinking = false;
        updateBoardCursor();
        redraw();
        return;
      }
      cpuThinking = false;
      updateBoardCursor();
      var m = chooseComputerMove();
      if (!m) return;
      applyMove(m.z, m.r, m.c);
    }, 280);
  }

  function boardFull3() {
    var z;
    var r;
    var c;
    for (z = 0; z < BOARD_DIM; z++) {
      for (r = 0; r < BOARD_DIM; r++) {
        for (c = 0; c < BOARD_DIM; c++) {
          if (grid[z][r][c] === null) return false;
        }
      }
    }
    return true;
  }

  function updateLayerIndicator() {
    if (layerIndicatorEl) {
      layerIndicatorEl.textContent = currentZ + 1 + " / " + BOARD_DIM;
    }
  }

  function setCurrentZ(z) {
    if (z < 0 || z >= BOARD_DIM) return;
    currentZ = z;
    updateLayerIndicator();
    hoverCell = null;
    redraw();
  }

  function sideLabel(color) {
    return color === "black" ? "dog" : "cat";
  }

  function resolvedBlackName() {
    var t = (nameBlackEl.value || "").trim();
    return t || "Dog";
  }

  function resolvedWhiteName() {
    if (isCpuMode()) return CPU_NAME;
    var t = (nameWhiteEl.value || "").trim();
    return t || "Cat";
  }

  function loadStatsRaw() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { version: 1, players: {} };
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return { version: 1, players: {} };
      if (!data.players || typeof data.players !== "object") data.players = {};
      return data;
    } catch (e) {
      return { version: 1, players: {} };
    }
  }

  function saveStatsRaw(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      /* ignore quota / private mode */
    }
  }

  function ensurePlayer(players, name) {
    if (!players[name]) {
      players[name] = { wins: 0, losses: 0, draws: 0 };
    }
    return players[name];
  }

  function recordResult(winner) {
    var bName = resolvedBlackName();
    var wName = resolvedWhiteName();
    var data = loadStatsRaw();
    var players = data.players;
    var pb = ensurePlayer(players, bName);
    var pw = ensurePlayer(players, wName);

    if (winner === "draw") {
      pb.draws++;
      pw.draws++;
    } else if (winner === "black") {
      pb.wins++;
      pw.losses++;
    } else {
      pw.wins++;
      pb.losses++;
    }

    saveStatsRaw(data);
    renderStats();
  }

  function gamesPlayed(p) {
    return p.wins + p.losses + p.draws;
  }

  function renderStats() {
    var data = loadStatsRaw();
    var players = data.players;
    var bName = resolvedBlackName();
    var wName = resolvedWhiteName();
    var pb = players[bName];
    var pw = players[wName];

    var rows =
      "<table><thead><tr><th>Player</th><th>Wins</th><th>Losses</th><th>Draws</th><th>Games</th></tr></thead><tbody>";
    rows += rowForPlayer(bName, pb);
    rows += rowForPlayer(wName, pw);
    rows += "</tbody></table>";
    statsCurrentEl.innerHTML = rows;

    var list = Object.keys(players).map(function (name) {
      return { name: name, stats: players[name] };
    });
    list.sort(function (a, b) {
      var dw = b.stats.wins - a.stats.wins;
      if (dw !== 0) return dw;
      return a.name.localeCompare(b.name);
    });

    if (list.length === 0) {
      statsLeaderEl.innerHTML =
        '<p class="stats-empty">No games recorded yet.</p>';
      return;
    }

    var lb =
      "<table><thead><tr><th>Rank</th><th>Player</th><th>Wins</th><th>Games</th></tr></thead><tbody>";
    for (var i = 0; i < list.length; i++) {
      var p = list[i].stats;
      lb +=
        "<tr><td>" +
        (i + 1) +
        "</td><td>" +
        escapeHtml(list[i].name) +
        "</td><td>" +
        p.wins +
        "</td><td>" +
        gamesPlayed(p) +
        "</td></tr>";
    }
    lb += "</tbody></table>";
    statsLeaderEl.innerHTML = lb;
  }

  function rowForPlayer(name, p) {
    if (!p) {
      return (
        "<tr><td>" +
        escapeHtml(name) +
        "</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>"
      );
    }
    return (
      "<tr><td>" +
      escapeHtml(name) +
      "</td><td>" +
      p.wins +
      "</td><td>" +
      p.losses +
      "</td><td>" +
      p.draws +
      "</td><td>" +
      gamesPlayed(p) +
      "</td></tr>"
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("winner", "draw");
    if (kind === "winner") statusEl.classList.add("winner");
    if (kind === "draw") statusEl.classList.add("draw");
  }

  function ensureAudioContext() {
    if (audioCtx) return audioCtx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
      return audioCtx;
    } catch (e) {
      return null;
    }
  }

  function resumeAudioContext() {
    var a = ensureAudioContext();
    if (a && a.state === "suspended") {
      a.resume().catch(function () {});
    }
    return a;
  }

  function makeNoiseBuffer(actx, duration) {
    var rate = actx.sampleRate;
    var n = (rate * duration) | 0;
    var buf = actx.createBuffer(1, n, rate);
    var d = buf.getChannelData(0);
    var i;
    for (i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function playDogBark() {
    var actx = ensureAudioContext();
    if (!actx) return;
    var t0 = actx.currentTime;
    var noiseDur = 0.09;
    var src = actx.createBufferSource();
    src.buffer = makeNoiseBuffer(actx, noiseDur);
    var bp = actx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 920;
    bp.Q.value = 1.35;
    var gN = actx.createGain();
    gN.gain.setValueAtTime(0, t0);
    gN.gain.linearRampToValueAtTime(0.5, t0 + 0.004);
    gN.gain.exponentialRampToValueAtTime(0.008, t0 + noiseDur);
    src.connect(bp);
    bp.connect(gN);
    gN.connect(actx.destination);
    src.start(t0);
    src.stop(t0 + noiseDur + 0.03);

    var osc = actx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(195, t0);
    osc.frequency.exponentialRampToValueAtTime(88, t0 + 0.065);
    var gO = actx.createGain();
    gO.gain.setValueAtTime(0, t0);
    gO.gain.linearRampToValueAtTime(0.2, t0 + 0.006);
    gO.gain.exponentialRampToValueAtTime(0.008, t0 + 0.1);
    osc.connect(gO);
    gO.connect(actx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.12);
  }

  function playCatMeow() {
    var actx = ensureAudioContext();
    if (!actx) return;
    var t0 = actx.currentTime;
    var osc = actx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(340, t0);
    osc.frequency.exponentialRampToValueAtTime(720, t0 + 0.07);
    osc.frequency.exponentialRampToValueAtTime(380, t0 + 0.24);
    var g = actx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.19, t0 + 0.028);
    g.gain.linearRampToValueAtTime(0.16, t0 + 0.14);
    g.gain.exponentialRampToValueAtTime(0.008, t0 + 0.36);
    osc.connect(g);
    g.connect(actx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.4);

    var osc2 = actx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1180, t0 + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(980, t0 + 0.2);
    var g2 = actx.createGain();
    g2.gain.setValueAtTime(0, t0);
    g2.gain.linearRampToValueAtTime(0.045, t0 + 0.06);
    g2.gain.exponentialRampToValueAtTime(0.005, t0 + 0.28);
    osc2.connect(g2);
    g2.connect(actx.destination);
    osc2.start(t0 + 0.04);
    osc2.stop(t0 + 0.32);
  }

  function playPlaceSound(color) {
    var actx = ensureAudioContext();
    if (!actx) return;
    function play() {
      try {
        if (color === "black") playDogBark();
        else playCatMeow();
      } catch (e) {
        /* ignore */
      }
    }
    if (actx.state === "suspended") {
      actx.resume().then(play).catch(play);
    } else {
      play();
    }
  }

  function computeLayout() {
    layoutW = boardEl.clientWidth;
    layoutH = boardEl.clientHeight;
    var size = Math.min(layoutW, layoutH);
    viewScale = size * 0.092;
    originX = layoutW / 2;
    originY = layoutH * 0.48;
    basePieceR = viewScale * 0.33;
    pickRadius = Math.max(15, viewScale * 0.3);
  }

  function cellWorldCenter(c, r, z) {
    var off = (BOARD_DIM - 1) / 2;
    return {
      x: c - off,
      y: off - r,
      z: z - off,
    };
  }

  function worldToScreen(wx, wy, wz) {
    var cYa = Math.cos(viewYaw);
    var sYa = Math.sin(viewYaw);
    var x1 = wx * cYa + wz * sYa;
    var z1 = -wx * sYa + wz * cYa;
    var y1 = wy;
    var cP = Math.cos(viewPitch);
    var sP = Math.sin(viewPitch);
    var y2 = y1 * cP - z1 * sP;
    var z2 = y1 * sP + z1 * cP;
    var zSafe = Math.min(z2, PERSP - 0.4);
    var fac = PERSP / (PERSP - zSafe);
    var sx = originX + x1 * viewScale * fac;
    var sy = originY - y2 * viewScale * fac;
    return { sx: sx, sy: sy, eyeZ: z2, fac: fac };
  }

  function projectCell(c, r, z) {
    var w = cellWorldCenter(c, r, z);
    return worldToScreen(w.x, w.y, w.z);
  }

  function pickCellAt(px, py) {
    var best = null;
    var z;
    var r;
    var c;
    var p;
    var d;
    for (z = 0; z < BOARD_DIM; z++) {
      for (r = 0; r < BOARD_DIM; r++) {
        for (c = 0; c < BOARD_DIM; c++) {
          p = projectCell(c, r, z);
          d = Math.hypot(px - p.sx, py - p.sy);
          if (d >= pickRadius) continue;
          if (
            best === null ||
            p.eyeZ > best.eyeZ + 0.02 ||
            (Math.abs(p.eyeZ - best.eyeZ) < 0.02 && d < best.d)
          ) {
            best = { z: z, r: r, c: c, eyeZ: p.eyeZ, d: d };
          }
        }
      }
    }
    return best ? { z: best.z, r: best.r, c: best.c } : null;
  }

  function eventToLocal(ev) {
    var rect = boardEl.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left) / rect.width) * layoutW,
      y: ((ev.clientY - rect.top) / rect.height) * layoutH,
    };
  }

  function touchToLocal(ev) {
    var t = ev.changedTouches[0] || ev.touches[0];
    var rect = boardEl.getBoundingClientRect();
    return {
      x: ((t.clientX - rect.left) / rect.width) * layoutW,
      y: ((t.clientY - rect.top) / rect.height) * layoutH,
    };
  }

  function pieceRadiusAt(fac) {
    return basePieceR * Math.min(1.35, Math.max(0.45, fac * 0.92));
  }

  function drawWood() {
    var W = layoutW;
    var H = layoutH;
    var grd = ctx.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, "#c9a06c");
    grd.addColorStop(0.45, "#a67c3d");
    grd.addColorStop(1, "#8b6914");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = "#4a3018";
    var i;
    for (i = -20; i < 60; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 10, 0);
      ctx.lineTo(i * 10 + 40, H);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWireframeCube3D() {
    var E = BOARD_DIM / 2;
    var cornersW = [
      [-E, -E, -E],
      [E, -E, -E],
      [E, E, -E],
      [-E, E, -E],
      [-E, -E, E],
      [E, -E, E],
      [E, E, E],
      [-E, E, E],
    ];
    var edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ];
    var i;
    var a;
    var b;
    var pa;
    var pb;
    ctx.save();
    ctx.strokeStyle = "rgba(45, 30, 15, 0.65)";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    for (i = 0; i < edges.length; i++) {
      a = cornersW[edges[i][0]];
      b = cornersW[edges[i][1]];
      pa = worldToScreen(a[0], a[1], a[2]);
      pb = worldToScreen(b[0], b[1], b[2]);
      ctx.beginPath();
      ctx.moveTo(pa.sx, pa.sy);
      ctx.lineTo(pb.sx, pb.sy);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSliceHighlightPlane3D() {
    var off = (BOARD_DIM - 1) / 2;
    var wz = currentZ - off;
    var E = BOARD_DIM / 2;
    var pts = [
      worldToScreen(-E, -E, wz),
      worldToScreen(E, -E, wz),
      worldToScreen(E, E, wz),
      worldToScreen(-E, E, wz),
    ];
    ctx.save();
    ctx.fillStyle = "rgba(233, 196, 106, 0.14)";
    ctx.strokeStyle = "rgba(233, 196, 106, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    ctx.lineTo(pts[1].sx, pts[1].sy);
    ctx.lineTo(pts[2].sx, pts[2].sy);
    ctx.lineTo(pts[3].sx, pts[3].sy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawLatticeDots3D() {
    var items = [];
    var z;
    var r;
    var c;
    var p;
    for (z = 0; z < BOARD_DIM; z++) {
      for (r = 0; r < BOARD_DIM; r++) {
        for (c = 0; c < BOARD_DIM; c++) {
          p = projectCell(c, r, z);
          items.push(p);
        }
      }
    }
    items.sort(function (a, b) {
      return a.eyeZ - b.eyeZ;
    });
    ctx.save();
    var i;
    for (i = 0; i < items.length; i++) {
      p = items[i];
      ctx.fillStyle = "rgba(45, 30, 15, 0.22)";
      ctx.beginPath();
      ctx.arc(
        p.sx,
        p.sy,
        Math.max(1.1, 1.15 + p.eyeZ * 0.04),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  }

  function drawUiCaption3D() {
    ctx.save();
    ctx.font =
      "600 " +
      Math.max(10, Math.min(13, layoutW * 0.028)) +
      "px Segoe UI, system-ui, sans-serif";
    ctx.fillStyle = "rgba(45, 30, 15, 0.5)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Highlight Z = " + (currentZ + 1), 10, 6);
    ctx.restore();
  }

  function drawDogHead(cx, cy, R, alpha) {
    var a = alpha === undefined ? 1 : alpha;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = a;

    var fur = "#2a1f18";
    var furHi = "#4d3d30";
    var snout = "#6e5c4a";

    ctx.shadowColor = "rgba(0,0,0,0.38)";
    ctx.shadowBlur = Math.max(2, R * 0.18);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = R * 0.1;

    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.moveTo(-R * 0.52, -R * 0.08);
    ctx.quadraticCurveTo(-R * 0.98, -R * 0.42, -R * 0.48, -R * 0.82);
    ctx.quadraticCurveTo(-R * 0.22, -R * 0.45, -R * 0.32, R * 0.05);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(R * 0.52, -R * 0.08);
    ctx.quadraticCurveTo(R * 0.98, -R * 0.42, R * 0.48, -R * 0.82);
    ctx.quadraticCurveTo(R * 0.22, -R * 0.45, R * 0.32, R * 0.05);
    ctx.closePath();
    ctx.fill();

    var headG = ctx.createRadialGradient(
      -R * 0.28,
      -R * 0.32,
      R * 0.05,
      0,
      R * 0.02,
      R * 0.82
    );
    headG.addColorStop(0, furHi);
    headG.addColorStop(0.55, fur);
    headG.addColorStop(1, "#15100c");
    ctx.fillStyle = headG;
    ctx.beginPath();
    ctx.arc(0, R * 0.02, R * 0.74, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = snout;
    ctx.beginPath();
    ctx.ellipse(0, R * 0.44, R * 0.34, R * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0d0a08";
    ctx.beginPath();
    ctx.ellipse(0, R * 0.38, R * 0.09, R * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = "#f5f2eb";
    ctx.beginPath();
    ctx.arc(-R * 0.3, -R * 0.14, R * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(R * 0.3, -R * 0.14, R * 0.13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1a120e";
    ctx.beginPath();
    ctx.arc(-R * 0.3, -R * 0.12, R * 0.065, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(R * 0.3, -R * 0.12, R * 0.065, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawCatHead(cx, cy, R, alpha) {
    var a = alpha === undefined ? 1 : alpha;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = a;

    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = Math.max(2, R * 0.14);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = R * 0.08;

    ctx.fillStyle = "#e8dcc8";
    ctx.strokeStyle = "rgba(60,45,35,0.35)";
    ctx.lineWidth = Math.max(0.5, R * 0.05);
    ctx.beginPath();
    ctx.moveTo(-R * 0.48, -R * 0.32);
    ctx.lineTo(-R * 0.62, -R * 0.92);
    ctx.lineTo(-R * 0.12, -R * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f2a8b0";
    ctx.beginPath();
    ctx.moveTo(-R * 0.42, -R * 0.38);
    ctx.lineTo(-R * 0.52, -R * 0.78);
    ctx.lineTo(-R * 0.22, -R * 0.55);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#e8dcc8";
    ctx.beginPath();
    ctx.moveTo(R * 0.48, -R * 0.32);
    ctx.lineTo(R * 0.62, -R * 0.92);
    ctx.lineTo(R * 0.12, -R * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f2a8b0";
    ctx.beginPath();
    ctx.moveTo(R * 0.42, -R * 0.38);
    ctx.lineTo(R * 0.52, -R * 0.78);
    ctx.lineTo(R * 0.22, -R * 0.55);
    ctx.closePath();
    ctx.fill();

    var faceG = ctx.createRadialGradient(
      -R * 0.22,
      -R * 0.28,
      R * 0.04,
      0,
      R * 0.06,
      R * 0.78
    );
    faceG.addColorStop(0, "#fffef9");
    faceG.addColorStop(0.65, "#efe6d8");
    faceG.addColorStop(1, "#cfc3b2");
    ctx.fillStyle = faceG;
    ctx.beginPath();
    ctx.arc(0, R * 0.06, R * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(60,45,35,0.28)";
    ctx.lineWidth = Math.max(0.5, R * 0.045);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = "#b8d060";
    ctx.beginPath();
    ctx.ellipse(-R * 0.3, -R * 0.06, R * 0.11, R * 0.15, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(R * 0.3, -R * 0.06, R * 0.11, R * 0.15, 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2a2418";
    ctx.beginPath();
    ctx.ellipse(-R * 0.3, -R * 0.05, R * 0.045, R * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(R * 0.3, -R * 0.05, R * 0.045, R * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e89898";
    ctx.beginPath();
    ctx.moveTo(0, R * 0.14);
    ctx.lineTo(-R * 0.07, R * 0.26);
    ctx.lineTo(R * 0.07, R * 0.26);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = Math.max(0.5, R * 0.035);
    ctx.beginPath();
    ctx.moveTo(-R * 0.42, R * 0.18);
    ctx.lineTo(-R * 1.02, R * 0.1);
    ctx.moveTo(-R * 0.42, R * 0.28);
    ctx.lineTo(-R * 1.02, R * 0.28);
    ctx.moveTo(R * 0.42, R * 0.18);
    ctx.lineTo(R * 1.02, R * 0.1);
    ctx.moveTo(R * 0.42, R * 0.28);
    ctx.lineTo(R * 1.02, R * 0.28);
    ctx.stroke();

    ctx.restore();
  }

  function drawStoneAt(cx, cy, color, isLast, R) {
    var rad = R !== undefined ? R : basePieceR;
    if (color === "black") {
      drawDogHead(cx, cy, rad, 1);
    } else {
      drawCatHead(cx, cy, rad, 1);
    }
    if (isLast) {
      ctx.save();
      ctx.strokeStyle = "#e9c46a";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.beginPath();
      ctx.arc(cx, cy, rad + 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawGhost(cx, cy, color, R) {
    var rad = R !== undefined ? R : basePieceR;
    var a = color === "black" ? 0.42 : 0.5;
    if (color === "black") {
      drawDogHead(cx, cy, rad, a);
    } else {
      drawCatHead(cx, cy, rad, a);
    }
  }

  function drawAll() {
    if (layoutW < 2 || layoutH < 2) return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, layoutW, layoutH);
    drawWood();
    drawLatticeDots3D();
    drawWireframeCube3D();
    drawSliceHighlightPlane3D();
    drawUiCaption3D();

    var pieces = [];
    var z;
    var r;
    var c;
    var col;
    var p;
    var isLast;
    for (z = 0; z < BOARD_DIM; z++) {
      for (r = 0; r < BOARD_DIM; r++) {
        for (c = 0; c < BOARD_DIM; c++) {
          col = grid[z][r][c];
          if (!col) continue;
          p = projectCell(c, r, z);
          isLast =
            lastMove &&
            lastMove.z === z &&
            lastMove.r === r &&
            lastMove.c === c;
          pieces.push({
            p: p,
            color: col,
            isLast: isLast,
            R: pieceRadiusAt(p.fac),
          });
        }
      }
    }
    pieces.sort(function (a, b) {
      return a.p.eyeZ - b.p.eyeZ;
    });
    var i;
    for (i = 0; i < pieces.length; i++) {
      var q = pieces[i];
      drawStoneAt(q.p.sx, q.p.sy, q.color, q.isLast, q.R);
    }

    if (hoverCell && !humanInputBlocked()) {
      if (grid[hoverCell.z][hoverCell.r][hoverCell.c] === null) {
        p = projectCell(hoverCell.c, hoverCell.r, hoverCell.z);
        drawGhost(p.sx, p.sy, current, pieceRadiusAt(p.fac));
      }
    }

    ctx.restore();
  }

  function redraw() {
    updateBoardCursor();
    drawAll();
  }

  function resizeCanvas() {
    var w = boardEl.clientWidth;
    var h = boardEl.clientHeight;
    if (w < 2 || h < 2) return;
    var css = Math.min(w, h);
    dpr = window.devicePixelRatio || 1;
    boardEl.width = Math.floor(css * dpr);
    boardEl.height = Math.floor(css * dpr);
    computeLayout();
    redraw();
  }

  function onPointerMove(ev) {
    var moveOk =
      ev.pointerType === "touch" || (ev.buttons & 1) === 1;
    if (dragBoard && moveOk) {
      var dx = ev.clientX - lastDragX;
      var dy = ev.clientY - lastDragY;
      lastDragX = ev.clientX;
      lastDragY = ev.clientY;
      dragMoved += Math.abs(dx) + Math.abs(dy);
      viewYaw += dx * 0.0065;
      viewPitch += dy * 0.0065;
      viewPitch = Math.max(-1.15, Math.min(1.15, viewPitch));
      boardEl.classList.add("is-grabbing");
      redraw();
      return;
    }

    if (humanInputBlocked()) {
      if (hoverCell !== null) {
        hoverCell = null;
        redraw();
      }
      return;
    }
    var p = eventToLocal(ev);
    var hit = pickCellAt(p.x, p.y);
    if (hit) {
      if (
        hoverCell &&
        hoverCell.r === hit.r &&
        hoverCell.c === hit.c &&
        hoverCell.z === hit.z
      ) {
        return;
      }
    } else if (!hoverCell) {
      return;
    }
    hoverCell = hit;
    redraw();
  }

  function onPointerLeave() {
    hoverCell = null;
    redraw();
  }

  function onPointerDown(ev) {
    if (ev.pointerType === "touch") ev.preventDefault();
    resumeAudioContext();
    if (ev.button !== 0 && ev.pointerType === "mouse") return;
    dragBoard = true;
    dragMoved = 0;
    lastDragX = ev.clientX;
    lastDragY = ev.clientY;
  }

  function onPointerUp(ev) {
    dragBoard = false;
    boardEl.classList.remove("is-grabbing");
  }

  function onCanvasClick(ev) {
    if (humanInputBlocked()) return;
    if (Date.now() < suppressClickUntil) return;
    if (dragMoved > 12) return;
    var p = eventToLocal(ev);
    var hit = pickCellAt(p.x, p.y);
    if (!hit) return;
    onCellClick(hit.z, hit.r, hit.c);
  }

  function onCanvasTouchEnd(ev) {
    if (humanInputBlocked()) return;
    ev.preventDefault();
    suppressClickUntil = Date.now() + 450;
    if (dragMoved > 14) {
      dragMoved = 0;
      return;
    }
    var p = touchToLocal(ev);
    var hit = pickCellAt(p.x, p.y);
    dragMoved = 0;
    if (!hit) return;
    onCellClick(hit.z, hit.r, hit.c);
  }

  function onCellClick(z, r, c) {
    if (gameOver || grid[z][r][c] !== null) return;
    if (isCpuMode() && current === "white") return;
    applyMove(z, r, c);
  }

  function applyMove(z, r, c) {
    if (gameOver || grid[z][r][c] !== null) return;

    grid[z][r][c] = current;
    lastMove = { z: z, r: r, c: c };
    currentZ = z;
    updateLayerIndicator();
    playPlaceSound(current);

    if (checkWinAt(z, r, c)) {
      gameOver = true;
      clearCpuTimer();
      cpuThinking = false;
      var winnerName =
        current === "black" ? resolvedBlackName() : resolvedWhiteName();
      setStatus(
        winnerName + " (" + sideLabel(current) + ") wins.",
        "winner"
      );
      recordResult(current);
      finishGameUi();
      redraw();
      return;
    }

    if (boardFull3()) {
      gameOver = true;
      clearCpuTimer();
      cpuThinking = false;
      setStatus("Draw — cube full.", "draw");
      recordResult("draw");
      finishGameUi();
      redraw();
      return;
    }

    current = current === "black" ? "white" : "black";
    var nextName =
      current === "black" ? resolvedBlackName() : resolvedWhiteName();
    setStatus(
      "Z" +
        (currentZ + 1) +
        " · " +
        nextName +
        " (" +
        sideLabel(current) +
        ") to move.",
      null
    );
    redraw();
    maybeScheduleComputerMove();
  }

  function finishGameUi() {
    updateBoardCursor();
  }

  function newGame() {
    clearCpuTimer();
    cpuThinking = false;
    grid = emptyGrid();
    gameOver = false;
    current = "black";
    lastMove = null;
    hoverCell = null;
    currentZ = (BOARD_DIM / 2) | 0;
    viewYaw = 0.65;
    viewPitch = 0.5;
    updateLayerIndicator();
    syncModeUi();
    setStatus(
      "Z" +
        (currentZ + 1) +
        " · " +
        resolvedBlackName() +
        " (dog) to move.",
      null
    );
    updateBoardCursor();
    redraw();
    maybeScheduleComputerMove();
  }

  function bindBoardEvents() {
    boardEl.addEventListener("mousemove", onPointerMove);
    boardEl.addEventListener("mouseleave", onPointerLeave);
    boardEl.addEventListener("click", onCanvasClick);
    boardEl.addEventListener("pointerdown", onPointerDown);
    boardEl.addEventListener("pointerup", onPointerUp);
    boardEl.addEventListener("pointercancel", onPointerUp);
    boardEl.addEventListener("touchend", onCanvasTouchEnd, { passive: false });
    window.addEventListener("pointerup", onPointerUp);

    var ro = new ResizeObserver(function () {
      requestAnimationFrame(resizeCanvas);
    });
    ro.observe(boardEl);
    window.addEventListener("resize", function () {
      requestAnimationFrame(resizeCanvas);
    });
  }

  function init() {
    grid = emptyGrid();
    bindBoardEvents();
    resizeCanvas();
    btnNew.addEventListener("click", function () {
      resumeAudioContext();
      newGame();
    });
    if (layerPrevBtn) {
      layerPrevBtn.addEventListener("click", function () {
        setCurrentZ(currentZ - 1);
      });
    }
    if (layerNextBtn) {
      layerNextBtn.addEventListener("click", function () {
        setCurrentZ(currentZ + 1);
      });
    }
    nameBlackEl.addEventListener("input", renderStats);
    nameWhiteEl.addEventListener("input", renderStats);
    var modeInputs = document.querySelectorAll('input[name="game-mode"]');
    var mi;
    for (mi = 0; mi < modeInputs.length; mi++) {
      modeInputs[mi].addEventListener("change", function () {
        syncModeUi();
        newGame();
        renderStats();
      });
    }
    newGame();
    renderStats();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
