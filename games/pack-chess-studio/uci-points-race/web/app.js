/**
 * UCI 計分賽 — 瀏覽器計算（3.2.118–119）
 * 邏輯與 uci_points_race.py 一致
 */

const LAP_POINTS = 20;
const SPRINT_NORMAL = [5, 3, 2, 1];
const SPRINT_FINAL = [10, 6, 4, 2];

/** Web Speech API：香港粵語（繁體）— 實際辨識品質視瀏覽器與裝置而定 */
const CANTONESE_LANG = "zh-HK";

const T = {
  sprintLabel: (n) => `第 ${n} 次衝刺`,
  remove: "移除",
  sttStart: "粵語語音輸入",
  sttStop: "停止收音",
  sttHint: "使用香港中文（粵語）辨識；建議 Chrome／Edge。每段語音會插入新一行。",
  sttBannerUnsupported:
    "此瀏覽器不支援 Web Speech API，無法使用粵語語音輸入。請改用最新版 Chrome 或 Edge，並允許麥克風權限。",
  sttError: "語音辨識錯誤：",
  sttStartFail: "無法啟動語音辨識，請檢查麥克風權限。",
  placeholder: "安娜、碧絲\n基斯\n丹娜",
  lapsGained: "超圈次數",
  lapsLost: "被扣圈",
  startingPts: "起始分數",
  emptyRidersBefore: "請先在上方輸入車手姓名，再按「",
  emptyRidersAfter: "」列出車手。",
  dashEm: "—",
  errNeedSprint: "請至少新增一個衝刺。",
  errJsonSprints: "JSON 須包含非空的 sprints 陣列。",
  warnDupSprint: (n, names) => `第 ${n} 次衝刺：以下車手出現超過一次：${names}`,
  msgUpdated: "已更新名次。",
  msgExample: "已載入範例。",
  msgExported: "已匯出 JSON。",
  msgImported: "匯入完成。",
  msgImportFail: (e) => `匯入失敗：${e}`,
};

function getRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

const stt = {
  active: false,
  recognition: null,
  targetTa: null,
  targetBtn: null,
};

function stopSpeechToText() {
  stt.active = false;
  const r = stt.recognition;
  stt.recognition = null;
  if (r) {
    r.onend = null;
    try {
      r.stop();
    } catch (_) {}
  }
  if (stt.targetBtn) {
    stt.targetBtn.classList.remove("listening");
    stt.targetBtn.setAttribute("aria-pressed", "false");
    stt.targetBtn.textContent = T.sttStart;
  }
  stt.targetTa = null;
  stt.targetBtn = null;
}

function appendTranscriptToTextarea(textarea, text) {
  const chunk = String(text).trim();
  if (!chunk) return;
  const cur = textarea.value;
  const sep = cur.length && !/\n$/.test(cur) ? "\n" : "";
  textarea.value = cur + sep + chunk;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function startSpeechToText(textarea, btn) {
  stopSpeechToText();
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    setMessage(T.sttBannerUnsupported);
    return;
  }

  stt.active = true;
  stt.targetTa = textarea;
  stt.targetBtn = btn;
  btn.classList.add("listening");
  btn.setAttribute("aria-pressed", "true");
  btn.textContent = T.sttStop;

  const rec = new Ctor();
  stt.recognition = rec;
  rec.lang = CANTONESE_LANG;
  rec.continuous = true;
  rec.interimResults = false;

  rec.onresult = (ev) => {
    let line = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      if (ev.results[i].isFinal) {
        line += ev.results[i][0].transcript;
      }
    }
    appendTranscriptToTextarea(textarea, line);
  };

  rec.onerror = (ev) => {
    if (ev.error === "no-speech" || ev.error === "aborted") return;
    setMessage(`${T.sttError}${ev.error}`);
    stopSpeechToText();
  };

  rec.onend = () => {
    if (!stt.active || stt.recognition !== rec) return;
    try {
      rec.start();
    } catch (_) {}
  };

  try {
    rec.start();
  } catch (_) {
    setMessage(T.sttStartFail);
    stopSpeechToText();
  }
}

