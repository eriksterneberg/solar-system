// The Voyage: a guided autopilot from the Sun out past the Oort cloud, plus the shared "exponential travel" used by free flight.
// Travel law: d(pos)/dt = k * min(distance from where we left (+sA), distance to where we are going (+sB)):
// the speed grows exponentially while leaving and shrinks exponentially while arriving, so a leg takes about the same time at any scale.
import { T, fmtDur, fmtLeg, nf } from './i18n.js';
import { radec, eqToWorld, BODY } from './astro.js';

export const K_DEFAULT = 1.45;

/* ---------- helpers shared with free flight ---------- */
export function clampOut(api, pos, margin = 1.05) {
  for (const b of api.bodies.list) {
    const d = pos.distanceTo(b.pos), m = b.r * margin;
    if (d < m) { if (d < 1e-6) pos.set(b.pos.x + m, b.pos.y, b.pos.z); else pos.sub(b.pos).multiplyScalar(m / d).add(b.pos); }
  }
}
// camera offset (km) from a body so that it is lit as a gibbous disc/crescent: phase angle alpha from the Sun direction, slightly above the ecliptic
export function frameRel(api, name, mult, alphaDeg = 55, elevDeg = 8) {
  const THREE = api.THREE, b = api.bodies.byName[name], Y = new THREE.Vector3(0, 1, 0);
  const u = name === 'sun' ? api.bodies.byName.earth.pos.clone().normalize() : b.pos.clone().normalize();
  if (name === 'sun') return u.addScaledVector(Y, 0.12).normalize().multiplyScalar(b.r * mult);
  const t = new THREE.Vector3().crossVectors(Y, u).normalize(), a = alphaDeg * Math.PI / 180;
  const c = u.clone().multiplyScalar(-Math.cos(a)).addScaledVector(t, Math.sin(a)).addScaledVector(Y, Math.tan(elevDeg * Math.PI / 180)).normalize();
  return c.multiplyScalar(b.r * mult);
}

export class Leg {
  // A: start (km), destFn: () => live destination (km), sA/sB: softening distances (km), k: 1/s growth rate
  constructor(api, A, destFn, sA, sB, k = K_DEFAULT) {
    const THREE = api.THREE; this.A = A.clone(); this.destFn = destFn; this.sA = sA; this.sB = sB; this.k = k; this.s = 0; this.t = 0; this.done = false;
    const B = destFn(); this.L = Math.max(A.distanceTo(B), 1); this.dir = new THREE.Vector3().subVectors(B, A).normalize(); this.vel = new THREE.Vector3(); this.off = new THREE.Vector3();
    this.tmp = new THREE.Vector3(); this.pos = A.clone();
    // keep clear of the Sun: if the straight line passes too close, bend it upward (a parabola, peak at the middle)
    const AU = api.AU, clr = Math.min(0.06 * AU, 0.9 * Math.min(A.length(), B.length())), Y = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3();
    const minD = off => { let m = Infinity; for (let i = 0; i <= 80; i++) { const u = i / 80; p.lerpVectors(A, B, u).addScaledVector(off, 4 * u * (1 - u)); m = Math.min(m, p.length()); } return m; };
    if (minD(this.off) < clr) { for (let m = 0.05; m < 400; m *= 1.6) { this.off.copy(Y).multiplyScalar(m * AU); if (minD(this.off) >= clr) break; } }
    this.T = this.estimate();
  }
  estimate() { let s = 0, t = 0; const h = 1 / 30; while (s < this.L && t < 3600) { s += this.k * Math.min(s + this.sA, this.L - s + this.sB) * h; t += h; } return t; }
  step(dt) {
    let rem = dt, last = 0;
    while (rem > 1e-9 && !this.done) {
      const h = Math.min(rem, 1 / 120); rem -= h; const ds = this.k * Math.min(this.s + this.sA, this.L - this.s + this.sB) * h; last = ds / h; this.s += ds; this.t += h;
      if (this.s >= this.L) { this.s = this.L; this.done = true; }
    }
    const u = this.s / this.L, B = this.destFn();
    this.pos.lerpVectors(this.A, B, u).addScaledVector(this.off, 4 * u * (1 - u));
    this.vel.copy(this.dir).multiplyScalar(this.done ? this.k * this.sB : last);
    return this.pos;
  }
}

