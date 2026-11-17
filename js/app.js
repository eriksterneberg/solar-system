// Application: wires the engine, the voyage, free flight, labels, audio and the UI together.
import { boot } from './main.js';
import { setLang, getLang, onLang } from './i18n.js';
import { UI } from './ui.js';
import { Voyage } from './voyage.js';
import { Flight } from './flight.js';
import { Labels } from './labels.js';
import { Audio } from './audio.js';

const $ = id => document.getElementById(id);
const RATES = [1, 86400, 2592000, 31557600];
const ui = new UI();
setLang(getLang(), false);
$('lang').addEventListener('click', e => { e.stopPropagation(); if (e.target.dataset.lang) setLang(e.target.dataset.lang); });
$('lang2').addEventListener('click', e => { e.stopPropagation(); if (e.target.dataset.lang) setLang(e.target.dataset.lang); });
for (const id of ['aboutBtn', 'aboutBtn0']) $(id).addEventListener('click', e => { e.stopPropagation(); ui.about(); });
$('aboutClose').addEventListener('click', e => { e.stopPropagation(); $('about').style.display = 'none'; });
ui.setMode('voyage');

(async function main() {
  let started = false, mode = 'voyage', rateI = 0, userOrbits = true;
  const craft = await fetch('assets/data/spacecraft.json').then(r => r.json()).then(j => j.spacecraft).catch(() => []);
  const api = await boot({ progress: (f, m) => ui.progress(f, m) });
  const voyage = new Voyage(api, {
    caption: c => ui.setCaption(c), fade: cb => ui.fade(cb), chime: () => Audio.chime(),
    onStop: () => {}, onLeg: () => {}
  }, craft);
  const flight = new Flight(api, $('c'), { speedChanged: () => {} });
  const labels = new Labels(api, $('labels'), craft);
  window.__voyage = voyage; window.__flight = flight; window.__ui = ui; window.__app = { get mode() { return mode; }, labels };
  ui.cb = {
    prev: () => voyage.prev(), next: () => voyage.next(), pause: () => ui.setPaused(voyage.togglePause()), free: () => toFlight(),
    goto: n => { flight.flyTo(n); }, voyage: () => toVoyage()
  };
  ui.setMode('voyage');
  onLang(() => labels.refresh());
  voyage.backdrop();

  function toFlight(flyTo) {
    if (mode === 'flight') { if (flyTo) flight.flyTo(flyTo); return; }
    mode = 'flight'; voyage.phase = 'idle'; voyage.paused = false; voyage.release(); ui.setPaused(false); ui.setCaption(null);
    const v = api.view; v.pitch = Math.max(-1.5, Math.min(1.5, v.pitch)); flight.start(); ui.setMode('flight');
    ui.hint(new URLSearchParams(location.search).get('nolock') === '1' ? 'dragHint' : 'flightHint', 7000);
    if (flyTo) flight.flyTo(flyTo);
  }
  function toVoyage() {
    if (mode === 'voyage') return; mode = 'voyage'; flight.stop(); ui.setMode('voyage'); voyage.resumeFrom(api.view.pos);
  }
  function begin() {
    if (started) return; started = true; document.body.classList.remove('prestart'); Audio.init(); ui.hideStart(); $('fade').style.transition = 'opacity .6s'; $('fade').style.opacity = 1;
    setTimeout(() => { voyage.begin(); $('fade').style.transition = 'opacity 1.6s'; $('fade').style.opacity = 0; }, 650);
  }
  window.__begin = begin;
  $('start').addEventListener('click', e => { if ($('start').classList.contains('ready') && !e.target.closest('#lang,.alink')) begin(); });

  // keys
  addEventListener('keydown', e => {
    if (e.repeat && !['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code)) return;
    if ($('about').style.display === 'flex') { if (e.code === 'Escape') $('about').style.display = 'none'; return; }
    if (!started) { if (e.code === 'Enter' && $('start').classList.contains('ready')) begin(); return; }
    flight.key(e.code, true);
    const c = e.code;
    if (c === 'Space') { e.preventDefault(); if (mode === 'voyage') ui.setPaused(voyage.togglePause()); }
    else if (c === 'ArrowRight' && mode === 'voyage') { e.preventDefault(); voyage.next(); }
    else if (c === 'ArrowLeft' && mode === 'voyage') { e.preventDefault(); voyage.prev(); }
    else if (c === 'KeyF') toFlight();
    else if (c === 'KeyV') toVoyage();
    else if (c === 'KeyR' && mode === 'voyage') { voyage.release(); voyage.begin(); }
    else if (c === 'KeyL') labels.toggle();
    else if (c === 'KeyO') userOrbits = !userOrbits;
    else if (c === 'KeyM') Audio.toggle();
    else if (c === 'KeyT') { rateI = (rateI + 1) % RATES.length; api.timeRate = RATES[rateI]; }
    else if (/^Digit[0-9]$/.test(c) || /^Numpad[0-9]$/.test(c)) { const n = +c.slice(-1), names = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']; toFlight(names[n]); }
  });
  addEventListener('keyup', e => flight.key(e.code, false));
  addEventListener('blur', () => flight.keys.clear());
  // look around with the mouse in the voyage
  addEventListener('mousemove', e => { if (started && mode === 'voyage' && (e.buttons & 1)) voyage.drag(e.movementX, e.movementY); });

  let lastTime = 1;
  api.onTick = dt => {
    if (mode === 'voyage') voyage.update(dt); else flight.update(dt);
    api.orbitsOn.v = userOrbits && !(mode === 'voyage' && voyage.hideOrbits);
    labels.update();
    const v = api.view, d = v.pos.length(), sp = mode === 'voyage' ? (voyage.phase === 'leg' ? voyage.speed : 0) : flight.speed;
    ui.readout(d, sp, started && (mode === 'flight' || voyage.phase !== 'idle'));
    ui.bar(d); ui.tick(dt);
    ui.setTime(api.timeRate, api.jd);
    Audio.setTravel(Math.max(0, Math.min(1, (Math.log10(Math.max(sp, 1)) - 2) / 4)));
  };
  ui.ready();
  $('fade').style.opacity = 0;
})().catch(e => { console.error(e); $('err').textContent = String(e && e.stack || e); });
