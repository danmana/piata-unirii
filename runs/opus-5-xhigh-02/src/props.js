// Street furniture, cafe terraces, the southern fountain installation and the
// evening lamp glow. All repeated pieces go through instanced pools.

import * as THREE from 'three';
import { P } from './palette.js';
import { Rng } from './rng.js';
import { bakeModel, Pool, scatterPool } from './instances.js';
import { PLAZA, SQUARE, FOUNTAIN, WATER_TABLES, ROMAN_WINDOW, MONUMENT, CHURCH, RING, STREETS, terrainHeight, distToPolyline, streetBounds } from './layout.js';
import { makeRadialSprite } from './textures.js';

// --- models ------------------------------------------------------------------

const model = {
  bench: (b) => {
    const w = 1.95, d = 0.62;
    for (const s of [-1, 1]) {
      b.box(s * (w / 2 - 0.12) - 0.06, 0, -d / 2, s * (w / 2 - 0.12) + 0.06, 0.44, d / 2, P.iron);
      b.box(s * (w / 2 - 0.12) - 0.05, 0.44, -d / 2 + 0.06, s * (w / 2 - 0.12) + 0.05, 0.92, -d / 2 + 0.16, P.iron);
      b.box(s * (w / 2 - 0.05) - 0.05, 0, -d / 2 - 0.04, s * (w / 2 - 0.05) + 0.05, 0.06, d / 2 + 0.04, P.iron);
    }
    for (let i = 0; i < 4; i++) {
      b.box(-w / 2, 0.44, -d / 2 + i * 0.155, w / 2, 0.51, -d / 2 + i * 0.155 + 0.12, P.benchWood);
    }
    for (let i = 0; i < 3; i++) {
      b.box(-w / 2, 0.60 + i * 0.12, -d / 2 + 0.04, w / 2, 0.70 + i * 0.12, -d / 2 + 0.13, P.benchWood);
    }
  },
  lamp: (b) => {
    b.box(-0.24, 0, -0.24, 0.24, 0.28, 0.24, P.greyStoneDark);
    b.box(-0.15, 0.28, -0.15, 0.15, 0.55, 0.15, P.ironDark);
    b.box(-0.09, 0.55, -0.09, 0.09, 4.15, 0.09, P.iron);
    b.box(-0.16, 4.15, -0.16, 0.16, 4.30, 0.16, P.ironDark);
    for (let i = 0; i < 5; i++) {
      const t = i / 4, r = 0.30 - t * 0.13;
      b.box(-r, 4.30 + i * 0.14, -r, r, 4.44 + i * 0.14, r, P.lampGlow);
    }
    b.box(-0.26, 5.00, -0.26, 0.26, 5.14, 0.26, P.ironDark);
    b.box(-0.10, 5.14, -0.10, 0.10, 5.40, 0.10, P.ironDark);
    for (const s of [-1, 1]) {
      b.box(s * 0.10, 3.55, -0.05, s * 0.42, 3.66, 0.05, P.iron);
      b.box(s * 0.36, 3.66, -0.05, s * 0.42, 3.95, 0.05, P.iron);
    }
  },
  cafeSet: (b) => {
    // round table
    b.cylY(0, 0, 0.42, 0.70, 0.78, P.cafeWood);
    b.cylY(0, 0, 0.07, 0, 0.70, P.ironDark);
    b.cylY(0, 0, 0.28, 0, 0.06, P.ironDark);
    // four chairs
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const cx = Math.cos(a) * 0.85, cz = Math.sin(a) * 0.85;
      b.box(cx - 0.22, 0.42, cz - 0.22, cx + 0.22, 0.50, cz + 0.22, P.cafeWood);
      for (const [ox, oz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
        b.box(cx + ox - 0.035, 0, cz + oz - 0.035, cx + ox + 0.035, 0.42, cz + oz + 0.035, P.ironDark);
      }
      const bx = cx + Math.cos(a) * 0.20, bz = cz + Math.sin(a) * 0.20;
      b.box(bx - 0.20, 0.50, bz - 0.05, bx + 0.20, 0.92, bz + 0.05, P.cafeWood);
    }
  },
  umbrella: (b) => {
    b.cylY(0, 0, 0.28, 0, 0.08, P.greyStoneDark);
    b.box(-0.05, 0.08, -0.05, 0.05, 2.42, 0.05, P.ironDark);
    const R = 1.55;
    for (let i = 0; i < 11; i++) {
      const t = i / 10;
      const r = R * Math.sin((1 - t) * Math.PI * 0.52);
      b.cylY(0, 0, Math.max(b.vs, r), 2.42 - 0.42 + t * 0.42, 2.42 - 0.42 + (t + 0.1) * 0.42 + b.vs, P.awningCream, b.vs * 1.5);
    }
    b.cylY(0, 0, R * 0.99, 2.02, 2.10, P.awningCream);
    b.box(-0.09, 2.42, -0.09, 0.09, 2.60, 0.09, P.ironDark);
  },
  bicycle: (b) => {
    const wheel = (cx) => {
      for (let a = 0; a < Math.PI * 2; a += 0.14) {
        const x = cx + Math.cos(a) * 0.33, y = 0.35 + Math.sin(a) * 0.33;
        b.box(x - 0.05, y - 0.05, -0.035, x + 0.05, y + 0.05, 0.035, P.ironDark);
      }
      b.box(cx - 0.05, 0.30, -0.03, cx + 0.05, 0.40, 0.03, P.steel);
    };
    wheel(-0.52); wheel(0.52);
    b.box(-0.50, 0.36, -0.03, 0.20, 0.44, 0.03, P.iron);
    b.box(-0.10, 0.44, -0.03, 0.26, 0.76, 0.03, P.iron);
    b.box(0.24, 0.62, -0.03, 0.54, 0.78, 0.03, P.iron);
    b.box(-0.22, 0.76, -0.11, 0.02, 0.84, 0.11, P.doorWoodDark);
    b.box(0.46, 0.90, -0.24, 0.58, 0.97, 0.24, P.ironDark);
    b.box(0.50, 0.78, -0.03, 0.56, 0.92, 0.03, P.iron);
  },
  bollard: (b) => {
    b.cylY(0, 0, 0.14, 0, 0.86, P.greyStoneDark);
    b.cylY(0, 0, 0.17, 0.86, 0.96, P.iron);
    b.cylY(0, 0, 0.09, 0.96, 1.04, P.ironDark);
  },
  bin: (b) => {
    b.box(-0.06, 0, -0.06, 0.06, 0.42, 0.06, P.ironDark);
    b.cylY(0, 0, 0.26, 0.42, 1.02, P.iron, 0.09);
    b.cylY(0, 0, 0.30, 1.02, 1.10, P.ironDark);
  },
  planter: (b) => {
    b.box(-0.75, 0, -0.75, 0.75, 0.62, 0.75, P.greyStone);
    b.box(-0.82, 0.55, -0.82, 0.82, 0.68, 0.82, P.whiteStone);
    b.box(-0.66, 0.62, -0.66, 0.66, 0.76, 0.66, P.soil);
    b.ellipsoid(0, 1.02, 0, 0.7, 0.42, 0.7, P.hedge);
    b.ellipsoid(0.28, 1.22, -0.2, 0.36, 0.3, 0.34, P.leafD);
  },
  signpost: (b) => {
    b.box(-0.07, 0, -0.07, 0.07, 2.5, 0.07, P.iron);
    b.box(-0.72, 2.06, -0.045, 0.06, 2.34, 0.045, P.paleBlueGrey);
    b.box(-0.06, 1.70, -0.045, 0.68, 1.96, 0.045, P.paleBlueGrey);
    b.box(-0.16, 0, -0.16, 0.16, 0.10, 0.16, P.ironDark);
  },
  kiosk: (b) => {
    b.box(-1.5, 0, -1.1, 1.5, 2.55, 1.1, P.fadedGreen);
    b.box(-1.6, 0, -1.2, 1.6, 0.28, 1.2, P.greyStoneDark);
    b.box(-1.25, 0.85, -1.22, 1.25, 2.05, -1.05, P.shopGlass);
    b.box(-1.7, 2.55, -1.3, 1.7, 2.78, 1.3, P.roofZinc);
    for (let i = 0; i < 5; i++) {
      b.box(-1.7 + i * 0.7, 2.78, -1.45, -1.1 + i * 0.7, 2.92, -1.28, i % 2 ? P.awningRed : P.awningCream);
    }
  },
  uplight: (b) => {
    b.cylY(0, 0, 0.17, -0.02, 0.06, P.ironDark);
    b.cylY(0, 0, 0.13, 0.06, 0.10, P.lampGlow);
  },
  flagpole: (b) => {
    b.box(-0.4, 0, -0.4, 0.4, 0.35, 0.4, P.greyStone);
    b.box(-0.08, 0.35, -0.08, 0.08, 8.5, 0.08, P.steel);
    b.box(-0.14, 8.5, -0.14, 0.14, 8.7, 0.14, P.gold);
  },
};

