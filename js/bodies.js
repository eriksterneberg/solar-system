// The Sun, planets, Moon, Pluto: true sizes, real orientations, photographic maps.
// Positions are kept in double-precision km on the CPU; every frame each mesh is placed camera-relative in
// render units (1 unit = 1000 km) so nearby surfaces stay precise. A logarithmic depth buffer spans 1 km .. 1e15 km.
import * as THREE from 'three';
import { BODY, AU, DEG, planetPos, moonGeo, bodyFrame, elements, orbitPoints } from './astro.js';

export const UNIT = 1000;            // km per render unit

const LOGV = '#include <common>\n#include <logdepthbuf_pars_vertex>\n';
const LOGF = '#include <logdepthbuf_pars_fragment>\n';

const PLANET_VS = LOGV + /* glsl */`
out vec3 vN; out vec3 vP; out vec3 vObj;
void main(){
  vObj = normalize(position);
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.); vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`;

// shared lighting helpers. Reflectance models:
//  kind 0 rocky (Lommel-Seeliger/Lambert mix), 1 gas/cloud (Minnaert limb darkening), 2 Earth (special), 3 icy (Lambert-ish)
const PLANET_FS = LOGF + /* glsl */`
precision highp float;
layout(location=0) out highp vec4 pc_fragColor;
uniform sampler2D uMap, uNight, uClouds, uWater, uRing;
uniform vec3 uSunPos, uCenter, uAtmo, uRingN;
uniform float uIrr, uKind, uHasNight, uHasClouds, uHasWater, uCloudRot, uAtmoAmt, uRadius, uRingIn, uRingOut, uHasRing, uGain;
in vec3 vN; in vec3 vP; in vec3 vObj;
vec2 lonlat(vec3 o){ return vec2(atan(-o.z, o.x), asin(clamp(o.y, -1., 1.))); }
void main(){
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vN), v = normalize(-vP), L = normalize(uSunPos - vP);
  vec2 ll = lonlat(vObj); vec2 uv = vec2(ll.x/6.2831853 + 0.5, ll.y/3.14159265 + 0.5);
  // seam-safe derivatives (texture lookups across the lon=+-180 seam would otherwise pick the smallest mip)
  vec2 gx = vec2(length(dFdx(vObj))/6.2831853, 0.), gy = vec2(0., length(dFdy(vObj))/3.14159265);
  vec3 alb = textureGrad(uMap, uv, gx, gy).rgb;
  float mu0 = dot(n, L), mu = clamp(dot(n, v), 0., 1.), lit = max(mu0, 0.);
  // shadow of Saturn's rings on the planet
  if(uHasRing > 0.5){
    float dn = dot(L, uRingN);
    if(abs(dn) > 1e-4){ float t = -dot(vP - uCenter, uRingN)/dn; if(t > 0.){ vec3 q = vP + L*t - uCenter; float rr = length(q)/uRadius;
      if(rr > uRingIn && rr < uRingOut){ float a = texture(uRing, vec2((rr-uRingIn)/(uRingOut-uRingIn), 0.5)).a; lit *= 1. - 0.92*a; } } }
  }
  vec3 col;
  if(uKind < 0.5){            // rocky: regolith scatters like the Moon (bright limb, flat disc)
    float ls = mu0 > 0. ? 2.*mu0/(mu0 + mu + 1e-4) : 0.;
    col = alb * mix(lit, ls*0.5*sign(lit), 0.65) * 1.25;
  } else if(uKind < 1.5){     // cloud tops: Minnaert, darker toward the limb
    float k = 0.85; col = alb * (mu0 > 0. ? pow(lit, k)*pow(max(mu,0.05), k-1.) : 0.) * 0.95;
  } else if(uKind < 2.5){     // Earth: surface, ocean glint, clouds, city lights
    float water = uHasWater > 0.5 ? textureGrad(uWater, uv, gx, gy).r : 0.;
    vec2 uc = vec2(fract(uv.x + uCloudRot), uv.y);
    float cl = uHasClouds > 0.5 ? smoothstep(0.08, 0.9, textureGrad(uClouds, uc, gx, gy).r) : 0.;
    vec3 surf = alb*mix(1., 0.72, water);
    col = surf * lit;
    vec3 h = normalize(L + v); float nh = clamp(dot(n, h), 0.05, 1.), r = 0.12;
    float D = exp((nh*nh - 1.)/(r*r*nh*nh))/(3.14159*r*r*nh*nh*nh*nh), F = 0.02 + 0.98*pow(1. - clamp(dot(v, h), 0., 1.), 5.);
    col += water*(1.-cl)*D*F*lit*0.12/max(mu*0.6 + 0.05, 0.05)*vec3(1., 0.97, 0.9);
    col = mix(col, vec3(0.93, 0.94, 0.97)*pow(lit, 0.9), cl);
    if(uHasNight > 0.5){ vec3 nl = textureGrad(uNight, uv, gx, gy).rgb; col += nl*nl*vec3(1., 0.8, 0.55)*(1. - smoothstep(-0.12, 0.05, mu0))*(1. - cl*0.8)*0.06/max(uIrr, 1e-3); }
  } else {                    // icy / generic
    col = alb * lit;
  }
  // atmosphere: a thin coloured veil thickening toward the limb on the day side
  float rim = pow(1. - mu, 3.), day = smoothstep(-0.15, 0.25, mu0);
  col = col*(1. - uAtmoAmt*rim*0.5) + uAtmo*uAtmoAmt*(0.08 + 0.7*rim)*day*(0.4 + 0.6*lit);
  col *= uIrr * uGain;
  col = clamp(col, 0., 1e4); if(any(isnan(col))) col = vec3(0.);
  pc_fragColor = vec4(col, 1.);
}`;

