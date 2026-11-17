// Free flight: mouse look, WASD/QE, automatic base speed (0.6 x distance to the nearest surface per second), and fly-to with exponential travel.
import { Leg, clampOut, frameRel } from './voyage.js';

const ORDER = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
export class Flight {
  constructor(api, canvas, hooks = {}) {
    const THREE = this.THREE = api.THREE; this.api = api; this.canvas = canvas; this.hooks = hooks; this.active = false;
    this.keys = new Set(); this.mul = 1; this.vel = new THREE.Vector3(); this.leg = null; this.target = null; this.speed = 0; this.prev = new THREE.Vector3();
    this.nolock = new URLSearchParams(location.search).get('nolock') === '1'; this.dragging = false; this.locked = false;
    this.tmp = new THREE.Vector3(); this.Y = new THREE.Vector3(0, 1, 0);
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    canvas.addEventListener('click', () => { if (this.active && !this.nolock && !this.locked && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } } });
    canvas.addEventListener('pointerdown', e => { if (this.active) this.dragging = true; });
    addEventListener('pointerup', () => { this.dragging = false; });
    addEventListener('mousemove', e => { if (this.active && (this.locked || this.dragging)) this.look(e.movementX, e.movementY); });
    addEventListener('wheel', e => { if (!this.active) return; this.mul = Math.min(100, Math.max(0.1, this.mul * Math.pow(1.12, -Math.sign(e.deltaY)))); this.hooks.speedChanged && this.hooks.speedChanged(this.mul); }, { passive: true });
  }
  look(dx, dy) { const v = this.api.view, k = 0.0022 * v.fov / 55; v.yaw -= dx * k; v.pitch = Math.max(-1.52, Math.min(1.52, v.pitch - dy * k)); this.leg = null; }
  start() { this.active = true; this.vel.set(0, 0, 0); this.leg = null; this.prev.copy(this.api.view.pos); this.api.beltsVis.force = null; }
  stop() { this.active = false; this.keys.clear(); this.leg = null; if (document.pointerLockElement) document.exitPointerLock(); }
  key(code, down) { if (down) this.keys.add(code); else this.keys.delete(code); }
  // fly to a planet (or the Sun) with the same exponential travel as the voyage
  flyTo(name) {
    const api = this.api, b = api.bodies.byName[name]; if (!b) return;
    const rel = frameRel(api, name, name === 'sun' ? 10 : name === 'saturn' ? 7.5 : 5, 55, name === 'saturn' ? 14 : 8), v = api.view;
    const sA = Math.max(api.nearest().dist * 0.5, 100), sB = 0.05 * rel.length(), o = new this.THREE.Vector3();
    this.target = b; this.leg = new Leg(api, v.pos, () => o.copy(b.pos).add(rel), sA, sB, 0.8); this.vel.set(0, 0, 0);
  }
  update(dt) {
    if (!this.active) return; const api = this.api, v = api.view, K = this.keys;
    if (this.leg) {
      if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE'].some(c => K.has(c))) this.leg = null;
      else {
        this.leg.step(dt); v.pos.copy(this.leg.pos);
        const d = this.tmp.subVectors(this.target.pos, v.pos); if (d.lengthSq() > 0) { d.normalize(); const ty = Math.atan2(-d.x, -d.z), tp = Math.asin(d.y); let dy = ty - v.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); const f = 1 - Math.exp(-dt / 0.6); v.yaw += dy * f; v.pitch += (tp - v.pitch) * f; }
        if (this.leg.done) this.leg = null;
      }
    }
    if (!this.leg) {
      const f = api.dirOf(v.yaw, v.pitch), r = new this.THREE.Vector3().crossVectors(f, this.Y).normalize(), mv = new this.THREE.Vector3();
      if (K.has('KeyW')) mv.add(f); if (K.has('KeyS')) mv.sub(f); if (K.has('KeyD')) mv.add(r); if (K.has('KeyA')) mv.sub(r); if (K.has('KeyE')) mv.add(this.Y); if (K.has('KeyQ')) mv.sub(this.Y);
      const base = Math.max(1, 0.6 * api.nearest().dist), boost = K.has('ShiftLeft') || K.has('ShiftRight') ? 10 : 1;
      if (mv.lengthSq() > 0) mv.normalize().multiplyScalar(base * boost * this.mul);
      this.vel.lerp(mv, 1 - Math.exp(-dt / 0.3)); v.pos.addScaledVector(this.vel, dt);
    }
    clampOut(api, v.pos);
    if (dt > 0) { const sp = v.pos.distanceTo(this.prev) / dt; this.speed += (sp - this.speed) * (1 - Math.exp(-dt / 0.3)); } this.prev.copy(v.pos);
  }
  static order() { return ORDER; }
}