export function buildPropModels() {
  return {
    bench: bakeModel(0.075, model.bench),
    lamp: bakeModel(0.09, model.lamp),
    cafeSet: bakeModel(0.075, model.cafeSet),
    umbrella: bakeModel(0.085, model.umbrella),
    bicycle: bakeModel(0.055, model.bicycle),
    bollard: bakeModel(0.07, model.bollard),
    bin: bakeModel(0.07, model.bin),
    planter: bakeModel(0.09, model.planter),
    signpost: bakeModel(0.07, model.signpost),
    kiosk: bakeModel(0.11, model.kiosk),
    uplight: bakeModel(0.05, model.uplight),
    flagpole: bakeModel(0.12, model.flagpole),
  };
}

// --- placement ---------------------------------------------------------------

const AWNING_TINTS = ['#e8dcc4', '#d9b8a6', '#c9d2c0', '#e3cfa8', '#d6bfae'];

export function planProps(blocked) {
  const rng = new Rng('props');
  const out = { bench: [], lamp: [], cafeSet: [], umbrella: [], bicycle: [], bollard: [], bin: [], planter: [], signpost: [], kiosk: [], uplight: [], flagpole: [] };
  const lampPositions = [];
  const push = (k, x, z, rot, extra) => {
    if (blocked && blocked(x, z)) return;
    out[k].push(Object.assign({ model: 0, x, y: terrainHeight(x, z), z, rot: rot ?? 0, scale: 1 }, extra));
  };

  // lamps: a steady rhythm just inside the plaza edge, and along the streets
  const step = 16;
  for (let x = PLAZA.x0 + 6; x <= PLAZA.x1 - 6; x += step) {
    for (const z of [PLAZA.z0 + 2.2, PLAZA.z1 - 2.2]) { push('lamp', x, z, rng.range(0, 3)); lampPositions.push([x, 4.9, z]); }
  }
  for (let z = PLAZA.z0 + 12; z <= PLAZA.z1 - 12; z += step) {
    for (const x of [PLAZA.x0 + 2.2, PLAZA.x1 - 2.2]) { push('lamp', x, z, rng.range(0, 3)); lampPositions.push([x, 4.9, z]); }
  }
  // a pair flanking the monument and the church west front
  for (const [lx, lz] of [[-34, 8], [-34, 20], [-6, 8], [-6, 20], [-34, -22], [-34, -34]]) {
    push('lamp', lx, lz, 0); lampPositions.push([lx, 4.9, lz]);
  }
  for (const s of STREETS) {
    if (s.ring) continue;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const [ax, az] = s.pts[i], [bx, bz] = s.pts[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const n = Math.floor(L / 30);
      for (let k = 1; k <= n; k++) {
        const t = k / (n + 1);
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const dx = (bx - ax) / L, dz = (bz - az) / L;
        for (const side of [-1, 1]) {
          const px = x - dz * side * (s.width / 2 + 1.8), pz = z + dx * side * (s.width / 2 + 1.8);
          if (Math.abs(px) > 330 || Math.abs(pz) > 330) continue;
          push('lamp', px, pz, 0);
          if (Math.hypot(px, pz) < 260) lampPositions.push([px, 4.9, pz]);
        }
      }
    }
  }

  // bollards separating plaza from carriageway
  for (let x = -RING.x + 6; x <= RING.x - 6; x += 3.2) {
    push('bollard', x, PLAZA.z0 - 1.2, 0);
    push('bollard', x, PLAZA.z1 + 1.2, 0);
  }
  for (let z = -RING.z + 8; z <= RING.z - 8; z += 3.2) {
    push('bollard', PLAZA.x0 - 1.2, z, 0);
    push('bollard', PLAZA.x1 + 1.2, z, 0);
  }

  // benches: church grounds, plaza edges, near the water
  for (const [bx, bz, r] of [
    [-28, -44.5, 0], [-14, -44.5, 0], [0, -44.5, 0], [16, -44.5, 0], [32, -44.5, 0],
    [60.5, -30, Math.PI / 2], [60.5, -20, Math.PI / 2], [60.5, -10, Math.PI / 2],
    [-24, -8.5, Math.PI], [-8, -8.5, Math.PI], [8, -8.5, Math.PI],
    [-46, 4, Math.PI / 2], [-46, 16, Math.PI / 2],
    [4, 30, Math.PI], [18, 30, Math.PI], [32, 30, Math.PI],
    [4, 64, 0], [18, 64, 0], [32, 64, 0], [46, 64, 0],
    [-70, 56, 0], [-70, 30, 0], [-70, 6, 0], [76, 56, 0], [76, 30, 0], [76, -4, 0],
    [-58, -58, 0], [-30, -58, 0], [0, -58, 0], [30, -58, 0], [58, -58, 0],
  ]) push('bench', bx, bz, r);

  // bins and signs
  for (const [bx, bz] of [[-40, -46], [20, -46], [56, -6], [-52, 20], [12, 34], [40, 62], [-74, 44], [80, 24], [-90, -30], [88, -46]]) push('bin', bx, bz, rng.range(0, 3));
  for (const [sx, sz, r] of [[-92, -58, 0.6], [92, 58, 2.2], [-92, 58, 1.2], [92, -58, 3.4], [0, 66, 0], [-64, -66, 0]]) push('signpost', sx, sz, r);

  // planters along the frontages
  for (let x = -80; x <= 80; x += 26) { push('planter', x, PLAZA.z0 + 6, 0); push('planter', x, PLAZA.z1 - 6, 0); }

  // cafe terraces: clustered against the west and south frontages, plus the north
  const terraces = [
    { x: -88, z: -20, n: 4, dz: 6.5, dx: 0 }, { x: -88, z: 14, n: 4, dz: 6.5, dx: 0 },
    { x: -88, z: 44, n: 3, dz: 6.5, dx: 0 },
    { x: -46, z: 58, n: 4, dz: 0, dx: 6.8 }, { x: 54, z: 58, n: 4, dz: 0, dx: 6.8 },
    { x: -50, z: -58, n: 4, dz: 0, dx: 6.8 }, { x: 40, z: -58, n: 3, dz: 0, dx: 6.8 },
    { x: 88, z: 8, n: 3, dz: 6.5, dx: 0 },
  ];
  for (const t of terraces) {
    for (let i = 0; i < t.n; i++) {
      const x = t.x + t.dx * i + rng.range(-0.6, 0.6);
      const z = t.z + t.dz * i + rng.range(-0.6, 0.6);
      push('cafeSet', x, z, rng.range(0, Math.PI * 2));
      if (rng.chance(0.72)) push('umbrella', x, z, rng.range(0, 0.6), { tint: rng.pick(AWNING_TINTS) });
    }
  }

  // bicycles leaning near the edges
  for (let i = 0; i < 26; i++) {
    const edge = rng.int(0, 3);
    let x, z, r;
    if (edge === 0) { x = rng.range(-80, 80); z = PLAZA.z0 + 4.5; r = rng.range(-0.3, 0.3); }
    else if (edge === 1) { x = rng.range(-80, 80); z = PLAZA.z1 - 4.5; r = Math.PI + rng.range(-0.3, 0.3); }
    else if (edge === 2) { x = PLAZA.x0 + 4.5; z = rng.range(-56, 56); r = Math.PI / 2; }
    else { x = PLAZA.x1 - 4.5; z = rng.range(-56, 56); r = -Math.PI / 2; }
    push('bicycle', x, z, r);
  }

  push('kiosk', -78, -46, 0.3);
  push('kiosk', 66, 46, -0.4);
  push('flagpole', -100, -60, 0);
  push('flagpole', -100, 60, 0);

  // ground uplights washing the church walls
  for (let x = -14; x <= 44; x += 8.6) {
    push('uplight', x, CHURCH.nave.z0 - 3.6, 0); lampPositions.push([x, 0.4, CHURCH.nave.z0 - 3.6]);
    push('uplight', x, CHURCH.nave.z1 + 3.6, 0); lampPositions.push([x, 0.4, CHURCH.nave.z1 + 3.6]);
  }
  for (const [ux, uz] of [[-30, -26], [-30, -34], [58, -26], [58, -16], [-24, 6], [-16, 6]]) {
    push('uplight', ux, uz, 0); lampPositions.push([ux, 0.4, uz]);
  }
  // uplights around the monument
  for (const [ux, uz] of [[-31, 6], [-9, 6], [-31, 22], [-9, 22]]) {
    push('uplight', ux, uz, 0); lampPositions.push([ux, 0.4, uz]);
  }

  return { props: out, lampPositions };
}

