import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const viewport = document.getElementById("viewport");
const crosshair = document.getElementById("crosshair");
const splash = document.getElementById("splash");
const btnPlay = document.getElementById("btn-play");
const btnFullscreen = document.getElementById("btn-fullscreen");
const btnMode = document.getElementById("btn-mode");
const btnCatalog = document.getElementById("btn-catalog");
const blockBar = document.getElementById("block-bar");
const simMoneyEl = document.getElementById("sim-money");
const simTimeEl = document.getElementById("sim-time");
const simMoodEl = document.getElementById("sim-mood");
const buyCategoriesEl = document.getElementById("buy-categories");
const buyGridEl = document.getElementById("buy-grid");
const friendsListEl = document.getElementById("friends-list");
const friendPickEl = document.getElementById("friend-pick");
const btnHangout = document.getElementById("btn-hangout");
const careerPickEl = document.getElementById("career-pick");
const careerSummaryEl = document.getElementById("career-summary");
const btnShift = document.getElementById("btn-shift");
const shiftStatusEl = document.getElementById("shift-status");
const btnResume3d = document.getElementById("btn-resume-3d");
const npcHintEl = document.getElementById("npc-hint");
const npcHintNameEl = document.getElementById("npc-hint-name");
const eatHintEl = document.getElementById("eat-hint");

/** @type {{ id: string; name: string; color: number; emissive?: number; cost?: number; furn?: string; catalog: string; restorePower?: number; alsoRestore?: Record<string, number>; edible?: boolean; bite?: Record<string, number> }[]} */
const BLOCK_TYPES = [
  { id: "lime", name: "Lime", color: 0xb8e04a, emissive: 0x223300, cost: 0, catalog: "structure" },
  { id: "banana", name: "Banana", color: 0xffe566, emissive: 0x443300, cost: 0, catalog: "structure" },
  { id: "blue", name: "Blue", color: 0x3a6ea5, emissive: 0x112244, cost: 0, catalog: "structure" },
  { id: "stone", name: "Stone", color: 0x9aa1a6, cost: 0, catalog: "structure" },
  { id: "purple", name: "Purple", color: 0x7b4fb8, emissive: 0x220044, cost: 0, catalog: "structure" },
  { id: "chalk", name: "Chalk", color: 0xf5f0e6, cost: 0, catalog: "structure" },
  { id: "sofa", name: "Sofa", color: 0x6b4424, emissive: 0x221100, cost: 280, furn: "fun", catalog: "comfort" },
  { id: "bed", name: "Bed", color: 0xe8b4c4, cost: 420, furn: "energy", catalog: "comfort" },
  { id: "loo", name: "Loo", color: 0xe8eef2, emissive: 0x111122, cost: 160, furn: "bladder", catalog: "bath" },
  { id: "fridge", name: "Fridge", color: 0xb8c0cc, emissive: 0x101820, cost: 360, furn: "hunger", catalog: "kitchen" },
  { id: "shower", name: "Shower", color: 0x4fc3e0, emissive: 0x052830, cost: 310, furn: "hygiene", catalog: "bath" },
  { id: "pc", name: "Computer", color: 0x2a2a38, emissive: 0x1a2040, cost: 720, furn: "social", catalog: "tech" },
  {
    id: "juice",
    name: "Juice box",
    color: 0xff8fa8,
    cost: 38,
    furn: "hunger",
    catalog: "food",
    restorePower: 46,
    edible: true,
    bite: { hunger: 34, fun: 5 },
  },
  {
    id: "pizza",
    name: "Pizza",
    color: 0xd84315,
    emissive: 0x331008,
    cost: 92,
    furn: "hunger",
    catalog: "food",
    restorePower: 64,
    alsoRestore: { fun: 10 },
    edible: true,
    bite: { hunger: 50, fun: 12 },
  },
  {
    id: "salad",
    name: "Salad bowl",
    color: 0x8bc34a,
    emissive: 0x1a3010,
    cost: 52,
    furn: "hunger",
    catalog: "food",
    restorePower: 52,
    alsoRestore: { hygiene: 9 },
    edible: true,
    bite: { hunger: 38, hygiene: 8, fun: 3 },
  },
];

const CATALOG_SECTIONS = [
  { id: "structure", label: "Structure" },
  { id: "comfort", label: "Comfort" },
  { id: "bath", label: "Bathroom" },
  { id: "kitchen", label: "Kitchen" },
  { id: "food", label: "Food" },
  { id: "tech", label: "Tech" },
];

const CAREERS = [
  { id: "barista", title: "Café barista", hourly: 19, shiftPay: 76, xpShift: 15 },
  { id: "coder", title: "Code simmer", hourly: 39, shiftPay: 168, xpShift: 24 },
  { id: "artist", title: "Studio artist", hourly: 27, shiftPay: 112, xpShift: 18 },
];

const friends = [
  { id: "alex", name: "Alex Chen", rel: 48 },
  { id: "jordan", name: "Jordan Lee", rel: 55 },
  { id: "sam", name: "Sam Rivera", rel: 40 },
];

const SHIFT_GAP_MIN = 200;
const XP_PER_LEVEL = 85;

