(function () {
  function start(canvas) {
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let ended = false;

    const W = canvas.width;
    const H = canvas.height;
    const playerPaddleH = 108;
    const cpuPaddleH = 72;
    const paddleW = 12;
    let py = H / 2 - playerPaddleH / 2;
    let cpuY = H / 2 - cpuPaddleH / 2;
    let bx = W / 2,
      by = H / 2;
    let bvx = 3.2 * (Math.random() > 0.5 ? 1 : -1);
    let bvy = (Math.random() * 1.4 + 1.2) * (Math.random() > 0.5 ? 1 : -1);
    /** Lateral spin applied each frame on your smashes — curves mid-air */
    let smashCurve = 0;
    const margin = 18;
    let scoreP = 0,
      scoreC = 0;
    const winScore = 5;
    /** CPU can barely react to your speed */
    const cpuReturnCap = 4.2;
    /** ~2× previous “100 mph” smash */
    const playerSmashX = 25;
    const wallTop = 8;
    const wallBot = H - 8;
    let mouseBiasY = 0;

    function predictYAtPlayerPaddle() {
      if (bvx >= 0) return null;
      let x = bx,
        y = by,
        vx = bvx,
        vy = bvy;
      const targetX = margin + paddleW + 6;
      for (let i = 0; i < 600; i++) {
        if (x <= targetX) return Math.max(wallTop, Math.min(wallBot, y));
        x += vx;
        y += vy;
        if (y < wallTop) {
          y = wallTop + (wallTop - y);
          vy = -vy;
        } else if (y > wallBot) {
          y = wallBot - (y - wallBot);
          vy = -vy;
        }
      }
      return by;
    }

    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      const scale = canvas.height / rect.height;
      mouseBiasY = (e.clientY - rect.top) * scale - (py + playerPaddleH / 2);
    }

    canvas.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);

    const keys = {};
    function onKey(e) {
      keys[e.code] = true;
    }
    function onKeyUp(e) {
      keys[e.code] = false;
    }

    function resetBall(dir) {
      bx = W / 2;
      by = H / 2;
      bvx = 3.4 * dir;
      bvy = (Math.random() * 1.6 + 1.1) * (Math.random() > 0.5 ? 1 : -1);
      smashCurve = 0;
    }

    function loop() {
      if (ended) return;

      // Curved trajectory on your rocket shots toward CPU
      if (bvx > 14 && smashCurve !== 0) {
        bvy += smashCurve * 0.38;
        bvy += Math.sin(bx * 0.045) * 0.22;
        bvy = Math.max(-11, Math.min(11, bvy));
      }

      bx += bvx;
      by += bvy;

      if (by < wallTop || by > wallBot) bvy *= -1;

      const predicted = predictYAtPlayerPaddle();
      const aimCenter = predicted != null ? predicted : H / 2;
      const bias = mouseBiasY;
      const targetPy = aimCenter - playerPaddleH / 2 + Math.max(-42, Math.min(42, bias * 0.35));
      py += (targetPy - py) * 0.42;
      if (keys["ArrowUp"]) py -= 5;
      if (keys["ArrowDown"]) py += 5;
      py = Math.max(0, Math.min(H - playerPaddleH, py));

      const cpuTarget = by - cpuPaddleH / 2;
      const cpuMove = (cpuTarget - cpuY) * 0.016;
      const maxCpuStep = 0.75;
      cpuY += Math.max(-maxCpuStep, Math.min(maxCpuStep, cpuMove));
      cpuY = Math.max(0, Math.min(H - cpuPaddleH, cpuY));

      if (bx < margin + paddleW && by > py && by < py + playerPaddleH) {
        bx = margin + paddleW;
        const hit = (by - (py + playerPaddleH / 2)) / (playerPaddleH / 2);
        bvx = playerSmashX;
        bvy = hit * 6.2 + (Math.random() - 0.5) * 1.8;
        smashCurve = hit * 1.15 + (Math.random() - 0.5) * 1.5;
      }
      if (bx > W - margin - paddleW && by > cpuY && by < cpuY + cpuPaddleH) {
        bx = W - margin - paddleW;
        smashCurve = 0;
        bvx = -Math.min(cpuReturnCap, Math.abs(bvx) * 0.28 + 2.6);
        const hit = (by - (cpuY + cpuPaddleH / 2)) / (cpuPaddleH / 2);
        bvy += hit * 1.8;
      }

      if (bx < 0) {
        scoreC++;
        if (scoreC >= winScore) return finish(false);
        resetBall(1);
      }
      if (bx > W) {
        scoreP++;
        if (scoreP >= winScore) return finish(true);
        resetBall(-1);
      }

      ctx.fillStyle = "#050a14";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(0,240,255,0.25)";
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#00f0ff";
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 12;
      ctx.fillRect(margin, py, paddleW, playerPaddleH);
      ctx.fillStyle = "#ff00aa";
      ctx.shadowColor = "#ff00aa";
      ctx.fillRect(W - margin - paddleW, cpuY, paddleW, cpuPaddleH);

      ctx.fillStyle = "#ffe81f";
      ctx.shadowColor = "#ffe81f";
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#8ab";
      ctx.font = "16px Share Tech Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText(scoreP + "  —  " + scoreC, W / 2, 28);

      raf = requestAnimationFrame(loop);
    }

    function finish(won) {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      setTimeout(() => (won ? window.__npcLevelWin() : window.__npcGameOver()), 400);
    }

    loop();

    return function cleanup() {
      ended = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }

  window.PongGame = { start };
})();