export function buildProps(models, plan, matLib, parent) {
  const pools = [];
  for (const key of Object.keys(plan)) {
    if (!plan[key].length) continue;
    const p = scatterPool('prop-' + key, [models[key]], plan[key].map((q) => Object.assign({}, q, { model: 0 })), matLib, {
      castShadow: key !== 'uplight',
    });
    for (const pool of p) { pool.addTo(parent); pools.push({ key, pool }); }
  }
  return pools;
}

// --- lamp glow ----------------------------------------------------------------

export function buildLampGlow(positions) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(positions.length * 3);
  positions.forEach((p, i) => { pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2]; });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.computeBoundingSphere();
  const tex = makeRadialSprite([255, 226, 168], [255, 170, 80], 64, 2.2);
  const mat = new THREE.PointsMaterial({
    map: tex, size: 5.2, sizeAttenuation: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = 'lamp-glow';
  pts.frustumCulled = false;
  return pts;
}

// --- fountain -----------------------------------------------------------------

export function buildFountain(bMid, matLib, parent) {
  const rng = new Rng('fountain');
  const F = FOUNTAIN;

  // stone edge and the dark polished basin floor
  bMid.box(F.x0 - 1.3, -0.25, F.z0 - 1.3, F.x1 + 1.3, 0.30, F.z0, P.greyStone);
  bMid.box(F.x0 - 1.3, -0.25, F.z1, F.x1 + 1.3, 0.30, F.z1 + 1.3, P.greyStone);
  bMid.box(F.x0 - 1.3, -0.25, F.z0, F.x0, 0.30, F.z1, P.greyStone);
  bMid.box(F.x1, -0.25, F.z0, F.x1 + 1.3, 0.30, F.z1, P.greyStone);
  bMid.box(F.x0 - 1.3, 0.30, F.z0 - 1.3, F.x1 + 1.3, 0.40, F.z0, P.whiteStone);
  bMid.box(F.x0 - 1.3, 0.30, F.z1, F.x1 + 1.3, 0.40, F.z1 + 1.3, P.whiteStone);
  bMid.box(F.x0 - 1.3, 0.30, F.z0, F.x0, 0.40, F.z1, P.whiteStone);
  bMid.box(F.x1, 0.30, F.z0, F.x1 + 1.3, 0.40, F.z1, P.whiteStone);

  const jets = [];
  const gx = 6, gz = 4;
  for (let i = 0; i < gx; i++) {
    for (let j = 0; j < gz; j++) {
      const x = F.x0 + 3.4 + i * ((F.x1 - F.x0 - 6.8) / (gx - 1));
      const z = F.z0 + 3.0 + j * ((F.z1 - F.z0 - 6.0) / (gz - 1));
      bMid.cylY(x, z, 0.34, -0.25, -0.16, P.greyStoneDark);
      bMid.cylY(x, z, 0.16, -0.16, -0.13, P.steel);
      jets.push({ x, z, phase: rng.range(0, Math.PI * 2), speed: rng.range(0.55, 1.05), hmax: rng.range(1.5, 3.4) });
    }
  }

  // water surfaces: main sheet plus the still tables. Plane geometry carries no
  // vertex colours, so these use a dedicated tinted copy of the water material.
  const waterMat = matLib.get('water').clone();
  waterMat.vertexColors = false;
  waterMat.color.set('#8fa3a8');
  const surfaces = new THREE.Group();
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(F.x1 - F.x0, F.z1 - F.z0), waterMat);
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.set((F.x0 + F.x1) / 2, -0.10, (F.z0 + F.z1) / 2);
  sheet.receiveShadow = true;
  surfaces.add(sheet);
  for (const t of WATER_TABLES) {
    bMid.box(t.x0 - 0.9, -0.25, t.z0 - 0.9, t.x1 + 0.9, 0.52, t.z1 + 0.9, P.greyStone);
    bMid.box(t.x0 - 0.9, 0.52, t.z0 - 0.9, t.x1 + 0.9, 0.62, t.z1 + 0.9, P.whiteStone);
    bMid.carve(t.x0, -0.3, t.z0, t.x1, 0.62, t.z1);
    bMid.box(t.x0, -0.3, t.z0, t.x1, -0.2, t.z1, P.greyStoneDark);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(t.x1 - t.x0, t.z1 - t.z0), waterMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((t.x0 + t.x1) / 2, 0.44, (t.z0 + t.z1) / 2);
    surfaces.add(m);
  }
  parent.add(surfaces);

  // animated jets: one instanced box column per nozzle
  const jetGeo = new THREE.BoxGeometry(0.22, 1, 0.22);
  jetGeo.translate(0, 0.5, 0);
  const jetMat = matLib.get('water').clone();
  jetMat.vertexColors = false;
  jetMat.color.set('#c2d0d2');
  jetMat.opacity = 0.62;
  const jetMesh = new THREE.InstancedMesh(jetGeo, jetMat, jets.length * 2);
  jetMesh.name = 'fountain-jets';
  jetMesh.frustumCulled = false;
  jetMesh.castShadow = false;
  parent.add(jetMesh);
  const m4 = new THREE.Matrix4();

  return {
    jets, jetMesh, surfaces, jetMat,
    update(t) {
      let n = 0;
      for (const j of jets) {
        const s = Math.sin(t * j.speed + j.phase);
        const h = Math.max(0.05, j.hmax * (0.35 + 0.65 * s * s));
        m4.makeScale(1, h, 1);
        m4.setPosition(j.x, -0.12, j.z);
        jetMesh.setMatrixAt(n++, m4);
        // a small crown of spray at the top
        const sp = Math.max(0.05, 0.35 * (0.4 + 0.6 * Math.abs(Math.cos(t * j.speed * 1.7 + j.phase))));
        m4.makeScale(2.1, sp, 2.1);
        m4.setPosition(j.x, -0.12 + h, j.z);
        jetMesh.setMatrixAt(n++, m4);
      }
      jetMesh.count = n;
      jetMesh.instanceMatrix.needsUpdate = true;
    },
    dispose() { jetGeo.dispose(); jetMat.dispose(); waterMat.dispose(); },
  };
}

