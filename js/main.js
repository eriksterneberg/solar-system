// Solar system: renderer core. Camera position is kept in double-precision km; the scene is re-based on the
// camera every frame (floating origin) and depth uses a logarithmic buffer, so 1 km and 100,000 AU coexist.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { AU, C_KMS, julianDate } from './astro.js';
import { Bodies, UNIT } from './bodies.js';
import { Belts } from './belts.js';
import { Sky } from './sky.js';

const $ = id => document.getElementById(id);
const PARAMS = new URLSearchParams(location.search);

class LayeredPass extends Pass {
  constructor(fn) { super(); this.fn = fn; this.needsSwap = false; }
  render(renderer, writeBuffer, readBuffer) { renderer.setRenderTarget(this.renderToScreen ? null : readBuffer); this.fn(renderer); }
}

export async function boot(hooks = {}) {
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  const PR_MAX = Math.min(devicePixelRatio, 2); let pr = Math.min(PR_MAX, 1.5); renderer.setPixelRatio(pr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.autoClear = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 1e-3, 1e13); camera.rotation.order = 'YXZ';
  const skyCam = new THREE.PerspectiveCamera(55, 1, 0.1, 100); skyCam.rotation.order = 'YXZ';

  const progress = hooks.progress || (() => {});
  progress(0.05, 'loading');
  const bodies = new Bodies(scene), belts = new Belts(scene), sky = new Sky();
  await Promise.all([bodies.load().then(() => progress(0.6)), belts.load(), sky.load()]);
  const jd0 = PARAMS.get('jd') ? +PARAMS.get('jd') : julianDate();
  bodies.build(jd0); belts.build(jd0); sky.build();
  progress(0.95);

  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new LayeredPass(r => { r.clear(); r.render(sky.scene, skyCam); r.clearDepth(); r.render(scene, camera); }));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.6, 1.2); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = skyCam.aspect = w / h; camera.updateProjectionMatrix(); skyCam.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();

  /* ---------- view state (km, radians) ---------- */
  const view = { pos: new THREE.Vector3(1.0 * AU, 0.002 * AU, 0.02 * AU), yaw: 0, pitch: 0, fov: 55, exposure: 1, adaptTarget: 1 };
  let jd = jd0, simTime = 0, timeRate = 1;     // seconds of simulated time per real second
  const orbitsOn = { v: true }, beltsVis = { asteroids: 1, kuiper: 1, oort: 1 };

  const dirOf = (yaw, pitch) => new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  function lookAtKm(target) { const d = new THREE.Vector3().subVectors(target, view.pos).normalize(); view.yaw = Math.atan2(-d.x, -d.z); view.pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)); }

  // nearest body surface distance (km) — drives automatic cruise speed
  function nearest() {
    let best = null, bd = Infinity;
    for (const b of bodies.list) { const d = b.pos.distanceTo(view.pos) - b.r; if (d < bd) { bd = d; best = b; } }
    return { body: best, dist: Math.max(bd, 1) };
  }

  // eye/camera adaptation: what is bright in view? (the Sun's disc or glare, lit planet discs) -> exposure
  function adapt(dt) {
    const dir = dirOf(view.yaw, view.pitch), halfFov = view.fov * Math.PI / 360;
    let lum = 0, cov = 0, cap = Infinity;
    for (const b of bodies.list) {
      const rel = new THREE.Vector3().subVectors(b.pos, view.pos), d = rel.length(), ang = Math.acos(THREE.MathUtils.clamp(rel.dot(dir) / d, -1, 1));
      const angR = Math.atan(b.r / Math.max(d, b.r)), inView = 1 - THREE.MathUtils.smoothstep(ang - angR, halfFov * 0.9, halfFov * 1.6);
      if (inView <= 0) continue;
      const frac = Math.min(1, (angR * angR) / (halfFov * halfFov));            // fraction of the view the disc covers
      if (b.name === 'sun') lum += inView * (60 * Math.min(1, frac * 40) + 0.6 * Math.pow(AU / d, 2) * 1.2);
      else { const rad = b.albedo * Math.pow(AU / b.pos.length(), 2); lum += inView * frac * rad * 2.2; cov += inView * frac;
        // never let a visible sunlit disc burn out to white, however small it is (the eye adapts to the brightest thing)
        if (inView > 0.5 && angR * innerHeight / (2 * Math.tan(halfFov)) > 1.5) cap = Math.min(cap, 1.3 / (rad * 1.6)); }
    }
    // empty sky: the dark-adapted limit (stars, Milky Way); a lit disc in view sets the exposure instead, even far out
    const floor = 0.012 * (1 - THREE.MathUtils.smoothstep(cov, 0.004, 0.06)) + 2e-5;
    // the eye only partly compensates for dimmer sunlight: perceived brightness falls ~ irradiance^0.35, so the
    // outer planets are seen in a deepening dusk (Neptune gets 1/900 of Earth's sunlight)
    const maxExp = Math.max(45, 5 * Math.pow(view.pos.length() / AU, 1.3));
    const target = THREE.MathUtils.clamp(Math.min(0.55 / (lum + floor), cap), 0.016, maxExp);
    view.adaptTarget = target;
    const k = target > view.exposure ? 1.6 : 0.45;                                // darken fast, brighten slowly (seconds)
    view.exposure *= Math.exp(THREE.MathUtils.clamp(Math.log(target / view.exposure), -6, 6) * (1 - Math.exp(-dt / k)));
  }

  function render(dt) {
    camera.fov = skyCam.fov = view.fov; camera.updateProjectionMatrix(); skyCam.updateProjectionMatrix();
    camera.position.set(0, 0, 0); camera.rotation.set(view.pitch, view.yaw, 0); skyCam.rotation.copy(camera.rotation);
    const pxPerRad = innerHeight * pr / (2 * Math.tan(view.fov * Math.PI / 360));
    const dSun = view.pos.length();
    const nb = nearest(), orbitFade = THREE.MathUtils.smoothstep(nb.dist / nb.body.r, 20, 400);
    bodies.update(jd, view.pos, simTime, pxPerRad, pr, orbitsOn.v && orbitFade > 0.01, THREE.MathUtils.clamp(0.35 * Math.pow(dSun / (5 * AU), 0.3), 0.08, 0.5) * orbitFade * Math.min(1, 1.5 / view.exposure));
    // markers for the belts and the Oort cloud are a map overlay, not something an eye would see: show each one
    // only once you are far enough out to see it as a structure (a voyage can override via beltsVis.force)
    const au = dSun / AU, ss = THREE.MathUtils.smoothstep, f = beltsVis.force || {};
    const near = nearest(), nearFade = ss(near.dist / near.body.r, 30, 300);
    belts.update(view.pos, pr, {
      asteroids: (f.asteroids ?? ss(au, 0.5, 2.5) * nearFade * (1 - ss(au, 60, 400))) * beltsVis.asteroids,
      kuiper: (f.kuiper ?? ss(au, 6, 25) * nearFade * (1 - ss(au, 600, 5000))) * beltsVis.kuiper,
      oort: (f.oort ?? ss(au, 300, 2000)) * beltsVis.oort });
    sky.update(pr, Math.min(1, 45 / view.exposure));   // stars are faint next to any sunlit surface
    renderer.toneMappingExposure = view.exposure;
    composer.render(dt);
  }

  let last = performance.now(), paused = false, qT = 0, qN = 0;
  const api = {
    THREE, scene, camera, renderer, bodies, belts, sky, view, composer, bloom, AU, C_KMS, UNIT,
    get jd() { return jd; }, set jd(v) { jd = v; }, get simTime() { return simTime; }, get timeRate() { return timeRate; }, set timeRate(v) { timeRate = v; },
    orbitsOn, beltsVis, dirOf, lookAtKm, nearest, adapt, render,
    pause(v) { paused = !!v; }, step(dt) { tick(dt); render(dt); }, onTick: null
  };
  function tick(dt) { simTime += dt * timeRate; jd = jd0 + simTime / 86400; if (api.onTick) api.onTick(dt); adapt(dt); }
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now;
    if (!paused) tick(dt);
    render(dt);
    if (document.visibilityState === 'visible' && raw < 0.25) { qT += raw; qN++; if (qT > 2.5) { const f = qN / qT; qT = qN = 0; const np = f < 42 ? Math.max(0.75, pr - 0.25) : f > 57 ? Math.min(PR_MAX, pr + 0.125) : pr; if (np !== pr) { pr = np; renderer.setPixelRatio(pr); resize(); } } }
  }
  requestAnimationFrame(frame);
  window.__sim = api;
  return api;
}
