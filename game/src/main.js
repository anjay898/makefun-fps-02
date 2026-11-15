// Breachline — boot and the one game loop. A fixed 60 Hz simulation (player, bots, weapons,
// grenades, match) kept apart from rendering; all shared state lives in this module's scope
// and is passed down to the focused modules (map, actors, combat, bots, match, ui, input).
// ?shot=cover|buy|site|fire&seed=N sets up a deterministic frame for screenshots, renders
// twice, then freezes and sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE, WEAPONS, GRENADES, ECONOMY, TIMING, SPAWN_ATK, SPAWN_DEF } from './config.js';
import { buildMap } from './map.js';
import { createActor, buildBody, syncBody, stepActor, damageActor } from './actors.js';
import { makeWeapon, spreadFor, startReload, stepWeapon, fire, buildViewModel, createTracers, createNades } from './combat.js';
import { createBrain, stepBots } from './bots.js';
import { createMatch, beginRound, startChannel, cancelChannel, updateMatch, inSite } from './match.js';
import { createUi } from './ui.js';
import { createInput } from './input.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '7', 10) || 7;
function mulberry32(a) {
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(seed * 7919 + 13);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
scene.add(camera);
const map = buildMap(scene);
const viewModel = buildViewModel(camera);
const tracers = createTracers(scene);

// --- actors: the player leads the Ember Cell (attackers); 4 allied bots, 5 Warden bots. ---
const player = createActor(SPAWN_ATK[0].x, SPAWN_ATK[0].z, 'atk', true);
player.label = 'YOU';
const actors = [player];
const bots = []; // { actor, brain, role }
const ATK_ROLES = ['carrier', 'entry', 'entry', 'support'];
const DEF_ROLES = ['anchor', 'anchor', 'rotate', 'rotate', 'mid'];
ATK_ROLES.forEach((role, i) => {
  const a = createActor(SPAWN_ATK[i + 1].x, SPAWN_ATK[i + 1].z, 'atk', false);
  a.label = `EMBER-${i + 2}`; a.role = role;
  buildBody(a, scene); actors.push(a); bots.push({ actor: a, role, brain: null });
});
DEF_ROLES.forEach((role, i) => {
  const a = createActor(SPAWN_DEF[i].x, SPAWN_DEF[i].z, 'def', false);
  a.label = `WARDEN-${i + 1}`; a.role = role;
  buildBody(a, scene); actors.push(a); bots.push({ actor: a, role, brain: null });
});
for (const a of actors) {
  a.money = ECONOMY.start;
  a.owned = { knife: true, pistol: true };
  a.cur = 'pistol';
  a.w = makeWeapon('pistol');
  a.nades = { flash: 0, frag: 0 };
  a.diedLast = false;
  a.aimTarget = null;
}

// Invisible-but-raycastable hit proxy for the player (the player has no visible body).
const proxyMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
const proxy = new THREE.Group();
function proxyPart(w, h, d, y, part) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), proxyMat);
  m.position.y = y; m.userData.actor = player; m.userData.part = part;
  proxy.add(m); return m;
}
const proxyLegs = proxyPart(0.5, 0.8, 0.3, 0.4, 'legs');
const proxyTorso = proxyPart(0.62, 0.72, 0.34, 1.16, 'torso');
const proxyHead = proxyPart(0.34, 0.34, 0.34, 1.77, 'head');
scene.add(proxy);

// Raycast target lists per defending team, rebuilt when someone dies or a round resets.
const teamMeshes = { atk: [], def: [] };
function rebuildTargets() {
  teamMeshes.atk.length = 0; teamMeshes.def.length = 0;
  for (const a of actors) {
    if (!a.alive) continue;
    if (a.isPlayer) { teamMeshes.atk.push(proxyLegs, proxyTorso, proxyHead); continue; }
    a.group.traverse((o) => { if (o.isMesh) teamMeshes[a.team].push(o); });
  }
}

// The charge (bomb) prop: shown when dropped or planted.
const bombMesh = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.14), new THREE.MeshStandardMaterial({ color: 0x22282f, roughness: 0.6 }));
  body.position.y = 0.12; bombMesh.add(body);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: PALETTE.ember, emissive: PALETTE.ember, emissiveIntensity: 2 }));
  lamp.position.set(0.08, 0.26, 0); lamp.name = 'lamp'; bombMesh.add(lamp);
  bombMesh.visible = false; scene.add(bombMesh);
}

