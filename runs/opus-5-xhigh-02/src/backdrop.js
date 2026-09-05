// The Transylvanian basin around the old town: distant hills, forest, hillside
// housing, a few far-off modern blocks, plus the sky dome and voxel clouds.
// Everything here stays deliberately low-contrast so Piata Unirii keeps the eye.

import * as THREE from 'three';
import { MAP, FAR, terrainRaw } from './layout.js';
import { P } from './palette.js';
import { Rng, makeNoise2D } from './rng.js';
import { makeSkyTexture, makeRadialSprite } from './textures.js';

const hn = makeNoise2D('cluj-basin');
const rn = makeNoise2D('cluj-ridge');

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Terrain height well outside the detailed map: the basin rim closing the view. */
export function farHeight(x, z) {
  const r = Math.hypot(x * 1.0, z * 1.12);
  const ramp = smoothstep(330, 1750, r);
  // The Somes valley runs roughly east-west just north of the centre, so the
  // northern rim (Cetatuia and beyond) starts closer in and climbs harder.
  const north = smoothstep(0, -700, z) * 0.55;
  const ridge = (rn.fbm(x / 620 + 4, z / 620 + 9, 3) - 0.42) * 2.0;
  const rise = (74 + 190 * Math.max(0, ridge)) * (1 + north);
  const local = (hn.fbm(x / 170, z / 170, 4) - 0.5) * 26 * ramp;
  const inner = terrainRaw(Math.max(MAP.x0, Math.min(MAP.x1, x)), Math.max(MAP.z0, Math.min(MAP.z1, z)));
  // dip slightly where the sheet slides under the detailed ground so the seam
  // never pokes through
  const tuck = 1.1 * (1 - smoothstep(320, 430, r));
  return inner * (1 - ramp) + (rise * ramp * ramp + local) - tuck;
}

const SRGB = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function lin(hex) {
  return [SRGB(((hex >> 16) & 255) / 255), SRGB(((hex >> 8) & 255) / 255), SRGB((hex & 255) / 255)];
}
const C_FOREST = lin(0x6b7d58);
const C_FOREST2 = lin(0x5e7050);
const C_MEADOW = lin(0x8b9472);
const C_FIELD = lin(0x9ba07e);
const C_URBAN = lin(0x9c9384);
const C_URBAN2 = lin(0xa89c8a);
const C_ROOFY = lin(0xa4735c);
const C_HAZE = lin(0xb9bdb6);

function terrainColour(x, z, y, out) {
  const r = Math.hypot(x, z);
  const t = hn.fbm(x / 260 + 21, z / 260 + 5, 3);
  const u = hn.fbm(x / 96 + 3, z / 96 + 31, 2);
  let c;
  // the built-up basin floor reaches well past the detailed map before giving
  // way to meadow and then woodland on the rim
  const urbanness = Math.max(0, 1 - Math.max(0, r - 420) / 1000) * (0.68 + 0.32 * t);
  if (u < urbanness) {
    c = u < urbanness * 0.34 ? C_ROOFY : (t > 0.5 ? C_URBAN : C_URBAN2);
  } else if (y > 108 + t * 70) {
    c = t > 0.5 ? C_FOREST2 : C_FOREST;
  } else if (t > 0.66) {
    c = C_FOREST;
  } else if (t < 0.36) {
    c = u > 0.55 ? C_FIELD : C_MEADOW;
  } else {
    c = C_MEADOW;
  }
  // gentle per-cell variation, then a haze wash so nothing out there competes
  // with the square for attention
  const shade = 0.955 + 0.09 * u;
  const haze = Math.min(0.5, Math.max(0, (r - 520) / 2100));
  out[0] = c[0] * shade * (1 - haze) + C_HAZE[0] * haze;
  out[1] = c[1] * shade * (1 - haze) + C_HAZE[1] * haze;
  out[2] = c[2] * shade * (1 - haze) + C_HAZE[2] * haze;
}

