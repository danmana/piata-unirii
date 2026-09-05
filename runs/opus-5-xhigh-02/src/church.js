// St. Michael's Church (Biserica Sfântul Mihail) - the hero asset.
//
// Built at 0.25 m voxels: an enormous elongated hall-church nave under one huge
// steep clay roof, a polygonal sanctuary to the east, deep stepped buttresses, tall
// traceried lancets, and the neo-Gothic bell tower standing forward of the north
// half of the west front. Single dominant tower, no symmetrical twins.

import { CHURCH } from './layout.js';
import { P } from './palette.js';
import { makeNoise2D } from './rng.js';

const noise = makeNoise2D('st-michael');

// --- helpers ----------------------------------------------------------------

/** Two-centred pointed arch: height above the springing at offset du from centre. */
function archRise(du, hw, h) {
  if (du >= hw) return 0;
  const c = (h * h - hw * hw) / (2 * hw);
  const R = hw + c;
  const q = R * R - (du + c) * (du + c);
  return q <= 0 ? 0 : Math.sqrt(q);
}

/**
 * Cut a traceried pointed window into an axis-aligned wall.
 * axis: 'x' (wall normal along X) or 'z'. dir: +1/-1 outward normal.
 * plane: coordinate of the outer wall face. u0..u1: opening extent on the other axis.
 */
function lancet(b, o) {
  const vs = b.vs;
  const { axis, dir, plane, u0, u1, yBase, ySpring, yApex } = o;
  const depth = o.depth ?? 1.1;
  const glassMat = o.glass ?? P.windowGlassDark;
  const frameMat = o.frame ?? P.churchTrim;
  const hw = (u1 - u0) / 2, uc = (u0 + u1) / 2;
  const h = yApex - ySpring;
  const inner = plane - dir * depth;          // back of the recess
  const glassA = Math.min(inner, inner + dir * 0.3);
  const glassB = Math.max(inner, inner + dir * 0.3);
  const cutA = Math.min(plane, inner), cutB = Math.max(plane, inner);
  const nMull = o.mullions ?? 2;

  for (let u = u0; u < u1 - 1e-6; u += vs) {
    const du = Math.abs(u + vs / 2 - uc);
    const top = du <= hw ? ySpring + archRise(du, hw, h) : yBase;
    if (top <= yBase + vs) continue;
    if (axis === 'z') {
      b.carve(u, yBase, cutA, u + vs, top, cutB);
      b.box(u, yBase, glassA, u + vs, top - 0.2, glassB, glassMat);
    } else {
      b.carve(cutA, yBase, u, cutB, top, u + vs);
      b.box(glassA, yBase, u, glassB, top - 0.2, u + vs, glassMat);
    }
  }

  // mullions and simple head tracery, one voxel thick
  const mA = Math.min(inner + dir * 0.3, inner + dir * 0.75);
  const mB = Math.max(inner + dir * 0.3, inner + dir * 0.75);
  const barW = Math.max(vs, 0.3);
  for (let k = 1; k <= nMull; k++) {
    const u = uc - hw + (2 * hw * k) / (nMull + 1);
    const topBar = ySpring + h * 0.42;
    if (axis === 'z') b.box(u - barW / 2, yBase, mA, u + barW / 2, topBar, mB, frameMat);
    else b.box(mA, yBase, u - barW / 2, mB, topBar, u + barW / 2, frameMat);
  }
  // head: a small circle plus the bars rising into the arch
  const cy = ySpring + h * 0.62;
  const rr = Math.min(hw * 0.34, h * 0.20);
  for (let a = 0; a < Math.PI * 2; a += 0.09) {
    const u = uc + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (axis === 'z') b.box(u - vs, y - vs, mA, u + vs, y + vs, mB, frameMat);
    else b.box(mA, y - vs, u - vs, mB, y + vs, u + vs, frameMat);
  }
  for (let k = 1; k <= nMull; k++) {
    const u0b = uc - hw + (2 * hw * k) / (nMull + 1);
    const steps = 14;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const u = u0b + (uc - u0b) * t;
      const y = ySpring + h * 0.42 + (cy - rr - (ySpring + h * 0.42)) * Math.sin(t * Math.PI / 2);
      if (axis === 'z') b.box(u - barW / 2, y, mA, u + barW / 2, y + vs * 1.5, mB, frameMat);
      else b.box(mA, y, u - barW / 2, mB, y + vs * 1.5, u + barW / 2, frameMat);
    }
  }

  // projecting hood mould over the arch
  if (o.hood !== false) {
    const pA = Math.min(plane, plane + dir * 0.35), pB = Math.max(plane, plane + dir * 0.35);
    for (let u = uc - hw - 0.5; u < uc + hw + 0.5; u += vs) {
      const du = Math.abs(u + vs / 2 - uc);
      const top = du <= hw ? ySpring + archRise(du, hw, h) : ySpring;
      const y = Math.max(ySpring, top) + 0.1;
      if (axis === 'z') b.box(u, y, pA, u + vs, y + 0.35, pB, frameMat);
      else b.box(pA, y, u, pB, y + 0.35, u + vs, frameMat);
    }
  }
}