// --- tiny procedural audio (no assets, no network): noise bursts and beeps. ---
let actx = null;
window.addEventListener('pointerdown', () => { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { actx = null; } } if (actx && actx.state === 'suspended') actx.resume(); });
function sfx(kind) {
  if (!actx) return;
  const t = actx.currentTime;
  if (kind === 'beep') {
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = 920; g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.13); return;
  }
  const dur = kind === 'boom' ? 0.55 : 0.13;
  const buf = actx.createBuffer(1, Math.floor(actx.sampleRate * dur), actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = actx.createBufferSource(); src.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'boom' ? 380 : 2600;
  const g = actx.createGain(); g.gain.setValueAtTime(kind === 'boom' ? 0.32 : 0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(actx.destination); src.start(t);
}

// --- shared simulation state ---
let M = createMatch();
let simNow = performance.now();
let yaw = 0, pitch = 0, kickPitch = 0;
let started = false;
let buyShown = false;
const noise = { pos: new THREE.Vector3(0, 0, -99), at: -1e9 };
const nades = createNades(scene, map.colliders, actors, (type) => { sfx(type === 'frag' ? 'boom' : 'beep'); });

const ui = createUi({
  onBuy: (key) => { if (buyForPlayer(key)) ui.showBuy(player.money, ownedSet(player)); },
  onPlay: () => {
    if (M.matchOver) resetMatch();
    ui.hideOverlay(); input.requestLock();
  },
});
const input = createInput(renderer.domElement, onLockChange);
document.getElementById('buy-deploy').addEventListener('click', () => { ui.hideBuy(); buyShown = false; input.requestLock(); });
renderer.domElement.addEventListener('click', () => {
  if (started && !input.state.locked && !M.matchOver && !buyShown) input.requestLock();
});

function ownedSet(a) {
  const s = new Set(Object.keys(a.owned).filter((k) => a.owned[k]));
  for (const k of ['flash', 'frag']) if (a.nades[k] > 0) s.add(k);
  return s;
}
function equip(a, key) {
  a.cur = key; a.w = makeWeapon(key);
  if (a === player) {
    viewModel.setWeapon(key);
    document.getElementById('weapon-name').textContent = WEAPONS[key].name || 'CINDER KNIFE';
  }
}
function buyForPlayer(key) { return buy(player, key); }
function buy(a, key) {
  const isWep = !!WEAPONS[key];
  const def = isWep ? WEAPONS[key] : GRENADES[key];
  if (!def || a.money < def.price) return false;
  if (isWep) {
    if (a.owned[key]) return false;
    a.owned[key] = true; a.money -= def.price; equip(a, key);
  } else {
    if (a.nades[key] >= 1) return false;
    a.nades[key] += 1; a.money -= def.price;
  }
  return true;
}
function botBuy(a) {
  if (a.money >= WEAPONS.rifle.price && rng() < 0.75) buy(a, 'rifle');
  else if (a.money >= WEAPONS.shotgun.price && rng() < 0.3) buy(a, 'shotgun');
  else if (a.money >= WEAPONS.smg.price) buy(a, 'smg');
  if (rng() < 0.35) buy(a, 'flash');
  if (rng() < 0.35) buy(a, 'frag');
}

function resetRound() {
  const idx = { atk: 0, def: 0 };
  for (const a of actors) {
    const spawn = (a.team === 'atk' ? SPAWN_ATK : SPAWN_DEF)[idx[a.team]++];
    a.pos.set(spawn.x, 0, spawn.z);
    a.vel.set(0, 0, 0); a.hp = 100; a.alive = true; a.crouch = false;
    a.yaw = a.team === 'atk' ? 0 : Math.PI; a.pitch = 0; a.flashUntil = 0;
    if (a.diedLast) { a.owned = { knife: true, pistol: true }; a.nades = { flash: 0, frag: 0 }; }
    a.diedLast = false; a.aimTarget = null;
    if (!a.isPlayer) botBuy(a);
    equip(a, ['rifle', 'sniper', 'smg', 'shotgun'].find((k) => a.owned[k]) || 'pistol');
    if (!a.isPlayer) syncBody(a);
  }
  for (const b of bots) { b.brain = createBrain(b.actor, b.role); b.brain.lane = bots.indexOf(b); }
  yaw = 0; pitch = 0; kickPitch = 0;
  bombMesh.visible = false;
  beginRound(M, actors, simNow, rng);
  rebuildTargets();
  buyShown = false;
}
function resetMatch() {
  M = createMatch();
  for (const a of actors) { a.money = ECONOMY.start; a.owned = { knife: true, pistol: true }; a.nades = { flash: 0, frag: 0 }; a.diedLast = false; }
  resetRound();
}

// --- shooting ---
const ray = new THREE.Raycaster();
const tmpO = new THREE.Vector3(), tmpD = new THREE.Vector3(), tmpR = new THREE.Vector3(), tmpU = new THREE.Vector3(), tmpT = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
function eyeOf(a, out) { out.copy(a.pos); out.y += a.eye; return out; }
function dirFromYawPitch(y, p, out) {
  out.set(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
  return out;
}
function losClear(a, b) {
  eyeOf(a, tmpO);
  tmpT.copy(b.pos); tmpT.y += 1.25; tmpT.sub(tmpO);
  const dist = tmpT.length();
  if (dist > 42) return false;
  ray.set(tmpO, tmpT.normalize());
  const hit = ray.intersectObjects(map.shootables, false)[0];
  return !hit || hit.distance > dist - 0.6;
}
function performShot(shooter) {
  const def = WEAPONS[shooter.cur];
  if (!def || !shooter.alive || M.phase !== 'live') return;
  if (shooter.cur === 'knife') {
    if (!fire(shooter.w, simNow)) return;
    eyeOf(shooter, tmpO);
    dirFromYawPitch(shooter.yaw, shooter.pitch, tmpD);
    for (const t of actors) {
      if (t.team === shooter.team || !t.alive) continue;
      tmpT.copy(t.pos); tmpT.y += 1; tmpT.sub(tmpO);
      if (tmpT.length() < 1.9 && tmpT.normalize().dot(tmpD) > 0.4) {
        if (damageActor(t, def.dmg)) onKill(shooter, t);
        if (shooter === player) ui.hitMarker(t.alive === false);
        break;
      }
    }
    return;
  }
  if (!shooter.isPlayer) {
    const t = shooter.aimTarget;
    if (!t || !t.alive) return;
  }
  if (!fire(shooter.w, simNow)) {
    if (shooter.w.mag === 0) startReload(shooter.w, simNow);
    return;
  }
  eyeOf(shooter, tmpO);
  if (shooter.isPlayer) {
    dirFromYawPitch(yaw, pitch + kickPitch, tmpD);
  } else {
    const t = shooter.aimTarget;
    tmpT.copy(t.pos); tmpT.y += rng() < 0.3 ? 1.72 : 1.3;
    tmpD.copy(tmpT).sub(tmpO);
    const err = 0.014 + tmpD.length() * 0.0007 + (t.speedNow || 0) * 0.004 + shooter.speedNow * 0.002;
    tmpD.normalize();
    tmpD.x += (rng() * 2 - 1) * err; tmpD.y += (rng() * 2 - 1) * err * 0.7; tmpD.z += (rng() * 2 - 1) * err;
    tmpD.normalize();
  }
  const spread = spreadFor(shooter.w, shooter.speedNow, shooter.crouch);
  const foes = shooter.team === 'atk' ? 'def' : 'atk';
  const hitList = map.shootables.concat(teamMeshes[foes]);
  const pellets = def.pellets || 1;
  let firstEnd = null;
  for (let i = 0; i < pellets; i++) {
    tmpR.crossVectors(tmpD, UP).normalize();
    if (tmpR.lengthSq() < 0.01) tmpR.set(1, 0, 0);
    tmpU.crossVectors(tmpR, tmpD);
    const r = Math.sqrt(rng()) * spread, ang = rng() * Math.PI * 2;
    const dir = tmpD.clone().addScaledVector(tmpR, Math.cos(ang) * r).addScaledVector(tmpU, Math.sin(ang) * r).normalize();
    ray.set(tmpO, dir);
    const hit = ray.intersectObjects(hitList, false)[0];
    const end = hit ? hit.point : tmpO.clone().addScaledVector(dir, 60);
    if (!firstEnd) firstEnd = end;
    tracers.spawn(tmpO.clone().addScaledVector(dir, 0.55), end, shooter.team === 'atk' ? PALETTE.ember : PALETTE.warden);
    if (hit && hit.object.userData.actor) {
      const victim = hit.object.userData.actor;
      const part = hit.object.userData.part || 'torso';
      const mult = part === 'head' ? (def.headMult || 1) : part === 'legs' ? 0.6 : 1;
      const fall = def.falloff ? Math.max(0.35, 1 - hit.distance * def.falloff) : 1;
      const died = damageActor(victim, def.dmg * mult * fall);
      if (shooter === player) ui.hitMarker(died);
      if (victim === player) ui.damageFlash();
      if (died) onKill(shooter, victim);
    }
  }
  if (shooter === player) {
    viewModel.kick(); viewModel.flash();
    kickPitch += def.recoil || 0;
  }
  noise.pos.copy(shooter.pos); noise.at = simNow;
  sfx('shot');
}
function onKill(shooter, victim) {
  victim.diedLast = true;
  shooter.money = Math.min(ECONOMY.cap, shooter.money + ECONOMY.kill);
  ui.killfeed(`${shooter.label} ▸ ${victim.label}`);
  if (victim === player) ui.banner('YOU ARE DOWN', 'spectating this round', 2200);
  rebuildTargets();
}

// --- bot channel helpers (plant / defuse) ---
function channelBot(a, kind) {
  if (a.speedNow > 1) { if (M.channel && M.channel.actor === a) cancelChannel(M, a); return; }
  if (!M.channel || M.channel.actor !== a) startChannel(M, a, kind, simNow);
}
const botCtx = {
  actors, colliders: map.colliders, phase: 'buy', bombPos: null,
  canShoot: (a, t) => losClear(a, t),
  shoot: (a, t) => { a.aimTarget = t; performShot(a); },
  tryPlant: (a) => channelBot(a, 'plant'),
  tryDefuse: (a) => channelBot(a, 'defuse'),
  noise, rng,
};

// --- fixed-step simulation ---
const FIXED = 1 / 60;
function step(dt) {
  simNow += dt * 1000;
  // player movement
  const k = input.state.keys;
  const fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
  const str = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  player.crouch = k.has('ControlLeft') || k.has('ControlRight') || k.has('KeyC');
  player.yaw = yaw; player.pitch = pitch;
  if (player.alive && !shot) {
    stepActor(player, fx * fwd + rx * str, fz * fwd + rz * str, dt, map.colliders, k.has('Space'));
  }
  proxy.position.copy(player.pos);
  proxyTorso.position.y = player.crouch ? 0.68 : 1.16;
  proxyHead.position.y = player.crouch ? 1.19 : 1.77;
  // firing + reloading
  if (input.state.locked && input.state.firing && player.alive && M.phase === 'live') performShot(player);
  // plant channel (player holds E, standing in the Crucible)
  if (player.alive && M.phase === 'live' && k.has('KeyE')) {
    if ((!M.channel || M.channel.actor !== player) && inSite(player)) startChannel(M, player, 'plant', simNow);
  }
  if (M.channel && M.channel.actor === player && (!k.has('KeyE') || player.speedNow > 0.6)) cancelChannel(M, player);
  // bots
  if (M.phase !== 'over' && !shot) {
    botCtx.phase = M.phase === 'buy' ? 'buy' : (M.bombMode === 'planted' ? 'planted' : 'live');
    botCtx.bombPos = M.bombPos ? tmpBombPos.set(M.bombPos.x, 0, M.bombPos.z) : null;
    stepBots(bots.map((b) => b.brain), dt, simNow, botCtx);
  }
  for (const a of actors) stepWeapon(a.w, simNow, dt);
  nades.update(dt, simNow);
  tracers.update(dt);
  viewModel.update(dt);
  kickPitch *= Math.pow(0.0015, dt); // fast recoil recovery
  // match flow
  const prevAtk = M.score.atk, prevDef = M.score.def;
  const ev = updateMatch(M, actors, simNow);
  if (ev === 'live') ui.banner('ROUND LIVE', 'Ember Cell attacking', 1700);
  else if (ev === 'planted') { ui.banner('CHARGE PLANTED', 'Wardens must defuse', 2400); sfx('beep'); placeBombMesh(); }
  else if (ev === 'dropped') placeBombMesh();
  else if (ev === 'pickup') bombMesh.visible = false;
  else if (ev === 'roundend') {
    const won = (M.score.atk > prevAtk && player.team === 'atk') || (M.score.def > prevDef && player.team === 'def');
    if (M.lastReason === 'detonate') sfx('boom');
    ui.banner(won ? 'ROUND WON' : 'ROUND LOST', reasonText(M.lastReason, won), 2600);
  } else if (ev === 'nextround') resetRound();
  else if (ev === 'matchover') {
    const won = M.score[player.team] >= TIMING.winRounds;
    ui.showOverlay(won ? 'matchwin' : 'matchlose', { copy: `Final score — Ember Cell ${M.score.atk} : ${M.score.def} Wardens. Click to play again.` });
    if (document.pointerLockElement) document.exitPointerLock();
  }
  if (M.bombMode === 'planted') placeBombMesh();
}
const tmpBombPos = new THREE.Vector3();
function placeBombMesh() {
  if (!M.bombPos) return;
  bombMesh.position.set(M.bombPos.x, 0, M.bombPos.z);
  bombMesh.visible = true;
}
function reasonText(reason, won) {
  if (reason === 'elim') return won ? 'enemy team eliminated' : 'your team was eliminated';
  if (reason === 'detonate') return 'the charge detonated';
  if (reason === 'defuse') return 'the charge was defused';
  if (reason === 'time') return 'the clock ran out';
  return '';
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    ui.hideOverlay();
    if (buyShown) { ui.hideBuy(); buyShown = false; }
  } else if (started && !M.matchOver) {
    if (M.phase === 'buy') { ui.showBuy(player.money, ownedSet(player)); buyShown = true; }
    else ui.showOverlay('pause');
  }
}

// --- HUD ---
const nadesEl = document.getElementById('nades');
let lastNadesText = '';
function hud() {
  ui.setHealth(Math.max(0, Math.ceil(player.hp)));
  if (player.cur === 'knife') ui.setAmmo('—', '', 'knife');
  else ui.setAmmo(player.w.mag, player.w.reserve, player.cur);
  ui.setMoney(player.money);
  const target = M.bombMode === 'planted' ? M.bombEnd : M.phaseEnd;
  const s = Math.max(0, Math.ceil((target - simNow) / 1000));
  ui.setTimer(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, M.phase === 'live' && s <= 10);
  const phaseText = M.matchOver ? 'MATCH OVER' : M.phase === 'buy' ? 'BUY PHASE' : M.phase === 'over' ? 'ROUND OVER' : M.bombMode === 'planted' ? 'CHARGE PLANTED' : 'ROUND LIVE';
  ui.setScore(M.round, M.score.atk, M.score.def, phaseText);
  const bombLabel = document.getElementById('bomb-label');
  bombLabel.textContent =
    M.bombMode === 'carried' && M.carrier === player && M.phase === 'live' ? 'YOU CARRY THE CHARGE — HOLD E AT THE CRUCIBLE' :
    M.bombMode === 'dropped' ? 'CHARGE DROPPED' :
    M.bombMode === 'planted' ? 'CHARGE PLANTED — DEFEND THE CRUCIBLE' : '';
  const nt = `FLASH ×${player.nades.flash} (Q) · FRAG ×${player.nades.frag} (G)`;
  if (nt !== lastNadesText) { lastNadesText = nt; nadesEl.textContent = nt; }
  const flashA = Math.max(0, Math.min(1, (player.flashUntil - simNow) / 2500)) * 0.95;
  ui.setFlash(flashA.toFixed(3));
  if (M.channel) {
    const dur = M.channel.kind === 'plant' ? TIMING.plantMs : TIMING.defuseMs;
    ui.setChannel(1 - (M.channel.endAt - simNow) / dur, M.channel.kind === 'plant' ? 'PLANTING CHARGE' : 'DEFUSING CHARGE');
  } else ui.setChannel(-1);
  const spread = player.cur === 'knife' ? 0 : spreadFor(player.w, player.speedNow, player.crouch);
  ui.crosshairSpread((4 + spread * 650 + player.speedNow * 1.4).toFixed(1));
  const lamp = bombMesh.getObjectByName('lamp');
  if (lamp && M.bombMode === 'planted') lamp.visible = (simNow % 620) < 330;
}

function syncCamera() {
  eyeOf(player, tmpO);
  if (!player.alive) tmpO.y = player.pos.y + 0.7;
  camera.position.copy(tmpO);
  camera.rotation.set(pitch + kickPitch, yaw, 0, 'YXZ');
}

// --- frame loop ---
let last = performance.now(), acc = 0;
function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min((nowMs - last) / 1000, 0.1);
  last = nowMs;
  const look = input.takeLook();
  if (input.state.locked) {
    const scoped = input.state.rmb && player.cur === 'sniper';
    const sens = scoped ? 0.0009 : 0.0023;
    yaw -= look.x * sens;
    pitch = THREE.MathUtils.clamp(pitch - look.y * sens, -1.45, 1.45);
    camera.fov += ((scoped ? 28 : 74) - camera.fov) * Math.min(1, dt * 14);
    camera.updateProjectionMatrix();
    ui.setScope(scoped);
  }
  const p = input.pressed;
  if (p.has('KeyR') && player.alive) startReload(player.w, simNow);
  const primary = ['rifle', 'sniper', 'smg', 'shotgun'].find((key) => player.owned[key]);
  if (p.has('Digit1')) equip(player, 'knife');
  if (p.has('Digit2')) equip(player, 'pistol');
  if (p.has('Digit3') && primary) equip(player, primary);
  const wheel = input.takeWheel();
  if (wheel !== 0) {
    const owned = ['knife', 'pistol', primary].filter(Boolean);
    const next = owned[(owned.indexOf(player.cur) + wheel + owned.length) % owned.length];
    if (next) equip(player, next);
  }
  if (p.has('KeyB') && M.phase === 'buy' && !M.matchOver) {
    if (input.state.locked) document.exitPointerLock();
    else input.requestLock();
  }
  for (const [key, code] of [['flash', 'KeyQ'], ['frag', 'KeyG']]) {
    if (p.has(code) && player.nades[key] > 0 && player.alive && M.phase === 'live') {
      player.nades[key]--;
      eyeOf(player, tmpO);
      dirFromYawPitch(yaw, pitch, tmpD);
      nades.throwNade(key, tmpO.clone(), tmpD.clone(), 16);
      sfx('beep');
    }
  }
  p.clear();
  acc += dt;
  let guard = 0;
  while (acc >= FIXED && guard < 5) { step(FIXED); acc -= FIXED; guard++; }
  if (acc > FIXED * 5) acc = 0;
  syncCamera();
  hud();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- boot ---
resetRound();
equip(player, 'pistol');
if (shot) {
  // Deterministic screenshot setups: freeze a composed frame, render twice, signal ready.
  ui.hideOverlay();
  started = true;
  M.phase = 'live'; M.phaseEnd = simNow + TIMING.roundMs;
  const place = (a, x, z, y) => { a.pos.set(x, 0, z); a.yaw = y; syncBody(a); };
  if (shot === 'buy') {
    M.phase = 'buy'; M.phaseEnd = simNow + TIMING.buyMs;
    yaw = 0; pitch = -0.03;
    ui.showBuy(player.money, ownedSet(player));
  } else if (shot === 'site') {
    player.pos.set(-3.5, 0, -1.5);
    yaw = Math.atan2(-(0.5 - -3.5), -(-8 - -1.5)); pitch = -0.02;
    M.bombMode = 'planted'; M.bombPos = { x: 0.5, z: -8 }; M.bombEnd = simNow + 35000;
    placeBombMesh();
    place(actors[8], 7, -11, Math.atan2(-(0.5 - 7), -(-8 - -11)));
    place(actors[2], 2.5, -5.5, 2.6);
    place(actors[6], -7.5, -12.5, -0.8);
  } else { // cover | fire
    player.pos.set(0, 0, 11); yaw = 0; pitch = -0.02;
    place(actors[7], 1.2, 2, Math.PI);
    place(actors[5], -6, -4, 2.8);
    place(actors[1], -6, 3.5, 0.5);
    place(actors[3], 5.5, 7.5, -0.6);
    if (shot === 'fire') { player.aimTarget = actors[7]; performShot(player); ui.hitMarker(false); }
  }
  rebuildTargets();
  syncCamera();
  hud();
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