const NEED_KEYS = ["bladder", "hunger", "energy", "fun", "social", "hygiene"];
const DECAY = {
  bladder: 2.1,
  hunger: 1.35,
  energy: 1.05,
  fun: 1.25,
  social: 0.95,
  hygiene: 1.45,
};

/** @type {Record<string, number>} */
const needs = Object.fromEntries(NEED_KEYS.map((k) => [k, 86]));

let simoleons = 20000;
let gameMinutes = 8 * 60;
let buildMode = false;
let buyFilter = "all";
let careerId = "barista";
let careerLevel = 1;
let careerXP = 0;
let lastPaidHourSlot = -1;
let lastShiftGameMinute = -1e9;
let lastNpcChat = 0;
let lastEatAt = 0;

/** @type {Record<string, HTMLElement | null>} */
const needFills = {};
document.querySelectorAll(".need").forEach((el) => {
  const n = el.dataset.need;
  if (n) needFills[n] = el.querySelector(".need__fill");
});

let selectedType = 0;

function buildBlockBar() {
  blockBar.innerHTML = "";
  BLOCK_TYPES.forEach((t, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "block-slot" + (i === selectedType ? " is-selected" : "");
    const costHint = t.cost ? ` · §${t.cost}` : "";
    b.title = `${t.name}${costHint} · slot ${i + 1}`;
    b.style.background = `#${t.color.toString(16).padStart(6, "0")}`;
    b.addEventListener("click", () => setSelectedType(i));
    blockBar.appendChild(b);
  });
}

function setSelectedType(i) {
  selectedType = Math.max(0, Math.min(BLOCK_TYPES.length - 1, i));
  buildBlockBar();
  syncCatalogSelection();
}

function syncCatalogSelection() {
  document.querySelectorAll(".catalog-item").forEach((el) => {
    const idx = Number(el.dataset.index);
    el.classList.toggle("is-selected", idx === selectedType);
  });
}

function buildBuyCatalog() {
  if (!buyCategoriesEl || !buyGridEl) return;
  buyCategoriesEl.innerHTML = "";
  const mkCat = (id, label) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "buy-cat" + (buyFilter === id ? " is-active" : "");
    b.textContent = label;
    b.addEventListener("click", () => {
      buyFilter = id;
      buildBuyCatalog();
    });
    buyCategoriesEl.appendChild(b);
  };
  mkCat("all", "All");
  for (const sec of CATALOG_SECTIONS) mkCat(sec.id, sec.label);

  buyGridEl.innerHTML = "";
  BLOCK_TYPES.forEach((t, i) => {
    if (buyFilter !== "all" && t.catalog !== buyFilter) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "catalog-item" + (i === selectedType ? " is-selected" : "");
    btn.dataset.index = String(i);
    const sw = document.createElement("span");
    sw.className = "catalog-item__swatch";
    sw.style.background = `#${t.color.toString(16).padStart(6, "0")}`;
    const nm = document.createElement("span");
    nm.className = "catalog-item__name";
    nm.textContent = t.name;
    const pr = document.createElement("span");
    pr.className = "catalog-item__price";
    pr.textContent = t.cost ? `§${t.cost}` : "Free";
    btn.appendChild(sw);
    btn.appendChild(nm);
    btn.appendChild(pr);
    btn.addEventListener("click", () => setSelectedType(i));
    buyGridEl.appendChild(btn);
  });
}

function setSimTab(tab) {
  document.querySelectorAll(".sim-tab").forEach((t) => {
    t.classList.toggle("is-active", t.dataset.simTab === tab);
  });
  document.querySelectorAll(".sim-tab-panel").forEach((p) => {
    const on = p.dataset.panel === tab;
    p.hidden = !on;
    p.classList.toggle("is-active", on);
  });
}

function openBuyCatalog() {
  controls.unlock();
  setSimTab("buy");
}

function buildFriendsUI() {
  if (!friendsListEl || !friendPickEl) return;
  friendsListEl.innerHTML = "";
  friendPickEl.innerHTML = "";
  for (const f of friends) {
    const row = document.createElement("div");
    row.className = "friend-row";
    const top = document.createElement("div");
    top.className = "friend-row__top";
    const name = document.createElement("span");
    name.className = "friend-row__name";
    name.textContent = f.name;
    const rel = document.createElement("span");
    rel.className = "friend-row__rel";
    rel.textContent = `${Math.round(f.rel)} ❤`;
    top.appendChild(name);
    top.appendChild(rel);
    const bar = document.createElement("div");
    bar.className = "friend-row__bar";
    const fill = document.createElement("div");
    fill.className = "friend-row__fill";
    fill.style.width = `${Math.round(f.rel)}%`;
    bar.appendChild(fill);
    row.appendChild(top);
    row.appendChild(bar);
    friendsListEl.appendChild(row);

    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.name;
    friendPickEl.appendChild(opt);
  }
}

function refreshFriendBars() {
  if (!friendsListEl) return;
  const rows = friendsListEl.querySelectorAll(".friend-row");
  friends.forEach((f, i) => {
    const row = rows[i];
    if (!row) return;
    const rel = row.querySelector(".friend-row__rel");
    const fill = row.querySelector(".friend-row__fill");
    if (rel) rel.textContent = `${Math.round(f.rel)} ❤`;
    if (fill) fill.style.width = `${Math.round(Math.min(100, f.rel))}%`;
  });
}

