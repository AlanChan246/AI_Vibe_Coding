(function (w) {
  const G = w.LuminaraGame;
  if (!G || !G.NODES) {
    console.error("Luminara: missing game data. Check script order in index.html.");
    return;
  }

  const NODES = G.NODES;
  const START_NODE = G.START_NODE;
  const COMBAT_TARGET_SCORE = G.COMBAT_TARGET_SCORE;
  const loadState = G.loadState;
  const saveState = G.saveState;
  const createInitialState = G.createInitialState;

  const ITEM_LABELS = {
    glow_elixir: "Glow elixir",
    rune_shard: "Rune shard",
    lucky_charm: "Lucky charm",
    star_cloak: "Star cloak",
  };

  const hpBar = document.getElementById("hp-bar");
  const hpBarWrap = document.getElementById("hp-bar-wrap");
  const hpText = document.getElementById("hp-text");
  const goldText = document.getElementById("gold-text");
  const inventoryEl = document.getElementById("inventory");
  const sceneRoot = document.getElementById("scene-root");
  const sceneArt = document.getElementById("scene-art");
  const sceneTitle = document.getElementById("scene-title");
  const sceneText = document.getElementById("scene-text");
  const choicesEl = document.getElementById("choices");
  const diceBanner = document.getElementById("dice-banner");
  const btnSave = document.getElementById("btn-save");
  const btnNew = document.getElementById("btn-new");

  if (
    !hpBar ||
    !hpText ||
    !goldText ||
    !inventoryEl ||
    !sceneRoot ||
    !sceneArt ||
    !sceneTitle ||
    !sceneText ||
    !choicesEl ||
    !diceBanner ||
    !btnSave ||
    !btnNew
  ) {
    console.error("Luminara: missing DOM elements. Check index.html ids.");
    return;
  }

  var state = loadState();
  var prevGold = state.gold;
  var renderPass = 0;

  function persist() {
    saveState(state);
  }

  function hasItem(id) {
    return state.inventory.indexOf(id) !== -1;
  }

  function choiceHidden(c) {
    var r = c.req;
    return !!(r && r.blockedByFlag && state.flags[r.blockedByFlag]);
  }

  function choiceMeetsReq(c) {
    var r = c.req;
    if (!r) return true;
    if (r.flag && !state.flags[r.flag]) return false;
    if (r.item && !hasItem(r.item)) return false;
    if (r.gold != null && state.gold < r.gold) return false;
    return true;
  }

  function applyEffect(eff) {
    if (eff.maxHp != null) {
      state.maxHp = Math.max(1, state.maxHp + eff.maxHp);
    }
    if (eff.hp != null) {
      state.hp = Math.min(state.maxHp, Math.max(0, state.hp + eff.hp));
    }
    if (eff.gold != null) {
      state.gold = Math.max(0, state.gold + eff.gold);
    }
    if (eff.item && !hasItem(eff.item)) {
      state.inventory.push(eff.item);
    }
    if (eff.removeItem) {
      state.inventory = state.inventory.filter(function (x) {
        return x !== eff.removeItem;
      });
    }
    if (eff.setFlag) {
      state.flags[eff.setFlag] = true;
    }
    var also = eff.alsoSetFlags;
    if (Array.isArray(also)) {
      for (var i = 0; i < also.length; i++) {
        state.flags[also[i]] = true;
      }
    }
    if (eff.clearFlag) {
      delete state.flags[eff.clearFlag];
    }
  }

  function applyChoiceEffects(c) {
    if (c.effect) applyEffect(c.effect);
  }

  function roll2d6() {
    return Math.floor(Math.random() * 6) + 1 + (Math.floor(Math.random() * 6) + 1);
  }

  function combatBonus() {
    var b = 0;
    if (hasItem("star_cloak")) b += 2;
    if (hasItem("rune_shard")) b += 1;
    return b;
  }

  function goToNode(id) {
    state.nodeId = id;
    persist();
    render();
  }

  function renderHud() {
    var pct = state.maxHp > 0 ? (state.hp / state.maxHp) * 100 : 0;
    hpBar.style.transform = "scaleX(" + pct / 100 + ")";
    if (hpBarWrap) {
      hpBarWrap.setAttribute("aria-valuenow", String(Math.round(pct)));
      hpBarWrap.setAttribute("aria-valuemax", "100");
      if (state.maxHp > 0 && state.hp / state.maxHp <= 0.3) {
        hpBarWrap.classList.add("bar--low");
      } else {
        hpBarWrap.classList.remove("bar--low");
      }
    }
    hpText.textContent = state.hp + " / " + state.maxHp;
    goldText.textContent = String(state.gold);
    if (prevGold !== state.gold) {
      goldText.classList.remove("gold--pop");
      void goldText.offsetWidth;
      goldText.classList.add("gold--pop");
    }
    prevGold = state.gold;

    inventoryEl.textContent = "";
    if (state.inventory.length === 0) {
      var li0 = document.createElement("li");
      li0.textContent = "None yet";
      li0.style.opacity = "0.65";
      li0.style.borderStyle = "dashed";
      inventoryEl.appendChild(li0);
    } else {
      for (var j = 0; j < state.inventory.length; j++) {
        var id = state.inventory[j];
        var li = document.createElement("li");
        li.textContent = ITEM_LABELS[id] || id;
        li.style.setProperty("--enter-delay", j * 0.055 + "s");
        inventoryEl.appendChild(li);
      }
    }
  }

  function render() {
    diceBanner.hidden = true;
    diceBanner.textContent = "";
    diceBanner.classList.remove("dice-banner--pop");

    var node = NODES[state.nodeId];
    if (!node) {
      state.nodeId = START_NODE;
      persist();
      render();
      return;
    }

    sceneArt.textContent = node.art;
    sceneTitle.textContent = node.title;
    sceneText.textContent = node.text;

    choicesEl.textContent = "";

    var choices = node.choices.filter(function (c) {
      return !choiceHidden(c);
    });

    for (var k = 0; k < choices.length; k++) {
      (function (c) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-choice";

        var label = c.text;
        if (c.req && c.req.gold != null && !choiceMeetsReq(c)) {
          label = c.text + " (need " + c.req.gold + " gold)";
        }
        btn.textContent = label;
        btn.disabled = !choiceMeetsReq(c);

        btn.addEventListener("click", function () {
          onChoice(c);
        });
        choicesEl.appendChild(btn);
      })(choices[k]);
    }
    renderHud();

    renderPass += 1;
    if (renderPass > 1) {
      sceneRoot.classList.remove("scene--flash");
      void sceneRoot.offsetWidth;
      sceneRoot.classList.add("scene--flash");
    }
  }

  function onChoice(c) {
    if (!choiceMeetsReq(c)) return;

    if (c.next === "__reset__") {
      state = createInitialState();
      persist();
      render();
      return;
    }

    if (c.next === "__combat__") {
      applyChoiceEffects(c);
      var roll = roll2d6();
      var bonus = combatBonus();
      var total = roll + bonus;
      var msg =
        "You rolled " +
        roll +
        (bonus ? " + " + bonus + " bonus" : "") +
        " = " +
        total +
        ". (A total of " +
        COMBAT_TARGET_SCORE +
        "+ is a clean win; 4-5 is a tough win; below 4 goes badly.)";

      var nextId;
      if (total >= COMBAT_TARGET_SCORE) {
        nextId = "victory_clean";
      } else if (total >= 4) {
        nextId = "victory_costly";
      } else {
        nextId = "defeat_echo";
      }

      state.nodeId = nextId;
      persist();
      render();
      diceBanner.hidden = false;
      diceBanner.textContent = msg;
      diceBanner.classList.remove("dice-banner--pop");
      void diceBanner.offsetWidth;
      diceBanner.classList.add("dice-banner--pop");
      return;
    }

    applyChoiceEffects(c);
    goToNode(c.next);
  }

  btnSave.addEventListener("click", function () {
    persist();
    diceBanner.hidden = false;
    diceBanner.textContent = "Progress saved on this device.";
    diceBanner.classList.remove("dice-banner--pop");
    void diceBanner.offsetWidth;
    diceBanner.classList.add("dice-banner--pop");
  });

  btnNew.addEventListener("click", function () {
    if (
      w.confirm(
        "Start a new game? This replaces your current save on this device.",
      )
    ) {
      state = createInitialState();
      persist();
      render();
    }
  });

  render();
})(window);
