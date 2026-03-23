(function () {
  const TYPE_WORD = "pneumonoultramicroscopicsilicovolcanoconiosis";
  const LS_CHECKPOINT = "alvin_chan_hell_checkpoint";

  function storageGet() {
    try {
      const a = localStorage.getItem(LS_CHECKPOINT);
      if (a != null) return a;
    } catch (e) {}
    try {
      return sessionStorage.getItem(LS_CHECKPOINT);
    } catch (e2) {
      return null;
    }
  }

  function storageSet(value) {
    const s = String(value);
    let ok = false;
    try {
      localStorage.setItem(LS_CHECKPOINT, s);
      if (localStorage.getItem(LS_CHECKPOINT) === s) ok = true;
    } catch (e) {}
    if (!ok) {
      try {
        sessionStorage.setItem(LS_CHECKPOINT, s);
        ok = sessionStorage.getItem(LS_CHECKPOINT) === s;
      } catch (e2) {}
    }
    return ok;
  }

  function storageRemove() {
    try {
      localStorage.removeItem(LS_CHECKPOINT);
    } catch (e) {}
    try {
      sessionStorage.removeItem(LS_CHECKPOINT);
    } catch (e2) {}
  }

  function getHellCheckpoint() {
    const v = parseInt(storageGet(), 10);
    if (v >= 1 && v <= 4) return v;
    return 1;
  }

  function setHellCheckpoint(level) {
    if (level < 1 || level > 4) return;
    storageSet(level);
  }

  function clearHellCheckpoint() {
    storageRemove();
  }

  function refreshHackedUI() {
    const el = document.getElementById("hell-checkpoint-line");
    if (!el) return;
    const cp = getHellCheckpoint();
    if (cp >= 2) {
      el.textContent =
        "Checkpoint saved: Hell " +
        cp +
        ". Press Enter to resume. Progress is stored in this browser (localStorage, or sessionStorage if needed).";
    } else {
      el.textContent =
        "Checkpoint: Hell 1. Beat a hell level to save progress. After a fail, return here and press Enter to resume from your latest saved hell level.";
    }
  }

  function setActiveScreen(fullId) {
    if (window.__npcSetActiveScreen) window.__npcSetActiveScreen(fullId);
  }

  function hellFail(msg) {
    window.__HELL_ABORT = true;
    const wrap = document.getElementById("hell1-wrap");
    if (wrap) wrap.innerHTML = "";
    const h4 = document.getElementById("hell4-root");
    if (h4) h4.innerHTML = "";
    alert(msg || "Hell mode failed. Press Enter on the hacked screen to retry hell mode.");
    setActiveScreen("screen-hacked");
    if (window.__npcSetHellPhase) window.__npcSetHellPhase("hell_hacked");
    refreshHackedUI();
  }

  /* —— Hell 1: troll obby + gun + heaven + movie —— */
  function runHell1() {
    window.__HELL_ABORT = false;
    setActiveScreen("screen-hell1");
    const wrap = document.getElementById("hell1-wrap");
    wrap.innerHTML = '<canvas id="canvas-hell-obby" width="900" height="480"></canvas>';
    const canvas = document.getElementById("canvas-hell-obby");
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let phase = "obby"; // obby | gun | heaven | movie
    let cleanupFn = null;

    const W = canvas.width;
    const H = canvas.height;
    const worldW = 3400;
    const groundY = H - 70;
    let camX = 0;
    let px = 60,
      py = groundY - 40,
      vx = 0,
      vy = 0;
    const pw = 22,
      ph = 32;
    const grav = 0.52;
    let onGround = false;
    const keys = {};
    function keyEv(e) {
      keys[e.code] = e.type === "keydown";
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code))
        e.preventDefault();
    }

    const platforms = [
      { x: 0, y: groundY, w: worldW, h: 80, solid: true },
      { x: 180, y: groundY - 100, w: 70, h: 14, solid: true },
      { x: 320, y: groundY - 160, w: 50, h: 14, solid: false, troll: true },
      { x: 420, y: groundY - 130, w: 90, h: 14, solid: true },
      { x: 620, y: groundY - 200, w: 40, h: 14, solid: true },
      { x: 720, y: groundY - 120, w: 40, h: 14, solid: false, troll: true },
      { x: 820, y: groundY - 220, w: 100, h: 14, solid: true },
      { x: 1020, y: groundY - 90, w: 200, h: 14, solid: true },
      { x: 1320, y: groundY - 180, w: 60, h: 14, solid: true },
      { x: 1480, y: groundY - 250, w: 50, h: 14, solid: false, troll: true },
      { x: 1580, y: groundY - 200, w: 120, h: 14, solid: true },
      { x: 1780, y: groundY - 140, w: 30, h: 14, solid: true },
      { x: 1880, y: groundY - 300, w: 160, h: 14, solid: true },
      { x: 2120, y: groundY - 160, w: 80, h: 14, solid: true },
      { x: 2280, y: groundY - 100, w: 400, h: 14, solid: true },
      { x: 2650, y: groundY - 190, w: 45, h: 14, solid: true },
      { x: 2780, y: groundY - 260, w: 45, h: 14, solid: true },
    ];

    const spikes = [];
    for (let i = 0; i < 28; i++) spikes.push({ x: 950 + i * 38, y: groundY - 12, w: 20, h: 12 });
    for (let i = 0; i < 12; i++) spikes.push({ x: 2350 + i * 45, y: groundY - 12, w: 18, h: 12 });

    const endZone = { x: 3080, y: groundY - 120, w: 50, h: 120 };

    function resetPlayer() {
      px = 60;
      py = groundY - ph - 2;
      vx = vy = 0;
    }

    function solidCollide(ax, ay, aw, ah) {
      for (const p of platforms) {
        if (!p.solid) continue;
        if (ax < p.x + p.w && ax + aw > p.x && ay < p.y + p.h && ay + ah > p.y) return p;
      }
      return null;
    }

    function spikeHit(ax, ay, aw, ah) {
      for (const s of spikes) {
        if (ax < s.x + s.w && ax + aw > s.x && ay < s.y + s.h && ay + ah > s.y) return true;
      }
      return false;
    }

    function startObby() {
      phase = "obby";
      resetPlayer();
      window.addEventListener("keydown", keyEv, { passive: false });
      window.addEventListener("keyup", keyEv);

      function loop() {
        if (window.__HELL_ABORT) return;
        if (phase !== "obby") return;
        vx *= 0.82;
        if (keys["ArrowLeft"]) vx -= 1.1;
        if (keys["ArrowRight"]) vx += 1.1;
        vx = Math.max(-6, Math.min(6, vx));
        if ((keys["ArrowUp"] || keys["Space"]) && onGround) {
          vy = -11.2;
          onGround = false;
        }
        vy += grav;
        px += vx;
        py += vy;
        px = Math.max(0, Math.min(worldW - pw, px));

        let landed = false;
        onGround = false;
        if (py + ph >= groundY) {
          py = groundY - ph;
          vy = 0;
          onGround = true;
          landed = true;
        }
        for (const p of platforms) {
          if (!p.solid) continue;
          if (px + pw > p.x && px < p.x + p.w && py + ph > p.y && py + ph < p.y + 20 && vy >= 0) {
            if (py + ph - vy <= p.y + 6) {
              py = p.y - ph;
              vy = 0;
              onGround = true;
              landed = true;
            }
          }
        }
        for (const p of platforms) {
          if (p.solid) continue;
          if (px + pw > p.x && px < p.x + p.w && py + ph > p.y && py < p.y + p.h) {
            if (vy > 0 && py + ph - vy <= p.y + 4) {
              py = p.y + p.h;
              vy = 2;
            }
          }
        }

        if (spikeHit(px, py, pw, ph)) {
          resetPlayer();
        }

        if (px + pw > endZone.x && px < endZone.x + endZone.w && py + ph > endZone.y && py < endZone.y + endZone.h) {
          phase = "gun";
          showGun();
          return;
        }

        camX = Math.max(0, Math.min(worldW - W, px - W * 0.35));

        ctx.fillStyle = "#0a0512";
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.translate(-camX, 0);
        ctx.fillStyle = "#1a0a22";
        ctx.fillRect(0, 0, worldW, groundY - 40);
        for (const p of platforms) {
          ctx.fillStyle = p.solid ? "#2a4a60" : "#602030";
          ctx.fillRect(p.x, p.y, p.w, p.h);
        }
        ctx.fillStyle = "#c00";
        for (const s of spikes) ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.fillStyle = "#0f8";
        ctx.fillRect(endZone.x, endZone.y, endZone.w, endZone.h);
        ctx.fillStyle = "#0ff";
        ctx.fillRect(px, py, pw, ph);
        ctx.restore();
        ctx.fillStyle = "#889";
        ctx.font = "13px monospace";
        ctx.fillText("Hell obby — fake platforms are dark red · reach the green… if you dare · Arrows + Space jump", 8, 18);

        raf = requestAnimationFrame(loop);
      }

      function showGun() {
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", keyEv);
        window.removeEventListener("keyup", keyEv);
        const ov = document.createElement("div");
        ov.className = "hell-overlay gun-flash";
        ov.innerHTML =
          "<p style='font-size:1.8rem;color:#fff;margin:0'>BANG</p><p style='color:#faa'>You reached the end.<br>You were shot.<br><strong>You lose.</strong></p>";
        wrap.appendChild(ov);
        setTimeout(() => {
          ov.remove();
          showHeaven();
        }, 2200);
      }

      function showHeaven() {
        phase = "heaven";
        const ov = document.createElement("div");
        ov.className = "hell-overlay heaven";
        let clicks = 0;
        const deadline = performance.now() + 10000;
        const timerEl = document.createElement("p");
        const countEl = document.createElement("p");
        timerEl.style.fontSize = "1.4rem";
        countEl.style.fontSize = "1.2rem";
        ov.appendChild(document.createElement("h2")).textContent = "Wait… you're in heaven.";
        ov.appendChild(document.createElement("p")).textContent =
          "Click 20 times before 10 seconds run out to return to the world.";
        ov.appendChild(timerEl);
        ov.appendChild(countEl);
        wrap.appendChild(ov);

        function tick() {
          if (window.__HELL_ABORT) return;
          const left = Math.max(0, (deadline - performance.now()) / 1000);
          timerEl.textContent = "Time: " + left.toFixed(2) + "s";
          countEl.textContent = "Clicks: " + clicks + " / 20";
          if (clicks >= 20) {
            ov.remove();
            showMovie();
            return;
          }
          if (left <= 0) {
            ov.remove();
            hellFail("Not fast enough in heaven.");
            return;
          }
          requestAnimationFrame(tick);
        }
        ov.addEventListener("click", () => {
          clicks++;
        });
        tick();
      }

      function showMovie() {
        phase = "movie";
        const ov = document.createElement("div");
        ov.className = "hell-overlay";
        ov.style.background = "rgba(0,0,0,0.95)";
        ov.innerHTML =
          "<div class='hell-movie'><div class='hell-movie-title'>ENDGAME // THE MOVIE</div><p style='color:#888;font-size:0.85rem'>Relax. Watch. Your health is… narrative.</p><div class='hell-health-outer'><div class='hell-health-inner' id='hell-movie-hp'></div></div><p id='hell-movie-sub' style='color:#aaa;margin-top:1rem;font-size:0.8rem'></p></div>";
        wrap.appendChild(ov);
        const hp = ov.querySelector("#hell-movie-hp");
        const sub = ov.querySelector("#hell-movie-sub");
        const lines = [
          "Act I: The ball was always political.",
          "Act II: Someone said 'skill issue'.",
          "Act III: Credits roll upside down.",
        ];
        let t = 0;
        const dur = 12000;
        const subInt = setInterval(() => {
          sub.textContent = lines[Math.min(Math.floor(t / 4000), lines.length - 1)];
          t += 400;
        }, 400);
        const start = performance.now();
        function anim() {
          const e = performance.now() - start;
          const k = Math.max(0, 1 - e / dur);
          hp.style.transform = "scaleX(" + k + ")";
          if (e < dur) requestAnimationFrame(anim);
          else {
            clearInterval(subInt);
            ov.remove();
            window.removeEventListener("keydown", keyEv);
            window.removeEventListener("keyup", keyEv);
            setHellCheckpoint(2);
            runHell2();
          }
        }
        anim();
      }

      loop();
    }

    startObby();
  }

  /* —— Hell 2: football —— */
  function runHell2() {
    window.__HELL_ABORT = false;
    setActiveScreen("screen-hell2");
    const canvas = document.getElementById("canvas-hell-football");
    const ctx = canvas.getContext("2d");
    const W = canvas.width,
      H = canvas.height;
    let raf = 0;
    const endTime = performance.now() + 300000;
    let pScore = 0,
      aiScore = 0;
    let px = 200,
      py = H / 2,
      pvx = 0,
      pvy = 0;
    let bx = 280,
      by = H / 2,
      bvx = 0,
      bvy = 0;
    let possessed = true;
    let charge = 0;
    let charging = false;
    const keys = {};
    function keyEv(e) {
      keys[e.code] = e.type === "keydown";
      if (e.code === "Space") {
        e.preventDefault();
        if (e.type === "keydown" && possessed) charging = true;
        if (e.type === "keyup" && charging && possessed) {
          shoot();
          charging = false;
          charge = 0;
        }
      }
    }
    window.addEventListener("keydown", keyEv, { passive: false });
    window.addEventListener("keyup", keyEv, { passive: false });

    function shoot() {
      const goalCx = goalRX - 8;
      const goalCy = (goalTop + goalBot) / 2;
      let dx = goalCx - bx;
      let dy = goalCy - by;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const power = 8 + Math.min(1, charge / 40) * 14;
      const curve = (keys["ArrowLeft"] ? -1 : 0) + (keys["ArrowRight"] ? 1 : 0);
      bvx = dx * power + curve * 1.4;
      bvy = dy * power * 0.92;
      possessed = false;
    }

    const goalTop = 170,
      goalBot = 310,
      goalRX = W - 30;

    function loop() {
      if (window.__HELL_ABORT) return;
      const now = performance.now();
      if (now > endTime) {
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", keyEv);
        window.removeEventListener("keyup", keyEv);
        hellFail("Time up — need 20–0 in 5 minutes.");
        return;
      }
      if (aiScore > 0) {
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", keyEv);
        window.removeEventListener("keyup", keyEv);
        hellFail("They scored. Must be 20–0.");
        return;
      }
      if (pScore >= 20) {
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", keyEv);
        window.removeEventListener("keyup", keyEv);
        setHellCheckpoint(3);
        runHell3();
        return;
      }

      if (charging) charge = Math.min(40, charge + 1.2);

      const acc = 0.45;
      if (keys["ArrowLeft"]) pvx -= acc;
      if (keys["ArrowRight"]) pvx += acc;
      if (keys["ArrowUp"]) pvy -= acc;
      if (keys["ArrowDown"]) pvy += acc;
      pvx *= 0.88;
      pvy *= 0.88;
      if (!possessed) {
        const tdx = bx - px;
        const tdy = by - py;
        const td = Math.hypot(tdx, tdy) || 1;
        pvx += (tdx / td) * 0.42;
        pvy += (tdy / td) * 0.42;
        pvx = Math.max(-7.5, Math.min(7.5, pvx));
        pvy = Math.max(-7.5, Math.min(7.5, pvy));
      }
      px += pvx;
      py += pvy;
      px = Math.max(40, Math.min(W - 80, px));
      py = Math.max(60, Math.min(H - 60, py));

      if (possessed) {
        bx = px + 28;
        by = py;
        bvx = bvy = 0;
      } else {
        bvx *= 0.997;
        bvy *= 0.997;
        bvy += Math.sin(bx * 0.02) * 0.06 * (Math.abs(bvx) > 12 ? 1.2 : 0.5);
        bx += bvx;
        by += bvy;
        if (by < 50 || by > H - 50) bvy *= -1;
        if (bx < 40) {
          bvx = Math.abs(bvx) * 0.6;
          bx = 40;
        }
        if (bx > goalRX && by > goalTop && by < goalBot) {
          pScore++;
          possessed = true;
          bx = px + 28;
          by = py;
        }
        if (bx < 55 && by > goalTop && by < goalBot) {
          aiScore++;
        }
        const d = Math.hypot(px - bx, py - by);
        if (!possessed && d < 36) {
          possessed = true;
        }
      }

      ctx.fillStyle = "#0a3018";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(35, goalTop, 8, goalBot - goalTop);
      ctx.strokeRect(W - 38, goalTop, 8, goalBot - goalTop);
      ctx.fillStyle = "#fff";
      ctx.font = "14px monospace";
      const sec = Math.max(0, Math.ceil((endTime - now) / 1000));
      ctx.fillText(
        "You " + pScore + " — AI " + aiScore + "  |  " + sec + "s  |  Aimbot: shots home on goal · movement pulls to ball",
        12,
        22
      );

      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fillStyle = "#0cf";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx, by, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#ffe";
      ctx.fill();

      raf = requestAnimationFrame(loop);
    }
    loop();
  }

  /* —— Hell 3: five turrets, fixed fire (no aimbot), bouncing bullets —— */
  function runHell3() {
    window.__HELL_ABORT = false;
    setActiveScreen("screen-hell3");
    const canvas = document.getElementById("canvas-hell-guns");
    const ctx = canvas.getContext("2d");
    const W = canvas.width,
      H = canvas.height;
    let px = W / 2,
      py = H / 2;
    const pr = 10;
    const keys = {};
    function keyEv(e) {
      keys[e.code] = e.type === "keydown";
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    }
    window.addEventListener("keydown", keyEv, { passive: false });
    window.addEventListener("keyup", keyEv);

    const walls = [
      { x: 120, y: 100, w: 24, h: 200 },
      { x: 320, y: 220, w: 200, h: 24 },
      { x: 480, y: 80, w: 24, h: 180 },
      { x: 200, y: 360, w: 280, h: 24 },
    ];

    const guns = [
      { x: 8, y: 80 },
      { x: W - 8, y: 120 },
      { x: W / 2, y: 8 },
      { x: 40, y: H - 8 },
      { x: W - 40, y: H - 8 },
    ];

    /** Fixed pattern: each gun fires along a constant direction (arena center + small offset by index — not tracking player). */
    const aimX = W / 2 + 22;
    const aimY = H / 2 - 18;
    const gunMuzzleVel = [];
    guns.forEach((g, i) => {
      let dx = aimX + Math.sin(i * 1.7) * 40 - g.x;
      let dy = aimY + Math.cos(i * 1.3) * 35 - g.y;
      const L = Math.hypot(dx, dy) || 1;
      gunMuzzleVel.push({ vx: (dx / L) * 5.6, vy: (dy / L) * 5.6 });
    });

    let bullets = [];
    let frame = 0;
    const startMs = performance.now();
    const surviveMs = 40000;
    const BULLET_LIFE = 720;
    let raf = 0;

    function circleWall(cx, cy, r) {
      for (const w of walls) {
        const nx = Math.max(w.x, Math.min(cx, w.x + w.w));
        const ny = Math.max(w.y, Math.min(cy, w.y + w.h));
        const dx = cx - nx,
          dy = cy - ny;
        if (dx * dx + dy * dy < r * r) return true;
      }
      return false;
    }

    function pointInWall(x, y) {
      for (const w of walls) {
        if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true;
      }
      return false;
    }

    function moveBulletWithBounce(b) {
      b.x += b.vx;
      if (pointInWall(b.x, b.y)) {
        b.x -= b.vx;
        b.vx *= -1;
      }
      b.y += b.vy;
      if (pointInWall(b.x, b.y)) {
        b.y -= b.vy;
        b.vy *= -1;
      }
      const pad = 4;
      if (b.x < pad) {
        b.x = pad;
        b.vx *= -1;
      } else if (b.x > W - pad) {
        b.x = W - pad;
        b.vx *= -1;
      }
      if (b.y < pad) {
        b.y = pad;
        b.vy *= -1;
      } else if (b.y > H - pad) {
        b.y = H - pad;
        b.vy *= -1;
      }
    }

    function loop(t) {
      if (window.__HELL_ABORT) return;
      const now = t || performance.now();
      const elapsed = now - startMs;
      if (elapsed >= surviveMs) {
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", keyEv);
        window.removeEventListener("keyup", keyEv);
        setHellCheckpoint(4);
        runHell4();
        return;
      }

      const sp = 4.2;
      if (keys["ArrowLeft"]) px -= sp;
      if (keys["ArrowRight"]) px += sp;
      if (keys["ArrowUp"]) py -= sp;
      if (keys["ArrowDown"]) py += sp;

      let tries = 0;
      while (circleWall(px, py, pr) && tries++ < 8) {
        px += (Math.random() - 0.5) * 6;
        py += (Math.random() - 0.5) * 6;
      }
      px = Math.max(pr, Math.min(W - pr, px));
      py = Math.max(pr, Math.min(H - pr, py));

      frame++;
      if (frame % 38 === 0) {
        guns.forEach((g, i) => {
          const mv = gunMuzzleVel[i];
          bullets.push({ x: g.x, y: g.y, vx: mv.vx, vy: mv.vy, life: BULLET_LIFE });
        });
      }

      bullets = bullets.filter((b) => {
        b.life--;
        if (b.life <= 0) return false;
        moveBulletWithBounce(b);
        if (Math.hypot(b.x - px, b.y - py) < pr + 4) {
          cancelAnimationFrame(raf);
          window.removeEventListener("keydown", keyEv);
          window.removeEventListener("keyup", keyEv);
          hellFail("Hit by a bullet — use walls; shots bounce.");
          return false;
        }
        return true;
      });

      ctx.fillStyle = "#080810";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#333";
      for (const w of walls) ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = "#f08";
      for (const g of guns) {
        ctx.beginPath();
        ctx.arc(g.x, g.y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ff0";
      for (const b of bullets) {
        ctx.fillRect(b.x - 3, b.y - 3, 6, 6);
      }
      ctx.fillStyle = "#0ff";
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "14px monospace";
      ctx.fillText("Survive: " + Math.ceil((surviveMs - elapsed) / 1000) + "s · bullets bounce", 12, 20);

      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
  }

  /* —— Hell 4: hacker —— */
  function runHell4() {
    window.__HELL_ABORT = false;
    setActiveScreen("screen-hell4");
    const root = document.getElementById("hell4-root");
    root.innerHTML = "";

    function phaseType(next) {
      const panel = document.createElement("div");
      panel.className = "hell4-panel";
      panel.innerHTML =
        "<h3>Phase 1 — Type the word</h3><p>Type <strong>pneumonoultramicroscopicsilicovolcanoconiosis</strong> in under <strong>1 minute</strong>.</p>";
      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = "hell-type-input";
      inp.autocomplete = "off";
      const timer = document.createElement("p");
      panel.appendChild(inp);
      panel.appendChild(timer);
      root.appendChild(panel);
      inp.focus();
      const deadline = performance.now() + 60000;
      const tick = setInterval(() => {
        if (window.__HELL_ABORT) {
          clearInterval(tick);
          return;
        }
        const s = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
        timer.textContent = "Time left: " + s + "s";
        if (s <= 0) {
          clearInterval(tick);
          root.innerHTML = "";
          hellFail("Typing time expired.");
        }
      }, 200);
      inp.addEventListener("input", () => {
        if (inp.value.trim().toLowerCase() === TYPE_WORD) {
          clearInterval(tick);
          root.innerHTML = "";
          next();
        }
      });
    }

    function phaseSans2(next) {
      const panel = document.createElement("div");
      panel.className = "hell4-panel";
      panel.innerHTML =
        "<h3>Phase 2 — Sans 2.0</h3><p>Faster bones · longer box · new diagonal bursts · <strong>5s</strong> prepare then <strong>28s</strong></p>";
      const cv = document.createElement("canvas");
      cv.width = 720;
      cv.height = 440;
      panel.appendChild(cv);
      root.appendChild(panel);
      const ctx = cv.getContext("2d");
      const W = cv.width,
        H = cv.height;
      const box = { x: 50, y: 70, w: W - 100, h: 300 };
      let px = box.x + box.w / 2,
        py = box.y + box.h / 2;
      const pr = 7;
      const speed = 3.85;
      const PREP_MS = 5000;
      const COMBAT_MS = 28000;
      const startMs = performance.now();
      const cornerSize = 52;
      const cornerZones = [
        { x: box.x, y: box.y, w: cornerSize, h: cornerSize },
        { x: box.x + box.w - cornerSize, y: box.y, w: cornerSize, h: cornerSize },
        { x: box.x, y: box.y + box.h - cornerSize, w: cornerSize, h: cornerSize },
        {
          x: box.x + box.w - cornerSize,
          y: box.y + box.h - cornerSize,
          w: cornerSize,
          h: cornerSize,
        },
      ];
      function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
      }
      function boneHitsCorner(b) {
        for (const z of cornerZones) {
          if (rectsOverlap(b.x, b.y, b.w, b.h, z.x, z.y, z.w, z.h)) return true;
        }
        return false;
      }
      function playerInCornerSafe() {
        for (const z of cornerZones) {
          if (
            px + pr > z.x &&
            px - pr < z.x + z.w &&
            py + pr > z.y &&
            py - pr < z.y + z.h
          )
            return true;
        }
        return false;
      }
      const bones = [];
      let waveTimer = 0,
        wave = 0;
      const keys = {};
      function k(e) {
        keys[e.code] = e.type === "keydown";
      }
      window.addEventListener("keydown", k);
      window.addEventListener("keyup", k);

      function spawn() {
        wave++;
        const t = wave % 5;
        if (t === 0) {
          for (let i = 0; i < 8; i++)
            bones.push({ x: box.x + 15 + i * 48, y: box.y + 30, w: 36, h: 7, vx: 0, vy: 3.1, life: 180 });
        } else if (t === 1) {
          for (let i = 0; i < 6; i++)
            bones.push({ x: box.x + box.w - 20, y: box.y + 40 + i * 42, w: 7, h: 32, vx: -3.4, vy: 0, life: 200 });
        } else if (t === 2) {
          for (let i = 0; i < 10; i++)
            bones.push({
              x: box.x - 20,
              y: box.y + 25 + i * 26,
              w: 50,
              h: 6,
              vx: 3.8,
              vy: Math.sin(i) * 0.8,
              life: 220,
            });
        } else if (t === 3) {
          for (let i = 0; i < 7; i++)
            bones.push({
              x: box.x + 80 + i * 55,
              y: box.y + box.h + 15,
              w: 8,
              h: 40,
              vx: 0,
              vy: -3.2,
              life: 190,
            });
        } else {
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            bones.push({
              x: box.x + box.w / 2,
              y: box.y + box.h / 2,
              w: 10,
              h: 10,
              vx: Math.cos(a) * 4.2,
              vy: Math.sin(a) * 4.2,
              life: 160,
            });
          }
        }
      }

      let raf = 0;
      function loop(now) {
        if (window.__HELL_ABORT) return;
        const elapsed = now - startMs;
        const inPrep = elapsed < PREP_MS;
        const combatElapsed = Math.max(0, elapsed - PREP_MS);

        if (elapsed >= PREP_MS + COMBAT_MS) {
          cancelAnimationFrame(raf);
          window.removeEventListener("keydown", k);
          window.removeEventListener("keyup", k);
          root.innerHTML = "";
          next();
          return;
        }

        if (inPrep) {
          bones.length = 0;
          waveTimer = 0;
        } else {
          waveTimer++;
          if (waveTimer > 22) {
            waveTimer = 0;
            spawn();
          }
        }

        if (keys["ArrowLeft"]) px -= speed;
        if (keys["ArrowRight"]) px += speed;
        if (keys["ArrowUp"]) py -= speed;
        if (keys["ArrowDown"]) py += speed;
        px = Math.max(box.x + pr, Math.min(box.x + box.w - pr, px));
        py = Math.max(box.y + pr, Math.min(box.y + box.h - pr, py));

        const cornerSafe = playerInCornerSafe();

        for (let i = bones.length - 1; i >= 0; i--) {
          const b = bones[i];
          if (!inPrep) {
            b.life--;
            b.x += b.vx;
            b.y += b.vy;
          }
          if (boneHitsCorner(b)) {
            bones.splice(i, 1);
            continue;
          }
          if (b.life <= 0 || b.x < box.x - 80 || b.x > box.x + box.w + 80 || b.y < box.y - 80 || b.y > box.y + box.h + 80) {
            bones.splice(i, 1);
            continue;
          }
          if (
            !cornerSafe &&
            px + pr > b.x &&
            px - pr < b.x + b.w &&
            py + pr > b.y &&
            py - pr < b.y + b.h
          ) {
            cancelAnimationFrame(raf);
            window.removeEventListener("keydown", k);
            window.removeEventListener("keyup", k);
            root.innerHTML = "";
            hellFail("Sans 2.0 caught you.");
            return;
          }
        }

        ctx.fillStyle = "#0a0008";
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "#f4a";
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        ctx.fillStyle = "#eef";
        for (const b of bones) ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = "#f44";
        ctx.beginPath();
        ctx.moveTo(px, py - pr);
        ctx.lineTo(px + pr, py + pr);
        ctx.lineTo(px - pr, py + pr);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fff";
        if (inPrep) {
          const pl = Math.max(0, Math.ceil((PREP_MS - elapsed) / 1000));
          ctx.fillText("Sans 2.0 — prepare: " + pl + "s", box.x, 40);
        } else {
          ctx.fillText("Sans 2.0 — " + Math.ceil((COMBAT_MS - combatElapsed) / 1000) + "s", box.x, 40);
        }

        raf = requestAnimationFrame(loop);
      }
      raf = requestAnimationFrame(loop);
    }

    function phaseSpam() {
      const panel = document.createElement("div");
      panel.className = "hell4-panel";
      panel.innerHTML =
        "<h3>Phase 3 — Out-click the hacker</h3><p>Hacker outputs <strong>100 clicks per minute</strong>. You must click <strong>more than 100 times</strong> in <strong>one minute</strong> to win.</p>";
      const area = document.createElement("div");
      area.className = "hell-spam-area";
      area.textContent = "SPAM CLICK HERE";
      const stat = document.createElement("p");
      panel.appendChild(area);
      panel.appendChild(stat);
      root.appendChild(panel);

      let clicks = 0;
      let hackerClicks = 0;
      const deadline = performance.now() + 60000;
      const hackerRate = 100 / 60;

      let iv = null;
      let spamDone = false;
      function finishSpam(win) {
        if (spamDone) return;
        spamDone = true;
        if (iv) clearInterval(iv);
        root.innerHTML = "";
        if (win) showHackerDestroyed();
        else hellFail("Not enough clicks — need more than 100.");
      }

      area.addEventListener("click", () => {
        clicks++;
        if (clicks > 100 && performance.now() < deadline) finishSpam(true);
      });

      iv = setInterval(() => {
        if (window.__HELL_ABORT) {
          clearInterval(iv);
          return;
        }
        const left = (deadline - performance.now()) / 1000;
        hackerClicks += hackerRate * (1 / 20);
        stat.textContent =
          "Your clicks: " + clicks + " (need >100) · Hacker ~" + Math.floor(hackerClicks) + " / min pace · " + left.toFixed(1) + "s";
        if (left <= 0) {
          finishSpam(clicks > 100);
        }
      }, 50);
    }

    function showHackerDestroyed() {
      setActiveScreen("screen-hell4");
      const root2 = document.getElementById("hell4-root");
      root2.innerHTML =
        "<div class='hell4-panel' style='text-align:center'><h3>HACKER NEUTRALIZED</h3><div class='hacker-fall'></div><p>The hacker is destroyed and falls…</p></div>";
      setTimeout(() => {
        if (root2) root2.innerHTML = "";
        function goThanks() {
          clearHellCheckpoint();
          setActiveScreen("screen-thanks");
          if (window.__npcSetHellPhase) window.__npcSetHellPhase("thanks");
        }
        if (window.__npcStartPostHellGunfight) {
          window.__npcStartPostHellGunfight(goThanks, function () {
            if (window.__npcGameOver) window.__npcGameOver();
          });
        } else {
          goThanks();
        }
      }, 2800);
    }

    phaseType(() => phaseSans2(() => phaseSpam()));
  }

  window.HellMode = {
    refreshHackedUI,
    resetCheckpointToOne() {
      clearHellCheckpoint();
      refreshHackedUI();
    },
    clearHellProgress() {
      clearHellCheckpoint();
    },
    onHackedEnter() {
      const cp = getHellCheckpoint();
      if (cp === 1) runHell1();
      else if (cp === 2) runHell2();
      else if (cp === 3) runHell3();
      else runHell4();
    },
  };
})();