/** Coarse, flat-shaded hill mesh filling everything outside the detailed ground. */
export function buildFarTerrain(matLib) {
  const step = 34;
  const n = Math.ceil((FAR * 2) / step);
  const pos = [], col = [], idx = [], nrm = [];
  const hole = 296;
  const tmp = [0, 0, 0];
  let v = 0;
  const H = (x, z) => farHeight(x, z);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x0 = -FAR + i * step, z0 = -FAR + j * step;
      const x1 = x0 + step, z1 = z0 + step;
      if (x1 > -hole && x0 < hole && z1 > -hole && z0 < hole) continue;
      const h00 = H(x0, z0), h10 = H(x1, z0), h11 = H(x1, z1), h01 = H(x0, z1);
      const cxm = (x0 + x1) / 2, czm = (z0 + z1) / 2;
      terrainColour(cxm, czm, (h00 + h10 + h11 + h01) / 4, tmp);
      const ax = step, ay = ((h10 + h11) - (h00 + h01)) / 2, az = 0;
      const bx = 0, by = ((h01 + h11) - (h00 + h10)) / 2, bz = step;
      // b x a, so the normal points up rather than into the ground
      let nx2 = by * az - bz * ay, ny2 = bz * ax - bx * az, nz2 = bx * ay - by * ax;
      const L = Math.hypot(nx2, ny2, nz2) || 1;
      nx2 /= L; ny2 /= L; nz2 /= L;
      if (ny2 < 0) { nx2 = -nx2; ny2 = -ny2; nz2 = -nz2; }
      pos.push(x0, h00, z0, x1, h10, z0, x1, h11, z1, x0, h01, z1);
      for (let k = 0; k < 4; k++) { col.push(tmp[0], tmp[1], tmp[2]); nrm.push(nx2, ny2, nz2); }
      idx.push(v, v + 3, v + 2, v, v + 2, v + 1);
      v += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  const mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 0, specular: 0x000000 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'far-terrain';
  mesh.matrixAutoUpdate = false;
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  return mesh;
}

/**
 * The far city: dense low blocks continuing the old town outward, then hillside
 * housing, then a handful of tall socialist-era slabs on the far skyline.
 */
