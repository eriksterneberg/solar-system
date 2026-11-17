// Small bodies: the real asteroid belt and Kuiper belt (MPC/JPL orbital elements, positioned for the chosen date)
// and a modelled Oort cloud. In reality none of these is visible to the eye: they are far too small, dark and far
// apart. They are drawn as faint markers of where they are, and the captions say so.
import * as THREE from 'three';
import { AU, keplerPos } from './astro.js';
import { UNIT } from './bodies.js';

const LOGV = '#include <common>\n#include <logdepthbuf_pars_vertex>\n', LOGF = '#include <logdepthbuf_pars_fragment>\n';
const VS = LOGV + /* glsl */`
in vec3 aColor; in float aSize; uniform vec3 uOffset; uniform float uPx, uGain, uNearFade; out vec3 vC;
void main(){
  vec3 p = position + uOffset; vec4 mv = viewMatrix*vec4(p, 1.); gl_Position = projectionMatrix*mv;
  float d = length(p);
  // markers near the camera would be huge rocks; keep them point-like and fade the ones closer than uNearFade
  float f = smoothstep(uNearFade*0.2, uNearFade, d);
  gl_PointSize = aSize*uPx; vC = aColor*uGain*f;
  #include <logdepthbuf_vertex>
}`;
const FS = LOGF + /* glsl */`precision highp float; layout(location=0) out highp vec4 pc_fragColor; in vec3 vC;
void main(){
  #include <logdepthbuf_fragment>
  vec2 q = gl_PointCoord*2. - 1.; float r2 = dot(q, q); if(r2 > 1.) discard; pc_fragColor = vec4(vC*exp(-r2*2.5), 1.); }`;

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Belts {
  constructor(scene) { this.scene = scene; this.layers = {}; }
  async load(base = 'assets/data/') {
    [this.bin, this.info] = await Promise.all([
      fetch(base + 'smallbodies.bin').then(r => r.ok ? r.arrayBuffer() : null).then(b => b && new Float32Array(b)).catch(() => null),
      fetch(base + 'smallbodies.json').then(r => r.json()).catch(() => null)
    ]);
  }
  make(name, pos, col, size, gain, nearFade) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const u = { uOffset: { value: new THREE.Vector3() }, uPx: { value: 1 }, uGain: { value: gain }, uNearFade: { value: nearFade } };
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: u, vertexShader: VS, fragmentShader: FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false; pts.renderOrder = 3; this.scene.add(pts);
    this.layers[name] = { pts, u, base: gain };
  }
  build(jd) {
    const r = rng(7);
    // ---- asteroid + Kuiper belts from real orbits ----
    if (this.bin) {
      const L = (this.info && this.info.record_floats) || 8, n = Math.floor(this.bin.length / L), v = new THREE.Vector3();
      const ast = [], kui = [];
      for (let i = 0; i < n; i++) {
        const o = i * L, a = this.bin[o], e = this.bin[o + 1]; if (!(a > 0) || e >= 1) continue;
        const I = this.bin[o + 2], node = this.bin[o + 3], w = this.bin[o + 4], M0 = this.bin[o + 5], ep = this.bin[o + 6];
        const nDeg = 0.9856076686 / Math.pow(a, 1.5), M = M0 + nDeg * (jd - ep);
        keplerPos(a, e, I, node, w, M, v); (a > 30 ? kui : ast).push(v.x / UNIT, v.y / UNIT, v.z / UNIT);
      }
      const fill = (arr, c0, c1, s0, s1) => { const k = arr.length / 3, c = new Float32Array(k * 3), s = new Float32Array(k); for (let i = 0; i < k; i++) { const t = r(); c.set([c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t], i * 3); s[i] = s0 + (s1 - s0) * r(); } return [new Float32Array(arr), c, s]; };
      if (ast.length) { const [p, c, s] = fill(ast, [0.62, 0.58, 0.52], [0.75, 0.72, 0.66], 1.3, 2.0); this.make('asteroids', p, c, s, 0.05, 0.02 * AU / UNIT); }
      if (kui.length) { const [p, c, s] = fill(kui, [0.70, 0.60, 0.52], [0.85, 0.75, 0.66], 1.6, 2.4); this.make('kuiper', p, c, s, 0.11, 0.3 * AU / UNIT); }
      this.counts = { asteroids: ast.length / 3, kuiper: kui.length / 3 };
    }
    // ---- Oort cloud (modelled): inner Hills cloud flattened toward the ecliptic, outer cloud spherical ----
    const N = 90000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
    const rmin = 1500, rmax = 100000, a0 = Math.pow(rmin, 0.5), a1 = Math.pow(rmax, 0.5);
    for (let i = 0; i < N; i++) {
      // number per shell ~ r^-0.5 (shallower than model r^-3.5 densities so the outer cloud reads as a sphere); flattened toward the ecliptic in the inner (Hills) cloud,
      // becoming spherical outward, with no hard boundary between the two
      const rr = Math.pow(a0 + r() * (a1 - a0), 2), flat = 0.35 + 0.65 * THREE.MathUtils.smoothstep(rr, 2000, 12000);
      let z = 2 * r() - 1; z = Math.sign(z) * Math.pow(Math.abs(z), 1 / flat) * 1; const ph = r() * Math.PI * 2, q = Math.sqrt(Math.max(0, 1 - z * z));
      const k = rr * AU / UNIT; pos.set([q * Math.cos(ph) * k, z * k, q * Math.sin(ph) * k], i * 3);
      const t = 0.7 + 0.3 * r(); col.set([0.72 * t, 0.78 * t, 0.9 * t], i * 3); size[i] = 1.0 + 0.7 * r();
    }
    this.make('oort', pos, col, size, 0.008, 200 * AU / UNIT);
  }
  // camKm: camera world position (km); visibility 0..1 per layer
  update(camKm, pixelRatio, vis = {}) {
    for (const [name, L] of Object.entries(this.layers)) {
      L.u.uOffset.value.copy(camKm).negate().divideScalar(UNIT); L.u.uPx.value = pixelRatio;
      const v = vis[name] ?? 1; L.u.uGain.value = L.base * v; L.pts.visible = v > 0.002;
    }
  }
}