function doHangout() {
  const id = friendPickEl?.value;
  if (!id) return;
  const f = friends.find((x) => x.id === id);
  if (!f || needs.energy < 14) return;
  f.rel = Math.min(100, f.rel + 16);
  needs.social = Math.min(100, needs.social + 32);
  needs.energy = Math.max(0, needs.energy - 18);
  needs.fun = Math.max(0, needs.fun - 6);
  buildFriendsUI();
}

function populateCareerSelect() {
  if (!careerPickEl) return;
  careerPickEl.innerHTML = "";
  for (const c of CAREERS) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.title;
    careerPickEl.appendChild(opt);
  }
  careerPickEl.value = careerId;
}

function careerMult() {
  return 1 + 0.11 * (careerLevel - 1);
}

function updateCareerSummary() {
  if (!careerSummaryEl || !btnShift || !shiftStatusEl) return;
  const c = CAREERS.find((x) => x.id === careerId);
  if (!c) return;
  const mult = careerMult();
  const hr = Math.floor(c.hourly * mult);
  const sh = Math.floor(c.shiftPay * mult);
  const nextLvl = XP_PER_LEVEL - careerXP;
  careerSummaryEl.innerHTML = `
    <strong>${c.title}</strong> · Level <strong>${careerLevel}</strong><br/>
    About <strong>§${hr}</strong> / in-game hour (Live mode)<br/>
    Shift payout ~ <strong>§${sh}</strong> · +${c.xpShift} XP<br/>
    Next level in ~<strong>${nextLvl}</strong> XP`;

  const wait = SHIFT_GAP_MIN - (gameMinutes - lastShiftGameMinute);
  const canShift = wait <= 0 && needs.energy >= 26;
  btnShift.disabled = !canShift;
  if (wait > 0) {
    shiftStatusEl.textContent = `Next shift in ~${Math.ceil(wait)} sim-min.`;
  } else if (needs.energy < 26) {
    shiftStatusEl.textContent = "Need more Energy to work.";
  } else {
    shiftStatusEl.textContent = "Ready for a shift.";
  }
}

function doWorkShift() {
  const c = CAREERS.find((x) => x.id === careerId);
  if (!c) return;
  if (gameMinutes - lastShiftGameMinute < SHIFT_GAP_MIN) return;
  if (needs.energy < 26) return;
  const mult = careerMult();
  simoleons += Math.floor(c.shiftPay * mult);
  careerXP += c.xpShift;
  needs.energy -= 26;
  needs.fun -= 12;
  lastShiftGameMinute = gameMinutes;
  while (careerXP >= XP_PER_LEVEL) {
    careerXP -= XP_PER_LEVEL;
    careerLevel += 1;
  }
  updateCareerSummary();
}

function initSimDock() {
  document.querySelectorAll(".sim-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      controls.unlock();
      const t = btn.dataset.simTab;
      if (t) setSimTab(t);
    });
  });
  btnCatalog?.addEventListener("click", openBuyCatalog);
  btnResume3d?.addEventListener("click", () => {
    controls.lock();
  });
  btnHangout?.addEventListener("click", doHangout);
  careerPickEl?.addEventListener("change", () => {
    careerId = careerPickEl.value;
    updateCareerSummary();
  });
  btnShift?.addEventListener("click", doWorkShift);
  buildBuyCatalog();
  buildFriendsUI();
  populateCareerSelect();
  updateCareerSummary();
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c9eb);
scene.fog = new THREE.Fog(0xb8e0f5, 28, 90);

const camera = new THREE.PerspectiveCamera(70, 1, 0.08, 200);
camera.position.set(8, 9, 14);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xb8e0ff, 0x6b8c3a, 0.65);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5dd, 0.85);
sun.position.set(20, 35, 12);
scene.add(sun);

const skyColorDay = new THREE.Color(0x87c9eb);
const skyColorDusk = new THREE.Color(0xffb366);
const skyColorNight = new THREE.Color(0x1a2540);

const plumbob = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.26, 0),
  new THREE.MeshLambertMaterial({
    color: 0x00e676,
    emissive: 0x003322,
    emissiveIntensity: 0.45,
  })
);
plumbob.visible = false;
scene.add(plumbob);

const controls = new PointerLockControls(camera, renderer.domElement);

/** @type {Map<string, number>} */
const blocks = new Map();
/** @type {Map<string, THREE.Mesh>} */
const meshes = new Map();

/** @type {{ friendId: string; x: number; z: number; targetX: number; targetZ: number; waitUntil: number; group: THREE.Group; facingY: number; homeX: number; homeZ: number }[]} */
const npcs = [];

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const materials = BLOCK_TYPES.map(
  (t) =>
    new THREE.MeshLambertMaterial({
      color: t.color,
      emissive: t.emissive ?? 0x000000,
      emissiveIntensity: t.emissive ? 0.15 : 0,
    })
);

function key(x, y, z) {
  return `${x},${y},${z}`;
}

function parseKey(k) {
  const [x, y, z] = k.split(",").map(Number);
  return { x, y, z };
}