const RING_VS = LOGV + /* glsl */`out vec3 vP; out vec2 vL; void main(){ vL = position.xz; vec4 w = modelMatrix*vec4(position,1.); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w;
  #include <logdepthbuf_vertex>
}`;
const RING_FS = LOGF + /* glsl */`
precision highp float; layout(location=0) out highp vec4 pc_fragColor;
uniform sampler2D uRing; uniform vec3 uSunPos, uCenter, uRingN; uniform float uIn, uOut, uRadius, uIrr, uGain;
in vec3 vP; in vec2 vL;
void main(){
  #include <logdepthbuf_fragment>
  float rr = length(vL); if(rr < uIn || rr > uOut) discard;
  vec4 t = texture(uRing, vec2((rr - uIn)/(uOut - uIn), 0.5)); if(t.a < 0.01) discard;
  vec3 L = normalize(uSunPos - vP), v = normalize(-vP);
  // planet's shadow on the rings: does the ray toward the Sun hit the planet?
  vec3 oc = vP - uCenter; float b = dot(oc, L), c = dot(oc, oc) - uRadius*uRadius, h = b*b - c;
  float sh = (h > 0. && -b - sqrt(h) > 0.) ? 0.03 : 1.;
  // lit face vs unlit face: light diffuses through the ring (more for thin parts) and scatters forward
  float sameSide = sign(dot(L, uRingN))*sign(dot(v, uRingN));
  float g = dot(-L, v), fwd = 1. + 1.6*pow(max(g, 0.), 6.);
  float bright = sameSide > 0. ? 1.0 : (1. - t.a)*1.6 + 0.08;
  vec3 col = t.rgb*bright*fwd*sh*abs(dot(L, uRingN))*2.2*uIrr*uGain;
  pc_fragColor = vec4(col, t.a);
}`;