export function buildDistantCity(b) {
  const rng = new Rng('far-city');
  const roofs = [P.roofOrange, P.roofTerracotta, P.roofRust, P.roofRed, P.roofBrown, P.roofPale];
  const walls = [P.beige, P.sand, P.softGrey, P.ochre, P.cream, P.ivory, P.paleYellow, P.terracottaWash];
  const outside = (x, z) => Math.abs(x) > 352 || Math.abs(z) > 352;

  const house = (x, z, w, d, h, warm) => {
    const y = farHeight(x, z);
    b.box(x - w / 2, y - 6, z - d / 2, x + w / 2, y + h, z + d / 2, rng.pick(walls));
    const rm = rng.pick(roofs);
    if (rng.chance(0.76)) {
      if (w > d) b.gableX(x - w / 2 - 0.9, z - d / 2 - 0.9, x + w / 2 + 0.9, z + d / 2 + 0.9, y + h, y + h + d * 0.36, rm, 1.6);
      else b.gableZ(x - w / 2 - 0.9, z - d / 2 - 0.9, x + w / 2 + 0.9, z + d / 2 + 0.9, y + h, y + h + w * 0.36, rm, 1.6);
    } else {
      b.hipRoof(x - w / 2 - 0.9, z - d / 2 - 0.9, x + w / 2 + 0.9, z + d / 2 + 0.9, y + h, y + h + Math.min(w, d) * 0.32, rm, 1.6);
    }
  };

  // Neighbourhoods rather than confetti: clusters of houses lined up along a
  // local street axis, thinning out and climbing as they go up the basin sides.
  const CLUSTERS = 132;
  for (let c = 0; c < CLUSTERS; c++) {
    const a = rng.range(0, Math.PI * 2);
    const r = 360 + Math.pow(rng.f(), 0.66) * 1450;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r * 0.94;
    const base = farHeight(cx, cz);
    if (base > 190) continue;
    const dense = Math.max(0.18, 1 - (r - 360) / 1500);
    const rows = rng.int(2, 4);
    const per = rng.int(3, 7);
    const dir = rng.range(0, Math.PI);
    const ux = Math.cos(dir), uz = Math.sin(dir);
    const vx = -uz, vz = ux;
    const gapU = rng.range(20, 30), gapV = rng.range(30, 46);
    for (let rw = 0; rw < rows; rw++) {
      for (let i = 0; i < per; i++) {
        if (rng.f() > dense + 0.35) continue;
        const su = (i - (per - 1) / 2) * gapU + rng.range(-4, 4);
        const sv = (rw - (rows - 1) / 2) * gapV + rng.range(-5, 5);
        const x = cx + ux * su + vx * sv;
        const z = cz + uz * su + vz * sv;
        if (!outside(x, z)) continue;
        const scale = Math.max(0.55, 1.15 - r / 2600);
        house(x, z, rng.range(10, 20) * scale, rng.range(9, 17) * scale, rng.range(7, 15) * scale);
      }
    }
  }

  // Three socialist-era estates on the far skyline - never near the square.
  for (let e = 0; e < 4; e++) {
    const a = rng.range(0, Math.PI * 2);
    const r = 950 + rng.f() * 1000;
    const ex = Math.cos(a) * r, ez = Math.sin(a) * r * 0.94;
    const dir = rng.range(0, Math.PI);
    const ux = Math.cos(dir), uz = Math.sin(dir);
    const vx = -uz, vz = ux;
    const n = rng.int(4, 8);
    for (let i = 0; i < n; i++) {
      const su = (i - (n - 1) / 2) * rng.range(58, 78);
      const sv = rng.range(-40, 40);
      const x = ex + ux * su + vx * sv, z = ez + uz * su + vz * sv;
      const y = farHeight(x, z);
      const w = rng.range(26, 56), d = rng.range(13, 18), h = rng.range(24, 44);
      const wall = rng.pick([P.softGrey, P.beige, P.paleBlueGrey, P.ivory]);
      b.box(x - w / 2, y - 10, z - d / 2, x + w / 2, y + h, z + d / 2, wall);
      for (let fy = y + 4; fy < y + h - 3; fy += 3.2) {
        b.box(x - w / 2 - 0.2, fy, z - d / 2 - 0.2, x + w / 2 + 0.2, fy + 1.6, z - d / 2 + 0.2,
          rng.chance(0.24) ? P.litWindow : P.windowGlassDark);
        b.box(x - w / 2 - 0.2, fy, z + d / 2 - 0.2, x + w / 2 + 0.2, fy + 1.6, z + d / 2 + 0.2,
          rng.chance(0.24) ? P.litWindow : P.windowGlassDark);
      }
      b.box(x - w / 2 - 0.9, y + h, z - d / 2 - 0.9, x + w / 2 + 0.9, y + h + 1.5, z + d / 2 + 0.9, P.roofZinc);
    }
  }

  // A hint of the Cetatuia hill marker on the northern rim.
  const cetX = -60, cetZ = -640;
  const cetY = farHeight(cetX, cetZ);
  b.box(cetX - 3, cetY, cetZ - 3, cetX + 3, cetY + 6, cetZ + 3, P.whiteStone);
  b.box(cetX - 1.6, cetY + 6, cetZ - 1.6, cetX + 1.6, cetY + 26, cetZ + 1.6, P.whiteStone);
  b.box(cetX - 2.4, cetY + 26, cetZ - 2.4, cetX + 2.4, cetY + 29, cetZ + 2.4, P.greyStone);

  // Woodland on the rim, in drifts rather than an even sprinkle.
  for (let g = 0; g < 130; g++) {
    const a = rng.range(0, Math.PI * 2);
    const r = 620 + Math.pow(rng.f(), 0.7) * 1650;
    const gx = Math.cos(a) * r, gz = Math.sin(a) * r * 0.94;
    if (farHeight(gx, gz) < 42) continue;
    const n = rng.int(4, 11);
    for (let i = 0; i < n; i++) {
      const x = gx + rng.range(-70, 70), z = gz + rng.range(-70, 70);
      const y = farHeight(x, z);
      if (y < 30) continue;
      const sz2 = rng.range(7, 19);
      b.ellipsoid(x, y + sz2 * 0.5, z, sz2, sz2 * 0.6, sz2 * 0.88, rng.pick([P.leafC, P.leafE, P.leafA, P.hedge]));
    }
  }
}

// ---------------------------------------------------------------------------
// Sky, sun and clouds
// ---------------------------------------------------------------------------

const DAY_STOPS = [
  [0.00, '#2f6fc4'], [0.28, '#5b9ada'], [0.55, '#9fc4e6'], [0.78, '#cfdcea'], [1.00, '#e2e3dd'],
];
const DUSK_STOPS = [
  [0.00, '#1d3560'], [0.24, '#41558c'], [0.46, '#95688c'], [0.66, '#dd8f62'], [0.84, '#f2b072'], [1.00, '#f6cf9d'],
];

function mixHex(a, b, t) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return 'rgb(' + m.join(',') + ')';
}