/* ---------- stops ---------- */
const AUKM = 149597870.7;
// mult: distance from the body's centre in radii. s: softening distance for points (km). dwell: seconds.
const BODY_STOPS = [
  { id: 'sun', body: 'sun', mult: 10, dwell: 11 },
  { id: 'mercury', body: 'mercury', mult: 4.5, dwell: 11 },
  { id: 'venus', body: 'venus', mult: 4.5, dwell: 11 },
  { id: 'earth', body: 'earth', mult: 5, dwell: 15, dolly: true },
  { id: 'mars', body: 'mars', mult: 4.5, dwell: 11 },
  { id: 'belt', point: true, s: 0.02 * AUKM, dwell: 12 },
  { id: 'jupiter', body: 'jupiter', mult: 5, dwell: 11 },
  { id: 'saturn', body: 'saturn', mult: 6.5, elev: 14, dwell: 13 },
  { id: 'uranus', body: 'uranus', mult: 5, dwell: 10 },
  { id: 'neptune', body: 'neptune', mult: 5, dwell: 10 },
  { id: 'pluto', body: 'pluto', mult: 5, dwell: 10 },
  { id: 'kuiper', point: true, s: 0.4 * AUKM, dwell: 14 },
  { id: 'helio', point: true, s: 0.2 * AUKM, dwell: 15 },
  { id: 'oort1', point: true, s: 5 * AUKM, dwell: 15 },
  { id: 'oort2', point: true, s: 100 * AUKM, dwell: 14 },
  { id: 'back', point: true, s: 200 * AUKM, dwell: Infinity }
];

export class Voyage {
  constructor(api, hooks = {}, craft = []) {
    const THREE = this.THREE = api.THREE; this.api = api; this.hooks = hooks; this.k = +(new URLSearchParams(location.search).get('k')) || K_DEFAULT;
    this.stops = BODY_STOPS.map(s => ({ ...s })); this.idx = Object.fromEntries(this.stops.map((s, i) => [s.id, i]));
    this.phase = 'idle'; this.i = 0; this.j = 0; this.t = 0; this.clock = 0; this.paused = false; this.speed = 0; this.maxSpeed = 0; this.log = [];
    this.autoDir = new THREE.Vector3(0, 0, -1); this.offYaw = 0; this.offPitch = 0; this.idle = 99; this.leg = null; this.carry = new THREE.Vector3(); this.carryV = new THREE.Vector3();
    this.dest = new THREE.Vector3(); this.tmp = new THREE.Vector3(); this.tmp2 = new THREE.Vector3(); this.Y = new THREE.Vector3(0, 1, 0); this.prev = api.view.pos.clone();
    this.belt = { asteroids: 0, kuiper: 0, oort: 0 }; this.capShown = -1; this.cmpShown = false; this.forcing = false;
    const B = api.bodies.byName, AU = api.AU;
    // Voyager 1: from JPL data if present
    const v1 = craft.find(c => c.name === 'Voyager 1');
    this.v1 = v1 ? new THREE.Vector3(v1.xyz_au[0], v1.xyz_au[2], -v1.xyz_au[1]).multiplyScalar(AU) : eqToWorld(radec(258.25, 12)).normalize().multiplyScalar(170 * AU);
    const dV = this.v1.clone().normalize(), S = this.idx;
    const P = (id, pos, look, extra = {}) => Object.assign(this.stops[S[id]], { pos, look, ...extra });
    // asteroid belt: above the plane, inside the belt, looking along it
    const mj = B.mars.pos.clone().setY(0).normalize().add(B.jupiter.pos.clone().setY(0).normalize()); if (mj.length() < 0.4) mj.copy(B.jupiter.pos).setY(0); mj.normalize();
    const bp = mj.clone().multiplyScalar(2.0 * AU).addScaledVector(this.Y, 0.42 * AU), bl = mj.clone().applyAxisAngle(this.Y, -0.55).multiplyScalar(3.0 * AU);
    P('belt', bp, bl, { drift: bl.clone().sub(bp).normalize().multiplyScalar(0.0006 * AU) });
    P('kuiper', dV.clone().multiplyScalar(85 * AU), new THREE.Vector3(0, 0, 0));
    P('helio', this.v1.clone().addScaledVector(dV, -3 * AU).addScaledVector(this.Y, 0.35 * AU), this.v1.clone());
    P('oort1', dV.clone().multiplyScalar(2000 * AU), dV.clone().multiplyScalar(2000 * AU).addScaledVector(dV, 5000 * AU).addScaledVector(this.Y, -900 * AU));
    P('oort2', dV.clone().multiplyScalar(100000 * AU), dV.clone().multiplyScalar(200000 * AU));
    P('back', dV.clone().multiplyScalar(150000 * AU), new THREE.Vector3(0, 0, 0));
    for (const s of this.stops) if (!s.point) { s.rel = this.relFor(s); s.s = 0.05 * s.rel.length(); }
  }
  relFor(s) {
    if (s.dolly) return this.earthRel(0);
    return frameRel(this.api, s.body, s.mult, 55, s.elev ?? 8);
  }
  // Earth + Moon: begin close to Earth, pull back until both are in view
  earthRel(e) {
    const B = this.api.bodies.byName, THREE = this.THREE, m = new THREE.Vector3().subVectors(B.moon.pos, B.earth.pos), md = m.length();
    const sun = B.earth.pos.clone().negate().normalize();
    const c = new THREE.Vector3().crossVectors(m.normalize(), this.Y).normalize(); if (c.dot(sun) < 0) c.negate();
    c.multiplyScalar(0.8).addScaledVector(sun, 0.5).addScaledVector(this.Y, 0.12).normalize();
    const v = this.api.view, asp = innerWidth / innerHeight, halfH = Math.tan(v.fov * Math.PI / 360), halfW = Math.atan(halfH * asp);
    const d0 = B.earth.r * 5, d1 = Math.max(md * 0.5 / Math.tan(0.82 * halfW), 150000), k = e * e * (3 - 2 * e);
    return c.multiplyScalar(d0 * Math.pow(d1 / d0, k));
  }
  // ---- geometry of a stop at local time t ----
  anchor(s) { return s.point ? null : this.api.bodies.byName[s.body].pos; }
  basePos(s, t, out) {
    if (s.point) { out.copy(s.pos); if (s.drift) out.addScaledVector(s.drift, t); return out; }
    const b = this.api.bodies.byName[s.body];
    if (s.dolly) return out.copy(b.pos).add(this.earthRel(smooth(0.1, 0.92, t / s.dwell)));
    const rel = s.rel.clone().applyAxisAngle(this.Y, 0.035 * t).multiplyScalar(1 - 0.07 * Math.min(1, t / s.dwell));
    return out.copy(b.pos).add(rel);
  }
  lookTarget(s, t, out) {
    if (s.point) return out.copy(s.look);
    const B = this.api.bodies.byName, b = B[s.body]; out.copy(b.pos);
    if (s.dolly) out.lerp(B.moon.pos, 0.58 * smooth(0.1, 0.92, t / s.dwell));
    return out;
  }
  arrival(i, out) { return this.basePos(this.stops[i], 0, out); }

