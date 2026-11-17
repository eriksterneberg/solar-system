// HTML labels for bodies and spacecraft, projected to screen. Names follow the current language.
import { T } from './i18n.js';

export class Labels {
  constructor(api, container, craft) {
    this.api = api; this.el = container; this.on = true; this.items = [];
    const THREE = api.THREE; this.THREE = THREE; this.rel = new THREE.Vector3(); this.f = new THREE.Vector3(); this.r = new THREE.Vector3(); this.u = new THREE.Vector3(); this.Y = new THREE.Vector3(0, 1, 0);
    const add = (id, name, getPos, radius, craftItem) => {
      const e = document.createElement('div'); e.className = 'lbl' + (craftItem ? ' craft' : ''); e.style.display = 'none';
      if (craftItem) { const ring = document.createElement('i'); e.appendChild(ring); }
      const s = document.createElement('span'); e.appendChild(s); container.appendChild(e);
      this.items.push({ id, name, getPos, radius, e, s, craft: !!craftItem, shown: false, txt: '' });
    };
    for (const n of ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']) { const b = api.bodies.byName[n]; add(n, 'names.' + n, () => b.pos, b.r); }
    for (const c of craft || []) { const p = new THREE.Vector3(c.xyz_au[0], c.xyz_au[2], -c.xyz_au[1]).multiplyScalar(api.AU); add(c.name, 'sc.' + c.name, () => p, 0, true); }
    this.earthIt = this.items.find(i => i.id === 'earth');
  }
  toggle() { this.on = !this.on; this.el.style.display = this.on ? '' : 'none'; return this.on; }
  refresh() { for (const it of this.items) it.txt = ''; }
  update() {
    if (!this.on) return;
    const { view, THREE } = this.api, W = innerWidth, H = innerHeight, tanH = Math.tan(view.fov * Math.PI / 360), pxRad = H / (2 * tanH);
    const f = this.api.dirOf(view.yaw, view.pitch), r = this.r.crossVectors(f, this.Y).normalize(), u = this.u.crossVectors(r, f);
    const occ = [];
    for (const it of this.items) { if (!it.radius) continue; const rel = this.rel.subVectors(it.getPos(), view.pos), z = rel.dot(f), d = rel.length(); if (z <= 0) continue; const px = Math.atan(it.radius / d) * pxRad; if (px > 4) occ.push({ it, d, px, x: W / 2 + rel.dot(r) / z * pxRad, y: H / 2 - rel.dot(u) / z * pxRad }); }
    const placed = [];   // de-clutter: a label never sits within 16 px of an earlier (higher-priority) one; the Sun is first
    for (const it of this.items) {
      const rel = this.rel.subVectors(it.getPos(), view.pos), d = rel.length(), z = rel.dot(f);
      let ok = z > 0 && d > 0;
      let x = 0, y = 0;
      if (ok) {
        x = W / 2 + rel.dot(r) / z * pxRad; y = H / 2 - rel.dot(u) / z * pxRad;
        const discPx = it.radius ? Math.atan(it.radius / d) * pxRad : 0;
        for (const o of occ) if (o.it !== it && o.d < d && Math.hypot(o.x - x, o.y - y) < o.px) ok = false;
        ok = ok && discPx < 40 && x > -20 && x < W + 20 && y > -20 && y < H + 20;
        if (ok && it.id === 'moon') { const e = this.earthIt, pe = this.rel.subVectors(e.getPos(), view.pos), ze = pe.dot(f); if (ze > 0) { const ex = W / 2 + pe.dot(r) / ze * pxRad, ey = H / 2 - pe.dot(u) / ze * pxRad; if (Math.hypot(ex - x, ey - y) < 26) ok = false; } }
      }
      if (ok) { if (placed.some(p => Math.hypot(p[0] - x, p[1] - y) < 16)) ok = false; else placed.push([x, y]); }
      if (ok !== it.shown) { it.shown = ok; it.e.style.display = ok ? '' : 'none'; }
      if (!ok) continue;
      it.e.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
      const txt = T(it.name); if (txt !== it.txt) { it.txt = txt; it.s.textContent = txt; }
    }
  }
}
