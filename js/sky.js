// Background sky: NASA SVS Deep Star Maps Milky Way panorama + 8,800 Yale catalogue stars as sharp points.
// Drawn first in its own camera-centred scene (directions only), in the same HDR units as the bodies.
import * as THREE from 'three';
import { DEG, OBLIQ } from './astro.js';

// world = M * equatorial (see astro.js eqToWorld)
const c = Math.cos(OBLIQ), s = Math.sin(OBLIQ);
export const WORLD_FROM_EQ = new THREE.Matrix3().set(1, 0, 0, 0, -s, c, 0, -c, -s);
export const EQ_FROM_WORLD = WORLD_FROM_EQ.clone().transpose();

const loadTex = url => new Promise(res => new THREE.TextureLoader().load(url, t => {
  t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping; res(t);
}, undefined, () => res(null)));

const SKY_FS = /* glsl */`
precision highp float; layout(location=0) out highp vec4 pc_fragColor;
uniform sampler2D uMW; uniform mat3 uEq; uniform float uGain, uCenterRA, uRaSign;
in vec3 vDir;
void main(){
  vec3 e = uEq*normalize(vDir);
  float ra = atan(e.y, e.x), de = asin(clamp(e.z, -1., 1.));
  vec2 uv = vec2(0.5 + uRaSign*(ra - uCenterRA)/6.2831853, 0.5 + de/3.14159265);
  vec2 dx = vec2(length(dFdx(e))/6.2831853, 0.), dy = vec2(0., length(dFdy(e))/3.14159265);
  vec3 col = pow(textureGrad(uMW, uv, dx, dy).rgb, vec3(2.2))*uGain;
  pc_fragColor = vec4(col, 1.);
}`;
const DIR_VS = /* glsl */`out vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*viewMatrix*vec4(position, 1.); }`;

export class Sky {
  async load(base = 'assets/sky/') {
    [this.mw, this.meta, this.stars] = await Promise.all([
      loadTex(base + 'milkyway.jpg'),
      fetch(base + 'meta.json').then(r => r.json()).catch(() => ({})),
      fetch(base + 'stars.bin').then(r => r.ok ? r.arrayBuffer() : null).then(b => b && new Float32Array(b)).catch(() => null)
    ]);
  }
  build() {
    const scene = this.scene = new THREE.Scene(), m = this.meta || {};
    this.u = { uMW: { value: this.mw }, uEq: { value: EQ_FROM_WORLD }, uGain: { value: 0.012 }, uCenterRA: { value: (m.center_ra_deg ?? 0) * DEG }, uRaSign: { value: m.ra_increases_left === false ? 1 : -1 } };
    if (this.mw) {
      const dome = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.u, vertexShader: DIR_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthTest: false, depthWrite: false }));
      dome.frustumCulled = false; scene.add(dome);
    }
    if (this.stars) {
      const d = this.stars, n = d.length / 4, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), mag = new Float32Array(n), v = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        const ra = d[i * 4] * DEG, de = d[i * 4 + 1] * DEG; v.set(Math.cos(de) * Math.cos(ra), Math.cos(de) * Math.sin(ra), Math.sin(de)).applyMatrix3(WORLD_FROM_EQ);
        pos.set([v.x * 50, v.y * 50, v.z * 50], i * 3); mag[i] = d[i * 4 + 2];
        const t = d[i * 4 + 3] / 100; let r, g, b;
        if (t <= 66) { r = 1; g = Math.min(1, Math.max(0, 0.39008 * Math.log(t) - 0.63184)); b = t <= 19 ? 0 : Math.min(1, Math.max(0, 0.54321 * Math.log(t - 10) - 1.19625)); }
        else { r = Math.min(1, 1.2929 * Math.pow(t - 60, -0.1332)); g = Math.min(1, 1.1299 * Math.pow(t - 60, -0.0755)); b = 1; }
        col.set([0.45 + 0.55 * r, 0.45 + 0.55 * g, 0.45 + 0.55 * b], i * 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
      this.su = { uPx: { value: 1 }, uGain: { value: 0.02 } };
      const pts = new THREE.Points(g, new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.su, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
        vertexShader: `in float aMag; in vec3 color; uniform float uPx, uGain; out vec3 vC;
          void main(){ float f = pow(10., -0.4*aMag);
            float sz = clamp(1.6 + 2.2*pow(f, 0.28), 1.6, 9.0)*uPx, area = sz*sz/(1.6*1.6*uPx*uPx);
            vC = color*uGain*min(pow(f, 0.62)*42., 60.)/pow(area, 0.55);
            gl_PointSize = sz; gl_Position = projectionMatrix*viewMatrix*vec4(position, 1.); }`,
        fragmentShader: `precision highp float; layout(location=0) out highp vec4 pc_fragColor; in vec3 vC;
          void main(){ vec2 q = gl_PointCoord*2. - 1.; float r2 = dot(q, q); if(r2 > 1.) discard; pc_fragColor = vec4(vC*exp(-r2*3.2), 1.); }` }));
      pts.frustumCulled = false; scene.add(pts); this.points = pts;
    }
  }
  // starGain: HDR radiance multiplier for the night sky (constant physically; exposure does the adapting)
  update(pixelRatio, starGain = 1) { if (this.su) { this.su.uPx.value = pixelRatio; this.su.uGain.value = 0.013 * starGain; } this.u.uGain.value = 0.0055 * starGain; }
}