  /* ---------- control ---------- */
  // jump straight into stop i (used by skipping, restart and screenshots)
  enter(i, quiet = false) {
    const s = this.stops[i], v = this.api.view; this.i = i; this.phase = 'dwell'; this.t = 0; this.capShown = -1; this.leg = null; this.carry.set(0, 0, 0); this.carryV.set(0, 0, 0);
    this.basePos(s, 0, v.pos); this.lookTarget(s, 0, this.tmp); this.autoDir.subVectors(this.tmp, v.pos).normalize(); this.offYaw = this.offPitch = 0;
    this.applyView(); this.prev.copy(v.pos); this.speed = 0;
    v.exposure = Math.min(Math.max(v.adaptTarget || 1, 0.004), 45);
    if (this.hooks.onStop) this.hooks.onStop(i, s);
    if (!quiet && this.hooks.chime) this.hooks.chime();
  }
  // a quiet backdrop for the title screen: Earth with its dolly paused at the beginning
  backdrop() { this.enter(this.idx.earth, true); this.phase = 'idle'; this.offPitch = 0.3; this.hooks.caption && this.hooks.caption(null); }
  begin() { this.paused = false; this.clock = 0; this.log = []; this.maxSpeed = 0; this.enter(0); }
  startLeg(j) {
    const s = this.stops[this.i], d = this.stops[j], v = this.api.view, api = this.api, B = api.bodies.byName;
    const sA = s.point ? s.s : Math.max(0.05 * v.pos.distanceTo(B[s.body].pos), 1);
    this.leg = new Leg(api, v.pos, this.destFn(d), sA, d.s, this.k);
    this.j = j; this.phase = 'leg'; this.t = 0; this.cmpShown = false; this.legStart = this.clock; this.legMax = 0; this.capShown = 99;
    this.legLen = this.leg.L; this.legSrc = this.i;
    if (this.hooks.onLeg) this.hooks.onLeg(this.i, j);
  }
  destFn(d) { return d.point ? () => d.pos : () => this.basePos(d, 0, this.dest); }
  next() {
    if (this.phase === 'leg') return this.fadeTo(() => this.enter(this.j));
    if (this.phase === 'dwell' && this.i < this.stops.length - 1) this.startLeg(this.i + 1);
  }
  prev() {
    if (this.phase === 'leg') return this.fadeTo(() => this.enter(this.i));
    if (this.phase === 'dwell') this.fadeTo(() => this.enter(Math.max(0, this.i - 1)));
  }
  fadeTo(cb) { this.hooks.fade ? this.hooks.fade(cb) : cb(); }
  togglePause() { this.paused = !this.paused; return this.paused; }
  // resume from free flight: fly to the nearest stop, then carry on
  resumeFrom(pos) {
    let best = 0, bd = Infinity; const o = new this.THREE.Vector3();
    this.stops.forEach((s, i) => { const d = this.arrival(i, o).distanceTo(pos); if (d < bd) { bd = d; best = i; } });
    this.paused = false; const d = this.stops[best], v = this.api.view, sB = d.s ?? 0.05 * d.rel.length();
    if (bd < 3 * (d.point ? d.s * 40 : d.rel.length())) { this.fadeTo(() => this.enter(best, true)); return best; }
    const sA = Math.max(0.05 * this.api.nearest().dist, 1);
    this.leg = new Leg(this.api, v.pos, this.destFn(d), sA, sB, this.k);
    this.i = best; this.j = best; this.phase = 'leg'; this.t = 0; this.cmpShown = true; this.legStart = this.clock; this.legMax = 0; this.legSrc = -1; this.capShown = 99; this.carryV.set(0, 0, 0);
    this.hooks.caption && this.hooks.caption(null);
    return best;
  }
  stopWithView() { this.phase = 'idle'; }
  drag(dx, dy) { const v = this.api.view, k = 0.0026 * v.fov / 55; this.offYaw -= dx * k; this.offPitch = Math.max(-1.3, Math.min(1.3, this.offPitch - dy * k)); this.idle = 0; }