const SUN_FS = LOGF + /* glsl */`
precision highp float; layout(location=0) out highp vec4 pc_fragColor;
uniform float uTime, uI; in vec3 vN; in vec3 vP; in vec3 vObj;
float h3(vec3 p){ p = fract(p*0.3183099 + .1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3. - 2.*f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
void main(){
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vN), v = normalize(-vP); float mu = clamp(dot(n, v), 0., 1.);
  // granulation (cells ~1000 km) and a little large-scale mottling, slowly evolving
  vec3 p = vObj*180.; float g = vn(p + uTime*0.02)*0.6 + vn(p*2.1 - uTime*0.03)*0.4;
  float m = vn(vObj*7. + uTime*0.002);
  float limb = 0.3 + 0.93*mu - 0.23*mu*mu;            // Neckel & Labs-like limb darkening
  vec3 col = vec3(1.0, 0.87, 0.68)*limb*(0.88 + 0.16*g)*(0.95 + 0.1*m);
  col *= mix(vec3(1.0, 0.55, 0.3), vec3(1.), smoothstep(0., 0.35, mu));  // reddened limb
  pc_fragColor = vec4(col*uI, 1.);
}`;

// glare / corona around the Sun, billboarded; and the point-like glow of any body smaller than a few pixels
const GLOW_VS = LOGV + /* glsl */`
in float aBright; in vec3 aColor; in float aFade; uniform float uPx; out vec3 vC; out float vA;
void main(){ vec4 mv = modelViewMatrix*vec4(position, 1.); gl_Position = projectionMatrix*mv;
  float b = aBright; float sz = clamp(2.0 + 2.6*pow(b, 0.32), 2.0, 22.0)*uPx;
  vC = aColor*b/pow(sz/(2.0*uPx), 2.0)*1.6; vA = aFade; gl_PointSize = sz;
  #include <logdepthbuf_vertex>
}`;
const GLOW_FS = LOGF + /* glsl */`
precision highp float; layout(location=0) out highp vec4 pc_fragColor; in vec3 vC; in float vA;
void main(){
  #include <logdepthbuf_fragment>
  vec2 q = gl_PointCoord*2. - 1.; float r2 = dot(q, q); if(r2 > 1. || vA < 0.002) discard;
  pc_fragColor = vec4(vC*exp(-r2*4.0)*vA, 1.); }`;

const loadTex = (url, srgb = true) => new Promise(res => new THREE.TextureLoader().load(url, t => {
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; res(t);
}, undefined, () => { console.warn('missing', url); res(null); }));

const DEFS = {
  mercury: { kind: 0, tex: 'mercury', tint: [0.75, 0.72, 0.68] },
  venus:   { kind: 1, tex: 'venus', atmo: [1.0, 0.85, 0.6], atmoAmt: 0.5, tint: [0.95, 0.88, 0.7] },
  earth:   { kind: 2, tex: 'earth_day', atmo: [0.25, 0.45, 1.0], atmoAmt: 0.6, tint: [0.3, 0.45, 0.7] },
  moon:    { kind: 0, tex: 'moon', tint: [0.6, 0.58, 0.55] },
  mars:    { kind: 0, tex: 'mars', atmo: [0.9, 0.6, 0.45], atmoAmt: 0.15, tint: [0.85, 0.5, 0.32] },
  jupiter: { kind: 1, tex: 'jupiter', atmo: [0.6, 0.65, 0.8], atmoAmt: 0.12, tint: [0.85, 0.78, 0.68] },
  saturn:  { kind: 1, tex: 'saturn', atmo: [0.7, 0.68, 0.6], atmoAmt: 0.1, tint: [0.9, 0.82, 0.62] },
  uranus:  { kind: 1, tex: 'uranus', atmo: [0.6, 0.85, 0.9], atmoAmt: 0.25, tint: [0.65, 0.85, 0.88] },
  neptune: { kind: 1, tex: 'neptune', atmo: [0.35, 0.5, 1.0], atmoAmt: 0.3, tint: [0.35, 0.5, 0.95] },
  pluto:   { kind: 0, tex: 'pluto', tint: [0.8, 0.7, 0.6] },
};

export class Bodies {
  constructor(scene) { this.scene = scene; this.list = []; this.byName = {}; this.tmp = new THREE.Vector3(); }

