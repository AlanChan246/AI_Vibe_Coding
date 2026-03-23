(function () {
  const ROSTER = [
    { id: "ryu", name: "Ryu", color: "#4488cc" },
    { id: "ken", name: "Ken", color: "#cc4422" },
    { id: "chun", name: "Chun-Li", color: "#44cc88" },
    { id: "guile", name: "Guile", color: "#ccaa44" },
    { id: "blanka", name: "Blanka", color: "#66cc33" },
    { id: "dhalsim", name: "Dhalsim", color: "#aa66ff" },
    { id: "honda", name: "E. Honda", color: "#dd88aa" },
    { id: "zangief", name: "Zangief", color: "#cc4444" },
  ];

  function start(selectRoot, canvas, hintEl) {
    let raf = 0;
    let ended = false;
    let picked = null;

    selectRoot.innerHTML = "";
    selectRoot.classList.remove("hidden");
    canvas.classList.add("hidden");
    hintEl.classList.add("hidden");

    ROSTER.forEach((ch) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = ch.name;
      b.style.borderColor = ch.color;
      b.style.color = ch.color;
      b.addEventListener("click", () => begin(ch));
      selectRoot.appendChild(b);
    });

    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const ground = H - 70;

    let p = { x: 180, y: ground, vx: 0, vy: 0, hp: 100, facing: 1, punch: 0, kick: 0, onGround: true };
    let cpu = { x: W - 220, y: ground, vx: 0, vy: 0, hp: 100, facing: -1, punch: 0, kick: 0, onGround: true };
    let superMeter = 0;
    /** Super fireballs: all supers are fireballs */
    let fireballs = [];
    let prevKeyL = false;
    const grav = 0.65;

    const keys = {};
    function onKey(e) {
      keys[e.code] = e.type === "keydown";
      if (e.type === "keydown") {
        if (e.code === "KeyJ") p.punch = 12;
        if (e.code === "KeyK") p.kick = 14;
      }
    }

    function rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    function drawFighter(f, color, label) {
      const w = 44;
      const h = 80;
      const drawY = f.y - h;
      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillRect(f.x - w / 2, drawY, w, h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, f.x, drawY - 6);
      ctx.restore();

      if (f.punch > 0) {
        const px = f.x + f.facing * (w / 2 + 18);
        ctx.fillStyle = "#ffee88";
        ctx.fillRect(px - 12, drawY + 28, 28, 14);
      }
      if (f.kick > 0) {
        const kx = f.x + f.facing * (w / 2 + 22);
        ctx.fillStyle = "#ff8866";
        ctx.fillRect(kx - 8, drawY + 50, 20, 10);
      }
    }

    function hpBar(x, y, w, h, pct, col) {
      ctx.strokeStyle = col;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "#111";
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = col;
      ctx.fillRect(x + 1, y + 1, (w - 2) * (pct / 100), h - 2);
    }

    function superBar(x, y, w, h, pct, col) {
      ctx.strokeStyle = "#888";
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "#222";
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = col;
      ctx.fillRect(x + 1, y + 1, (w - 2) * (pct / 100), h - 2);
    }

    let cpuTimer = 0;

    function loop() {
      if (ended) return;
      cpuTimer++;

      if (p.punch > 0) p.punch--;
      if (p.kick > 0) p.kick--;
      if (cpu.punch > 0) cpu.punch--;
      if (cpu.kick > 0) cpu.kick--;

      const wantSuper = keys["KeyL"] && !prevKeyL;
      prevKeyL = !!keys["KeyL"];
      if (wantSuper && superMeter >= 100) {
        superMeter = 0;
        const fy = ground - 40;
        fireballs.push({
          x: p.x + p.facing * 38,
          y: fy,
          vx: p.facing * 10.5,
          r: 16,
          color: picked.color,
          hit: false,
        });
      }

      p.vx = 0;
      if (keys["KeyA"]) {
        p.vx = -3.2;
        p.facing = -1;
      }
      if (keys["KeyD"]) {
        p.vx = 3.2;
        p.facing = 1;
      }
      if (keys["KeyW"] && p.onGround) {
        p.vy = -11;
        p.onGround = false;
      }

      const dist = Math.abs(p.x - cpu.x);
      if (dist > 120 && cpuTimer % 40 < 20) {
        cpu.vx = p.x < cpu.x ? -2.2 : 2.2;
        cpu.facing = p.x < cpu.x ? -1 : 1;
      } else {
        cpu.vx = 0;
        if (cpuTimer % 70 === 0) {
          if (Math.random() < 0.5) cpu.punch = 12;
          else cpu.kick = 14;
        }
      }

      p.x += p.vx;
      cpu.x += cpu.vx;
      p.x = Math.max(40, Math.min(W - 40, p.x));
      cpu.x = Math.max(40, Math.min(W - 40, cpu.x));

      p.y += p.vy;
      cpu.y += cpu.vy;
      if (p.y >= ground) {
        p.y = ground;
        p.vy = 0;
        p.onGround = true;
      } else p.vy += grav;
      if (cpu.y >= ground) {
        cpu.y = ground;
        cpu.vy = 0;
        cpu.onGround = true;
      } else cpu.vy += grav;

      const pw = 44,
        ph = 80;
      const pTop = p.y - ph;
      const cTop = cpu.y - ph;

      if (p.punch === 8) {
        const px = p.x + p.facing * (pw / 2 + 18);
        if (rectHit(px - 12, pTop + 28, 28, 14, cpu.x - pw / 2, cTop, pw, ph)) {
          cpu.hp -= 8;
          superMeter = Math.min(100, superMeter + 14);
        }
      }
      if (p.kick === 9) {
        const kx = p.x + p.facing * (pw / 2 + 22);
        if (rectHit(kx - 8, pTop + 50, 20, 10, cpu.x - pw / 2, cTop, pw, ph)) {
          cpu.hp -= 11;
          superMeter = Math.min(100, superMeter + 18);
        }
      }
      if (cpu.punch === 8) {
        const px = cpu.x + cpu.facing * (pw / 2 + 18);
        if (rectHit(px - 12, cTop + 28, 28, 14, p.x - pw / 2, pTop, pw, ph)) {
          p.hp -= 6;
        }
      }
      if (cpu.kick === 9) {
        const kx = cpu.x + cpu.facing * (pw / 2 + 22);
        if (rectHit(kx - 8, cTop + 50, 20, 10, p.x - pw / 2, pTop, pw, ph)) {
          p.hp -= 9;
        }
      }

      fireballs = fireballs.filter((fb) => {
        fb.x += fb.vx;
        if (fb.x < -40 || fb.x > W + 40) return false;
        const bx0 = cpu.x - pw / 2,
          by0 = cTop,
          bw = pw,
          bh = ph;
        const nx = Math.max(bx0, Math.min(fb.x, bx0 + bw));
        const ny = Math.max(by0, Math.min(fb.y, by0 + bh));
        if (!fb.hit && Math.hypot(fb.x - nx, fb.y - ny) < fb.r) {
          fb.hit = true;
          cpu.hp -= 28;
          return false;
        }
        return true;
      });

      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#1a0a30");
      g.addColorStop(1, "#050510");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(0,240,255,0.2)";
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo((i * W) / 8, 0);
        ctx.lineTo((i * W) / 8 + 40, H);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(0,240,255,0.08)";
      ctx.fillRect(0, ground + 10, W, H - ground);

      for (const fb of fireballs) {
        ctx.save();
        ctx.shadowColor = "#ff6600";
        ctx.shadowBlur = 20;
        const grd = ctx.createRadialGradient(fb.x, fb.y, 2, fb.x, fb.y, fb.r);
        grd.addColorStop(0, "#fff8a0");
        grd.addColorStop(0.4, fb.color);
        grd.addColorStop(1, "rgba(255,80,0,0.2)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(fb.x, fb.y, fb.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      hpBar(40, 16, 200, 14, p.hp, picked.color);
      hpBar(W - 240, 16, 200, 14, cpu.hp, "#ff00aa");
      superBar(40, 34, 200, 8, superMeter, superMeter >= 100 ? "#ffaa00" : "#4488cc");
      ctx.fillStyle = "#889";
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
      ctx.fillText("SUPER", 44, 32);

      drawFighter(p, picked.color, picked.name);
      drawFighter(cpu, "#ff00aa", "CPU");

      if (p.hp <= 0) {
        ended = true;
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("keyup", onKey);
        setTimeout(() => window.__npcGameOver(), 500);
        return;
      }
      if (cpu.hp <= 0) {
        ended = true;
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("keyup", onKey);
        setTimeout(() => window.__npcLevelWin(), 500);
        return;
      }

      raf = requestAnimationFrame(loop);
    }

    function begin(ch) {
      picked = ch;
      selectRoot.classList.add("hidden");
      canvas.classList.remove("hidden");
      hintEl.classList.remove("hidden");
      superMeter = 0;
      fireballs = [];
      prevKeyL = false;
      window.addEventListener("keydown", onKey);
      window.addEventListener("keyup", onKey);
      loop();
    }

    return function cleanup() {
      ended = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      selectRoot.innerHTML = "";
      selectRoot.classList.remove("hidden");
      canvas.classList.add("hidden");
      hintEl.classList.add("hidden");
    };
  }

  window.StreetFighterGame = { start };
})();