function toggleSpeechToText(textarea, btn) {
  if (stt.active && stt.targetTa === textarea) {
    stopSpeechToText();
    return;
  }
  startSpeechToText(textarea, btn);
}

function initSttBanner() {
  const banner = document.getElementById("stt-banner");
  if (!banner) return;
  if (!getRecognitionCtor()) {
    banner.textContent = T.sttBannerUnsupported;
    banner.hidden = false;
  }
}

function sprintPointsForPlace(place, finalSprint) {
  if (place < 1 || place > 4) return 0;
  const t = finalSprint ? SPRINT_FINAL : SPRINT_NORMAL;
  return t[place - 1];
}

function sprintPointsForGroups(groups, finalSprint) {
  const out = {};
  let place = 1;
  for (const tied of groups) {
    if (!tied || !tied.length) continue;
    const pts = sprintPointsForPlace(place, finalSprint);
    for (const r of tied) {
      const rid = String(r).trim();
      if (!rid) continue;
      out[rid] = (out[rid] || 0) + pts;
    }
    place += tied.length;
  }
  return out;
}

function mergePoints(into, delta) {
  for (const [k, v] of Object.entries(delta)) {
    into[k] = (into[k] || 0) + v;
  }
}

function finalSprintTiebreakRank(groups) {
  let rank = 1;
  const out = {};
  for (const tied of groups) {
    if (!tied || !tied.length) continue;
    const clean = tied.map((r) => String(r).trim()).filter(Boolean);
    for (const r of clean) out[r] = rank;
    rank += clean.length;
  }
  return out;
}

/**
 * 一行一個名次；同行內可用半形逗號、全形逗號、頓號、分號分隔並列車手。
 * @param {string} text
 * @returns {string[][]}
 */
