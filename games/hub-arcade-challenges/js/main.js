(function () {
  const SCREENS = {
    crawl: "screen-crawl",
    briefing: "screen-briefing",
    g1: "screen-g1",
    g2: "screen-g2",
    g3: "screen-g3",
    g4: "screen-g4",
    g5: "screen-g5",
    g6: "screen-g6",
    victory: "screen-victory",
    impossible: "screen-impossible",
    hacked: "screen-hacked",
    hell1: "screen-hell1",
    hell2: "screen-hell2",
    hell3: "screen-hell3",
    hell4: "screen-hell4",
    thanks: "screen-thanks",
  };

  let phase = "crawl"; // ... | victory | hell_hacked | hell_playing
  let currentLevel = 0;
  let waitingForEnter = false;
  let activeGameCleanup = null;
  let victoryLyricTimer = null;

  const crawlDesc = document.getElementById("crawl-description");
  const overlayWin = document.getElementById("overlay-win");
  const overlayLose = document.getElementById("overlay-lose");
  const lyricLine = document.getElementById("lyric-line");
  const victoryCrowd = document.getElementById("victory-crowd");

  const hackedRepeat = Array(17)
    .fill("zzzzzzzzzzzzzz, hacked, hacked")
    .join(" ");

  if (crawlDesc) crawlDesc.textContent = hackedRepeat;

  const BRIEFING_ACCESS_CODE = "123456";
  const briefingPass = document.getElementById("briefing-pass");
  const briefingSkipRow = document.getElementById("briefing-skip-row");

  function resetBriefingCheat() {
    if (briefingPass) briefingPass.value = "";
    if (briefingSkipRow) briefingSkipRow.classList.add("hidden");
  }

  function tryBriefingUnlock() {
    if (!briefingPass || !briefingSkipRow) return;
    if (briefingPass.value.trim() === BRIEFING_ACCESS_CODE) {
      briefingSkipRow.classList.remove("hidden");
    } else {
      briefingPass.select();
    }
  }

  function showScreen(id) {
    Object.values(SCREENS).forEach((sid) => {
      const el = document.getElementById(sid);
      if (el) el.classList.toggle("active", sid === id);
    });
  }

  window.__npcSetActiveScreen = function (fullId) {
    showScreen(fullId);
  };

  window.__npcSetHellPhase = function (p) {
    phase = p;
  };

  function stopActiveGame() {
    if (typeof activeGameCleanup === "function") {
      try {
        activeGameCleanup();
      } catch (e) {}
      activeGameCleanup = null;
    }
  }

  function showWinOverlay() {
    waitingForEnter = true;
    overlayWin.classList.remove("hidden");
  }

  function hideWinOverlay() {
    waitingForEnter = false;
    overlayWin.classList.add("hidden");
  }

  function gameOver() {
    stopActiveGame();
    phase = "gameover";
    overlayLose.classList.remove("hidden");
    waitingForEnter = false;
  }

  window.__npcGameOver = gameOver;
  window.__npcLevelWin = function levelWin() {
    stopActiveGame();
    phase = "win_overlay";
    showWinOverlay();
  };

  function advanceAfterWin() {
    hideWinOverlay();
    currentLevel += 1;
    if (currentLevel > 6) {
      phase = "victory";
      stopActiveGame();
      showScreen(SCREENS.victory);
      startVictoryScene();
      return;
    }
    startLevel(currentLevel);
  }

  function startLevel(n) {
    phase = "playing";
    waitingForEnter = false;
    const map = {
      1: SCREENS.g1,
      2: SCREENS.g2,
      3: SCREENS.g3,
      4: SCREENS.g4,
      5: SCREENS.g5,
      6: SCREENS.g6,
    };
    showScreen(map[n]);

    stopActiveGame();
    if (n === 1 && window.BlackjackGame) {
      activeGameCleanup = BlackjackGame.start(document.getElementById("blackjack-root"));
    } else if (n === 2 && window.SpaceInvadersGame) {
      activeGameCleanup = SpaceInvadersGame.start(document.getElementById("canvas-invaders"));
    } else if (n === 3 && window.StreetFighterGame) {
      activeGameCleanup = StreetFighterGame.start(
        document.getElementById("sf-select"),
        document.getElementById("canvas-sf"),
        document.getElementById("sf-hint")
      );
    } else if (n === 4 && window.PongGame) {
      activeGameCleanup = PongGame.start(document.getElementById("canvas-pong"));
    } else if (n === 5 && window.FifthGraderGame) {
      activeGameCleanup = FifthGraderGame.start(document.getElementById("fifth-root"));
    } else if (n === 6 && window.SansGame) {
      activeGameCleanup = SansGame.start(document.getElementById("canvas-sans"));
    }
  }

  /** Twenty-gun gauntlet after hell hacker; then thanks (or game over). */
  window.__npcStartPostHellGunfight = function (onWin, onLose) {
    stopActiveGame();
    phase = "impossible";
    showScreen(SCREENS.impossible);
    if (!window.ImpossibleMode || typeof ImpossibleMode.start !== "function") {
      activeGameCleanup = null;
      if (typeof onWin === "function") onWin();
      return;
    }
    activeGameCleanup = ImpossibleMode.start(
      document.getElementById("canvas-impossible"),
      function gunfightWin() {
        activeGameCleanup = null;
        if (typeof onWin === "function") onWin();
      },
      function gunfightLose() {
        activeGameCleanup = null;
        if (typeof onLose === "function") onLose();
        else {
          phase = "gameover";
          overlayLose.classList.remove("hidden");
          waitingForEnter = false;
        }
      }
    );
  };

  function startVictoryScene() {
    if (victoryLyricTimer) clearInterval(victoryLyricTimer);
    victoryLyricTimer = null;
    victoryCrowd.innerHTML = "";
    for (let i = 0; i < 120; i++) {
      const d = document.createElement("div");
      d.className = "crowd-dot";
      d.style.left = Math.random() * 100 + "%";
      d.style.top = 55 + Math.random() * 40 + "%";
      d.style.animationDelay = Math.random() * 0.8 + "s";
      victoryCrowd.appendChild(d);
    }
    const lyrics =
      "We are the champions, my friends — and we'll keep on fighting till the end — " +
      "We are the champions — We are the champions — No time for losers 'cause we are the champions of the world.";
    let i = 0;
    lyricLine.textContent = "";
    victoryLyricTimer = setInterval(() => {
      if (i < lyrics.length) {
        lyricLine.textContent += lyrics[i];
        i++;
      } else {
        clearInterval(victoryLyricTimer);
        victoryLyricTimer = null;
        setTimeout(() => {
          phase = "hell_hacked";
          showScreen(SCREENS.hacked);
          if (window.HellMode && typeof HellMode.refreshHackedUI === "function") HellMode.refreshHackedUI();
        }, 900);
      }
    }, 28);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (phase === "thanks" || phase === "impossible") return;

    if (phase === "hell_hacked" && window.HellMode) {
      e.preventDefault();
      phase = "hell_playing";
      HellMode.onHackedEnter();
      return;
    }

    if (phase === "crawl") {
      phase = "briefing";
      resetBriefingCheat();
      showScreen(SCREENS.briefing);
      return;
    }

    if (phase === "briefing") {
      if (document.activeElement && document.activeElement.id === "briefing-pass") {
        e.preventDefault();
        tryBriefingUnlock();
        return;
      }
      currentLevel = 1;
      startLevel(1);
      return;
    }

    if (phase === "win_overlay" && waitingForEnter) {
      advanceAfterWin();
      return;
    }
  });

  document.getElementById("btn-retry").addEventListener("click", () => {
    stopActiveGame();
    overlayLose.classList.add("hidden");
    currentLevel = 1;
    phase = "briefing";
    resetBriefingCheat();
    showScreen(SCREENS.briefing);
  });

  const btnBriefingUnlock = document.getElementById("btn-briefing-unlock");
  if (btnBriefingUnlock) btnBriefingUnlock.addEventListener("click", tryBriefingUnlock);

  const btnSkipFinal = document.getElementById("btn-skip-final");
  if (btnSkipFinal) {
    btnSkipFinal.addEventListener("click", () => {
      stopActiveGame();
      currentLevel = 6;
      phase = "playing";
      startLevel(6);
    });
  }

  const btnSkipHell = document.getElementById("btn-skip-hell");
  if (btnSkipHell) {
    btnSkipHell.addEventListener("click", () => {
      stopActiveGame();
      phase = "hell_hacked";
      showScreen(SCREENS.hacked);
      if (window.HellMode && typeof HellMode.refreshHackedUI === "function") HellMode.refreshHackedUI();
    });
  }

  document.getElementById("btn-play-again").addEventListener("click", () => {
    lyricLine.textContent = "";
    currentLevel = 1;
    phase = "crawl";
    if (window.HellMode && typeof HellMode.clearHellProgress === "function") HellMode.clearHellProgress();
    showScreen(SCREENS.crawl);
  });

  const btnHellReset = document.getElementById("btn-hell-reset");
  if (btnHellReset) {
    btnHellReset.addEventListener("click", () => {
      if (window.HellMode && typeof HellMode.resetCheckpointToOne === "function") HellMode.resetCheckpointToOne();
    });
  }
})();