function setBlock(x, y, z, typeIndex) {
  const k = key(x, y, z);
  const existing = meshes.get(k);
  if (existing) {
    scene.remove(existing);
    meshes.delete(k);
    blocks.delete(k);
  }
  if (typeIndex < 0) return;
  blocks.set(k, typeIndex);
  const mesh = new THREE.Mesh(boxGeo, materials[typeIndex]);
  mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
  mesh.userData.gridKey = k;
  scene.add(mesh);
  meshes.set(k, mesh);
}

function removeBlock(x, y, z) {
  setBlock(x, y, z, -1);
}

function initWorld() {
  const size = 14;
  const baseY = 0;
  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      setBlock(x, baseY, z, 0);
    }
  }
}

initWorld();
buildBlockBar();

const player = {
  velocity: new THREE.Vector3(),
  onGround: false,
  radius: 0.28,
  height: 1.72,
  eye: 1.58,
};

function resetPlayer() {
  camera.position.set(7, 1 + player.eye, 7);
  player.velocity.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
}

resetPlayer();

function blockAt(ix, iy, iz) {
  return blocks.has(key(ix, iy, iz));
}

function collideAABB(min, max) {
  const x0 = Math.floor(min.x);
  const x1 = Math.floor(max.x);
  const y0 = Math.floor(min.y);
  const y1 = Math.floor(max.y);
  const z0 = Math.floor(min.z);
  const z1 = Math.floor(max.z);
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        if (blockAt(x, y, z)) return true;
      }
    }
  }
  return false;
}

function topBlockYAt(ix, iz) {
  for (let y = 32; y >= 0; y--) {
    if (blockAt(ix, y, iz)) return y;
  }
  return -1;
}

function groundHeightAt(wx, wz) {
  const ix = Math.floor(wx);
  const iz = Math.floor(wz);
  const t = topBlockYAt(ix, iz);
  return t < 0 ? -1 : t + 1;
}

const NPC_RADIUS = 0.2;
const NPC_HEIGHT = 1.32;
/** Same range and facing cone as the on-screen “Talk” hint so R works whenever the hint shows. */
const NPC_HINT_DIST = 3;
const NPC_CHAT_DIST = NPC_HINT_DIST;
const NPC_FACE_DOT = 0.28;

function npcAabbFeet(x, feetY, z) {
  return {
    min: new THREE.Vector3(x - NPC_RADIUS, feetY, z - NPC_RADIUS),
    max: new THREE.Vector3(x + NPC_RADIUS, feetY + NPC_HEIGHT, z + NPC_RADIUS),
  };
}

function playerBoundsBlocked() {
  const { min, max } = playerBounds();
  if (collideAABB(min, max)) return true;
  for (const n of npcs) {
    const fy = groundHeightAt(n.x, n.z);
    if (fy < 0) continue;
    const b = npcAabbFeet(n.x, fy, n.z);
    if (min.x < b.max.x && max.x > b.min.x && min.y < b.max.y && max.y > b.min.y && min.z < b.max.z && max.z > b.min.z) {
      return true;
    }
  }
  return false;
}

function npcCollidesBlocks(x, feetY, z) {
  const { min, max } = npcAabbFeet(x, feetY, z);
  return collideAABB(min, max);
}

function makeNpcVisual(shirt, pants, skin) {
  const g = new THREE.Group();
  g.userData.isNpc = true;
  const lower = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.5, 0.24),
    new THREE.MeshLambertMaterial({ color: pants })
  );
  lower.position.y = 0.25;
  const upper = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.48, 0.26),
    new THREE.MeshLambertMaterial({ color: shirt })
  );
  upper.position.y = 0.72;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.28),
    new THREE.MeshLambertMaterial({ color: skin })
  );
  head.position.y = 1.12;
  g.add(lower, upper, head);
  return g;
}

function pickNpcTarget() {
  return {
    x: 1.8 + Math.random() * 10.4,
    z: 1.8 + Math.random() * 10.4,
  };
}

function npcTooCloseToOthers(npc, x, z) {
  for (const o of npcs) {
    if (o === npc) continue;
    if (Math.hypot(o.x - x, o.z - z) < 0.52) return true;
  }
  return false;
}

function moveNpcAxis(npc, axis, delta) {
  const ox = npc.x;
  const oz = npc.z;
  npc[axis] += delta;
  const fy = groundHeightAt(npc.x, npc.z);
  if (fy < 0 || npcCollidesBlocks(npc.x, fy, npc.z) || npcTooCloseToOthers(npc, npc.x, npc.z)) {
    npc.x = ox;
    npc.z = oz;
    return false;
  }
  return true;
}

