(function () {
  const QUESTIONS = [
    { q: "What is 7 × 8?", choices: ["54", "56", "63", "49"], a: 1 },
    { q: "Which planet is known as the Red Planet?", choices: ["Venus", "Jupiter", "Mars", "Saturn"], a: 2 },
    { q: "What is the past tense of 'go'?", choices: ["goed", "went", "gone", "going"], a: 1 },
    { q: "How many sides does a hexagon have?", choices: ["5", "6", "7", "8"], a: 1 },
    { q: "What is 144 ÷ 12?", choices: ["11", "12", "13", "10"], a: 1 },
    { q: "Which gas do plants absorb from the air?", choices: ["Oxygen", "Nitrogen", "Carbon dioxide", "Helium"], a: 2 },
    { q: "What is the capital of France?", choices: ["London", "Berlin", "Paris", "Madrid"], a: 2 },
    { q: "Which is a synonym for 'happy'?", choices: ["furious", "joyful", "tiny", "ancient"], a: 1 },
  ];

  function start(root) {
    root.innerHTML = "";
    let idx = 0;
    let wrong = false;

    const wrap = document.createElement("div");
    const prog = document.createElement("div");
    prog.className = "fg-progress";
    const qEl = document.createElement("div");
    qEl.className = "fg-question";
    const choices = document.createElement("div");
    choices.className = "fg-choices";
    wrap.appendChild(prog);
    wrap.appendChild(qEl);
    wrap.appendChild(choices);
    root.appendChild(wrap);

    function renderQ() {
      if (idx >= QUESTIONS.length) {
        window.__npcLevelWin();
        return;
      }
      const Q = QUESTIONS[idx];
      prog.textContent = "Question " + (idx + 1) + " of " + QUESTIONS.length;
      qEl.textContent = Q.q;
      choices.innerHTML = "";
      Q.choices.forEach((text, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = String.fromCharCode(65 + i) + ") " + text;
        b.addEventListener("click", () => {
          if (wrong) return;
          if (i === Q.a) {
            idx++;
            renderQ();
          } else {
            wrong = true;
            window.__npcGameOver();
          }
        });
        choices.appendChild(b);
      });
    }

    renderQ();

    return function cleanup() {
      root.innerHTML = "";
    };
  }

  window.FifthGraderGame = { start };
})();