  async load(base = 'assets/tex/') {
    const names = Object.values(DEFS).map(d => d.tex);
    const extra = ['earth_night', 'earth_clouds'];
    const all = await Promise.all([...names, ...extra].map(n => loadTex(base + n + '.jpg')));
    this.tex = {}; [...names, ...extra].forEach((n, i) => this.tex[n] = all[i]);
    this.tex.earth_water = await loadTex(base + 'earth_water.png', false);
    const ring = await loadTex(base + 'saturn_ring.png', true); if (ring) { ring.wrapS = THREE.ClampToEdgeWrapping; ring.generateMipmaps = true; }
    this.tex.ring = ring;
    this.ringMeta = await fetch(base + '../manifest.json').then(r => r.json()).then(m => m.saturn_ring || null).catch(() => null);
  }

  build(jd) {
    const geo = new THREE.SphereGeometry(1, 192, 96);
    // --- Sun ---
    this.sunU = { uTime: { value: 0 }, uI: { value: 80 } };
    const sun = new THREE.Mesh(geo, new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.sunU, vertexShader: PLANET_VS, fragmentShader: SUN_FS }));
    sun.frustumCulled = false; this.scene.add(sun);
    // glare: light scattered in the eye/lens around the Sun, a camera-facing quad centred on it
    this.glareU = { uI: { value: 1 } };
    this.glare = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.glareU, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      vertexShader: 'out vec2 vU; void main(){ vU = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'precision highp float; layout(location=0) out highp vec4 pc_fragColor; uniform float uI; in vec2 vU; void main(){ float r = length(vU)*12.; /* in solar radii */ if(r < 0.98) discard; float g = 0.55/(1.+pow((r-0.95)/0.16,2.5)) + 0.018/(1.+pow(r/2.2,2.0)); g *= smoothstep(12.,9.,r); pc_fragColor = vec4(vec3(1.,0.93,0.82)*g*uI, 1.); }' }));
    this.glare.frustumCulled = false; this.glare.renderOrder = 6; this.scene.add(this.glare);
    this.add('sun', sun, null);
    // --- planets ---
    for (const [name, d] of Object.entries(DEFS)) {
      const T = this.tex, u = {
        uMap: { value: T[d.tex] || this.flat(d.tint) }, uNight: { value: T.earth_night }, uClouds: { value: T.earth_clouds }, uWater: { value: T.earth_water }, uRing: { value: T.ring },
        uSunPos: { value: new THREE.Vector3() }, uCenter: { value: new THREE.Vector3() }, uAtmo: { value: new THREE.Vector3(...(d.atmo || [0, 0, 0])) }, uRingN: { value: new THREE.Vector3(0, 1, 0) },
        uIrr: { value: 1 }, uKind: { value: d.kind }, uHasNight: { value: name === 'earth' && T.earth_night ? 1 : 0 }, uHasClouds: { value: name === 'earth' && T.earth_clouds ? 1 : 0 },
        uHasWater: { value: name === 'earth' && T.earth_water ? 1 : 0 }, uCloudRot: { value: 0 }, uAtmoAmt: { value: d.atmoAmt || 0 }, uRadius: { value: 1 },
        uRingIn: { value: 1.236 }, uRingOut: { value: 2.326 }, uHasRing: { value: name === 'saturn' && T.ring ? 1 : 0 }, uGain: { value: 1 }
      };
      const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: u, vertexShader: PLANET_VS, fragmentShader: PLANET_FS, extensions: { derivatives: true } }));
      m.frustumCulled = false; this.scene.add(m);
      const b = this.add(name, m, u); b.tint = new THREE.Color(...d.tint);
      if (name === 'saturn' && T.ring) this.buildRing(b);
    }
    this.buildGlow();
    this.buildOrbits(jd);
    this.update(jd, new THREE.Vector3(AU, 0, 0), 0);
  }

  flat(c) { const t = new THREE.DataTexture(new Uint8Array([c[0] * 255, c[1] * 255, c[2] * 255, 255]), 1, 1); t.needsUpdate = true; t.colorSpace = THREE.SRGBColorSpace; return t; }

  add(name, mesh, u) {
    const b = { name, mesh, u, pos: new THREE.Vector3(), r: BODY[name].r, f: BODY[name].f, albedo: BODY[name].albedo, frame: null };
    this.list.push(b); this.byName[name] = b; return b;
  }

  buildRing(b) {
    // ring radii in planet radii (equatorial 60268 km): default C ring inner edge .. F ring; a manifest entry can override
    const req = 60268, rm = this.ringMeta;
    const inner = (rm && rm.inner_km ? rm.inner_km : 74500) / req, outer = (rm && rm.outer_km ? rm.outer_km : 140220) / req;
    b.u.uRingIn.value = inner; b.u.uRingOut.value = outer;
    const g = new THREE.RingGeometry(inner, outer, 256, 4); g.rotateX(-Math.PI / 2);      // in the local XZ (equatorial) plane
    this.ringU = { uRing: { value: this.tex.ring }, uSunPos: b.u.uSunPos, uCenter: b.u.uCenter, uRingN: b.u.uRingN, uIn: { value: inner }, uOut: { value: outer }, uRadius: b.u.uRadius, uIrr: b.u.uIrr, uGain: b.u.uGain };
    const ring = new THREE.Mesh(g, new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.ringU, vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.frustumCulled = false; ring.renderOrder = 2; this.scene.add(ring); b.ring = ring;
  }

  buildGlow() {
    const n = this.list.length, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aBright', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aFade', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.glowU = { uPx: { value: 1 } };
    this.glow = new THREE.Points(g, new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.glowU, vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.glow.frustumCulled = false; this.glow.renderOrder = 5; this.scene.add(this.glow);
  }

  buildOrbits(jd) {
    const names = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
    this.orbits = [];
    for (const name of names) {
      const pts = orbitPoints(elements(name, jd), name === 'pluto' ? 1440 : 1024), arr = new Float64Array(pts.length * 3);
      pts.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.length * 3), 3));
      const m = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uC: { value: new THREE.Color(name === 'pluto' ? 0x6a6458 : 0x5a6a80) }, uA: { value: 0.35 } },
        vertexShader: LOGV + 'void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.);\n#include <logdepthbuf_vertex>\n}',
        fragmentShader: LOGF + 'precision highp float; layout(location=0) out highp vec4 pc_fragColor; uniform vec3 uC; uniform float uA; void main(){\n#include <logdepthbuf_fragment>\npc_fragColor = vec4(uC*uA, 1.); }'
      });
      const line = new THREE.LineLoop(g, m); line.frustumCulled = false; line.renderOrder = 1; this.scene.add(line);
      this.orbits.push({ name, line, km: arr, m });
    }
  }

  // jd: Julian date; cam: camera position in world km; exposure-independent radiance units (1 = sunlit white at 1 AU)
  update(jd, cam, time, pxPerRad = 1000, pixelRatio = 1, showOrbits = true, orbitAlpha = 0.35) {
    const B = this.byName, tmp = this.tmp;
    B.sun.pos.set(0, 0, 0);
    for (const n of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']) planetPos(n, jd, B[n].pos);
    // Earth: the elements are for the Earth-Moon barycentre; split it (Moon/Earth mass ratio 0.0123)
    const mg = moonGeo(jd); B.earth.pos.addScaledVector(mg, -0.0123 / 1.0123); B.moon.pos.copy(B.earth.pos).add(mg);
    const P = this.glow.geometry.attributes.position.array, BR = this.glow.geometry.attributes.aBright.array, C = this.glow.geometry.attributes.aColor.array, F = this.glow.geometry.attributes.aFade.array;
    this.list.forEach((b, i) => {
      const rel = tmp.subVectors(b.pos, cam), dist = rel.length(), m = b.mesh;
      m.position.copy(rel).divideScalar(UNIT);
      const fr = bodyFrame(b.name, jd); b.frame = fr;
      const Z = new THREE.Vector3().crossVectors(fr.x, fr.pole);                // local +Z (lon -90)
      m.matrixAutoUpdate = false;
      m.matrix.makeBasis(fr.x, fr.pole, Z).scale(new THREE.Vector3(b.r / UNIT, b.r * (1 - b.f) / UNIT, b.r / UNIT)).setPosition(m.position);
      const discPx = Math.atan(b.r / Math.max(dist, b.r * 1.0001)) * pxPerRad;  // apparent radius in pixels
      m.visible = discPx > 0.35;
      const rSun = b.pos.length();
      if (b.u) {
        b.u.uSunPos.value.copy(cam).negate().divideScalar(UNIT); b.u.uCenter.value.copy(m.position); b.u.uRadius.value = b.r / UNIT;
        b.u.uIrr.value = b.name === 'sun' ? 1 : Math.pow(AU / rSun, 2);
        if (b.name === 'earth') b.u.uCloudRot.value = (time / 86400) * 0.004;
        if (b.ring) { b.ring.matrixAutoUpdate = false; b.ring.matrix.copy(m.matrix); b.ring.visible = m.visible || discPx > 0.15; b.u.uRingN.value.copy(fr.pole); }
      }
      // star-like glow for small discs: reflected flux at the camera, in the same radiance units as the meshes
      const pi = i * 3; P[pi] = m.position.x; P[pi + 1] = m.position.y; P[pi + 2] = m.position.z;
      if (b.name === 'sun') {
        const sr = b.r / Math.max(dist, b.r); BR[i] = 60 * Math.PI * sr * sr * pxPerRad * pxPerRad * 0.6; C[pi] = 1; C[pi + 1] = 0.95; C[pi + 2] = 0.88;
        F[i] = 1 - THREE.MathUtils.smoothstep(discPx, 2, 6);
      } else {
        const toSun = tmp.copy(b.pos).negate().normalize(), toCam = new THREE.Vector3().subVectors(cam, b.pos).normalize();
        const alpha = Math.acos(THREE.MathUtils.clamp(toSun.dot(toCam), -1, 1)), phase = ((Math.PI - alpha) * Math.cos(alpha) + Math.sin(alpha)) / Math.PI; // Lambert sphere
        const sr = b.r / Math.max(dist, b.r);
        BR[i] = b.albedo * phase * Math.pow(AU / rSun, 2) * Math.PI * sr * sr * pxPerRad * pxPerRad * 1.0;
        C[pi] = b.tint.r; C[pi + 1] = b.tint.g; C[pi + 2] = b.tint.b;
        F[i] = 1 - THREE.MathUtils.smoothstep(discPx, 1.0, 3.0);
      }
    });
    this.glowU.uPx.value = pixelRatio;
    for (const k of ['position', 'aBright', 'aColor', 'aFade']) this.glow.geometry.attributes[k].needsUpdate = true;
    this.sunU.uTime.value = time;
    { const sb = B.sun, rel = tmp.subVectors(sb.pos, cam), d = rel.length(); this.glare.position.copy(rel).divideScalar(UNIT);
      this.glare.scale.setScalar(sb.r * 12 / UNIT); this.glare.lookAt(0, 0, 0); this.glare.visible = d > sb.r * 1.5;
      this.glareU.uI.value = 60 * Math.min(1, Math.pow(sb.r * 40 / d, 0.5)); }
    // orbits: rebased to the camera every frame (float32 precision near the camera)
    for (const o of this.orbits) {
      o.line.visible = showOrbits; if (!showOrbits) continue;
      const a = o.line.geometry.attributes.position.array, k = o.km;
      for (let j = 0; j < a.length; j += 3) { a[j] = (k[j] - cam.x) / UNIT; a[j + 1] = (k[j + 1] - cam.y) / UNIT; a[j + 2] = (k[j + 2] - cam.z) / UNIT; }
      o.line.geometry.attributes.position.needsUpdate = true; o.m.uniforms.uA.value = orbitAlpha;
    }
  }
}
