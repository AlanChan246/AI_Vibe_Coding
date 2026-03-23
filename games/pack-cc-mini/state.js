(function (w) {
  const G = w.LuminaraGame;
  if (!G) {
    console.error("Luminara: load definitions.js before state.js");
    return;
  }

  const STORAGE_KEY = "luminaraRpgSave";
  const SAVE_VERSION = 2;

  function emptyFlags() {
    return {};
  }

  function createInitialState() {
    return {
      version: SAVE_VERSION,
      nodeId: G.START_NODE,
      hp: 20,
      maxHp: 20,
      gold: 12,
      inventory: [],
      flags: emptyFlags(),
    };
  }

  function normalizeState(raw) {
    const base = createInitialState();
    if (!raw || typeof raw !== "object") return base;
    const o = raw;

    let nodeId = typeof o.nodeId === "string" ? o.nodeId : base.nodeId;
    if (!G.NODES[nodeId]) nodeId = G.START_NODE;
    base.nodeId = nodeId;

    base.hp = Math.max(0, Math.floor(Number(o.hp) || base.hp));
    base.maxHp = Math.max(1, Math.floor(Number(o.maxHp) || base.maxHp));
    base.gold = Math.max(0, Math.floor(Number(o.gold) || base.gold));
    if (base.hp > base.maxHp) base.hp = base.maxHp;

    const inv = o.inventory;
    if (Array.isArray(inv)) {
      base.inventory = inv.filter(function (x) {
        return typeof x === "string";
      });
    }

    const flags = o.flags;
    if (flags && typeof flags === "object") {
      const next = {};
      for (const k in flags) {
        if (flags[k] === true) next[k] = true;
      }
      base.flags = next;
    }

    base.version = SAVE_VERSION;
    return base;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createInitialState();
      return normalizeState(JSON.parse(raw));
    } catch (e) {
      return createInitialState();
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: SAVE_VERSION,
          nodeId: state.nodeId,
          hp: state.hp,
          maxHp: state.maxHp,
          gold: state.gold,
          inventory: state.inventory,
          flags: state.flags,
        }),
      );
    } catch (e) {
      /* quota / private mode */
    }
  }

  G.STORAGE_KEY = STORAGE_KEY;
  G.createInitialState = createInitialState;
  G.loadState = loadState;
  G.saveState = saveState;
})(window);
