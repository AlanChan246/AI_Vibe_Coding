(function () {
  function start(canvas) {
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let ended = false;

    const W = canvas.width;
    const H = canvas.height;
    const box = { x: 80, y: 100, w: W - 160, h: 280 };
    let px = box.x + box.w / 2,
      py = box.y + box.h / 2;
    const pr = 8;
    const speed = 3.2;

    const PREP_MS = 5000;
    const COMBAT_MS = 20000;
    const startMs = performance.now();

    const bones = [];
    let wave = 0;
    let waveTimer = 0;

    const keys = {};
    function onKey(e) {
      keys[e.code] = e.type === "keydown";
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);

    function spawnWave() {
      wave++;
      const t = wave % 4;
      if (t === 0) {
        for (let i = 0; i < 6; i++) {
          bones.push({ type: "h", x: box.x + 20 + i * 52, y: box.y + 40, w: 40, h: 8, vy: 2.2, life: 200 });
        }
      } else if (t === 1) {
        for (let i = 0; i < 5; i++) {
          bones.push({ type: "v", x: box.x + 30 + i * 70, y: box.y + box.h - 20, w: 8, h: 50, vy: -2.4, life: 200 });
        }
      } else if (t === 2) {
        for (let i = 0; i < 8; i++) {
          bones.push({
            type: "h",
            x: box.x + (i % 2) * 200 + 40,
            y: box.y + 60 + i * 28,
            w: 100,
            h: 7,
            vy: i % 2 === 0 ? 1.8 : -1.8,
            life: 220,
          });
        }
      } else {
        for (let i = 0; i < 10; i++) {
          bones.push({
            type: "v",
            x: box.x + 50 + ((i * 47) % (box.w - 80)),
            y: box.y - 30 - i * 8,
            w: 7,
            h: 36,
            vy: 2.6,
            life: 240,
          });
        }
      }
    }

    function loop(now) {
      if (ended) return;

      const elapsed = now - startMs;
      const inPrep = elapsed < PREP_MS;
      const combatElapsed = Math.max(0, elapsed - PREP_MS);

      if (elapsed >= PREP_MS + COMBAT_MS) {
        ended = true;
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("keyup", onKey);
        setTimeout(() => window.__npcLevelWin(), 500);
        return;
      }

      if (inPrep) {
        bones.length = 0;
        waveTimer = 0;
      } else {
        waveTimer++;
        if (waveTimer > 55) {
          waveTimer = 0;
          spawnWave();
        }
      }

      if (keys["ArrowLeft"]) px -= speed;
      if (keys["ArrowRight"]) px += speed;
      if (keys["ArrowUp"]) py -= speed;
      if (keys["ArrowDown"]) py += speed;

      px = Math.max(box.x + pr, Math.min(box.x + box.w - pr, px));
      py = Math.max(box.y + pr, Math.min(box.y + box.h - pr, py));

      for (let i = bones.length - 1; i >= 0; i--) {
        const b = bones[i];
        if (!inPrep) {
          b.life--;
          b.y += b.vy;
        }
        if (b.life <= 0 || b.y < box.y - 60 || b.y > box.y + box.h + 60) {
          bones.splice(i, 1);
          continue;
        }
        if (
          px + pr > b.x &&
          px - pr < b.x + b.w &&
          py + pr > b.y &&
          py - pr < b.y + b.h
        ) {
          ended = true;
          cancelAnimationFrame(raf);
          window.removeEventListener("keydown", onKey);
          window.removeEventListener("keyup", onKey);
          setTimeout(() => window.__npcGameOver(), 500);
          return;
        }
      }

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.w, box.h);

      for (const b of bones) {
        ctx.fillStyle = "#f8f8ff";
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }

      ctx.fillStyle = "#ff2244";
      ctx.beginPath();
      ctx.moveTo(px, py - pr);
      ctx.lineTo(px + pr, py + pr);
      ctx.lineTo(px - pr, py + pr);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = "14px monospace";
      if (inPrep) {
        const prepLeft = Math.max(0, Math.ceil((PREP_MS - elapsed) / 1000));
        ctx.fillText("Sans — prepare: " + prepLeft + "s", box.x, box.y - 16);
      } else {
        const remain = Math.max(0, Math.ceil((COMBAT_MS - combatElapsed) / 1000));
        ctx.fillText("Sans — survive: " + remain + "s", box.x, box.y - 16);
      }

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);

    return function cleanup() {
      ended = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }

  window.SansGame = { start };
})();
