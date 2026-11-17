// Orbital mechanics and reference frames.
// World frame (render): heliocentric ecliptic J2000 rotated so +Y is ecliptic north:
//   world = (x_ecl, z_ecl, -y_ecl), units: kilometres (doubles on the CPU; camera-relative floats on the GPU).
import * as THREE from 'three';

export const DEG = Math.PI / 180;
export const AU = 149597870.7;            // km
export const C_KMS = 299792.458;          // km/s
export const OBLIQ = 23.43928 * DEG;

// JPL "Keplerian elements for approximate positions of the major planets" (Standish), 1800-2050 AD:
// a [AU], e, I [deg], L [deg], long.peri [deg], long.node [deg] at J2000 and per Julian century.
const EL = {
  mercury: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus:   [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
  earth:   [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
  mars:    [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn:  [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  uranus:  [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503], [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
  neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
  pluto:   [[39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684], [-0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482]],
};

// Physical data: mean radius [km], flattening, IAU pole (RA, Dec deg), prime meridian W = W0 + Wd*d (deg, d = days since J2000),
// geometric albedo (for star-like brightness when the disc is smaller than a pixel).
export const BODY = {
  sun:     { r: 695700, f: 0, pole: [286.13, 63.87], W: [84.176, 14.1844], albedo: 0 },
  mercury: { r: 2439.7, f: 0, pole: [281.01, 61.45], W: [329.5469, 6.1385025], albedo: 0.142 },
  venus:   { r: 6051.8, f: 0, pole: [272.76, 67.16], W: [160.20, -1.4813688], albedo: 0.689 },
  earth:   { r: 6371.0, f: 0.00335, pole: [0.0, 90.0], W: [190.147, 360.9856235], albedo: 0.434 },
  moon:    { r: 1737.4, f: 0, pole: [266.86, 65.64], W: [38.3213, 13.17635815], albedo: 0.12 },
  mars:    { r: 3389.5, f: 0.00589, pole: [317.68, 52.89], W: [176.630, 350.89198226], albedo: 0.170 },
  jupiter: { r: 69911, f: 0.06487, pole: [268.06, 64.50], W: [284.95, 870.536], albedo: 0.538 },
  saturn:  { r: 58232, f: 0.09796, pole: [40.59, 83.54], W: [38.90, 810.7939024], albedo: 0.499 },
  uranus:  { r: 25362, f: 0.02293, pole: [257.31, -15.18], W: [203.81, -501.1600928], albedo: 0.488 },
  neptune: { r: 24622, f: 0.01708, pole: [299.36, 43.46], W: [249.978, 541.1397757], albedo: 0.442 },
  pluto:   { r: 1188.3, f: 0, pole: [132.99, -6.16], W: [302.695, 56.3625225], albedo: 0.52 },
};
export const PLANETS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

export function julianDate(date = new Date()) { return date.getTime() / 86400000 + 2440587.5; }

export function solveKepler(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 30; k++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-12) break; }
  return E;
}

// heliocentric ecliptic position [km] from classical elements (angles in degrees), as a world-frame Vector3
export function keplerPos(a, e, I, node, argPeri, M, out = new THREE.Vector3()) {
  const E = solveKepler(((M % 360) + 360) % 360 * DEG, e);
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const w = argPeri * DEG, O = node * DEG, i = I * DEG, cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i);
  const x = (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp;
  const y = (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp;
  const z = (sw * si) * xp + (cw * si) * yp;
  return out.set(x * AU, z * AU, -y * AU);
}

export function elements(name, jd) {
  const [e0, r] = EL[name], T = (jd - 2451545.0) / 36525;
  const a = e0[0] + r[0] * T, e = e0[1] + r[1] * T, I = e0[2] + r[2] * T, L = e0[3] + r[3] * T, peri = e0[4] + r[4] * T, node = e0[5] + r[5] * T;
  return { a, e, I, node, argPeri: peri - node, M: L - peri };
}
export function planetPos(name, jd, out) { const k = elements(name, jd); return keplerPos(k.a, k.e, k.I, k.node, k.argPeri, k.M, out); }
export function orbitPeriodDays(a) { return 365.25636 * Math.pow(a, 1.5); }

// sample a full orbit as a closed polyline (world km), for drawing
export function orbitPoints(k, n = 720) {
  const pts = [];
  for (let j = 0; j < n; j++) pts.push(keplerPos(k.a, k.e, k.I, k.node, k.argPeri, j / n * 360));
  return pts;
}

// equatorial (ICRF) unit vector -> world
export function eqToWorld(v) { // v: THREE.Vector3 in equatorial (x to vernal equinox, z to celestial north)
  const y = v.y * Math.cos(OBLIQ) + v.z * Math.sin(OBLIQ), z = -v.y * Math.sin(OBLIQ) + v.z * Math.cos(OBLIQ);
  return new THREE.Vector3(v.x, z, -y);
}
export function radec(raDeg, decDeg) { const a = raDeg * DEG, d = decDeg * DEG; return new THREE.Vector3(Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)); }

// body-fixed orientation as a quaternion: local +Y = north pole, local +X = prime meridian (lon 0), local +Z = lon 90 W? -> east
// (Three's SphereGeometry maps u=0..1 to lon -180..180 around +Y with u=0.5 at local -X... handled in the shader by explicit lon/lat.)
export function bodyFrame(name, jd) {
  const b = BODY[name], d = jd - 2451545.0;
  const P = eqToWorld(radec(b.pole[0], b.pole[1])).normalize();
  const N = eqToWorld(radec(b.pole[0] + 90, 0)).normalize();          // ascending node of the body equator on the ICRF equator
  const W = ((b.W[0] + b.W[1] * d) % 360) * DEG;
  const Q = new THREE.Vector3().crossVectors(P, N).normalize();       // 90 deg east of the node along the body equator
  const X = N.clone().multiplyScalar(Math.cos(W)).addScaledVector(Q, Math.sin(W)); // prime meridian
  const E = new THREE.Vector3().crossVectors(P, X).normalize();       // lon +90 east
  return { pole: P, x: X, e: E };
}

// Moon: low-precision geocentric position (km) — mean elements with the main perturbation terms (Meeus, ~0.3 deg)
export function moonGeo(jd, out = new THREE.Vector3()) {
  const T = (jd - 2451545.0) / 36525, d2r = DEG;
  const Lp = 218.3164477 + 481267.88123421 * T, D = 297.8501921 + 445267.1114034 * T, M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T, F = 93.2720950 + 483202.0175233 * T;
  const lon = Lp + 6.289 * Math.sin(Mp * d2r) + 1.274 * Math.sin((2 * D - Mp) * d2r) + 0.658 * Math.sin(2 * D * d2r) + 0.214 * Math.sin(2 * Mp * d2r) - 0.186 * Math.sin(M * d2r) - 0.114 * Math.sin(2 * F * d2r);
  const lat = 5.128 * Math.sin(F * d2r) + 0.281 * Math.sin((Mp + F) * d2r) + 0.278 * Math.sin((Mp - F) * d2r);
  const dist = 385000.56 - 20905.355 * Math.cos(Mp * d2r) - 3699.111 * Math.cos((2 * D - Mp) * d2r) - 2955.968 * Math.cos(2 * D * d2r);
  const l = lon * d2r, b = lat * d2r;
  return out.set(dist * Math.cos(b) * Math.cos(l), dist * Math.sin(b), -dist * Math.cos(b) * Math.sin(l));
}

// human-friendly durations for the kid-facing readouts
export function lightTime(km) { return km / C_KMS; } // seconds