function updateNpc(npc, timeMs, dt) {
  let fy = groundHeightAt(npc.x, npc.z);
  if (fy < 0) {
    npc.x = npc.homeX;
    npc.z = npc.homeZ;
    fy = groundHeightAt(npc.x, npc.z);
    const t = pickNpcTarget();
    npc.targetX = t.x;
    npc.targetZ = t.z;
  }

  if (timeMs < npc.waitUntil) {
    npc.group.position.set(npc.x, fy, npc.z);
    npc.group.rotation.y = npc.facingY;
    return;
  }

  const tx = npc.targetX - npc.x;
  const tz = npc.targetZ - npc.z;
  const dist = Math.hypot(tx, tz);
  if (dist < 0.35) {
    npc.waitUntil = timeMs + 600 + Math.random() * 2000;
    const t = pickNpcTarget();
    npc.targetX = t.x;
    npc.targetZ = t.z;
    npc.group.position.set(npc.x, fy, npc.z);
    return;
  }

  const speed = 2.05;
  const dx = (tx / dist) * speed * dt;
  const dz = (tz / dist) * speed * dt;
  npc.facingY = Math.atan2(tx, tz);

  moveNpcAxis(npc, "x", dx);
  moveNpcAxis(npc, "z", dz);
  fy = groundHeightAt(npc.x, npc.z);
  npc.group.position.set(npc.x, fy, npc.z);
  npc.group.rotation.y = npc.facingY;
}

function updateAllNpcs(timeMs, dt) {
  for (const npc of npcs) updateNpc(npc, timeMs, dt);
}

function spawnNpcs() {
  const defs = [
    { friendId: "alex", shirt: 0x4477cc, pants: 0x2a3340, skin: 0xf2c4a8, sx: 3.2, sz: 4.1 },
    { friendId: "jordan", shirt: 0x43a047, pants: 0x37474f, skin: 0xd7a574, sx: 9.1, sz: 3.5 },
    { friendId: "sam", shirt: 0xff7b6b, pants: 0x3d3d4a, skin: 0xc6916b, sx: 6.4, sz: 8.8 },
  ];
  for (const d of defs) {
    const g = makeNpcVisual(d.shirt, d.pants, d.skin);
    const t = pickNpcTarget();
    const npc = {
      friendId: d.friendId,
      x: d.sx,
      z: d.sz,
      targetX: t.x,
      targetZ: t.z,
      waitUntil: 0,
      group: g,
      facingY: 0,
      homeX: d.sx,
      homeZ: d.sz,
    };
    scene.add(g);
    npcs.push(npc);
  }
  updateAllNpcs(0, 0);
}

spawnNpcs();

function getClosestNpcInRange(maxDist) {
  let best = null;
  let bestD = maxDist;
  const px = camera.position.x;
  const pz = camera.position.z;
  for (const npc of npcs) {
    const d = Math.hypot(npc.x - px, npc.z - pz);
    if (d < bestD) {
      bestD = d;
      best = npc;
    }
  }
  return best;
}

function npcFacingScore(npc) {
  const toNpc = new THREE.Vector3(npc.x - camera.position.x, 0, npc.z - camera.position.z);
  if (toNpc.lengthSq() < 1e-6) return 0;
  toNpc.normalize();
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 1e-6) return 0;
  forward.normalize();
  return forward.dot(toNpc);
}

function tryNpcInteract() {
  if (!controls.isLocked) return;
  if (performance.now() - lastNpcChat < 2000) return;
  const npc = getClosestNpcInRange(NPC_CHAT_DIST);
  if (!npc || npcFacingScore(npc) < NPC_FACE_DOT) return;
  const f = friends.find((x) => x.id === npc.friendId);
  if (!f) return;
  const tired = needs.energy < 10;
  if (tired) {
    f.rel = Math.min(100, f.rel + 5);
    needs.social = Math.min(100, needs.social + 10);
    needs.fun = Math.min(100, needs.fun + 1);
  } else {
    f.rel = Math.min(100, f.rel + 14);
    needs.social = Math.min(100, needs.social + 26);
    needs.energy = Math.max(0, needs.energy - 14);
    needs.fun = Math.min(100, needs.fun + 4);
  }
  lastNpcChat = performance.now();
  buildFriendsUI();
}

function updateNpcHint() {
  if (!npcHintEl || !npcHintNameEl) return;
  if (!controls.isLocked) {
    npcHintEl.hidden = true;
    return;
  }
  const npc = getClosestNpcInRange(NPC_HINT_DIST);
  if (!npc || npcFacingScore(npc) < NPC_FACE_DOT) {
    npcHintEl.hidden = true;
    return;
  }
  const f = friends.find((x) => x.id === npc.friendId);
  npcHintNameEl.textContent = f?.name ?? "Neighbor";
  npcHintEl.hidden = false;
}

function npcBlocksPlacement(ix, iy, iz) {
  for (const n of npcs) {
    const fy = groundHeightAt(n.x, n.z);
    if (fy < 0) continue;
    const gx = Math.floor(n.x);
    const gz = Math.floor(n.z);
    const baseY = Math.floor(fy);
    if (gx === ix && gz === iz && iy >= baseY && iy < baseY + 3) return true;
  }
  return false;
}

function playerBounds() {
  const r = player.radius;
  const h = player.height;
  const fy = camera.position.y - player.eye;
  return {
    min: new THREE.Vector3(camera.position.x - r, fy, camera.position.z - r),
    max: new THREE.Vector3(camera.position.x + r, fy + h, camera.position.z + r),
  };
}

function tryMoveAxis(axis, delta) {
  if (delta === 0) return;
  const pos = camera.position;
  pos[axis] += delta;
  if (playerBoundsBlocked()) {
    pos[axis] -= delta;
    player.velocity[axis] = 0;
  }
}

const raycaster = new THREE.Raycaster();
raycaster.far = 8;