/** A filled disc lying in an axis-aligned plane (clock faces, oculi). */
function disc(b, axis, p0, p1, cu, cv, r, mat, ring = 0) {
  const vs = b.vs;
  for (let u = cu - r; u <= cu + r; u += vs) {
    for (let v = cv - r; v <= cv + r; v += vs) {
      const d = Math.hypot(u + vs / 2 - cu, v + vs / 2 - cv);
      if (d > r) continue;
      if (ring > 0 && d < r - ring) continue;
      if (axis === 'z') b.box(u, v, p0, u + vs, v + vs, p1, mat);
      else b.box(p0, v, u, p1, v + vs, u + vs, mat);
    }
  }
}

/** Stepped buttress with a weathered cap and a crocketed pinnacle. */
function buttress(b, o) {
  const { axis, dir, plane, uc, w, proj, top, mat, capMat } = o;
  const stages = [
    { h: top * 0.42, p: proj, w: w },
    { h: top * 0.72, p: proj * 0.72, w: w * 0.88 },
    { h: top, p: proj * 0.46, w: w * 0.76 },
  ];
  let y = 0;
  for (const s of stages) {
    const hw = s.w / 2;
    const a = Math.min(plane, plane + dir * s.p), c = Math.max(plane, plane + dir * s.p);
    if (axis === 'z') b.box(uc - hw, y, a, uc + hw, s.h, c, mat);
    else b.box(a, y, uc - hw, c, s.h, uc + hw, mat);
    // sloped weathering on top of each set-back
    const nextP = s === stages[stages.length - 1] ? 0 : s.p;
    const steps = 5;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const pp = s.p * (1 - t) + (nextP === 0 ? 0 : nextP * 0.6) * t;
      const aa = Math.min(plane, plane + dir * pp), cc = Math.max(plane, plane + dir * pp);
      const yy = s.h + i * 0.25;
      if (axis === 'z') b.box(uc - hw, yy, aa, uc + hw, yy + 0.25, cc, capMat);
      else b.box(aa, yy, uc - hw, cc, yy + 0.25, uc + hw, capMat);
    }
    y = s.h;
  }
  // pinnacle
  const pTop = top + 1.5;
  const pp = proj * 0.34;
  const a = Math.min(plane, plane + dir * pp), c = Math.max(plane, plane + dir * pp);
  const pw = w * 0.42;
  if (axis === 'z') {
    b.box(uc - pw / 2, top + 1.2, a, uc + pw / 2, pTop + 1.0, c, mat);
    b.pyramid(uc - pw / 2, Math.min(a, c), uc + pw / 2, Math.max(a, c), pTop + 1.0, pTop + 2.6, capMat);
  } else {
    b.box(a, top + 1.2, uc - pw / 2, c, pTop + 1.0, uc + pw / 2, mat);
    b.pyramid(Math.min(a, c), uc - pw / 2, Math.max(a, c), uc + pw / 2, pTop + 1.0, pTop + 2.6, capMat);
  }
}

// --- the church --------------------------------------------------------------

