// DOM user interface: captions, readout, distance bar, controls, about panel, idle hiding.
import { T, getLang, onLang, fmtDist, fmtLight, fmtMult, nf, fmtDate } from './i18n.js';
const $ = id => document.getElementById(id);
const AU_LY = 63241.077;

export class UI {
  constructor() {
    this.cap = null; this.capTimer = 0; this.mode = 'voyage'; this.idleT = 0; this.hidden = false;
    this.buildBar(); onLang(() => { this.renderCap(true); this.layoutBar(); this.buildButtons(); });
    addEventListener('resize', () => this.layoutBar());
    for (const ev of ['mousemove', 'keydown', 'pointerdown', 'wheel']) addEventListener(ev, () => { this.idleT = 0; });
  }
  progress(f, msg) { $('bar').firstElementChild.style.width = Math.round(f * 100) + '%'; $('loading').textContent = msg === 'ready' ? T('loadingDone') : T('loadingTxt'); }
  ready() { $('start').classList.add('ready'); this.progress(1, 'ready'); }
  hideStart() { $('start').style.opacity = 0; setTimeout(() => { $('start').style.display = 'none'; }, 1300); }
  fade(cb) { const f = $('fade'); f.style.transition = 'opacity .5s'; f.style.opacity = 1; setTimeout(() => { cb(); setTimeout(() => { f.style.transition = 'opacity 1.1s'; f.style.opacity = 0; }, 120); }, 520); }
  hint(key, ms = 6000) { const h = $('hint'); h.textContent = T(key); h.style.opacity = 1; clearTimeout(this.hintT); this.hintT = setTimeout(() => { h.style.opacity = 0; }, ms); }
  /* ---------- captions ---------- */
  setCaption(c) {
    this.cap = c; clearTimeout(this.capTimer); const box = $('cap');
    if (!c) { box.style.opacity = 0; return; }
    if (box.style.opacity === '0' || !box.style.opacity) { this.renderCap(); box.style.opacity = 1; return; }
    box.style.opacity = 0; this.capTimer = setTimeout(() => { this.renderCap(); box.style.opacity = 1; }, 450);
  }
  renderCap(live) {
    const c = this.cap; if (!c) return; if (live && $('cap').style.opacity === '0') return;
    $('capTitle').textContent = c.title ? T(c.title) : ''; $('capTitle').style.display = c.title ? '' : 'none'; $('capText').textContent = c.text();
  }
  /* ---------- readout ---------- */
  readout(distKm, speedKms, show) {
    const R = $('ro'); R.style.opacity = show ? 1 : 0; if (!show) return;
    if (this.roT == null || performance.now() - this.roT > 120) {
      this.roT = performance.now();
      $('roDist').textContent = `${T('ro.dist')}: ${fmtDist(distKm)}`; $('roLight').textContent = fmtLight(distKm);
      const c = speedKms / 299792.458; let sp = '';
      if (c >= 0.1) sp = T('ro.speedC', { x: fmtMult(c) }); else if (speedKms >= 1) sp = T('ro.speedKm', { x: nf(speedKms, speedKms < 10 ? 1 : 0) }); else sp = '';
      $('roSpeed').textContent = sp;
    }
  }
  /* ---------- distance bar (logarithmic, 0.3 AU .. 150 000 AU) ---------- */
  buildBar() {
    const lo = 0.3, hi = 150000; this.pos = au => Math.max(0, Math.min(1, Math.log(au / lo) / Math.log(hi / lo)));
    this.ticks = [['mercury', 0.387, 'names.mercury', 3], ['venus', 0.723, 'names.venus', 3], ['earth', 1, 'names.earth', 9], ['mars', 1.524, 'names.mars', 4], ['jupiter', 5.203, 'names.jupiter', 8], ['saturn', 9.537, 'names.saturn', 7],
      ['uranus', 19.19, 'names.uranus', 5], ['neptune', 30.07, 'names.neptune', 8], ['helio', 120, 'bar.helio', 9], ['ly', AU_LY, 'bar.ly', 9]];
    this.bands = [['belt', 2.2, 3.2, 'bar.belt', 2], ['kuiper', 30, 50, 'bar.kuiper', 6], ['oort', 2000, 100000, 'bar.oort', 9]];
    const track = $('barTrack'); track.innerHTML = '';
    this.els = [];
    for (const [id, a, b, key] of this.bands) { const e = document.createElement('div'); e.className = 'band'; e.style.left = this.pos(a) * 100 + '%'; e.style.width = (this.pos(b) - this.pos(a)) * 100 + '%'; track.appendChild(e); }
    for (const t of this.ticks) { const e = document.createElement('div'); e.className = 'tick'; e.style.left = this.pos(t[1]) * 100 + '%'; track.appendChild(e); }
    this.labelEls = []; this.marker = document.createElement('div'); this.marker.className = 'marker'; track.appendChild(this.marker);
    this.layoutBar();
  }
  layoutBar() {
    const track = $('barTrack'); this.labelEls.forEach(e => e.remove()); this.labelEls = [];
    const W = track.clientWidth || 600, items = [...this.ticks.map(t => ({ x: this.pos(t[1]), key: t[2], p: t[3] })), ...this.bands.map(b => ({ x: (this.pos(b[1]) + this.pos(b[2])) / 2, key: b[3], p: b[4] }))].sort((a, b) => b.p - a.p);
    const placed = [[], []];
    for (const it of items) {
      const txt = T(it.key), w = txt.length * 5.8 + 10, x0 = it.x * W - w / 2, x1 = x0 + w;
      for (let row = 0; row < 2; row++) {
        if (placed[row].every(r => x1 < r[0] - 2 || x0 > r[1] + 2)) {
          placed[row].push([x0, x1]); const e = document.createElement('div'); e.className = 'tl' + (row ? ' low' : ''); e.textContent = txt; e.style.left = it.x * 100 + '%'; track.appendChild(e); this.labelEls.push(e); break;
        }
      }
    }
  }
  bar(distKm) { this.marker.style.left = this.pos(distKm / 149597870.7) * 100 + '%'; }
  /* ---------- buttons / state ---------- */
  buildButtons() {
    const c = $('ctl'); c.innerHTML = '';
    const mk = (txt, title, fn, cls = '') => { const b = document.createElement('button'); b.textContent = txt; b.title = title; b.className = cls; b.addEventListener('click', e => { e.stopPropagation(); fn(); b.blur(); }); c.appendChild(b); return b; };
    this.btn = {};
    if (this.mode === 'voyage') {
      mk('‹', T('bPrev'), () => this.cb.prev()); this.btn.pause = mk(this.paused ? '▶' : '❚❚', T(this.paused ? 'bPlay' : 'bPause'), () => this.cb.pause()); mk('›', T('bNext'), () => this.cb.next()); mk(T('bFree'), T('bFree'), () => this.cb.free(), 'wide');
    } else {
      for (const n of ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']) mk(T('names.' + n).replace(/^The /, ''), '', () => this.cb.goto(n), 'wide');
      mk(T('bVoyage'), T('bVoyage'), () => this.cb.voyage(), 'wide go');
    }
  }
  setMode(m) { this.mode = m; this.buildButtons(); document.body.dataset.mode = m; }
  setPaused(p) { this.paused = p; this.buildButtons(); $('state').textContent = p ? T('paused') : ''; }
  setTime(rate, jd) { $('time').textContent = rate === 1 ? '' : `${T('time.' + ['x', '86400', '2592000', '31557600'].indexOf(String(rate)))} · ${fmtDate(jd)}`; }
  tick(dt, flightActive) {
    this.idleT += dt; const idle = this.idleT > 6; document.body.classList.toggle('idle', idle && this.mode === 'flight'); document.body.classList.toggle('idlectl', idle);
  }
  /* ---------- about ---------- */
  async about() {
    const p = $('about'); p.style.display = 'flex'; const body = $('aboutBody');
    if (!this.credits) {
      try { const r = await fetch('assets/CREDITS.md'); this.credits = r.ok ? await r.text() : null; } catch (e) { this.credits = null; }
    }
    body.textContent = ''; if (!this.credits) { body.textContent = T('aboutMissing'); return; }
    for (const line of this.credits.split('\n')) {
      const d = document.createElement('div'); const h = line.match(/^#+\s*(.*)/);
      d.textContent = (h ? h[1] : line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)').replace(/[*_`]/g, '')); if (h) d.className = 'h'; if (!line.trim()) d.style.height = '.6em'; body.appendChild(d);
    }
  }
}