function getTargetBlock() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects([...meshes.values()], false);
  if (hits.length === 0) return null;
  const hit = hits[0];
  const mesh = /** @type {THREE.Mesh} */ (hit.object);
  const k = mesh.userData.gridKey;
  if (!k) return null;
  const { x, y, z } = parseKey(k);

  const cx = x + 0.5;
  const cy = y + 0.5;
  const cz = z + 0.5;
  let px = x;
  let py = y;
  let pz = z;

  if (hit.face && hit.face.normal) {
    const n = new THREE.Vector3()
      .copy(hit.face.normal)
      .transformDirection(mesh.matrixWorld)
      .normalize();
    const placePos = hit.point.clone().addScaledVector(n, 0.4);
    px = Math.floor(placePos.x);
    py = Math.floor(placePos.y);
    pz = Math.floor(placePos.z);
  }

  if (px === x && py === y && pz === z) {
    const lx = hit.point.x - cx;
    const ly = hit.point.y - cy;
    const lz = hit.point.z - cz;
    const ax = Math.abs(lx);
    const ay = Math.abs(ly);
    const az = Math.abs(lz);
    if (ax >= ay && ax >= az && ax > 1e-4) px = x + (lx > 0 ? 1 : -1);
    else if (ay >= ax && ay >= az && ay > 1e-4) py = y + (ly > 0 ? 1 : -1);
    else if (az > 1e-4) pz = z + (lz > 0 ? 1 : -1);
    else {
      const ox = hit.point.x - raycaster.ray.direction.x * 0.45;
      const oy = hit.point.y - raycaster.ray.direction.y * 0.45;
      const oz = hit.point.z - raycaster.ray.direction.z * 0.45;
      px = Math.floor(ox);
      py = Math.floor(oy);
      pz = Math.floor(oz);
    }
  }

  return {
    breakAt: { x, y, z },
    placeAt: { x: px, y: py, z: pz },
  };
}

function intersectsPlayer(ix, iy, iz) {
  const r = player.radius + 0.02;
  const h = player.height;
  const fy = camera.position.y - player.eye;
  const px0 = camera.position.x - r;
  const px1 = camera.position.x + r;
  const py0 = fy;
  const py1 = fy + h;
  const pz0 = camera.position.z - r;
  const pz1 = camera.position.z + r;
  const bx0 = ix;
  const bx1 = ix + 1;
  const by0 = iy;
  const by1 = iy + 1;
  const bz0 = iz;
  const bz1 = iz + 1;
  return px0 < bx1 && px1 > bx0 && py0 < by1 && py1 > by0 && pz0 < bz1 && pz1 > bz0;
}

function tryBreakBlock() {
  if (!controls.isLocked) return;
  const t = getTargetBlock();
  if (!t) return;
  removeBlock(t.breakAt.x, t.breakAt.y, t.breakAt.z);
}

function tryPlaceBlock() {
  if (!controls.isLocked) return;
  const t = getTargetBlock();
  if (!t) return;
  const p = t.placeAt;
  if (blocks.has(key(p.x, p.y, p.z))) return;
  if (intersectsPlayer(p.x, p.y, p.z)) return;
  if (npcBlocksPlacement(p.x, p.y, p.z)) return;
  const def = BLOCK_TYPES[selectedType];
  const cost = buildMode ? 0 : def.cost ?? 0;
  if (cost > 0 && simoleons < cost) return;
  setBlock(p.x, p.y, p.z, selectedType);
  if (cost > 0) simoleons -= cost;
}

function getFurnitureRestoreRates() {
  /** @type {Record<string, number>} */
  const rates = Object.fromEntries(NEED_KEYS.map((k) => [k, 0]));
  const px = camera.position.x;
  const py = camera.position.y - player.eye * 0.35;
  const pz = camera.position.z;
  const reach = 2.2;
  for (const [bk, typeIndex] of blocks) {
    const def = BLOCK_TYPES[typeIndex];
    if (!def?.furn) continue;
    const { x, y, z } = parseKey(bk);
    const cx = x + 0.5;
    const cy = y + 0.5;
    const cz = z + 0.5;
    if (Math.hypot(px - cx, py - cy, pz - cz) <= reach) {
      const pow = def.restorePower ?? 34;
      rates[def.furn] += pow;
      if (def.alsoRestore) {
        for (const nk of NEED_KEYS) {
          const add = def.alsoRestore[nk];
          if (add) rates[nk] += add;
        }
      }
    }
  }
  return rates;
}

function tryEatFromNearbyFood() {
  if (!controls.isLocked) return;
  if (performance.now() - lastEatAt < 2200) return;
  /** @type {(typeof BLOCK_TYPES)[number] | null} */
  let best = null;
  let bestD = 2.35;
  const px = camera.position.x;
  const py = camera.position.y - player.eye * 0.35;
  const pz = camera.position.z;
  for (const [bk, typeIndex] of blocks) {
    const def = BLOCK_TYPES[typeIndex];
    if (!def?.edible || !def.bite) continue;
    const { x, y, z } = parseKey(bk);
    const cx = x + 0.5;
    const cy = y + 0.5;
    const cz = z + 0.5;
    const d = Math.hypot(px - cx, py - cy, pz - cz);
    if (d < bestD) {
      bestD = d;
      best = def;
    }
  }
  if (!best?.bite) return;
  for (const nk of NEED_KEYS) {
    const add = best.bite[nk];
    if (add) needs[nk] = Math.max(0, Math.min(100, needs[nk] + add));
  }
  lastEatAt = performance.now();
}