  /* ---------- per-frame ---------- */
  update(dt) {
    const api = this.api, v = api.view; const mdt = this.paused ? 0 : dt; this.idle += dt;
    if (this.phase === 'dwell' || this.phase === 'idle') this.updDwell(mdt);
    else if (this.phase === 'leg') this.updLeg(mdt);
    clampOut(api, v.pos);
    this.updLook(dt); this.updBelts(dt);
    if (mdt > 0) { const sp = v.pos.distanceTo(this.prev) / mdt; this.speed += (sp - this.speed) * (1 - Math.exp(-mdt / 0.35)); } else if (this.paused) this.speed *= Math.exp(-dt * 4);
    if (this.phase !== 'idle') this.maxSpeed = Math.max(this.maxSpeed, this.speed);
    if (this.phase === 'leg') this.legMax = Math.max(this.legMax, this.speed);
    this.prev.copy(v.pos); this.clock += mdt;
  }
  updDwell(dt) {
    const s = this.stops[this.i], v = this.api.view; this.t = this.phase === 'idle' ? 0 : this.t + dt;
    const tau = 2; const c = tau * (1 - Math.exp(-this.t / tau)); this.carry.copy(this.carryV).multiplyScalar(c);
    this.basePos(s, this.t, v.pos).add(this.carry);
    if (this.phase !== 'dwell') return;
    // captions: part 1 at once, part 2 about halfway
    const parts = this.parts(s), n = parts.length, tt = this.t;
    let want = 0; for (let q = 0; q < n; q++) if (tt >= parts[q].at) want = q;
    if (want !== this.capShown) { this.capShown = want; this.hooks.caption && this.hooks.caption({ title: s.id === 'back' ? null : 'names.' + s.id, text: () => parts[want].text() }); }
    if (this.t >= s.dwell && this.i < this.stops.length - 1) this.startLeg(this.i + 1);
  }
  parts(s) {
    if (s.parts) return s.parts;
    const id = s.id, caps = T('cap.' + id), d = s.dwell, mk = (idx, at) => ({ at, text: () => this.fill(id, idx) });
    if (id === 'back') s.parts = [mk(0, 0), mk(1, 8), { at: 20, text: () => T('cap.backEnd').join(' ') }];
    else s.parts = caps.map((_, q) => mk(q, q === 0 ? 0 : d * 0.5));
    return s.parts;
  }
  fill(id, idx) {
    const raw = T('cap.' + id)[idx], B = this.api.bodies.byName, dist = this.api.view.pos.length();
    return raw.replace('{lt}', () => fmtDur(B.pluto.pos.length() / this.api.C_KMS)).replace('{ly}', () => nf(dist / this.api.AU / 63241.077, 1));
  }
  updLeg(dt) {
    const leg = this.leg, v = this.api.view; if (!leg) return;
    leg.step(dt); v.pos.copy(leg.pos); this.t += dt;
    // one comparison caption per leg
    if (!this.cmpShown && this.t >= (this.legSrc === 0 ? 1.5 : 2.5)) {
      this.cmpShown = true;
      if (leg.T >= 8) { const txt = this.legSrc === 0 ? () => T('leg.au') : this.compareText(leg.L); this.hooks.caption && this.hooks.caption({ title: null, text: txt }); }
    }
    if (leg.done) {
      const j = this.j; this.i = j; this.log.push({ from: this.legSrc, to: j, t: this.clock - this.legStart, max: this.legMax });
      this.phase = 'dwell'; this.t = 0; this.capShown = -1; this.carryV.copy(leg.vel); this.leg = null;
      if (this.hooks.onStop) this.hooks.onStop(j, this.stops[j]); if (this.hooks.chime) this.hooks.chime();
    }
  }
  compareText(L) {
    const au = L / AUKM, a = this.stops[this.legSrc], b = this.stops[this.j];
    const t = { car: L / 100 * 3600, jet: L / 900 * 3600, voy: L / 17, light: L / this.api.C_KMS };
    const pick = au < 2 ? ['car', 'light'] : au < 40 ? ['jet', 'voy'] : ['voy', 'light'];
    return () => [T('leg.head', { a: T('inl.' + a.id), b: T('inl.' + b.id), d: fmtLeg(L) }), ...pick.map(k => T('leg.' + k, { t: fmtDur(t[k]) }))].join(' ');
  }
  /* ---------- look direction ---------- */
  desired(out) {
    const s = this.stops[this.phase === 'leg' ? this.j : this.i], v = this.api.view;
    this.lookTarget(s, this.phase === 'leg' ? 0 : this.t, this.tmp); out.subVectors(this.tmp, v.pos); if (out.lengthSq() < 1e-6) return false; out.normalize(); return true;
  }
  updLook(dt) {
    const d = this.tmp2; if (this.desired(d)) {
      const cur = this.autoDir, ang = Math.acos(Math.max(-1, Math.min(1, cur.dot(d))));
      if (ang > 1e-6) {
        const step = Math.min(ang * (1 - Math.exp(-dt / 0.7)), 2.6 * dt); const ax = new this.THREE.Vector3().crossVectors(cur, d);
        if (ax.lengthSq() < 1e-12) ax.set(0, 1, 0); cur.applyAxisAngle(ax.normalize(), step).normalize();
      }
    }
    if (this.idle > 4 && this.phase !== 'idle') { const k = Math.exp(-dt / 0.8); this.offYaw *= k; this.offPitch *= k; }
    this.applyView();
  }
  applyView() { const v = this.api.view, d = this.autoDir; v.yaw = Math.atan2(-d.x, -d.z) + this.offYaw; v.pitch = Math.max(-1.5, Math.min(1.5, Math.asin(Math.max(-1, Math.min(1, d.y))) + this.offPitch + (this.phase === 'idle' ? 0 : -0.07))); }

