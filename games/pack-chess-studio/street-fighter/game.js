(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var statusEl = document.getElementById("status");
  var hpP1 = document.getElementById("hp-p1");
  var hpP2 = document.getElementById("hp-p2");
  var timerEl = document.getElementById("timer");
  var vsCpuEl = document.getElementById("vs-cpu");
  var btnRematch = document.getElementById("btn-rematch");

  var W = canvas.width;
  var H = canvas.height;
  var FLOOR_Y = H - 88;
  var GRAVITY = 2800;
  var MOVE_SPEED = 420;
  var JUMP_V = -920;
  var FRICTION = 0.82;

  var ROUND_TIME = 99;
  var timerLeft = ROUND_TIME;
  var timerAccum = 0;

  var keys = Object.create(null);
  var vsCpu = false;
  var matchOver = false;
  var winner = null;
  var lastTs = 0;

  function keyDown(e) {
    keys[e.code] = true;
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Space",
        "KeyA",
        "KeyD",
        "KeyW",
        "KeyS",
      ].indexOf(e.code) !== -1
    ) {
      e.preventDefault();
    }
  }

  function keyUp(e) {
    keys[e.code] = false;
  }

  document.addEventListener("keydown", keyDown);
  document.addEventListener("keyup", keyUp);

  function createFighter(side) {
    var startX = side === 0 ? W * 0.28 : W * 0.72;
    return {
      side: side,
      x: startX,
      y: FLOOR_Y,
      vx: 0,
      vy: 0,
      facing: side === 0 ? 1 : -1,
      hp: 100,
      maxHp: 100,
      state: "idle",
      stateT: 0,
      grounded: true,
      hitThisSwing: false,
      combo: 0,
      width: 56,
      height: 128,
      crouchH: 72,
    };
  }

  var p1 = createFighter(0);
  var p2 = createFighter(1);

  function resetMatch() {
    p1 = createFighter(0);
    p2 = createFighter(1);
    timerLeft = ROUND_TIME;
    timerAccum = 0;
    matchOver = false;
    winner = null;
    statusEl.textContent = "Fight!";
    hpP1.style.transform = "scaleX(1)";
    hpP2.style.transform = "scaleX(1)";
    timerEl.textContent = String(timerLeft);
  }

  function other(f) {
    return f.side === 0 ? p2 : p1;
  }

  function setState(f, name, dur) {
    f.state = name;
    f.stateT = dur;
    if (name !== "punch" && name !== "kick") {
      f.hitThisSwing = false;
    }
  }

  function hurtbox(f) {
    var h = f.state === "crouch" || f.state === "crouch_attack" ? f.crouchH : f.height;
    var yTop = f.y - h;
    return {
      x: f.x - f.width / 2,
      y: yTop,
      w: f.width,
      h: h,
    };
  }

  function attackBox(attacker, kind) {
    var hb = hurtbox(attacker);
    var reach = kind === "punch" ? 62 : 88;
    var ah = kind === "punch" ? 36 : 32;
    var y = attacker.state === "crouch" || attacker.state === "crouch_attack" ? hb.y + hb.h - ah - 4 : hb.y + hb.h * 0.35;
    var w = reach;
    var x =
      attacker.facing === 1
        ? attacker.x + attacker.width / 2 - 4
        : attacker.x - attacker.width / 2 - w + 4;
    return { x: x, y: y, w: w, h: ah };
  }

  function aabbOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function applyHit(attacker, defender, dmg, knock) {
    if (matchOver) return;
    defender.hp = Math.max(0, defender.hp - dmg);
    defender.combo = 0;
    attacker.combo = Math.min(attacker.combo + 1, 5);
    var k = knock * (1 + attacker.combo * 0.08);
    defender.vx = attacker.facing * k;
    defender.vy = -180;
    defender.grounded = false;
    setState(defender, "hitstun", 0.28);
    defender.hitThisSwing = false;
  }

  function tryAttackHit(attacker, kind) {
    if (attacker.hitThisSwing) return;
    var def = other(attacker);
    if (def.state === "hitstun") return;
    var ab = attackBox(attacker, kind);
    var hb = hurtbox(def);
    if (!aabbOverlap(ab, hb)) return;
    var dmg = kind === "punch" ? 9 : 14;
    var knock = kind === "punch" ? 380 : 520;
    applyHit(attacker, def, dmg, knock);
    attacker.hitThisSwing = true;
  }

  function readInputP1() {
    return {
      left: keys["KeyA"],
      right: keys["KeyD"],
      up: keys["KeyW"],
      down: keys["KeyS"],
      punch: keys["KeyJ"],
      kick: keys["KeyK"],
    };
  }

  function readInputP2() {
    return {
      left: keys["ArrowLeft"],
      right: keys["ArrowRight"],
      up: keys["ArrowUp"],
      down: keys["ArrowDown"],
      punch: keys["Digit1"],
      kick: keys["Digit2"],
    };
  }

  function cpuInput(f) {
    var opp = other(f);
    var dx = opp.x - f.x;
    var dist = Math.abs(dx);
    var punchR = 95;
    var kickR = 125;
    var act = Math.random() < 0.024;
    var jump = Math.random() < 0.01 && f.grounded;
    var retreat = dist < 72 && Math.random() < 0.018;

    return {
      left: retreat ? dx > 0 : dx < -8,
      right: retreat ? dx < 0 : dx > 8,
      up: jump,
      down: false,
      punch: act && dist < punchR,
      kick: act && dist >= punchR && dist < kickR,
    };
  }

  function updateFacing(f, inp) {
    if (f.state === "hitstun" || f.state === "kick" || f.state === "punch") return;
    var o = other(f);
    if (o.x > f.x + 8) f.facing = 1;
    else if (o.x < f.x - 8) f.facing = -1;
    if (inp.left && !inp.right) f.facing = -1;
    if (inp.right && !inp.left) f.facing = 1;
  }

  function tryStartAttack(f, inp, canAct) {
    if (!canAct) return;
    if (inp.punch) {
      setState(f, f.grounded && inp.down ? "crouch_attack" : "punch", f.grounded && inp.down ? 0.32 : 0.28);
      f.hitThisSwing = false;
      return;
    }
    if (inp.kick) {
      setState(f, "kick", 0.38);
      f.hitThisSwing = false;
    }
  }

  function updateFighter(f, dt, inp) {
    var busy =
      f.state === "punch" ||
      f.state === "kick" ||
      f.state === "crouch_attack" ||
      f.state === "hitstun";
    var canAct =
      !busy &&
      (f.state === "idle" ||
        f.state === "walk" ||
        f.state === "crouch" ||
        (f.state === "jump" && !f.grounded));

    if (f.state === "hitstun") {
      f.vy += GRAVITY * dt;
      f.x += f.vx * dt;
      f.vx *= Math.pow(FRICTION, dt * 60);
      f.y += f.vy * dt;
      if (f.y >= FLOOR_Y) {
        f.y = FLOOR_Y;
        f.vy = 0;
        f.grounded = true;
        f.vx *= 0.75;
      }
      f.stateT -= dt;
      if (f.stateT <= 0) setState(f, "idle", 0);
      return;
    }

    if (f.state === "punch" || f.state === "kick" || f.state === "crouch_attack") {
      f.vy += GRAVITY * dt;
      if (!f.grounded) {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }
      if (f.y >= FLOOR_Y) {
        f.y = FLOOR_Y;
        f.vy = 0;
        f.grounded = true;
        f.vx *= 0.9;
      }
      var kind = f.state === "kick" ? "kick" : "punch";
      var activeStart = f.state === "kick" ? 0.12 : 0.06;
      var activeEnd = f.state === "kick" ? 0.22 : 0.18;
      var elapsed = (f.state === "punch" ? 0.28 : f.state === "kick" ? 0.38 : 0.32) - f.stateT;
      if (elapsed >= activeStart && elapsed <= activeEnd) tryAttackHit(f, kind);
      f.stateT -= dt;
      if (f.stateT <= 0) setState(f, f.grounded && inp.down ? "crouch" : "idle", 0);
      return;
    }

    updateFacing(f, inp);

    if (f.grounded && inp.up && !busy) {
      f.vy = JUMP_V;
      f.grounded = false;
      setState(f, "jump", 0);
    }

    var move = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (f.grounded) {
      f.vx = move * MOVE_SPEED;
      if (move !== 0 && !inp.down) setState(f, "walk", 0);
      else if (inp.down) {
        f.vx *= 0.35;
        setState(f, "crouch", 0);
      } else setState(f, "idle", 0);
    } else {
      f.vx = move * MOVE_SPEED * 0.85;
      setState(f, "jump", 0);
    }

    tryStartAttack(f, inp, canAct);

    f.vy += GRAVITY * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;

    if (f.y >= FLOOR_Y) {
      f.y = FLOOR_Y;
      f.vy = 0;
      f.grounded = true;
    }

    var half = f.width / 2;
    f.x = Math.max(half + 24, Math.min(W - half - 24, f.x));
  }

  function clampSeparation() {
    var minGap = 52;
    var dx = p2.x - p1.x;
    if (Math.abs(dx) < minGap) {
      var push = (minGap - Math.abs(dx)) / 2;
      if (dx >= 0) {
        p1.x -= push;
        p2.x += push;
      } else {
        p1.x += push;
        p2.x -= push;
      }
    }
  }

  function checkMatchEnd() {
    if (matchOver) return;
    if (p1.hp <= 0) {
      matchOver = true;
      winner = 2;
      statusEl.textContent = vsCpu ? "CPU wins!" : "Player 2 wins!";
      return;
    }
    if (p2.hp <= 0) {
      matchOver = true;
      winner = 1;
      statusEl.textContent = "Player 1 wins!";
      return;
    }
    if (timerLeft <= 0) {
      matchOver = true;
      if (p1.hp > p2.hp) {
        winner = 1;
        statusEl.textContent = "Time! Player 1 wins!";
      } else if (p2.hp > p1.hp) {
        winner = 2;
        statusEl.textContent = vsCpu ? "Time! CPU wins!" : "Time! Player 2 wins!";
      } else {
        winner = 0;
        statusEl.textContent = "Draw!";
      }
    }
  }

  function updateHUD() {
    hpP1.style.transform = "scaleX(" + Math.max(0, p1.hp / p1.maxHp) + ")";
    hpP2.style.transform = "scaleX(" + Math.max(0, p2.hp / p2.maxHp) + ")";
    timerEl.textContent = String(Math.max(0, Math.ceil(timerLeft)));
  }

  function update(dt) {
    if (matchOver) {
      updateHUD();
      return;
    }

    timerAccum += dt;
    while (timerAccum >= 1) {
      timerAccum -= 1;
      timerLeft -= 1;
    }

    var i1 = readInputP1();
    var i2 = vsCpu ? cpuInput(p2) : readInputP2();

    updateFighter(p1, dt, i1);
    updateFighter(p2, dt, i2);
    clampSeparation();
    checkMatchEnd();
    updateHUD();
  }

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    g.addColorStop(0, "#2d1f4e");
    g.addColorStop(0.45, "#4a3068");
    g.addColorStop(1, "#c94b6a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, FLOOR_Y);

    ctx.fillStyle = "rgba(255,200,120,0.35)";
    ctx.beginPath();
    ctx.arc(W * 0.78, FLOOR_Y * 0.22, 48, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCity() {
    var buildings = [
      { x: 0, w: 120, h: 200, c: "#1e1a28" },
      { x: 100, w: 90, h: 260, c: "#252030" },
      { x: 200, w: 140, h: 180, c: "#1a1724" },
      { x: 360, w: 100, h: 300, c: "#221c2e" },
      { x: 480, w: 160, h: 220, c: "#18151f" },
      { x: 650, w: 110, h: 280, c: "#231d32" },
      { x: 780, w: 200, h: 190, c: "#1c1825" },
    ];
    var i;
    for (i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      var y0 = FLOOR_Y - b.h;
      ctx.fillStyle = b.c;
      ctx.fillRect(b.x, y0, b.w, b.h);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      var wx;
      for (wx = b.x + 14; wx < b.x + b.w - 10; wx += 22) {
        var wy;
        for (wy = y0 + 16; wy < FLOOR_Y - 12; wy += 28) {
          ctx.strokeRect(wx, wy, 12, 16);
        }
      }
    }
  }

  function drawFloor() {
    ctx.fillStyle = "#2a2438";
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    ctx.fillStyle = "#3d3550";
    ctx.fillRect(0, FLOOR_Y, W, 6);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y + 4);
    ctx.lineTo(W, FLOOR_Y + 4);
    ctx.stroke();
  }

  function drawFighter(f) {
    var hb = hurtbox(f);
    var cx = f.x;
    var footY = f.y;
    var headY = hb.y + 18;
    var bodyTop = hb.y + 28;
    var isP1 = f.side === 0;
    var main = isP1 ? "#4dabf7" : "#ff6b9d";
    var dark = isP1 ? "#1864ab" : "#c2255c";
    var skin = "#e9c8a8";

    ctx.save();
    ctx.translate(cx, 0);
    ctx.scale(f.facing, 1);

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, footY + 6, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = dark;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    var legSpread = f.state === "crouch" ? 18 : 22;
    ctx.beginPath();
    ctx.moveTo(-8, bodyTop + 50);
    ctx.lineTo(-legSpread, footY - 4);
    ctx.moveTo(8, bodyTop + 50);
    ctx.lineTo(legSpread, footY - 4);
    ctx.stroke();

    ctx.fillStyle = main;
    var bw = 40;
    var bh = hb.h - 70;
    ctx.fillRect(-bw / 2, bodyTop, bw, bh);

    ctx.fillStyle = dark;
    ctx.fillRect(-bw / 2, bodyTop + bh - 8, bw, 8);

    var armAngle = 0;
    var armExt = 38;
    if (f.state === "punch" || f.state === "crouch_attack") {
      armAngle = -0.5;
      armExt = 72;
    } else if (f.state === "kick") {
      armAngle = 0.3;
      armExt = 36;
    }
    ctx.strokeStyle = skin;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(bw / 2 - 4, bodyTop + 16);
    ctx.lineTo(bw / 2 - 4 + Math.cos(armAngle) * armExt, bodyTop + 12 + Math.sin(armAngle) * 18);
    ctx.stroke();

    var legKick = 0;
    if (f.state === "kick") {
      var t = 1 - f.stateT / 0.38;
      if (t > 0.25 && t < 0.55) legKick = 55;
    }
    ctx.strokeStyle = skin;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(6, bodyTop + 48);
    ctx.lineTo(22 + legKick, footY - 20);
    ctx.stroke();

    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, headY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#222";
    ctx.fillRect(6, headY - 4, 10, 6);
    ctx.fillRect(-16, headY - 4, 10, 6);

    ctx.restore();
  }

  function drawVignette() {
    var g = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawKO() {
    if (!matchOver) return;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, H * 0.38, W, 90);
    ctx.font = "bold 52px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff6b35";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 4;
    var msg =
      winner === 0 ? "DRAW" : winner === 1 ? "K.O. — P1" : vsCpu ? "K.O. — CPU" : "K.O. — P2";
    ctx.strokeText(msg, W / 2, H * 0.38 + 58);
    ctx.fillText(msg, W / 2, H * 0.38 + 58);
  }

  function render() {
    drawSky();
    drawCity();
    drawFloor();
    if (p1.x < p2.x) {
      drawFighter(p1);
      drawFighter(p2);
    } else {
      drawFighter(p2);
      drawFighter(p1);
    }
    drawVignette();
    drawKO();
  }

  function frame(ts) {
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  vsCpuEl.addEventListener("change", function () {
    vsCpu = vsCpuEl.checked;
    document.getElementById("label-p2").textContent = vsCpu ? "CPU" : "Fighter B";
    resetMatch();
  });

  btnRematch.addEventListener("click", resetMatch);

  canvas.addEventListener("click", function () {
    canvas.focus();
  });

  requestAnimationFrame(frame);
})();
