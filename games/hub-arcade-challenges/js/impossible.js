(function () {
  /**
   * Post-victory gauntlet: 20 turrets in a ring, aimbot + wall bounces, no safe zones.
   * Survive SURVIVE_MS to continue to hell mode intro.
   */
  function start(canvas, onWin, onLose) {
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let ended = false;

    const W = canvas.width;
    const H = canvas.height;
    const pad = 40;
    const left = pad;
    const top = pad;
    const right = W - pad;
    const bottom = H - pad;

    let px = W / 2;
    let py = H / 2;
    let prevPx = px;
    let prevPy = py;
    const pr = 9;
    const moveSp = 5.4;
    const BULLET_SPEED = 6.1;
    const LEAD = 11;
    const SURVIVE_MS = 14000;
    const MAX_BULLETS = 160;
    const BULLET_LIFE = 500;

    const startMs = performance.now();
    const cx = W / 2;
    const cy = H / 2;
    const Rx = W / 2 - pad - 18;
    const Ry = H / 2 - pad - 18;

    const guns = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      guns.push({
        x: cx + Math.cos(a) * Rx,
        y: cy + Math.sin(a) * Ry,
        phase: i * 4,
      });
    }

    let bullets = [];
    let frame = 0;

    const keys = {};
    function keyEv(e) {
      keys[e.code] = e.type === "keydown";
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    }
    window.addEventListener("keydown", keyEv, { passive: false });
    window.addEventListener("keyup", keyEv);

    function spawnFromGun(g) {
      const pvx = px - prevPx;
      const pvy = py - prevPy;
      const tx = px + pvx * LEAD;
      const ty = py + pvy * LEAD;
      let dx = tx - g.x;
      let dy = ty - g.y;
      const L = Math.hypot(dx, dy) || 1;
      dx /= L;
      dy /= L;
      if (bullets.length >= MAX_BULLETS) bullets.shift();
      bullets.push({
        x: g.x,
        y: g.y,
        vx: dx * BULLET_SPEED,
        vy: dy * BULLET_SPEED,
        life: BULLET_LIFE,
      });
    }

    function bounceBullet(b) {
      b.x += b.vx;
      if (b.x < left) {
        b.x = left;
        b.vx *= -1;
      } else if (b.x > right) {
        b.x = right;
        b.vx *= -1;
      }
      b.y += b.vy;
      if (b.y < top) {
        b.y = top;
        b.vy *= -1;
      } else if (b.y > bottom) {
        b.y = bottom;
        b.vy *= -1;
      }
    }

    function loop(t) {
      if (ended) return;
      const now = t || performance.now();
      const elapsed = now - startMs;

      if (elapsed >= SURVIVE_MS) {
        ended = true;
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", keyEv);
        window.removeEventListener("keyup", keyEv);
        if (typeof onWin === "function") onWin();
        return;
      }

      prevPx = px;
      prevPy = py;

      if (keys["ArrowLeft"]) px -= moveSp;
      if (keys["ArrowRight"]) px += moveSp;
      if (keys["ArrowUp"]) py -= moveSp;
      if (keys["ArrowDown"]) py += moveSp;
      px = Math.max(left + pr, Math.min(right - pr, px));
      py = Math.max(top + pr, Math.min(bottom - pr, py));

      frame++;
      guns.forEach((g) => {
        if ((frame + g.phase) % 26 === 0) spawnFromGun(g);
      });

      bullets = bullets.filter((b) => {
        b.life--;
        if (b.life <= 0) return false;
        bounceBullet(b);
        if (Math.hypot(b.x - px, b.y - py) < pr + 5) {
          ended = true;
          cancelAnimationFrame(raf);
          window.removeEventListener("keydown", keyEv);
          window.removeEventListener("keyup", keyEv);
          if (typeof onLose === "function") onLose();
          return false;
        }
        return true;
      });

      ctx.fillStyle = "#06020a";
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(255,0,80,0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(left, top, right - left, bottom - top);

      ctx.fillStyle = "#1a0508";
      for (const g of guns) {
        ctx.beginPath();
        ctx.arc(g.x, g.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#f06";
        ctx.stroke();
      }

      ctx.fillStyle = "#ffee44";
      for (const b of bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#0ff";
      ctx.shadowColor = "#0ff";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#faa";
      ctx.font = "bold 15px Share Tech Mono, monospace";
      ctx.textAlign = "left";
      ctx.fillText("FINAL BARRAGE — " + Math.ceil((SURVIVE_MS - elapsed) / 1000) + "s · 20 guns · aim + bounce", left, 24);

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);

    return function cleanup() {
      ended = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", keyEv);
      window.removeEventListener("keyup", keyEv);
    };
  }

  window.ImpossibleMode = { start };
})();