export function buildChurch(b, detail) {
  const N = CHURCH.nave, A = CHURCH.apse, T = CHURCH.tower;
  const S = P.churchStone, SD = P.churchStoneDark, ST = P.churchTrim;
  const SW = P.churchStoneWarm, SC = P.churchStoneCool;

  const roofTone = (x, z) => {
    const n = noise.fbm(x / 3.4 + 3, z / 3.4 + 11, 2);
    return n > 0.63 ? P.churchRoofLight : (n < 0.30 ? P.churchRoofDark : P.churchRoof);
  };

  // ---- nave shell -----------------------------------------------------------
  b.shell(N.x0, 0, N.z0, N.x1, CHURCH.eave, N.z1, S, 1.5);
  // subtle ashlar banding so the great wall is not one flat tone
  for (let y = 0; y < CHURCH.eave; y += 2.5) {
    const m = ((y / 2.5) | 0) % 3 === 0 ? SW : (((y / 2.5) | 0) % 3 === 1 ? S : SC);
    b.box(N.x0, y, N.z0, N.x0 + 0.25, y + 0.25, N.z1, m);
    b.box(N.x1 - 0.25, y, N.z0, N.x1, y + 0.25, N.z1, m);
    b.box(N.x0, y, N.z0, N.x1, y + 0.25, N.z0 + 0.25, m);
    b.box(N.x0, y, N.z1 - 0.25, N.x1, y + 0.25, N.z1, m);
  }
  // plinth
  b.box(N.x0 - 0.6, 0, N.z0 - 0.6, N.x1 + 0.6, 1.3, N.z1 + 0.6, SD);
  b.box(N.x0 - 0.6, 1.3, N.z0 - 0.6, N.x1 + 0.6, 1.6, N.z1 + 0.6, ST);
  // string course
  b.box(N.x0 - 0.3, 7.6, N.z0 - 0.3, N.x1 + 0.3, 8.0, N.z1 + 0.3, ST);
  // eaves cornice
  b.box(N.x0 - 0.7, CHURCH.eave - 0.9, N.z0 - 0.7, N.x1 + 0.7, CHURCH.eave - 0.4, N.z1 + 0.7, ST);
  b.box(N.x0 - 0.4, CHURCH.eave - 0.4, N.z0 - 0.4, N.x1 + 0.4, CHURCH.eave, N.z1 + 0.4, SD);

  // ---- sanctuary (polygonal apse) -------------------------------------------
  const facets = [
    { x0: A.x0, x1: A.x0 + 3.0, z0: A.z0, z1: A.z1 },
    { x0: A.x0 + 3.0, x1: A.x0 + 6.0, z0: A.z0 + 1.2, z1: A.z1 - 1.2 },
    { x0: A.x0 + 6.0, x1: A.x0 + 8.6, z0: A.z0 + 3.2, z1: A.z1 - 3.2 },
    { x0: A.x0 + 8.6, x1: A.x1, z0: A.z0 + 6.0, z1: A.z1 - 6.0 },
  ];
  for (const f of facets) {
    b.shell(f.x0, 0, f.z0, f.x1, CHURCH.eave, f.z1, S, 1.4);
    b.box(f.x0 - 0.5, 0, f.z0 - 0.5, f.x1 + 0.5, 1.3, f.z1 + 0.5, SD);
    b.box(f.x0 - 0.5, 1.3, f.z0 - 0.5, f.x1 + 0.5, 1.6, f.z1 + 0.5, ST);
    b.box(f.x0 - 0.55, CHURCH.eave - 0.9, f.z0 - 0.55, f.x1 + 0.55, CHURCH.eave - 0.4, f.z1 + 0.55, ST);
    b.box(f.x0 - 0.3, CHURCH.eave - 0.4, f.z0 - 0.3, f.x1 + 0.3, CHURCH.eave, f.z1 + 0.3, SD);
  }

  // ---- great roof -----------------------------------------------------------
  b.gableX(N.x0 - 0.9, N.z0 - 0.9, N.x1 + 0.9, N.z1 + 0.9, CHURCH.eave, CHURCH.ridge, roofTone, 1.4, P.churchRoofRidge);
  // west gable wall closing the roof over the west front
  b.gableZ(N.x0 - 0.5, N.z0, N.x0, N.z1, CHURCH.eave, CHURCH.ridge, S, 0.6);
  for (let z = N.z0; z < N.z1; z += 0.25) {
    const dz = Math.abs(z + 0.125 - (N.z0 + N.z1) / 2);
    const half = (N.z1 - N.z0) / 2;
    const h = CHURCH.eave + (CHURCH.ridge - CHURCH.eave) * Math.max(0, 1 - dz / half);
    b.box(N.x0 - 0.9, CHURCH.eave, z, N.x0, h, z + 0.25, S);
  }
  // roof over the sanctuary: one faceted cone sweeping down from the nave ridge
  {
    const vs = b.vs;
    const zc = (A.z0 + A.z1) / 2;
    const peak = CHURCH.ridge - 1.2;
    for (let x = A.x0 - 0.9; x < A.x1 + 0.9 - 1e-6; x += vs) {
      const xm = x + vs / 2;
      let hw = 0;
      for (const f of facets) {
        if (xm >= f.x0 - 0.9 && xm < f.x1 + 0.9) hw = Math.max(hw, (f.z1 - f.z0) / 2 + 0.9);
      }
      if (hw <= 0) continue;
      const tx = Math.max(0, Math.min(1, (A.x1 + 0.9 - xm) / 8.0));
      for (let z = zc - hw; z < zc + hw - 1e-6; z += vs) {
        const dz = Math.abs(z + vs / 2 - zc);
        const tz = Math.max(0, 1 - dz / hw);
        const h = CHURCH.eave + (peak - CHURCH.eave) * Math.min(tz, tx);
        b.box(x, h - 1.2, z, x + vs, h, z + vs, roofTone(xm, z + vs / 2));
      }
    }
  }

  // ---- buttresses along the nave -------------------------------------------
  const butt = [];
  for (let x = N.x0 + 0.5; x <= N.x1 - 2.5; x += 8.6) butt.push(x + 1.0);
  for (const uc of butt) {
    buttress(b, { axis: 'z', dir: -1, plane: N.z0, uc, w: 2.1, proj: 2.6, top: 17.5, mat: S, capMat: ST });
    buttress(b, { axis: 'z', dir: 1, plane: N.z1, uc, w: 2.1, proj: 2.6, top: 17.5, mat: S, capMat: ST });
  }
  // buttresses at the apse facet joints
  for (const f of facets) {
    buttress(b, { axis: 'z', dir: -1, plane: f.z0, uc: f.x0 + 1.1, w: 1.7, proj: 2.0, top: 16, mat: S, capMat: ST });
    buttress(b, { axis: 'z', dir: 1, plane: f.z1, uc: f.x0 + 1.1, w: 1.7, proj: 2.0, top: 16, mat: S, capMat: ST });
  }
  buttress(b, { axis: 'x', dir: 1, plane: A.x1, uc: (A.z0 + A.z1) / 2 - 3.4, w: 1.7, proj: 2.0, top: 16, mat: S, capMat: ST });
  buttress(b, { axis: 'x', dir: 1, plane: A.x1, uc: (A.z0 + A.z1) / 2 + 3.4, w: 1.7, proj: 2.0, top: 16, mat: S, capMat: ST });

  // ---- lancet windows -------------------------------------------------------
  for (let i = 0; i < butt.length - 1; i++) {
    const cA = butt[i], cB = butt[i + 1];
    const uc = (cA + cB) / 2, hw = 2.1;
    lancet(b, { axis: 'z', dir: -1, plane: N.z0, u0: uc - hw, u1: uc + hw, yBase: 8.6, ySpring: 15.0, yApex: 19.4, depth: 1.15, frame: ST });
    lancet(b, { axis: 'z', dir: 1, plane: N.z1, u0: uc - hw, u1: uc + hw, yBase: 8.6, ySpring: 15.0, yApex: 19.4, depth: 1.15, frame: ST });
    // small aisle windows below the string course
    lancet(b, { axis: 'z', dir: -1, plane: N.z0, u0: uc - 1.3, u1: uc + 1.3, yBase: 3.0, ySpring: 5.4, yApex: 7.0, depth: 0.9, mullions: 1, hood: false, frame: ST });
    lancet(b, { axis: 'z', dir: 1, plane: N.z1, u0: uc - 1.3, u1: uc + 1.3, yBase: 3.0, ySpring: 5.4, yApex: 7.0, depth: 0.9, mullions: 1, hood: false, frame: ST });
  }
  // sanctuary windows
  for (const f of facets.slice(1)) {
    const uc = (f.x0 + f.x1) / 2;
    if (f.x1 - f.x0 < 2.4) continue;
    lancet(b, { axis: 'z', dir: -1, plane: f.z0, u0: uc - 1.1, u1: uc + 1.1, yBase: 6.5, ySpring: 13.5, yApex: 18.0, depth: 1.05, mullions: 1, frame: ST });
    lancet(b, { axis: 'z', dir: 1, plane: f.z1, u0: uc - 1.1, u1: uc + 1.1, yBase: 6.5, ySpring: 13.5, yApex: 18.0, depth: 1.05, mullions: 1, frame: ST });
  }
  const az = (A.z0 + A.z1) / 2;
  lancet(b, { axis: 'x', dir: 1, plane: A.x1, u0: az - 2.0, u1: az + 2.0, yBase: 6.0, ySpring: 13.0, yApex: 18.2, depth: 1.1, frame: ST });

  // ---- west front -----------------------------------------------------------
  // the great west window sits south of the tower, so the front is deliberately
  // asymmetric - the signature of St Michael's
  lancet(b, { axis: 'x', dir: -1, plane: N.x0, u0: -18.5, u1: -12.0, yBase: 11.0, ySpring: 20.5, yApex: 28.5, depth: 1.3, mullions: 3, frame: ST });
  // west portal
  lancet(b, { axis: 'x', dir: -1, plane: N.x0, u0: -18.0, u1: -12.5, yBase: 0.2, ySpring: 4.2, yApex: 7.4, depth: 1.4, mullions: 0, glass: P.doorWoodDark, frame: ST });
  b.box(N.x0 - 1.5, 0, -19.6, N.x0, 9.6, -10.9, SD);
  b.carve(N.x0 - 1.5, 0.2, -18.6, N.x0 + 0.1, 7.6, -11.9);
  b.box(N.x0 - 1.5, 0.2, -18.6, N.x0 - 1.2, 7.2, -11.9, P.doorWoodDark);
  lancet(b, { axis: 'x', dir: -1, plane: N.x0 - 1.5, u0: -18.6, u1: -11.9, yBase: 0.2, ySpring: 4.6, yApex: 8.0, depth: 1.5, mullions: 0, glass: P.doorWood, frame: ST });
  // gable over the portal
  b.gableZ(N.x0 - 1.9, -20.2, N.x0 - 0.4, -10.3, 9.4, 13.4, ST, 0.5);

  // ---- south porch (the 1444 portal) ---------------------------------------
  const px0 = 2.0, px1 = 10.0, pz1 = N.z1 + 3.4;
  b.shell(px0, 0, N.z1 - 0.4, px1, 9.0, pz1, S, 0.9);
  b.box(px0 - 0.4, 0, N.z1, px1 + 0.4, 1.3, pz1 + 0.4, SD);
  b.box(px0 - 0.5, 8.4, N.z1, px1 + 0.5, 9.0, pz1 + 0.5, ST);
  b.gableZ(px0 - 0.7, N.z1 - 0.4, px1 + 0.7, pz1 + 0.7, 9.0, 13.6, roofTone, 0.9);
  lancet(b, { axis: 'z', dir: 1, plane: pz1, u0: px0 + 1.3, u1: px1 - 1.3, yBase: 0.2, ySpring: 4.6, yApex: 7.6, depth: 1.0, mullions: 0, glass: P.doorWoodDark, frame: ST });
  for (let i = 0; i < 2; i++) {
    const x = i ? px1 - 0.4 : px0 - 0.4;
    b.box(x, 9.0, pz1 - 0.9, x + 0.8, 11.4, pz1 - 0.1, S);
    b.pyramid(x, pz1 - 0.9, x + 0.8, pz1 - 0.1, 11.4, 13.2, ST);
  }

  // ---- Schleynig chapel (small south annex) --------------------------------
  b.shell(-13.5, 0, N.z1 - 0.4, -6.5, 8.4, N.z1 + 4.4, S, 0.9);
  b.box(-14.0, 0, N.z1, -6.0, 1.2, N.z1 + 4.8, SD);
  b.box(-14.0, 7.9, N.z1, -6.0, 8.4, N.z1 + 4.8, ST);
  b.gableX(-14.1, N.z1 - 0.5, -5.9, N.z1 + 4.9, 8.4, 12.2, roofTone, 0.8, P.churchRoofRidge);
  lancet(b, { axis: 'z', dir: 1, plane: N.z1 + 4.4, u0: -11.6, u1: -8.4, yBase: 2.4, ySpring: 5.4, yApex: 7.4, depth: 0.85, mullions: 1, frame: ST });

  // ---- north stair turret ---------------------------------------------------
  b.polyPrism(43.5, N.z0 - 1.6, 2.0, 8, Math.PI / 8, 0, 26.0, S);
  b.polyPrism(43.5, N.z0 - 1.6, 2.3, 8, Math.PI / 8, 25.4, 26.6, ST);
  b.octSpire(43.5, N.z0 - 1.6, 2.3, 26.6, 32.6, P.churchRoofDark, 0.1, false);
  for (let y = 4; y < 24; y += 3.4) {
    b.box(43.2, y, N.z0 - 3.7, 43.8, y + 1.4, N.z0 - 3.2, P.windowGlassDark);
  }

  // ---- bell tower -----------------------------------------------------------
  const tcx = (T.x0 + T.x1) / 2, tcz = (T.z0 + T.z1) / 2;
  const tw = T.x1 - T.x0;

  // plinth and shaft
  b.box(T.x0 - 0.7, 0, T.z0 - 0.7, T.x1 + 0.7, 1.8, T.z1 + 0.7, SD);
  b.box(T.x0 - 0.7, 1.8, T.z0 - 0.7, T.x1 + 0.7, 2.2, T.z1 + 0.7, ST);
  b.shell(T.x0, 0, T.z0, T.x1, 46.0, T.z1, S, 1.4);
  // corner pilasters, stepping back with each stage
  const cornerPilasters = (y0, y1, proj, wdt) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx < 0 ? T.x0 : T.x1 - wdt;
      const z = sz < 0 ? T.z0 : T.z1 - wdt;
      b.box(x - (sx < 0 ? proj : 0), y0, z - (sz < 0 ? proj : 0),
        x + wdt + (sx > 0 ? proj : 0), y1, z + wdt + (sz > 0 ? proj : 0), SW);
    }
  };
  cornerPilasters(2.2, 30.0, 0.7, 2.4);
  cornerPilasters(30.0, 46.0, 0.45, 2.1);
  // stringcourses
  for (const y of [16.0, 30.0, 45.2]) {
    b.box(T.x0 - 0.55, y, T.z0 - 0.55, T.x1 + 0.55, y + 0.45, T.z1 + 0.55, ST);
  }
  // ashlar banding on the shaft
  for (let y = 2.5; y < 45; y += 3.0) {
    const m = ((y / 3) | 0) % 2 === 0 ? SW : SC;
    b.box(T.x0, y, T.z0, T.x0 + 0.25, y + 0.25, T.z1, m);
    b.box(T.x1 - 0.25, y, T.z0, T.x1, y + 0.25, T.z1, m);
    b.box(T.x0, y, T.z0, T.x1, y + 0.25, T.z0 + 0.25, m);
    b.box(T.x0, y, T.z1 - 0.25, T.x1, y + 0.25, T.z1, m);
  }

  // tower doorway on the west face
  lancet(b, { axis: 'x', dir: -1, plane: T.x0, u0: tcz - 1.7, u1: tcz + 1.7, yBase: 0.2, ySpring: 3.6, yApex: 6.2, depth: 1.35, mullions: 0, glass: P.doorWoodDark, frame: ST });
  // blind tracery panels, one per face per stage
  const towerFaces = [
    { axis: 'x', dir: -1, plane: T.x0, uc: tcz },
    { axis: 'x', dir: 1, plane: T.x1, uc: tcz },
    { axis: 'z', dir: -1, plane: T.z0, uc: tcx },
    { axis: 'z', dir: 1, plane: T.z1, uc: tcx },
  ];
  for (const f of towerFaces) {
    if (!(f.axis === 'x' && f.dir === 1)) {
      lancet(b, Object.assign({}, f, { u0: f.uc - 2.0, u1: f.uc + 2.0, yBase: 9.5, ySpring: 13.4, yApex: 15.4, depth: 0.8, mullions: 1, frame: ST }));
      lancet(b, Object.assign({}, f, { u0: f.uc - 2.2, u1: f.uc + 2.2, yBase: 19.0, ySpring: 25.0, yApex: 28.4, depth: 0.9, mullions: 2, frame: ST }));
    }
    // belfry openings
    lancet(b, Object.assign({}, f, {
      u0: f.uc - 2.4, u1: f.uc + 2.4, yBase: 32.5, ySpring: 40.0, yApex: 44.4,
      depth: 1.2, mullions: 2, glass: P.churchShadow, frame: ST,
    }));
  }

  // clock stage
  b.box(T.x0 - 0.4, 46.0, T.z0 - 0.4, T.x1 + 0.4, 46.7, T.z1 + 0.4, ST);
  b.shell(T.x0 - 0.2, 46.7, T.z0 - 0.2, T.x1 + 0.2, 56.0, T.z1 + 0.2, SW, 1.3);
  cornerPilasters(46.7, 56.0, 0.5, 1.9);
  const clockR = 2.1;
  for (const f of towerFaces) {
    const p0 = f.dir < 0 ? (f.plane - 0.45) : (f.plane - 0.05);
    const p1 = f.dir < 0 ? (f.plane + 0.05) : (f.plane + 0.45);
    disc(b, f.axis, p0 - (f.dir < 0 ? 0.15 : 0), p1 + (f.dir > 0 ? 0.15 : 0), f.uc, 51.3, clockR + 0.45, P.whiteStone);
    disc(b, f.axis, p0, p1, f.uc, 51.3, clockR, P.ironDark);
    // hands
    if (f.axis === 'z') {
      b.box(f.uc - 0.16, 51.3, p0 - 0.1, f.uc + 0.16, 51.3 + clockR * 0.78, p1 + 0.1, P.gold);
      b.box(f.uc - 0.05, 51.16, p0 - 0.1, f.uc + clockR * 0.55, 51.44, p1 + 0.1, P.gold);
    } else {
      b.box(p0 - 0.1, 51.3, f.uc - 0.16, p1 + 0.1, 51.3 + clockR * 0.78, f.uc + 0.16, P.gold);
      b.box(p0 - 0.1, 51.16, f.uc - 0.05, p1 + 0.1, 51.44, f.uc + clockR * 0.55, P.gold);
    }
  }

  // crowning cornice, parapet and pinnacles
  b.box(T.x0 - 1.1, 56.0, T.z0 - 1.1, T.x1 + 1.1, 57.0, T.z1 + 1.1, ST);
  b.box(T.x0 - 1.3, 57.0, T.z0 - 1.3, T.x1 + 1.3, 57.6, T.z1 + 1.3, SD);
  // openwork parapet
  const pTop = CHURCH.towerTop;
  for (let u = T.x0 - 1.2; u < T.x1 + 1.2; u += 1.0) {
    b.box(u, 57.6, T.z0 - 1.2, u + 0.55, pTop - 0.6, T.z0 - 0.7, SW);
    b.box(u, 57.6, T.z1 + 0.7, u + 0.55, pTop - 0.6, T.z1 + 1.2, SW);
  }
  for (let u = T.z0 - 1.2; u < T.z1 + 1.2; u += 1.0) {
    b.box(T.x0 - 1.2, 57.6, u, T.x0 - 0.7, pTop - 0.6, u + 0.55, SW);
    b.box(T.x1 + 0.7, 57.6, u, T.x1 + 1.2, pTop - 0.6, u + 0.55, SW);
  }
  b.box(T.x0 - 1.3, pTop - 0.6, T.z0 - 1.3, T.x1 + 1.3, pTop, T.z1 + 1.3, ST);

  // corner pinnacles
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx < 0 ? T.x0 - 1.6 : T.x1 + 0.2;
    const z = sz < 0 ? T.z0 - 1.6 : T.z1 + 0.2;
    b.box(x, 56.0, z, x + 1.4, pTop + 3.4, z + 1.4, SW);
    b.box(x - 0.2, pTop + 3.4, z - 0.2, x + 1.6, pTop + 3.9, z + 1.6, ST);
    b.octSpire(x + 0.7, z + 0.7, 0.85, pTop + 3.9, pTop + 8.2, SC, 0.05, false);
    // crockets
    for (let k = 0; k < 4; k++) {
      const yy = pTop + 4.6 + k * 0.9;
      const rr = 0.75 * (1 - k / 5);
      b.box(x + 0.7 - rr - 0.3, yy, z + 0.7 - 0.15, x + 0.7 - rr + 0.05, yy + 0.3, z + 0.7 + 0.15, ST);
      b.box(x + 0.7 + rr - 0.05, yy, z + 0.7 - 0.15, x + 0.7 + rr + 0.3, yy + 0.3, z + 0.7 + 0.15, ST);
    }
  }
  // mid-side pinnacles
  for (const f of towerFaces) {
    const bx = f.axis === 'z' ? f.uc : (f.dir < 0 ? T.x0 - 1.0 : T.x1 + 0.3);
    const bz = f.axis === 'x' ? f.uc : (f.dir < 0 ? T.z0 - 1.0 : T.z1 + 0.3);
    b.box(bx - 0.45, 57.6, bz - 0.45, bx + 0.45, pTop + 1.6, bz + 0.45, SW);
    b.octSpire(bx, bz, 0.5, pTop + 1.6, pTop + 4.4, SC, 0.05, false);
  }

  // ---- spire ----------------------------------------------------------------
  const sBase = pTop - 0.4, sTop = CHURCH.spireTop;
  b.octSpire(tcx, tcz, tw / 2 + 0.35, sBase, sTop, SC, 0.12, true);
  // eight ribs, one voxel proud, catching the light
  for (let s = 0; s < 8; s++) {
    const a = s * Math.PI / 4;
    const steps = 62;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = sBase + (sTop - sBase) * t;
      const r = (tw / 2 + 0.35) * (1 - t) + 0.12 * t + 0.16;
      const x = tcx + Math.cos(a) * r, z = tcz + Math.sin(a) * r;
      b.box(x - 0.22, y, z - 0.22, x + 0.22, y + 0.3, z + 0.22, ST);
    }
  }
  // lucarnes at the spire foot
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const lx = tcx + dx * (tw / 2 - 0.4), lz = tcz + dz * (tw / 2 - 0.4);
    b.box(lx - (dz ? 0.9 : 0.5), sBase + 1.2, lz - (dx ? 0.9 : 0.5), lx + (dz ? 0.9 : 0.5), sBase + 3.6, lz + (dx ? 0.9 : 0.5), SW);
    b.pyramid(lx - (dz ? 1.0 : 0.6), lz - (dx ? 1.0 : 0.6), lx + (dz ? 1.0 : 0.6), lz + (dx ? 1.0 : 0.6), sBase + 3.6, sBase + 5.4, SC);
    b.box(lx - (dz ? 0.5 : 0.25), sBase + 1.6, lz - (dx ? 0.5 : 0.25), lx + (dz ? 0.5 : 0.25), sBase + 3.2, lz + (dx ? 0.5 : 0.25), P.churchShadow);
  }

  // ---- cross ----------------------------------------------------------------
  const cTop = CHURCH.crossTop;
  b.box(tcx - 0.28, sTop - 0.3, tcz - 0.28, tcx + 0.28, sTop + 0.5, tcz + 0.28, P.gold);
  b.box(tcx - 0.16, sTop + 0.5, tcz - 0.16, tcx + 0.16, cTop, tcz + 0.16, P.gold);
  b.box(tcx - 0.85, cTop - 1.5, tcz - 0.16, tcx + 0.85, cTop - 1.05, tcz + 0.16, P.gold);
  b.box(tcx - 0.16, cTop, tcz - 0.16, tcx + 0.16, cTop + 0.45, tcz + 0.16, P.gold);

  // ---- eaves detail: small gargoyle blocks ----------------------------------
  for (const uc of butt) {
    for (const [zp, d] of [[N.z0 - 0.7, -1], [N.z1 + 0.7, 1]]) {
      b.box(uc - 0.3, CHURCH.eave - 1.0, zp + (d < 0 ? -0.9 : 0), uc + 0.3, CHURCH.eave - 0.55, zp + (d < 0 ? 0 : 0.9), SD);
    }
  }

  // ---- ridge cresting -------------------------------------------------------
  const rz = (N.z0 + N.z1) / 2;
  for (let x = N.x0; x < N.x1; x += 1.6) {
    b.box(x, CHURCH.ridge, rz - 0.22, x + 0.5, CHURCH.ridge + 0.55, rz + 0.22, P.churchRoofRidge);
  }
  // small flèche over the nave/chancel joint
  b.box(A.x0 - 1.4, CHURCH.ridge - 0.4, rz - 1.4, A.x0 + 1.4, CHURCH.ridge + 2.2, rz + 1.4, SW);
  b.octSpire(A.x0, rz, 1.5, CHURCH.ridge + 2.2, CHURCH.ridge + 8.0, P.churchRoofDark, 0.1, false);
  b.box(A.x0 - 0.12, CHURCH.ridge + 8.0, rz - 0.12, A.x0 + 0.12, CHURCH.ridge + 9.4, rz + 0.12, P.gold);
  b.box(A.x0 - 0.5, CHURCH.ridge + 8.5, rz - 0.12, A.x0 + 0.5, CHURCH.ridge + 8.8, rz + 0.12, P.gold);
}