function hasEdibleFoodNearby() {
  const px = camera.position.x;
  const py = camera.position.y - player.eye * 0.35;
  const pz = camera.position.z;
  for (const [bk, typeIndex] of blocks) {
    const def = BLOCK_TYPES[typeIndex];
    if (!def?.edible) continue;
    const { x, y, z } = parseKey(bk);
    const d = Math.hypot(px - (x + 0.5), py - (y + 0.5), pz - (z + 0.5));
    if (d < 2.35) return true;
  }
  return false;
}

function updateEatHint() {
  if (!eatHintEl) return;
  if (!controls.isLocked || !hasEdibleFoodNearby()) {
    eatHintEl.hidden = true;
    return;
  }
  eatHintEl.hidden = false;
}

function formatMoney(n) {
  return `§ ${Math.floor(n).toLocaleString()}`;
}

function formatSimTime(totalMin) {
  const m = Math.floor(totalMin) % (24 * 60);
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const am = h24 < 12;
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  const suffix = am ? "AM" : "PM";
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

function updateMoodLabel() {
  const low = Math.min(...NEED_KEYS.map((k) => needs[k]));
  let mood = "Feeling great";
  if (low < 18) mood = "Critical — fix needs!";
  else if (low < 35) mood = "Pretty uncomfortable";
  else if (low < 55) mood = "Could be better";
  else if (low < 72) mood = "Doing okay";
  if (simMoodEl) simMoodEl.textContent = mood;
}

function updateNeedsUI() {
  for (const k of NEED_KEYS) {
    const el = needFills[k];
    if (!el) continue;
    const v = needs[k];
    el.style.width = `${v}%`;
    el.classList.remove("is-low", "is-mid");
    if (v < 35) el.classList.add("is-low");
    else if (v < 65) el.classList.add("is-mid");
  }
}

function updateSkyForTimeOfDay() {
  const cycle = (gameMinutes % (24 * 60)) / (24 * 60);
  let c;
  if (cycle < 0.25) {
    const t = cycle / 0.25;
    c = skyColorNight.clone().lerp(skyColorDay, t);
  } else if (cycle < 0.45) {
    const t = (cycle - 0.25) / 0.2;
    c = skyColorDay.clone().lerp(skyColorDusk, t);
  } else if (cycle < 0.55) {
    const t = (cycle - 0.45) / 0.1;
    c = skyColorDusk.clone().lerp(skyColorNight, t);
  } else if (cycle < 0.75) {
    c = skyColorNight;
  } else {
    const t = (cycle - 0.75) / 0.25;
    c = skyColorNight.clone().lerp(skyColorDay, t);
  }
  scene.background = c;
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.copy(c);
  }

  const sunPhase = (cycle - 0.2) * Math.PI * 2;
  const h = Math.max(0.08, Math.sin(sunPhase));
  sun.position.set(Math.cos(sunPhase) * 55, Math.sin(sunPhase) * 42 + 8, 28);
  sun.intensity = h * 0.95 + 0.06;
  hemi.intensity = 0.28 + h * 0.42;
}

function syncModeButton() {
  btnMode.textContent = buildMode ? "BUILD MODE" : "LIVE MODE";
  btnMode.classList.toggle("is-build", buildMode);
}

function toggleBuildMode() {
  buildMode = !buildMode;
  syncModeButton();
}

syncModeButton();
btnMode.addEventListener("click", toggleBuildMode);
initSimDock();

/**
 * Pointer lock often delivers mouse events to document, not the canvas.
 * Use capture phase so we still receive clicks.
 */
function onGlobalMouseDown(e) {
  if (!controls.isLocked) return;
  if (e.button === 0 && e.ctrlKey) {
    e.preventDefault();
    tryPlaceBlock();
    return;
  }
  if (e.button === 0 && !e.ctrlKey) {
    tryBreakBlock();
    return;
  }
  if (e.button === 2) {
    e.preventDefault();
    tryPlaceBlock();
  }
}

document.addEventListener("mousedown", onGlobalMouseDown, true);
document.addEventListener("contextmenu", (e) => {
  if (controls.isLocked) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

const keys = new Set();

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (controls.isLocked && e.code === "Tab") {
    e.preventDefault();
    toggleBuildMode();
  }
  if (controls.isLocked && (e.code === "Space" || e.code.startsWith("Digit"))) {
    e.preventDefault();
  }
  if (controls.isLocked && (e.code === "Minus" || e.code === "Equal")) {
    e.preventDefault();
  }
  if (
    controls.isLocked &&
    (e.code === "BracketLeft" || e.code === "BracketRight" || e.code === "Backquote")
  ) {
    e.preventDefault();
  }
  if (controls.isLocked && (e.code === "KeyF" || e.code === "KeyE")) {
    e.preventDefault();
    tryPlaceBlock();
  }
  if (controls.isLocked && e.code === "KeyR") {
    e.preventDefault();
    tryNpcInteract();
  }
  if (e.code === "KeyB") {
    e.preventDefault();
    openBuyCatalog();
  }
  if (e.code === "Digit1") setSelectedType(0);
  if (e.code === "Digit2") setSelectedType(1);
  if (e.code === "Digit3") setSelectedType(2);
  if (e.code === "Digit4") setSelectedType(3);
  if (e.code === "Digit5") setSelectedType(4);
  if (e.code === "Digit6") setSelectedType(5);
  if (e.code === "Digit7") setSelectedType(6);
  if (e.code === "Digit8") setSelectedType(7);
  if (e.code === "Digit9") setSelectedType(8);
  if (e.code === "Digit0") setSelectedType(9);
  if (e.code === "Minus") setSelectedType(10);
  if (e.code === "Equal") setSelectedType(11);
  if (e.code === "BracketLeft") setSelectedType(12);
  if (e.code === "BracketRight") setSelectedType(13);
  if (e.code === "Backquote") setSelectedType(14);
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
});