// --- static plaza furniture that is not repeated ------------------------------

export function buildPlazaStructures(b) {
  // low stone steps that double as seating, framing the fountain terrace
  for (let i = 0; i < 3; i++) {
    const inset = i * 0.9;
    b.box(FOUNTAIN.x0 - 6.5 + inset, 0, FOUNTAIN.z0 - 6.5 + inset, FOUNTAIN.x1 + 6.5 - inset, 0.16 + i * 0.16, FOUNTAIN.z0 - 5.6 + inset, i % 2 ? P.greyStone : P.whiteStone);
  }
  // stepped seating edge along the church grass, south side
  for (let i = 0; i < 2; i++) {
    b.box(-24 + i * 0.8, 0, -7.4 - i * 0.55, 32 - i * 0.8, 0.18 + i * 0.18, -6.7 - i * 0.55, i ? P.whiteStone : P.greyStone);
  }
  // a broad shallow flight facing the monument from the south
  for (let i = 0; i < 3; i++) {
    b.box(MONUMENT.pedestal.x0 - 7 + i * 1.0, 0, MONUMENT.pedestal.z1 + 5.0 + i * 1.0,
      MONUMENT.pedestal.x1 + 7 - i * 1.0, 0.15 + i * 0.15, MONUMENT.pedestal.z1 + 6.0 + i * 1.0,
      i % 2 ? P.whiteStone : P.greyStone);
  }
}