  /* ---------- belts: markers only where the caption talks about them ---------- */
  updBelts(dt) {
    const f = this.api.beltsVis, I = this.idx, ph = this.phase, a = ph === 'leg' ? this.legSrc : this.i, b = ph === 'leg' ? this.j : this.i, au = this.api.view.pos.length() / this.api.AU;
    const astNear = ph === 'leg' ? ((a === I.mars && b === I.belt) || (a === I.belt && b === I.jupiter)) : this.i === I.belt;
    const kui = ph === 'leg' ? (a >= I.neptune && b <= I.helio) : (this.i >= I.pluto && this.i <= I.helio);
    void au;
    const tgt = { asteroids: astNear ? 1 : 0, kuiper: kui ? 1 : 0, oort: smooth(600, 1500, au) * (this.stops[this.i] && this.stops[this.i].id === 'back' && this.phase === 'dwell' ? 0.35 : 1) };   // final scene: let the Sun be the one light
    const o = this.belt; for (const k in tgt) { const r = k === 'oort' ? 1 : 0.5; o[k] += Math.max(-r * dt, Math.min(r * dt, tgt[k] - o[k])); }
    this.hideOrbits = astNear;
    f.force = { asteroids: o.asteroids, kuiper: o.kuiper, oort: o.oort }; this.forcing = true;
  }
  release() { this.api.beltsVis.force = null; this.forcing = false; }
}
export function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