controls.addEventListener("lock", () => {
  crosshair.classList.add("is-active");
});

controls.addEventListener("unlock", () => {
  crosshair.classList.remove("is-active");
});

function tryStartPlay() {
  if (splash) splash.hidden = true;
  controls.lock();
}

btnPlay?.addEventListener("click", (e) => {
  e.preventDefault();
  tryStartPlay();
});

renderer.domElement.addEventListener("click", () => {
  if (!controls.isLocked) controls.lock();
});

btnFullscreen.addEventListener("click", () => {
  const el = document.documentElement;
  if (!document.fullscreenElement) el.requestFullscreen?.();
  else document.exitFullscreen?.();
});

function onResize() {
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

window.addEventListener("resize", onResize);
onResize();

let last = performance.now();

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  gameMinutes += dt * 10;
  updateSkyForTimeOfDay();
  simTimeEl.textContent = formatSimTime(gameMinutes);
  simMoneyEl.textContent = formatMoney(simoleons);

  const hourSlot = Math.floor(gameMinutes / 60);
  if (controls.isLocked && !buildMode && hourSlot !== lastPaidHourSlot) {
    const job = CAREERS.find((x) => x.id === careerId);
    if (job) simoleons += Math.floor(job.hourly * careerMult());
    lastPaidHourSlot = hourSlot;
  }

  if (controls.isLocked && !buildMode) {
    const rates = getFurnitureRestoreRates();
    for (const k of NEED_KEYS) {
      let v = needs[k];
      const rateCap = k === "hunger" ? 66 : 52;
      v += Math.min(rates[k], rateCap) * dt;
      v -= DECAY[k] * dt;
      needs[k] = Math.max(0, Math.min(100, v));
    }
    simoleons += dt * 2.2;
    for (const f of friends) {
      f.rel = Math.max(0, f.rel - 0.042 * dt);
    }
    refreshFriendBars();
  }

  updateCareerSummary();

  updateMoodLabel();
  updateNeedsUI();

  const avgNeed = NEED_KEYS.reduce((a, k) => a + needs[k], 0) / NEED_KEYS.length;
  const hue = (avgNeed / 100) * 0.35;
  const plumbCol = new THREE.Color().setHSL(hue, 0.85, 0.48);
  plumbob.material.color.copy(plumbCol);
  plumbob.material.emissive.copy(plumbCol);
  plumbob.material.emissive.multiplyScalar(0.35);

  plumbob.visible = controls.isLocked;
  if (controls.isLocked) {
    plumbob.position.set(camera.position.x, camera.position.y + 0.62, camera.position.z);
    plumbob.rotation.y = now * 0.0018;
  }

  if (controls.isLocked) {
    const moveSpeed = 5.2;
    const dir = new THREE.Vector3();
    if (keys.has("KeyW")) dir.z -= 1;
    if (keys.has("KeyS")) dir.z += 1;
    if (keys.has("KeyA")) dir.x -= 1;
    if (keys.has("KeyD")) dir.x += 1;
    if (dir.lengthSq() > 0) {
      dir.normalize();
      dir.applyQuaternion(camera.quaternion);
      dir.y = 0;
      if (dir.lengthSq() > 0) {
        dir.normalize();
        const step = moveSpeed * dt;
        tryMoveAxis("x", dir.x * step);
        tryMoveAxis("z", dir.z * step);
      }
    }

    const gravity = -28;
    if (keys.has("Space") && player.onGround) {
      player.velocity.y = 8.5;
      player.onGround = false;
    }
    player.velocity.y += gravity * dt;

    const pos = camera.position;
    const vy = player.velocity.y * dt;
    pos.y += vy;
    if (playerBoundsBlocked()) {
      pos.y -= vy;
      if (player.velocity.y < 0) player.onGround = true;
      player.velocity.y = 0;
    } else {
      player.onGround = false;
      const { min, max } = playerBounds();
      const below = collideAABB(
        new THREE.Vector3(min.x, min.y - 0.08, min.z),
        new THREE.Vector3(max.x, min.y + 0.02, max.z)
      );
      if (below && player.velocity.y <= 0.05) player.onGround = true;
    }

    if (pos.y - player.eye < -14) {
      resetPlayer();
    }
  }

  updateAllNpcs(now, dt);
  updateNpcHint();
  updateEatHint();

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
