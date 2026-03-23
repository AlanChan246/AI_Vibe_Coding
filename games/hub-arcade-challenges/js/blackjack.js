(function () {
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  function freshDeck() {
    const d = [];
    for (const s of suits) {
      for (const r of ranks) {
        d.push({ r, s, red: s === "♥" || s === "♦" });
      }
    }
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function handValue(cards) {
    let sum = 0;
    let aces = 0;
    for (const c of cards) {
      if (c.r === "A") {
        aces++;
        sum += 11;
      } else if (["K", "Q", "J"].includes(c.r)) sum += 10;
      else sum += parseInt(c.r, 10);
    }
    while (sum > 21 && aces > 0) {
      sum -= 10;
      aces--;
    }
    return sum;
  }

  function cardEl(c, hidden) {
    const div = document.createElement("div");
    div.className = "bj-card" + (hidden ? " back" : c.red ? " red" : "");
    if (!hidden) div.textContent = c.r + c.s;
    return div;
  }

  function start(root) {
    root.innerHTML = "";
    let deck = freshDeck();
    const player = [deck.pop(), deck.pop()];
    const dealer = [deck.pop(), deck.pop()];
    let roundOver = false;

    const wrap = document.createElement("div");
    wrap.className = "bj-table";

    const hands = document.createElement("div");
    hands.className = "bj-hands";

    const dealerWrap = document.createElement("div");
    dealerWrap.className = "bj-hand";
    dealerWrap.innerHTML = '<div class="bj-label">Dealer</div>';
    const dealerCards = document.createElement("div");
    dealerCards.className = "bj-cards";
    dealerWrap.appendChild(dealerCards);

    const playerWrap = document.createElement("div");
    playerWrap.className = "bj-hand";
    playerWrap.innerHTML = '<div class="bj-label">You</div>';
    const playerCards = document.createElement("div");
    playerCards.className = "bj-cards";
    playerWrap.appendChild(playerCards);

    hands.appendChild(dealerWrap);
    hands.appendChild(playerWrap);

    const actions = document.createElement("div");
    actions.className = "bj-actions";
    const hitBtn = document.createElement("button");
    hitBtn.type = "button";
    hitBtn.textContent = "Hit";
    const standBtn = document.createElement("button");
    standBtn.type = "button";
    standBtn.textContent = "Stand";
    actions.appendChild(hitBtn);
    actions.appendChild(standBtn);

    const msg = document.createElement("div");
    msg.className = "bj-msg";

    wrap.appendChild(hands);
    wrap.appendChild(actions);
    wrap.appendChild(msg);
    root.appendChild(wrap);

    function render() {
      dealerCards.innerHTML = "";
      playerCards.innerHTML = "";
      dealer.forEach((c, i) => {
        dealerCards.appendChild(cardEl(c, !roundOver && i === 1));
      });
      player.forEach((c) => playerCards.appendChild(cardEl(c, false)));
    }

    function bust(cards) {
      return handValue(cards) > 21;
    }

    function finish(win, text) {
      roundOver = true;
      hitBtn.disabled = true;
      standBtn.disabled = true;
      render();
      msg.textContent = text;
      setTimeout(() => {
        if (win) window.__npcLevelWin();
        else window.__npcGameOver();
      }, 900);
    }

    function dealerPlay() {
      roundOver = true;
      render();
      while (handValue(dealer) < 17 && deck.length) {
        dealer.push(deck.pop());
      }
      render();
      const pv = handValue(player);
      const dv = handValue(dealer);
      if (bust(dealer)) return finish(true, "Dealer busts — you win!");
      if (dv > pv) return finish(false, "Dealer is closer — you lose.");
      if (pv > dv) return finish(true, "You beat the dealer!");
      return finish(false, "Push goes to the house — you lose.");
    }

    hitBtn.addEventListener("click", () => {
      if (roundOver) return;
      player.push(deck.pop());
      render();
      if (bust(player)) finish(false, "Bust — you lose.");
    });

    standBtn.addEventListener("click", () => {
      if (roundOver) return;
      dealerPlay();
    });

    render();
    if (handValue(player) === 21) {
      finish(true, "Blackjack!");
    }

    return function cleanup() {
      root.innerHTML = "";
    };
  }

  window.BlackjackGame = { start };
})();
