(function () {
  function start(canvas) {
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let ended = false;

    const W = canvas.width;
    const H = canvas.height;
    const rows = 5;
    const cols = 11;
    const invW = 36;
    const invH = 26;
    const gapX = 12;
    const gapY = 10;
    let fleetDx = 1.2;
    let fleetY = 60;
    let fleetX = 40;
    let tick = 0;

    const invaders = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        invaders.push({
          r,
          c,
          alive: true,
          hue: 180 + r * 25,
        });
      }
    }

    const player = { x: W / 2 - 25, y: H - 50, w: 50, h: 18 };
    /** Homing MG rounds: { x, y, vx, vy } */
    let bullets = [];
    let enemyBullets = [];
    const stars = Array.from({ length: 80 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      s: Math.random() * 1.5 + 0.3,
      tw: Math.random() * Math.PI * 2,
    }));

    const MG_COOLDOWN_FRAMES = 2;
    let mgCooldown = 0;
    const BULLET_SPEED = 11;
    const HOMING_STRENGTH = 0.22;
    const MAX_BULLETS = 48;

    function aliveInvaders() {
      return invaders.filter((i) => i.alive);
    }

    function nearestInvaderCenter(fromX, fromY) {
      let best = null,
        bestD = Infinity;
      for (const inv of invaders) {
        if (!inv.alive) continue;
        const ix = fleetX + inv.c * (invW + gapX) + invW / 2;
        const iy = fleetY + inv.r * (invH + gapY) + invH / 2;
        const d = (ix - fromX) * (ix - fromX) + (iy - fromY) * (iy - fromY);
        if (d < bestD) {
          bestD = d;
          best = { x: ix, y: iy };
        }
      }
      return best;
    }

    function spawnPlayerBullet() {
      if (bullets.length >= MAX_BULLETS) return;
      const cx = player.x + player.w / 2;
      const cy = player.y;
      const tgt = nearestInvaderCenter(cx, cy);
      let vx = 0,
        vy = -BULLET_SPEED;
      if (tgt) {
        const dx = tgt.x - cx,
          dy = tgt.y - cy;
        const L = Math.hypot(dx, dy) || 1;
        vx = (dx / L) * BULLET_SPEED;
        vy = (dy / L) * BULLET_SPEED;
      }
      bullets.push({ x: cx - 2, y: cy, vx, vy, w: 4, h: 4 });
    }

    function fleetBounds() {
      const a = aliveInvaders();
      if (!a.length) return null;
      let minX = Infinity,
        maxX = -Infinity,
        maxY = 0;
      for (const inv of a) {
        const x = fleetX + inv.c * (invW + gapX);
        const y = fleetY + inv.r * (invH + gapY);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + invW);
        maxY = Math.max(maxY, y + invH);
      }
      return { minX, maxX, maxY };
    }

    function win() {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouse);
      setTimeout(() => window.__npcLevelWin(), 400);
    }

    function lose() {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouse);
      setTimeout(() => window.__npcGameOver(), 400);
    }

    const keys = {};
    function onKey(e) {
      keys[e.code] = true;
      if (e.code === "Space") e.preventDefault();
    }
    function onKeyUp(e) {
      keys[e.code] = false;
    }
    function onMouse(e) {
      const rect = canvas.getBoundingClientRect();
      const scale = canvas.width / rect.width;
      player.x = (e.clientX - rect.left) * scale - player.w / 2;
      player.x = Math.max(10, Math.min(W - player.w - 10, player.x));
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("mousemove", onMouse);

    function drawInvader(x, y, hue) {
      ctx.save();
      ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
      ctx.shadowBlur = 12;
      ctx.fillStyle = `hsl(${hue}, 85%, 55%)`;
      ctx.fillRect(x + 4, y + 8, invW - 8, invH - 12);
      ctx.fillRect(x, y + 14, 8, 8);
      ctx.fillRect(x + invW - 8, y + 14, 8, 8);
      ctx.fillRect(x + 10, y + 2, 6, 8);
      ctx.fillRect(x + invW - 16, y + 2, 6, 8);
      ctx.restore();
    }

    function loop() {
      if (ended) return;
      tick++;
      ctx.fillStyle = "#030510";
      ctx.fillRect(0, 0, W, H);
      for (const st of stars) {
        st.tw += 0.02;
        const a = 0.4 + Math.sin(st.tw) * 0.35;
        ctx.fillStyle = `rgba(200, 230, 255, ${a})`;
        ctx.fillRect(st.x, st.y, st.s, st.s);
      }

      if (keys["ArrowLeft"] || keys["KeyA"]) player.x -= 5;
      if (keys["ArrowRight"] || keys["KeyD"]) player.x += 5;
      player.x = Math.max(10, Math.min(W - player.w - 10, player.x));

      if (keys["Space"]) {
        mgCooldown--;
        if (mgCooldown <= 0) {
          spawnPlayerBullet();
          mgCooldown = MG_COOLDOWN_FRAMES;
        }
      } else {
        mgCooldown = 0;
      }

      const b = fleetBounds();
      if (b) {
        if (b.maxX > W - 20 || b.minX < 20) {
          fleetDx *= -1;
          fleetY += 12;
        }
        if (b.maxY > player.y - 10) {
          lose();
          return;
        }
      }
      fleetX += fleetDx;

      for (const inv of invaders) {
        if (!inv.alive) continue;
        const x = fleetX + inv.c * (invW + gapX);
        const y = fleetY + inv.r * (invH + gapY);
        drawInvader(x, y, inv.hue);
      }

      ctx.save();
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#00d4ee";
      ctx.beginPath();
      ctx.moveTo(player.x + player.w / 2, player.y);
      ctx.lineTo(player.x + player.w, player.y + player.h);
      ctx.lineTo(player.x, player.y + player.h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      bullets = bullets.filter((bul) => {
        const cx = bul.x + bul.w / 2,
          cy = bul.y + bul.h / 2;
        const tgt = nearestInvaderCenter(cx, cy);
        if (tgt) {
          const dx = tgt.x - cx,
            dy = tgt.y - cy;
          const L = Math.hypot(dx, dy) || 1;
          const tx = dx / L,
            ty = dy / L;
          bul.vx += (tx * BULLET_SPEED - bul.vx) * HOMING_STRENGTH;
          bul.vy += (ty * BULLET_SPEED - bul.vy) * HOMING_STRENGTH;
          const sp = Math.hypot(bul.vx, bul.vy) || 1;
          const cap = BULLET_SPEED * 1.15;
          if (sp > cap) {
            bul.vx = (bul.vx / sp) * cap;
            bul.vy = (bul.vy / sp) * cap;
          }
        }
        bul.x += bul.vx;
        bul.y += bul.vy;
        if (bul.x < -20 || bul.x > W + 20 || bul.y < -20 || bul.y > H + 20) return false;

        ctx.fillStyle = "#ffee66";
        ctx.shadowColor = "#ff4400";
        ctx.shadowBlur = 6;
        ctx.fillRect(bul.x, bul.y, bul.w, bul.h + 6);
        ctx.shadowBlur = 0;

        for (const inv of invaders) {
          if (!inv.alive) continue;
          const ix = fleetX + inv.c * (invW + gapX);
          const iy = fleetY + inv.r * (invH + gapY);
          if (bul.x < ix + invW && bul.x + bul.w > ix && bul.y < iy + invH && bul.y + bul.h + 6 > iy) {
            inv.alive = false;
            return false;
          }
        }
        return true;
      });

      if (aliveInvaders().length === 0) {
        win();
        return;
      }

      if (tick % 55 === 0 && aliveInvaders().length) {
        const a = aliveInvaders();
        const shooter = a[Math.floor(Math.random() * a.length)];
        const ix = fleetX + shooter.c * (invW + gapX) + invW / 2;
        const iy = fleetY + shooter.r * (invH + gapY) + invH;
        enemyBullets.push({ x: ix, y: iy, dy: 5 });
      }

      enemyBullets = enemyBullets.filter((eb) => {
        eb.y += eb.dy;
        if (eb.y > H) return false;
        ctx.fillStyle = "#ff3366";
        ctx.fillRect(eb.x - 2, eb.y, 5, 12);
        if (
          eb.x > player.x &&
          eb.x < player.x + player.w &&
          eb.y > player.y &&
          eb.y < player.y + player.h
        ) {
          lose();
          return false;
        }
        return true;
      });

      raf = requestAnimationFrame(loop);
    }

    loop();

    return function cleanup() {
      ended = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouse);
    };
  }

  window.SpaceInvadersGame = { start };
})();