export class Sky {
  constructor(scene) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 8; this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.paint(0);
    const geo = new THREE.SphereGeometry(FAR * 1.7, 32, 18);
    const mat = new THREE.MeshBasicMaterial({ map: this.tex, side: THREE.BackSide, fog: false, depthWrite: false });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.name = 'sky';
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    // sun disc + halo
    const sunTex = makeRadialSprite([255, 250, 232], [255, 236, 190], 128, 1.6);
    this.sunMat = new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, depthTest: false, fog: false, opacity: 0.95 });
    this.sun = new THREE.Sprite(this.sunMat);
    this.sun.scale.set(520, 520, 1);
    this.sun.renderOrder = -900;
    scene.add(this.sun);
    const haloTex = makeRadialSprite([255, 226, 170], [255, 190, 120], 128, 3.2);
    this.haloMat = new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, depthTest: false, fog: false, opacity: 0.0, blending: THREE.AdditiveBlending });
    this.halo = new THREE.Sprite(this.haloMat);
    this.halo.scale.set(2400, 2400, 1);
    this.halo.renderOrder = -901;
    scene.add(this.halo);
  }

  paint(t) {
    const g = this.ctx.createLinearGradient(0, 0, 0, 512);
    const n = Math.max(DAY_STOPS.length, DUSK_STOPS.length);
    for (let i = 0; i < n; i++) {
      const a = DAY_STOPS[Math.min(i, DAY_STOPS.length - 1)];
      const b = DUSK_STOPS[Math.min(i, DUSK_STOPS.length - 1)];
      g.addColorStop(Math.min(1, a[0] + (b[0] - a[0]) * t), mixHex(a[1], b[1], t));
    }
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, 8, 512);
    this.tex.needsUpdate = true;
  }

  update(t, sunDir) {
    this.paint(t);
    const d = FAR * 1.35;
    this.sun.position.set(sunDir.x * d, sunDir.y * d, sunDir.z * d);
    this.halo.position.copy(this.sun.position);
    this.haloMat.opacity = 0.16 + 0.55 * t;
    this.sunMat.opacity = 0.92;
    const warm = new THREE.Color().setHSL(0.11 - 0.04 * t, 0.35 + 0.45 * t, 0.92 - 0.06 * t);
    this.sunMat.color.copy(warm);
  }

  setCameraPos(p) { this.mesh.position.set(p.x, 0, p.z); }

  dispose() {
    this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.tex.dispose();
    this.sunMat.map.dispose(); this.sunMat.dispose();
    this.haloMat.map.dispose(); this.haloMat.dispose();
  }
}

/** Big scattered cumulus built from instanced voxel blocks. */
export function buildClouds() {
  const rng = new Rng('clouds');
  const boxes = [];
  for (let c = 0; c < 15; c++) {
    const a = rng.range(0, Math.PI * 2);
    const r = 500 + rng.f() * 2300;
    const cxm = Math.cos(a) * r, czm = Math.sin(a) * r;
    const cy = 380 + rng.f() * 220;
    const rx = rng.range(120, 260), ry = rng.range(28, 60), rz = rng.range(110, 230);
    const n = rng.int(26, 46);
    for (let i = 0; i < n; i++) {
      const t = rng.f();
      const ux = (rng.f() * 2 - 1), uz = (rng.f() * 2 - 1);
      const d = Math.hypot(ux, uz);
      if (d > 1) continue;
      const bumpy = Math.pow(1 - d, 0.55);
      const s = rng.range(34, 78) * (0.55 + bumpy * 0.7);
      boxes.push({
        x: cxm + ux * rx, y: cy + (rng.f() - 0.4) * ry * bumpy + bumpy * ry * 0.7, z: czm + uz * rz,
        sx: s, sy: s * rng.range(0.42, 0.7), sz: s * rng.range(0.8, 1.2),
        tone: 0.86 + 0.14 * bumpy + rng.range(-0.05, 0.05),
      });
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshPhongMaterial({ shininess: 0, specular: 0x000000, fog: true });
  const mesh = new THREE.InstancedMesh(geo, mat, boxes.length);
  mesh.name = 'clouds';
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  boxes.forEach((b, i) => {
    m4.makeScale(b.sx, b.sy, b.sz);
    m4.setPosition(b.x, b.y, b.z);
    mesh.setMatrixAt(i, m4);
    col.setRGB(b.tone, b.tone, b.tone * 1.01);
    mesh.setColorAt(i, col);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  return mesh;
}