function parseSprintText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.map((line) =>
    line
      .split(/[,，、;；]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function collectRiderIdsFromSprints(sprints) {
  const set = new Set();
  for (const sp of sprints) {
    for (const grp of sp.order) {
      for (const r of grp) {
        const id = String(r).trim();
        if (id) set.add(id);
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

function findDuplicateRidersInSprint(groups) {
  const seen = new Set();
  const dups = new Set();
  for (const grp of groups) {
    for (const r of grp) {
      const id = String(r).trim();
      if (!id) continue;
      if (seen.has(id)) dups.add(id);
      seen.add(id);
    }
  }
  return [...dups];
}

function computeStandings(spec) {
  const sprints = spec.sprints || [];
  if (!sprints.length) throw new Error(T.errNeedSprint);

  const lapGains = Object.fromEntries(
    Object.entries(spec.lap_gains || {}).map(([k, v]) => [String(k), Number(v) || 0])
  );
  const lapLosses = Object.fromEntries(
    Object.entries(spec.lap_losses || {}).map(([k, v]) => [String(k), Number(v) || 0])
  );
  const starting = Object.fromEntries(
    Object.entries(spec.starting_points || {}).map(([k, v]) => [String(k), Number(v) || 0])
  );

  const finalIndex = sprints.length - 1;
  const sprintSub = {};

  const warnings = [];
  sprints.forEach((sp, i) => {
    const groups = sp.order || [];
    const dups = findDuplicateRidersInSprint(groups);
    if (dups.length) {
      warnings.push(T.warnDupSprint(i + 1, dups.join("、")));
    }
    const isFinal = i === finalIndex;
    mergePoints(sprintSub, sprintPointsForGroups(groups, isFinal));
  });

  const finalGroups = (sprints[finalIndex].order || [])
    .map((g) => g.map((x) => String(x).trim()).filter(Boolean))
    .filter((g) => g.length);
  const tieRanks = finalSprintTiebreakRank(finalGroups);

  const riderIds = new Set([
    ...Object.keys(sprintSub),
    ...Object.keys(lapGains),
    ...Object.keys(lapLosses),
    ...Object.keys(starting),
    ...Object.keys(tieRanks),
  ]);

  const rows = [];
  for (const r of [...riderIds].sort((a, b) => a.localeCompare(b, "zh-Hant"))) {
    const sg = sprintSub[r] || 0;
    const lg = (lapGains[r] || 0) * LAP_POINTS;
    const llDed = (lapLosses[r] || 0) * LAP_POINTS;
    const sp0 = starting[r] || 0;
    rows.push({
      rider_id: r,
      total_points: sp0 + sg + lg - llDed,
      sprint_points: sg,
      lap_gain_points: lg,
      lap_loss_deduction: llDed,
      final_sprint_rank: tieRanks[r] ?? null,
      starting_points: sp0,
    });
  }

  rows.sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    const ar = a.final_sprint_rank ?? 1e9;
    const br = b.final_sprint_rank ?? 1e9;
    if (ar !== br) return ar - br;
    return a.rider_id.localeCompare(b.rider_id, "zh-Hant");
  });

  return { rows, warnings };
}

function formatBreakdown(row) {
  const lines = [
    `${row.rider_id}：總分 ${row.total_points}`,
    `  衝刺小計：${row.sprint_points}`,
    `  起始分數：${row.starting_points}`,
    `  超圈得分（每圈 +${LAP_POINTS}）：${row.lap_gain_points}`,
    `  扣圈罰分（已自總分扣除）：${row.lap_loss_deduction}`,
  ];
  if (row.final_sprint_rank != null) {
    lines.push(`  決勝衝刺名次（數字愈小愈佳）：${row.final_sprint_rank}`);
  }
  return lines.join("\n");
}

// ——— UI ———

const EXAMPLE_SPEC = {
  sprints: [
    { order: [["安娜", "碧絲"], ["基斯"], ["丹娜"]] },
    { order: [["基斯"], ["安娜"], ["碧絲"], ["丹娜"]] },
    { order: [["丹娜"], ["安娜"], ["碧絲"], ["基斯"]] },
  ],
  lap_gains: { 安娜: 1 },
  lap_losses: { 丹娜: 1 },
};

let sprintCardEls = [];

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== false) node.setAttribute(k, v);
  });
  children.forEach((c) => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return node;
}

function getSprintTextsFromDOM() {
  return sprintCardEls.map((c) => ({
    textarea: c.textarea,
    order: parseSprintText(c.textarea.value),
  }));
}

function buildSpecFromDOM() {
  const sprints = getSprintTextsFromDOM().map((x) => ({ order: x.order }));
  const lap_gains = {};
  const lap_losses = {};
  const starting_points = {};

  document.querySelectorAll(".rider-card").forEach((card) => {
    const id = card.dataset.rider;
    if (!id) return;
    lap_gains[id] = Number(card.querySelector('[data-field="gain"]')?.value) || 0;
    lap_losses[id] = Number(card.querySelector('[data-field="loss"]')?.value) || 0;
    starting_points[id] = Number(card.querySelector('[data-field="start"]')?.value) || 0;
  });

  return { sprints, lap_gains, lap_losses, starting_points };
}

function renderSprintCards(count, texts = null) {
  if (stt.active) stopSpeechToText();

  const list = document.getElementById("sprint-list");
  list.innerHTML = "";
  sprintCardEls = [];
  const n = Math.max(1, count);
  const Ctor = getRecognitionCtor();

  for (let i = 0; i < n; i++) {
    const isFinal = i === n - 1;
    const ta = el("textarea", {
      class: "sprint-textarea",
      placeholder: T.placeholder,
      spellcheck: "false",
      "aria-label": T.sprintLabel(i + 1),
    });
    if (texts && texts[i] != null) ta.value = texts[i];

    const sttBtn = el("button", {
      type: "button",
      class: "btn stt-btn",
      text: T.sttStart,
      "aria-pressed": "false",
      title: `${T.sttHint} (${CANTONESE_LANG})`,
    });
    if (!Ctor) {
      sttBtn.disabled = true;
      sttBtn.title = T.sttBannerUnsupported;
    } else {
      sttBtn.addEventListener("click", () => toggleSpeechToText(ta, sttBtn));
    }

    const sttRow = el("div", { class: "sprint-stt-row" }, [
      sttBtn,
      el("p", { class: "stt-hint", text: T.sttHint }),
    ]);

    const body = el("div", { class: "sprint-body" }, [sttRow, ta]);

    const head = el("div", { class: "sprint-head" }, [
      el("h3", { text: T.sprintLabel(i + 1) }),
      n > 1
        ? el("button", {
            type: "button",
            class: "btn btn-remove-sprint",
            text: T.remove,
            onclick: () => removeSprintAt(i),
          })
        : el("span"),
    ]);

    const card = el("article", { class: `sprint-card${isFinal ? " final-sprint" : ""}` }, [head, body]);
    list.appendChild(card);
    sprintCardEls.push({ textarea: ta, card });
  }
}

function removeSprintAt(index) {
  if (sprintCardEls.length <= 1) return;
  const texts = getSprintTextsFromDOM().map((x) => x.textarea.value);
  texts.splice(index, 1);
  renderSprintCards(texts.length, texts);
  syncRiderGrid();
}

function addSprint() {
  const texts = getSprintTextsFromDOM().map((x) => x.textarea.value);
  texts.push("");
  renderSprintCards(texts.length, texts);
  sprintCardEls[sprintCardEls.length - 1].textarea.focus();
}

function syncRiderGrid() {
  const sprints = getSprintTextsFromDOM().map((x) => ({ order: x.order }));
  const ids = collectRiderIdsFromSprints(sprints);
  const grid = document.getElementById("rider-grid");
  const prev = {};
  grid.querySelectorAll(".rider-card").forEach((card) => {
    const id = card.dataset.rider;
    prev[id] = {
      gain: card.querySelector('[data-field="gain"]').value,
      loss: card.querySelector('[data-field="loss"]').value,
      start: card.querySelector('[data-field="start"]').value,
    };
  });

  grid.innerHTML = "";
  grid.classList.toggle("empty", ids.length === 0);

  if (!ids.length) {
    grid.appendChild(
      el("p", { class: "empty-riders" }, [
        document.createTextNode(T.emptyRidersBefore),
        el("strong", { text: document.getElementById("btn-calc").textContent }),
        document.createTextNode(T.emptyRidersAfter),
      ])
    );
    return;
  }

  for (const id of ids) {
    const p = prev[id] || { gain: "0", loss: "0", start: "0" };
    const card = el("div", { class: "rider-card", "data-rider": id }, [
      el("div", { class: "name", text: id }),
      el("label", {}, [
        document.createTextNode(T.lapsGained),
        el("input", {
          type: "number",
          min: "0",
          step: "1",
          value: p.gain,
          "data-field": "gain",
        }),
      ]),
      el("label", {}, [
        document.createTextNode(T.lapsLost),
        el("input", {
          type: "number",
          min: "0",
          step: "1",
          value: p.loss,
          "data-field": "loss",
        }),
      ]),
      el("label", {}, [
        document.createTextNode(T.startingPts),
        el("input", {
          type: "number",
          step: "1",
          value: p.start,
          "data-field": "start",
        }),
      ]),
    ]);
    grid.appendChild(card);
  }
}

function setMessage(text, ok = false) {
  const m = document.getElementById("message");
  m.textContent = text || "";
  m.classList.toggle("ok", !!ok && !!text);
}

function runCalculate() {
  setMessage("");
  let spec;
  try {
    spec = buildSpecFromDOM();
  } catch (e) {
    setMessage(String(e.message || e));
    return;
  }

  try {
    const { rows, warnings } = computeStandings(spec);
    const tbody = document.getElementById("results-body");
    tbody.innerHTML = "";
    rows.forEach((row, idx) => {
      const tr = el("tr", {}, [
        el("td", { text: String(idx + 1) }),
        el("td", { text: row.rider_id }),
        el("td", { text: String(row.total_points) }),
        el("td", { text: String(row.sprint_points) }),
        el("td", { text: String(row.lap_gain_points) }),
        el("td", { text: String(row.lap_loss_deduction) }),
        el("td", {
          text: row.final_sprint_rank != null ? String(row.final_sprint_rank) : T.dashEm,
        }),
      ]);
      tbody.appendChild(tr);
    });

    document.getElementById("breakdown-pre").textContent = rows.map(formatBreakdown).join("\n\n");
    document.getElementById("results-section").hidden = false;

    const warnText = warnings.length ? warnings.join(" ") : "";
    setMessage(warnText || T.msgUpdated, !warnText);
  } catch (e) {
    setMessage(String(e.message || e));
    document.getElementById("results-section").hidden = true;
  }
}

function loadExample() {
  const texts = EXAMPLE_SPEC.sprints.map((sp) => sp.order.map((grp) => grp.join("、")).join("\n"));
  renderSprintCards(texts.length, texts);
  syncRiderGrid();
  document.querySelectorAll(".rider-card").forEach((card) => {
    const id = card.dataset.rider;
    const g = EXAMPLE_SPEC.lap_gains[id] ?? 0;
    const l = EXAMPLE_SPEC.lap_losses[id] ?? 0;
    card.querySelector('[data-field="gain"]').value = String(g);
    card.querySelector('[data-field="loss"]').value = String(l);
    card.querySelector('[data-field="start"]').value = "0";
  });
  runCalculate();
  setMessage(T.msgExample, true);
}

function exportJson() {
  const spec = buildSpecFromDOM();
  const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "points-race.json";
  a.click();
  URL.revokeObjectURL(a.href);
  setMessage(T.msgExported, true);
}

function importJsonFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const spec = JSON.parse(reader.result);
      const sprints = spec.sprints || [];
      if (!sprints.length) throw new Error(T.errJsonSprints);
      const texts = sprints.map((sp) => (sp.order || []).map((grp) => grp.join(",")).join("\n"));
      renderSprintCards(texts.length, texts);
      syncRiderGrid();
      const lg = spec.lap_gains || {};
      const ll = spec.lap_losses || {};
      const st = spec.starting_points || {};
      document.querySelectorAll(".rider-card").forEach((card) => {
        const id = card.dataset.rider;
        card.querySelector('[data-field="gain"]').value = String(lg[id] ?? 0);
        card.querySelector('[data-field="loss"]').value = String(ll[id] ?? 0);
        card.querySelector('[data-field="start"]').value = String(st[id] ?? 0);
      });
      runCalculate();
      setMessage(T.msgImported, true);
    } catch (e) {
      setMessage(T.msgImportFail(e.message || e));
    }
  };
  reader.readAsText(file, "UTF-8");
}

initSttBanner();
renderSprintCards(1, [""]);
syncRiderGrid();

document.getElementById("btn-calc").addEventListener("click", () => {
  syncRiderGrid();
  runCalculate();
});

document.getElementById("btn-add-sprint").addEventListener("click", addSprint);
document.getElementById("btn-example").addEventListener("click", loadExample);
document.getElementById("btn-export").addEventListener("click", exportJson);

document.getElementById("import-file").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  if (f) importJsonFile(f);
  e.target.value = "";
});

document.getElementById("sprint-list").addEventListener("input", (e) => {
  if (e.target.classList.contains("sprint-textarea")) syncRiderGrid();
});

window.addEventListener("beforeunload", () => stopSpeechToText());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopSpeechToText();
});
