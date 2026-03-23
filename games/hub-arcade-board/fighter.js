(function () {
  "use strict";

  const W = 960;
  const H = 420;
  const FLOOR = H - 56;
  const GRAVITY = 0.72;
  const MOVE_BASE = 5.1;
  const JUMP_V = -14.5;
  const FRICTION = 0.86;

  const SCENE_KEY = "fighter-scene";
  const SCENE_ORDER = ["rooftop", "dojo", "circuit"];

  function loadSceneId() {
    try {
      const v = localStorage.getItem(SCENE_KEY);
      if (v && SCENE_ORDER.includes(v)) return v;
    } catch (_) {}
    return "rooftop";
  }

  let currentSceneId = loadSceneId();

  const ATK = {
    light: {
      windup: 5,
      active: 4,
      recover: 11,
      dmg: 8,
      reach: 56,
      height: 36,
      offsetY: 54,
      knock: 3.8,
    },
    heavy: {
      windup: 16,
      active: 5,
      recover: 24,
      dmg: 17,
      reach: 74,
      height: 46,
      offsetY: 50,
      knock: 7.5,
    },
  };

  const CHARACTERS = {
    striker: {
      id: "striker",
      name: "狂戰",
      role: "attack",
      dmgMult: 1.12,
      moveMult: 1.08,
      knockMult: 1.1,
      takenMult: 0.97,
      skillCd: 200,
      lineColor: "#fca5a5",
      headColor: "#fecdd3",
      atkMods: {
        light: { dmg: 1.08, recover: -2 },
        heavy: { dmg: 1.14, knock: 1.12 },
      },
    },
    tank: {
      id: "tank",
      name: "堅盾",
      role: "defense",
      dmgMult: 0.9,
      moveMult: 0.93,
      knockMult: 0.95,
      takenMult: 0.7,
      skillCd: 280,
      lineColor: "#93c5fd",
      headColor: "#dbeafe",
      atkMods: { heavy: { dmg: 0.94 } },
    },
    ranger: {
      id: "ranger",
      name: "遊擊",
      role: "ranged",
      dmgMult: 0.94,
      moveMult: 1.04,
      knockMult: 1,
      takenMult: 1,
      skillCd: 88,
      lineColor: "#c4b5fd",
      headColor: "#ede9fe",
      atkMods: {
        light: { dmg: 0.88 },
        heavy: { dmg: 0.84 },
      },
    },
  };

  let gamePhase = "select";
  let sel1 = "striker";
  let sel2 = "striker";
  let lock1 = false;
  let lock2 = false;

  const canvas = document.getElementById("fighter-canvas");
  const ctx = canvas.getContext("2d");
  const elHp1 = document.getElementById("hp1");
  const elHp2 = document.getElementById("hp2");
  const elCd1 = document.getElementById("cd1");
  const elCd2 = document.getElementById("cd2");
  const elScore = document.getElementById("score-display");
  const overlay = document.getElementById("fighter-overlay");
  const overlayText = document.getElementById("overlay-text");
  const btnNext = document.getElementById("btn-next");
  const btnReset = document.getElementById("btn-reset-match");
  const wrap = document.getElementById("canvas-area");
  const charSelectEl = document.getElementById("char-select");
  const fightHud = document.getElementById("fight-hud");
  const fightHelp = document.getElementById("fight-help");
  const labelP1 = document.getElementById("label-p1");
  const labelP2 = document.getElementById("label-p2");
  const pick1 = document.getElementById("p1-pick");
  const pick2 = document.getElementById("p2-pick");

  const keys = new Set();
  let edgeSkillP1 = false;
  let edgeSkillP2 = false;
  let walkAnim = 0;
  /** @type {{x:number,y:number,vx:number,w:number,h:number,dmg:number,owner:number,alive:boolean}[]} */
  let projectiles = [];

  let p1;
  let p2;
  let wins1 = 0;
  let wins2 = 0;
  let roundOver = false;
  let matchOver = false;
  let shake = 0;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function getAtkProfile(p, kind) {
    const base = { ...ATK[kind] };
    const m = p.char.atkMods && p.char.atkMods[kind];
    if (m) {
      if (m.dmg) base.dmg = Math.max(3, Math.round(base.dmg * m.dmg));
      if (m.recover != null)
        base.recover = Math.max(5, base.recover + m.recover);
      if (m.knock) base.knock *= m.knock;
      if (m.reach) base.reach = Math.round(base.reach * m.reach);
    }
    base.dmg = Math.max(3, Math.round(base.dmg * p.char.dmgMult));
    base.knock *= p.char.knockMult;
    return base;
  }

  function createPlayer(id, startX, charKey) {
    const c = CHARACTERS[charKey] || CHARACTERS.striker;
    return {
      id,
      charKey,
      char: c,
      x: startX,
      y: FLOOR,
      w: 48,
      h: 92,
      vx: 0,
      vy: 0,
      facing: id === 1 ? 1 : -1,
      health: 100,
      maxHealth: 100,
      grounded: true,
      state: "idle",
      stateT: 0,
      atkKind: null,
      atkPhase: null,
      atkDealt: false,
      hitstun: 0,
      dead: false,
      skillCdLeft: 0,
      shieldTimer: 0,
      skillId: null,
      skillPhase: null,
      skillT: 0,
      skillHitDone: false,
    };
  }

  function hurtbox(p) {
    const padX = 8;
    const padY = 18;
    return {
      x: p.x + padX,
      y: p.y - p.h + padY,
      w: p.w - padX * 2,
      h: p.h - padY,
    };
  }

  function attackBox(p) {
    const a = getAtkProfile(p, p.atkKind);
    if (!a) return null;
    const cx = p.x + p.w * 0.5;
    const ax = p.facing === 1 ? cx : cx - a.reach;
    return {
      x: ax,
      y: p.y - a.offsetY,
      w: a.reach,
      h: a.height,
    };
  }

  function dashHitBox(p) {
    const cx = p.x + p.w * 0.5;
    const w = 52;
    const h = 42;
    const x = p.facing === 1 ? cx : cx - w;
    return { x, y: p.y - 62, w, h };
  }

  function aabbOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function facingToward(a, b) {
    const ac = a.x + a.w * 0.5;
    const bc = b.x + b.w * 0.5;
    return bc >= ac ? 1 : -1;
  }

  function applyDamage(target, rawDmg, knockX, knockY, isHeavy) {
    if (target.dead) return;
    let m = target.char.takenMult;
    if (target.shieldTimer > 0) m *= 0.3;
    const d = rawDmg * m;
    target.health = Math.max(0, target.health - d);
    target.hitstun = isHeavy ? 24 : 13;
    target.vx = knockX;
    target.vy = knockY;
    target.grounded = false;
    shake = isHeavy ? 11 : 6;
    if (target.health <= 0) {
      target.dead = true;
      target.state = "dead";
    }
  }

  function tryHit(att, def) {
    if (def.dead) return;
    const hb = hurtbox(def);
    const ab = attackBox(att);
    if (!ab || !aabbOverlap(ab, hb)) return;
    const a = getAtkProfile(att, att.atkKind);
    applyDamage(
      def,
      a.dmg,
      att.facing * a.knock,
      att.atkKind === "heavy" ? -5.5 : -2.2,
      att.atkKind === "heavy"
    );
    att.atkDealt = true;
  }

  function tryDashHit(att, def) {
    if (def.dead || att.skillHitDone) return;
    const hb = hurtbox(def);
    const db = dashHitBox(att);
    if (!aabbOverlap(db, hb)) return;
    applyDamage(def, 18, att.facing * 9, -4, true);
    att.skillHitDone = true;
  }

  function advanceAttack(p) {
    const a = getAtkProfile(p, p.atkKind);
    p.stateT++;
    if (p.atkPhase === "windup") {
      if (p.stateT >= a.windup) {
        p.atkPhase = "active";
        p.stateT = 0;
      }
    } else if (p.atkPhase === "active") {
      if (!p.atkDealt) tryHit(p, p.id === 1 ? p2 : p1);
      if (p.stateT >= a.active) {
        p.atkPhase = "recover";
        p.stateT = 0;
      }
    } else if (p.atkPhase === "recover") {
      if (p.stateT >= a.recover) {
        p.state = "idle";
        p.atkKind = null;
        p.atkPhase = null;
        p.atkDealt = false;
        p.stateT = 0;
      }
    }
  }

  function startAttack(p, kind) {
    if (p.dead || p.hitstun > 0) return;
    if (p.state !== "idle" && p.state !== "walk") return;
    if (!p.grounded) return;
    p.state = "attack";
    p.atkKind = kind;
    p.atkPhase = "windup";
    p.stateT = 0;
    p.atkDealt = false;
    p.vx = 0;
  }

  function startSkill(p) {
    if (p.skillCdLeft > 0 || p.dead || p.hitstun > 0) return;
    if (p.state !== "idle" && p.state !== "walk") return;
    if (!p.grounded) return;
    const role = p.char.role;
    if (role === "attack") {
      p.state = "skill";
      p.skillId = "dash";
      p.skillPhase = "windup";
      p.skillT = 0;
      p.skillHitDone = false;
      p.vx = 0;
    } else if (role === "defense") {
      p.shieldTimer = 150;
      p.skillCdLeft = p.char.skillCd;
    } else if (role === "ranged") {
      const cx = p.x + p.w * 0.5;
      projectiles.push({
        x: cx + p.facing * 42,
        y: p.y - 56,
        vx: p.facing * 11,
        w: 30,
        h: 24,
        dmg: 14,
        owner: p.id,
        alive: true,
      });
      p.skillCdLeft = p.char.skillCd;
    }
  }

  function advanceSkill(p) {
    if (p.state !== "skill" || p.skillId !== "dash") return;
    p.skillT++;
    if (p.skillPhase === "windup") {
      if (p.skillT >= 9) {
        p.skillPhase = "dash";
        p.skillT = 0;
      }
    } else if (p.skillPhase === "dash") {
      p.x += p.facing * 10;
      p.x = clamp(p.x, 16, W - p.w - 16);
      tryDashHit(p, p.id === 1 ? p2 : p1);
      if (p.skillT >= 24) {
        p.skillPhase = "recover";
        p.skillT = 0;
      }
    } else if (p.skillPhase === "recover") {
      if (p.skillT >= 18) {
        p.state = "idle";
        p.skillId = null;
        p.skillPhase = null;
        p.skillCdLeft = p.char.skillCd;
      }
    }
  }

  function updateProjectiles() {
    const out = [];
    for (const pr of projectiles) {
      if (!pr.alive) continue;
      pr.x += pr.vx;
      if (pr.x < -40 || pr.x > W + 40) continue;
      const tgt = pr.owner === 1 ? p2 : p1;
      if (!tgt.dead && aabbOverlap(pr, hurtbox(tgt))) {
        applyDamage(tgt, pr.dmg, pr.vx > 0 ? 5 : -5, -2, false);
        shake = 7;
        continue;
      }
      out.push(pr);
    }
    projectiles = out;
  }

  function kneeIK(hip, foot, bendSign) {
    const mx = (hip.x + foot.x) * 0.5;
    const my = (hip.y + foot.y) * 0.5;
    const dx = foot.x - hip.x;
    const dy = foot.y - hip.y;
    const len = Math.hypot(dx, dy) || 1;
    const bend = 9;
    const nx = (-dy / len) * bend * bendSign;
    const ny = (dx / len) * bend * bendSign;
    return { x: mx + nx, y: my + ny };
  }

  /**
   * 關節座標：y 向上為正（繪製時再翻成 canvas）。
   * 比例約 7～7.5 頭身、肩寬與步幅接近一般站姿。
   */
  function computeStickPose(p) {
    const segs = [];
    const ph = walkAnim * 0.17 + p.id * 1.3;
    const walkSwing = p.state === "walk" && p.grounded ? Math.sin(ph) * 2.6 : 0;
    const bob = Math.sin(walkAnim * 0.18) * (p.grounded ? 0.55 : 0);

    let backFx = -8 - walkSwing;
    let frontFx = 10 + walkSwing;
    let backFy = 0;
    let frontFy = 0;

    if (!p.grounded) {
      backFx = -7;
      frontFx = 7;
      backFy = 14;
      frontFy = 14;
    }

    if (p.dead) {
      segs.push({ x1: -12, y1: 6, x2: 18, y2: 12 });
      segs.push({ x1: 2, y1: 14, x2: 6, y2: 38 });
      return {
        segs,
        head: { x: 16, y: 10, r: 6.5 },
        hip: { x: 4, y: 18 },
        aura: false,
      };
    }

    const hip = {
      x: (backFx + frontFx) * 0.5 + bob * 0.25,
      y: 44 + bob + (p.grounded ? 0 : 10),
    };
    const spineLen = 24;
    const neck = { x: hip.x + walkSwing * 0.08, y: hip.y + spineLen };
    const headR = 6.8;
    const head = { x: neck.x, y: neck.y + 9.5, r: headR };

    const shoulderY = neck.y + 3;
    const shoulderL = { x: neck.x - 11, y: shoulderY };
    const shoulderR = { x: neck.x + 11, y: shoulderY };

    const kneeB = kneeIK(hip, { x: backFx, y: backFy }, 1);
    const kneeF = kneeIK(hip, { x: frontFx, y: frontFy }, -1);
    segs.push({ x1: hip.x, y1: hip.y, x2: kneeB.x, y2: kneeB.y });
    segs.push({ x1: kneeB.x, y1: kneeB.y, x2: backFx, y2: backFy });
    segs.push({ x1: hip.x, y1: hip.y, x2: kneeF.x, y2: kneeF.y });
    segs.push({ x1: kneeF.x, y1: kneeF.y, x2: frontFx, y2: frontFy });
    segs.push({ x1: hip.x, y1: hip.y, x2: neck.x, y2: neck.y });

    let leadElbow = { x: shoulderR.x + 5, y: shoulderY + 14 };
    let leadHand = { x: shoulderR.x + 7, y: shoulderY + 26 };
    let rearElbow = { x: shoulderL.x - 5, y: shoulderY + 13 };
    let rearHand = { x: shoulderL.x - 6, y: shoulderY + 24 };

    if (p.shieldTimer > 0 && p.char.role === "defense") {
      leadElbow = { x: shoulderR.x - 2, y: shoulderY + 8 };
      leadHand = { x: shoulderR.x + 10, y: shoulderY + 6 };
      rearElbow = { x: shoulderL.x + 4, y: shoulderY + 8 };
      rearHand = { x: shoulderL.x + 12, y: shoulderY + 6 };
    }

    if (p.state === "skill" && p.skillId === "dash") {
      if (p.skillPhase === "windup") {
        rearElbow = { x: shoulderL.x - 8, y: shoulderY + 6 };
        rearHand = { x: shoulderL.x - 14, y: shoulderY + 2 };
        leadElbow = { x: shoulderR.x + 8, y: shoulderY + 10 };
        leadHand = { x: shoulderR.x + 14, y: shoulderY + 8 };
      } else if (p.skillPhase === "dash") {
        hip.y += 2;
        leadElbow = { x: shoulderR.x + 12, y: shoulderY + 11 };
        leadHand = { x: shoulderR.x + 26, y: shoulderY + 10 };
      }
    }

    if (p.char.role === "ranged" && p.skillCdLeft > p.char.skillCd - 8) {
      leadElbow = { x: shoulderR.x + 10, y: shoulderY + 4 };
      leadHand = { x: shoulderR.x + 20, y: shoulderY + 2 };
      rearElbow = { x: shoulderL.x + 6, y: shoulderY + 5 };
      rearHand = { x: shoulderL.x + 14, y: shoulderY + 3 };
    }

    if (p.state === "attack" && p.atkKind) {
      const a = getAtkProfile(p, p.atkKind);
      let t = 0;
      if (p.atkPhase === "windup") t = p.stateT / a.windup;
      else if (p.atkPhase === "active") t = 0.5 + (p.stateT / a.active) * 0.35;
      else t = 0.85 + (p.stateT / a.recover) * 0.15;
      t = clamp(t, 0, 1);

      if (p.atkKind === "light") {
        const ext = t < 0.5 ? t / 0.5 : 1 - (t - 0.5) / 0.5 * 0.28;
        leadElbow = {
          x: shoulderR.x + 4 + ext * 10,
          y: shoulderY + 10 - ext * 3,
        };
        leadHand = {
          x: shoulderR.x + 8 + ext * 16,
          y: shoulderY + 12 - ext * 2,
        };
        rearElbow = { x: shoulderL.x - 4, y: shoulderY + 11 };
        rearHand = { x: shoulderL.x - 8, y: shoulderY + 22 };
      } else {
        const wind = p.atkPhase === "windup" ? p.stateT / a.windup : 0;
        if (p.atkPhase === "windup") {
          rearElbow = { x: shoulderL.x - 4, y: shoulderY - 2 - wind * 10 };
          rearHand = { x: shoulderL.x - 2, y: shoulderY - 4 - wind * 8 };
          leadElbow = { x: shoulderR.x + 4, y: shoulderY + 12 };
          leadHand = { x: shoulderR.x + 6, y: shoulderY + 20 };
        } else if (p.atkPhase === "active") {
          leadElbow = { x: shoulderR.x + 14, y: shoulderY + 12 };
          leadHand = { x: shoulderR.x + 28, y: shoulderY + 11 };
          rearHand = { x: shoulderL.x + 4, y: shoulderY + 8 };
          rearElbow = { x: shoulderL.x - 2, y: shoulderY + 4 };
        } else {
          leadHand = {
            x: shoulderR.x + 18 - t * 6,
            y: shoulderY + 16 - t * 4,
          };
          leadElbow = { x: shoulderR.x + 10, y: shoulderY + 12 };
        }
      }
    }

    if (p.hitstun > 0) {
      neck.x += p.facing * 2;
      leadElbow = { x: shoulderR.x + 4, y: shoulderY + 18 };
      leadHand = { x: shoulderR.x + 6, y: shoulderY + 26 };
      rearElbow = { x: shoulderL.x - 2, y: shoulderY + 17 };
      rearHand = { x: shoulderL.x - 4, y: shoulderY + 25 };
    }

    segs.push({ x1: neck.x, y1: neck.y, x2: shoulderL.x, y2: shoulderL.y });
    segs.push({ x1: neck.x, y1: neck.y, x2: shoulderR.x, y2: shoulderR.y });
    segs.push({ x1: shoulderR.x, y1: shoulderR.y, x2: leadElbow.x, y2: leadElbow.y });
    segs.push({ x1: leadElbow.x, y1: leadElbow.y, x2: leadHand.x, y2: leadHand.y });
    segs.push({ x1: shoulderL.x, y1: shoulderL.y, x2: rearElbow.x, y2: rearElbow.y });
    segs.push({ x1: rearElbow.x, y1: rearElbow.y, x2: rearHand.x, y2: rearHand.y });

    const aura = p.shieldTimer > 0 && p.char.role === "defense";
    return { segs, head, hip: { x: hip.x, y: hip.y }, aura };
  }

  function drawStick(p) {
    const cx = p.x + p.w * 0.5;
    const gy = p.y;
    const pose = computeStickPose(p);

    ctx.save();
    ctx.translate(cx, gy);
    ctx.scale(p.facing, 1);

    if (pose.aura && pose.hip) {
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(pose.hip.x, -pose.hip.y, 38, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = p.char.lineColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (const s of pose.segs) {
      ctx.moveTo(s.x1, -s.y1);
      ctx.lineTo(s.x2, -s.y2);
    }
    ctx.stroke();

    const h = pose.head;
    ctx.fillStyle = p.hitstun > 0 ? "#fef9c3" : p.char.headColor;
    ctx.beginPath();
    ctx.arc(h.x, -h.y, h.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.char.lineColor;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.restore();

    if (p.state === "attack" && p.atkPhase === "active") {
      const ab = attackBox(p);
      if (ab) {
        ctx.fillStyle = "rgba(250, 250, 250, 0.2)";
        ctx.fillRect(ab.x, ab.y, ab.w, ab.h);
      }
    }
    if (p.state === "skill" && p.skillPhase === "dash") {
      const db = dashHitBox(p);
      ctx.fillStyle = "rgba(252, 165, 165, 0.25)";
      ctx.fillRect(db.x, db.y, db.w, db.h);
    }
  }

  function drawSceneRooftop() {
    const g = ctx.createLinearGradient(0, 0, 0, FLOOR);
    g.addColorStop(0, "#3d2a5c");
    g.addColorStop(0.45, "#1a2744");
    g.addColorStop(1, "#0b1020");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, FLOOR);

    for (let i = 0; i < 52; i++) {
      const sx = (i * 193 + 17) % (W - 4);
      const sy = (i * 127 + 41) % (FLOOR - 55);
      const a = 0.12 + (i % 7) * 0.06;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }

    ctx.fillStyle = "#060912";
    let bx = -8;
    while (bx < W + 20) {
      const bw = 36 + ((bx * 3) % 55);
      const bh = 42 + ((bx * 5) % 78);
      ctx.fillRect(bx, FLOOR - bh - 2, bw, bh + 4);
      bx += bw - 6;
    }

    ctx.fillStyle = "rgba(236, 72, 153, 0.18)";
    ctx.fillRect(0, FLOOR - 28, W, 26);

    const rim = ctx.createLinearGradient(0, FLOOR, W, FLOOR);
    rim.addColorStop(0, "rgba(244, 63, 94, 0.75)");
    rim.addColorStop(0.45, "rgba(34, 211, 238, 0.65)");
    rim.addColorStop(1, "rgba(168, 85, 247, 0.55)");
    ctx.fillStyle = rim;
    ctx.fillRect(0, FLOOR, W, 3);

    ctx.fillStyle = "rgba(17, 24, 39, 0.97)";
    ctx.fillRect(0, FLOOR + 3, W, H - FLOOR - 3);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.1)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 18; i++) {
      const gx = (i / 18) * W;
      ctx.beginPath();
      ctx.moveTo(gx, FLOOR + 3);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
  }

  function drawSceneDojo() {
    const g = ctx.createLinearGradient(0, 0, W, FLOOR);
    g.addColorStop(0, "#fdba74");
    g.addColorStop(0.35, "#ea580c");
    g.addColorStop(0.72, "#9a3412");
    g.addColorStop(1, "#431407");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, FLOOR);

    const sunG = ctx.createRadialGradient(
      W * 0.76,
      FLOOR - 92,
      4,
      W * 0.76,
      FLOOR - 92,
      72
    );
    sunG.addColorStop(0, "rgba(255, 251, 235, 0.95)");
    sunG.addColorStop(0.25, "rgba(253, 224, 71, 0.45)");
    sunG.addColorStop(0.55, "rgba(234, 88, 12, 0.2)");
    sunG.addColorStop(1, "rgba(234, 88, 12, 0)");
    ctx.fillStyle = sunG;
    ctx.beginPath();
    ctx.arc(W * 0.76, FLOOR - 92, 68, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(67, 20, 7, 0.55)";
    ctx.beginPath();
    ctx.ellipse(W * 0.5, FLOOR - 8, W * 0.55, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2c0b06";
    ctx.fillRect(W * 0.38, FLOOR - 118, 10, 118);
    ctx.fillRect(W * 0.58, FLOOR - 118, 10, 118);
    ctx.beginPath();
    ctx.moveTo(W * 0.32, FLOOR - 118);
    ctx.quadraticCurveTo(W * 0.5, FLOOR - 138, W * 0.68, FLOOR - 118);
    ctx.lineTo(W * 0.66, FLOOR - 108);
    ctx.quadraticCurveTo(W * 0.5, FLOOR - 124, W * 0.34, FLOOR - 108);
    ctx.closePath();
    ctx.fill();

    const rim = ctx.createLinearGradient(0, FLOOR, 0, FLOOR + 4);
    rim.addColorStop(0, "rgba(254, 243, 199, 0.85)");
    rim.addColorStop(1, "rgba(120, 53, 15, 0.6)");
    ctx.fillStyle = rim;
    ctx.fillRect(0, FLOOR, W, 3);

    ctx.fillStyle = "#c9b59a";
    ctx.fillRect(0, FLOOR + 3, W, H - FLOOR - 3);
    ctx.strokeStyle = "rgba(120, 53, 15, 0.22)";
    for (let row = 0; row < 4; row++) {
      const y = FLOOR + 8 + row * 14;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(87, 83, 78, 0.15)";
    for (let col = 0; col < 24; col++) {
      const x = (col / 24) * W;
      ctx.beginPath();
      ctx.moveTo(x, FLOOR + 3);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
  }

  function drawSceneCircuit() {
    const g = ctx.createLinearGradient(0, 0, 0, FLOOR);
    g.addColorStop(0, "#020617");
    g.addColorStop(0.5, "#0c1e2e");
    g.addColorStop(1, "#042f2e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, FLOOR);

    ctx.strokeStyle = "rgba(45, 212, 191, 0.14)";
    ctx.lineWidth = 1;
    const vanishX = W * 0.5;
    const vanishY = FLOOR - 160;
    for (let i = -14; i <= 14; i++) {
      ctx.beginPath();
      ctx.moveTo(vanishX + i * 8, vanishY);
      ctx.lineTo(i * 70 + W * 0.5, FLOOR - 4);
      ctx.stroke();
    }
    for (let h = 0; h < 9; h++) {
      const t = h / 9;
      const y = vanishY + (FLOOR - 8 - vanishY) * (0.15 + t * 0.85);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    for (let i = 0; i < 28; i++) {
      const px = (i * 211 + 31) % W;
      const py = (i * 97 + 59) % (FLOOR - 30);
      ctx.fillStyle =
        i % 4 === 0
          ? "rgba(52, 211, 153, 0.35)"
          : "rgba(34, 211, 238, 0.2)";
      ctx.fillRect(px, py, 2, 2);
    }

    const rim = ctx.createLinearGradient(0, FLOOR, W, FLOOR);
    rim.addColorStop(0, "rgba(52, 211, 153, 0.85)");
    rim.addColorStop(0.5, "rgba(34, 211, 238, 0.75)");
    rim.addColorStop(1, "rgba(52, 211, 153, 0.85)");
    ctx.fillStyle = rim;
    ctx.fillRect(0, FLOOR, W, 3);

    ctx.fillStyle = "#021c18";
    ctx.fillRect(0, FLOOR + 3, W, H - FLOOR - 3);
    ctx.strokeStyle = "rgba(45, 212, 191, 0.12)";
    for (let i = 0; i <= 32; i++) {
      const gx = (i / 32) * W;
      ctx.beginPath();
      ctx.moveTo(gx, FLOOR + 3);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(34, 211, 238, 0.1)";
    for (let j = 0; j < 5; j++) {
      const y = FLOOR + 20 + j * 16;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  function drawSceneEnvironment() {
    switch (currentSceneId) {
      case "dojo":
        drawSceneDojo();
        break;
      case "circuit":
        drawSceneCircuit();
        break;
      case "rooftop":
      default:
        drawSceneRooftop();
        break;
    }
  }

  function syncSceneUi() {
    document.querySelectorAll(".scene-chip").forEach((btn) => {
      const on = btn.dataset.scene === currentSceneId;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function setSceneId(id) {
    if (!SCENE_ORDER.includes(id)) return;
    currentSceneId = id;
    try {
      localStorage.setItem(SCENE_KEY, id);
    } catch (_) {}
    syncSceneUi();
  }

  function drawProjectiles() {
    for (const pr of projectiles) {
      const g = ctx.createRadialGradient(
        pr.x,
        pr.y,
        2,
        pr.x,
        pr.y,
        pr.w * 0.6
      );
      g.addColorStop(0, "#faf5ff");
      g.addColorStop(0.5, "#a78bfa");
      g.addColorStop(1, "rgba(109, 40, 217, 0.15)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(
        pr.x,
        pr.y,
        pr.w * 0.5,
        pr.h * 0.5,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  function drawScene() {
    ctx.save();
    if (shake > 0) {
      const s = shake * 0.45;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      shake *= 0.88;
      if (shake < 0.25) shake = 0;
    }

    drawSceneEnvironment();

    if (gamePhase === "fight") {
      drawStick(p1);
      drawStick(p2);
      drawProjectiles();
    }

    ctx.restore();
  }

  function bindKeys() {
    window.addEventListener("keydown", (e) => {
      keys.add(e.code);
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          e.code
        )
      ) {
        e.preventDefault();
      }
      if (gamePhase === "select") {
        if (e.code === "Digit1") {
          sel1 = "striker";
          lock1 = false;
        }
        if (e.code === "Digit2") {
          sel1 = "tank";
          lock1 = false;
        }
        if (e.code === "Digit3") {
          sel1 = "ranger";
          lock1 = false;
        }
        if (e.code === "KeyF") lock1 = true;
        if (e.code === "KeyI") {
          sel2 = "striker";
          lock2 = false;
        }
        if (e.code === "KeyO") {
          sel2 = "tank";
          lock2 = false;
        }
        if (e.code === "KeyP") {
          sel2 = "ranger";
          lock2 = false;
        }
        if (e.code === "BracketRight") lock2 = true;
        if (e.code === "Space" && lock1 && lock2) {
          e.preventDefault();
          startFight();
        }
        syncSelectUi();
      }
      if (gamePhase === "fight" && !e.repeat) {
        if (e.code === "KeyQ") edgeSkillP1 = true;
        if (e.code === "Semicolon") edgeSkillP2 = true;
      }
    });
    window.addEventListener("keyup", (e) => {
      keys.delete(e.code);
    });
  }

  function syncSelectUi() {
    document.querySelectorAll('.char-card[data-player="1"]').forEach((btn) => {
      const k = btn.getAttribute("data-char");
      btn.classList.toggle("is-highlight", k === sel1);
      btn.classList.toggle("is-locked", lock1 && k === sel1);
    });
    document.querySelectorAll('.char-card[data-player="2"]').forEach((btn) => {
      const k = btn.getAttribute("data-char");
      btn.classList.toggle("is-highlight", k === sel2);
      btn.classList.toggle("is-locked", lock2 && k === sel2);
    });
    const n1 = CHARACTERS[sel1].name;
    const n2 = CHARACTERS[sel2].name;
    pick1.textContent = lock1 ? "已鎖定：" + n1 : "預覽：" + n1 + "（按 F 鎖定）";
    pick2.textContent = lock2 ? "已鎖定：" + n2 : "預覽：" + n2 + "（按 ] 鎖定）";
  }

  document.querySelectorAll(".char-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pl = btn.closest(".char-cards").getAttribute("data-player");
      const ch = btn.getAttribute("data-char");
      if (pl === "1") {
        sel1 = ch;
        lock1 = false;
      } else {
        sel2 = ch;
        lock2 = false;
      }
      syncSelectUi();
    });
  });

  function startFight() {
    gamePhase = "fight";
    charSelectEl.classList.add("hidden");
    fightHud.classList.remove("hidden");
    wrap.classList.remove("hidden");
    fightHelp.classList.remove("hidden");
    p1 = createPlayer(1, W * 0.22, sel1);
    p2 = createPlayer(2, W * 0.72, sel2);
    labelP1.textContent = "P1 · " + p1.char.name;
    labelP2.textContent = "P2 · " + p2.char.name;
    projectiles = [];
    roundOver = false;
    matchOver = false;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    btnNext.classList.remove("hidden");
    wrap.focus();
  }

  function inputPlayer(p, codes) {
    if (p.dead) return;
    if (p.hitstun > 0) return;
    if (p.state === "attack" || p.state === "skill") return;

    const spd = MOVE_BASE * p.char.moveMult;
    let move = 0;
    if (keys.has(codes.left)) move -= 1;
    if (keys.has(codes.right)) move += 1;
    const slow = p.shieldTimer > 0 ? 0.55 : 1;
    if (move !== 0) {
      p.facing = move;
      p.vx = move * spd * slow;
      p.state = "walk";
    } else {
      p.vx *= FRICTION;
      if (Math.abs(p.vx) < 0.12) p.vx = 0;
      p.state = p.grounded ? "idle" : "jump";
    }

    if (keys.has(codes.up) && p.grounded) {
      p.vy = JUMP_V;
      p.grounded = false;
      p.state = "jump";
    }

    if (p.grounded && (p.state === "idle" || p.state === "walk")) {
      if (keys.has(codes.light)) startAttack(p, "light");
      else if (keys.has(codes.heavy)) startAttack(p, "heavy");
    }
    const wantSkill = p.id === 1 ? edgeSkillP1 : edgeSkillP2;
    if (wantSkill) startSkill(p);
  }

  function physics(p) {
    if (p.dead) {
      p.vx *= 0.88;
      p.vy += GRAVITY;
      p.y += p.vy;
      if (p.y >= FLOOR) {
        p.y = FLOOR;
        p.vy = 0;
      }
      return;
    }

    if (p.skillCdLeft > 0) p.skillCdLeft--;
    if (p.shieldTimer > 0) p.shieldTimer--;

    if (p.hitstun > 0) {
      p.hitstun--;
      p.vy += GRAVITY;
      p.x += p.vx;
      p.y += p.vy;
      p.x = clamp(p.x, 16, W - p.w - 16);
      if (p.y >= FLOOR) {
        p.y = FLOOR;
        p.vy = 0;
        p.grounded = true;
      }
      return;
    }

    if (p.state === "skill") {
      advanceSkill(p);
      p.vy += GRAVITY * 0.4;
      p.y += p.vy;
      if (p.y >= FLOOR) {
        p.y = FLOOR;
        p.vy = 0;
        p.grounded = true;
      }
      p.x = clamp(p.x, 16, W - p.w - 16);
      p.facing = facingToward(p, p.id === 1 ? p2 : p1);
      return;
    }

    if (p.state === "attack") {
      advanceAttack(p);
      p.vy += GRAVITY * 0.38;
      p.y += p.vy;
      if (p.y >= FLOOR) {
        p.y = FLOOR;
        p.vy = 0;
        p.grounded = true;
      }
      p.x = clamp(p.x, 16, W - p.w - 16);
      p.facing = facingToward(p, p.id === 1 ? p2 : p1);
      return;
    }

    p.vy += GRAVITY;
    p.x += p.vx;
    p.y += p.vy;
    p.x = clamp(p.x, 16, W - p.w - 16);
    if (p.y >= FLOOR) {
      p.y = FLOOR;
      p.vy = 0;
      p.grounded = true;
    } else {
      p.grounded = false;
    }
    p.facing = facingToward(p, p.id === 1 ? p2 : p1);
  }

  function separatePlayers() {
    const hb1 = hurtbox(p1);
    const hb2 = hurtbox(p2);
    if (aabbOverlap(hb1, hb2)) {
      const overlap =
        Math.min(hb1.x + hb1.w, hb2.x + hb2.w) - Math.max(hb1.x, hb2.x);
      const half = overlap * 0.5 + 0.5;
      if (p1.x < p2.x) {
        p1.x -= half;
        p2.x += half;
      } else {
        p1.x += half;
        p2.x -= half;
      }
      p1.x = clamp(p1.x, 16, W - p1.w - 16);
      p2.x = clamp(p2.x, 16, W - p2.w - 16);
    }
  }

  function updateHud() {
    if (gamePhase !== "fight") return;
    elHp1.style.transform = `scaleX(${p1.health / p1.maxHealth})`;
    elHp2.style.transform = `scaleX(${p2.health / p2.maxHealth})`;
    elScore.textContent = wins1 + " — " + wins2;
    const r1 = p1.skillCdLeft / p1.char.skillCd;
    const r2 = p2.skillCdLeft / p2.char.skillCd;
    elCd1.style.transform = `scaleX(${clamp(1 - r1, 0, 1)})`;
    elCd2.style.transform = `scaleX(${clamp(1 - r2, 0, 1)})`;
  }

  function checkRoundEnd() {
    if (roundOver || matchOver || gamePhase !== "fight") return;
    if (p1.dead || p2.dead) {
      roundOver = true;
      const w1 = p2.dead && !p1.dead;
      const w2 = p1.dead && !p2.dead;
      if (w1) wins1++;
      if (w2) wins2++;
      updateHud();
      let msg = "";
      if (w1) msg = "本回合：P1 勝！";
      else if (w2) msg = "本回合：P2 勝！";
      else msg = "雙方倒地 · 平手";

      if (wins1 >= 2 || wins2 >= 2) {
        matchOver = true;
        msg =
          wins1 >= 2
            ? "比賽結束 · P1 贏得三戰兩勝！"
            : "比賽結束 · P2 贏得三戰兩勝！";
        overlayText.textContent = msg;
        btnNext.classList.add("hidden");
      } else {
        overlayText.textContent = msg + "（先贏 2 局）";
        btnNext.classList.remove("hidden");
      }
      overlay.classList.remove("hidden");
      overlay.setAttribute("aria-hidden", "false");
    }
  }

  function tick() {
    if (gamePhase === "fight" && !roundOver && !matchOver) {
      walkAnim++;
      inputPlayer(p1, {
        left: "KeyA",
        right: "KeyD",
        up: "KeyW",
        light: "KeyV",
        heavy: "KeyB",
      });
      inputPlayer(p2, {
        left: "ArrowLeft",
        right: "ArrowRight",
        up: "ArrowUp",
        light: "KeyJ",
        heavy: "KeyK",
      });
      edgeSkillP1 = false;
      edgeSkillP2 = false;
      physics(p1);
      physics(p2);
      updateProjectiles();
      separatePlayers();
      checkRoundEnd();
    }
    updateHud();
    drawScene();
    requestAnimationFrame(tick);
  }

  function resetRound() {
    p1 = createPlayer(1, W * 0.22, sel1);
    p2 = createPlayer(2, W * 0.72, sel2);
    labelP1.textContent = "P1 · " + p1.char.name;
    labelP2.textContent = "P2 · " + p2.char.name;
    projectiles = [];
    roundOver = false;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    btnNext.classList.remove("hidden");
    wrap.focus();
  }

  function resetMatch() {
    wins1 = 0;
    wins2 = 0;
    matchOver = false;
    resetRound();
  }

  btnNext.addEventListener("click", resetRound);
  btnReset.addEventListener("click", resetMatch);
  wrap.addEventListener("click", () => wrap.focus());

  document.querySelector(".fighter-scenes__opts")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".scene-chip");
    if (!btn || !btn.dataset.scene) return;
    setSceneId(btn.dataset.scene);
  });

  bindKeys();
  syncSelectUi();
  syncSceneUi();
  drawScene();
  requestAnimationFrame(tick);

  setTimeout(() => {
    if (gamePhase === "select") document.body.focus();
  }, 100);
})();
