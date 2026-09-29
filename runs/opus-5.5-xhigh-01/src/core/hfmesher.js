// Heightfield voxel mesher for the continuous solid ground: every column is a
// solid voxel stack; only top faces and exposed side faces are generated.
// Top faces are greedy-merged (material + height + AO), sides are run-merged.

import { GeoOut } from './geo.js';
import { POOL_COUNT } from './mat.js';

// p: { nx, nz, x0, z0, res, hres, H (Int16, (nx+2)*(nz+2) incl. 1-cell margin),
//      M (Uint16 material ids), V (Uint8 void flags), O (Uint8 AO occluders),
//      mats (MatTable), side: Uint16Array mapping mat -> side mat, gx0, gz0 (global column index of i=0), base }
export function meshHeightfield(p) {
  const { nx, nz, x0, z0, res, hres, H, M, V, O, mats, side, gx0, gz0 } = p;
  const base = p.base ?? -12;
  const W = nx + 2;
  const geo = new Array(POOL_COUNT).fill(null);
  const getGeo = (k) => geo[k] || (geo[k] = new GeoOut(2048));
  const P = new Float32Array(12);
  const ST = new Int16Array(8);
  const AO = [3, 3, 3, 3];
  const idx = (i, j) => (j + 1) * W + (i + 1);
  const resmm = Math.round(res * 1000), hresmm = Math.round(hres * 1000);
  const rr = Math.round(res / hres);

  // ---- top faces
  const mk = new Int32Array(nx * nz);
  const mh = new Int16Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const c = idx(i, j);
      const o = j * nx + i;
      if (V[c]) { mk[o] = 0; continue; }
      const h = H[c];
      const sol = (q) => (!V[q] && (H[q] > h || O[q])) ? 1 : 0;
      const xm = sol(c - 1), xp = sol(c + 1), zm = sol(c - W), zp = sol(c + W);
      const a0 = (xm && zm) ? 0 : 3 - (xm + zm + sol(c - 1 - W));   // (x0,z0)
      const a1 = (xm && zp) ? 0 : 3 - (xm + zp + sol(c - 1 + W));   // (x0,z1)
      const a2 = (xp && zp) ? 0 : 3 - (xp + zp + sol(c + 1 + W));   // (x1,z1)
      const a3 = (xp && zm) ? 0 : 3 - (xp + zm + sol(c + 1 - W));   // (x1,z0)
      mk[o] = M[c] | (a0 << 16) | (a1 << 18) | (a2 << 20) | (a3 << 22);
      mh[o] = h;
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx;) {
      const o = j * nx + i;
      const k = mk[o];
      if (k === 0) { i++; continue; }
      const h = mh[o];
      const a0 = (k >> 16) & 3, a1 = (k >> 18) & 3, a2 = (k >> 20) & 3, a3 = (k >> 22) & 3;
      const canX = a0 === a3 && a1 === a2;
      const canZ = a0 === a1 && a3 === a2;
      let w = 1;
      if (canX) while (i + w < nx && mk[o + w] === k && mh[o + w] === h) w++;
      let d = 1;
      if (canZ) {
        outer: while (j + d < nz) {
          const row = (j + d) * nx + i;
          for (let t = 0; t < w; t++) if (mk[row + t] !== k || mh[row + t] !== h) break outer;
          d++;
        }
      }
      for (let dd = 0; dd < d; dd++) mk.fill(0, (j + dd) * nx + i, (j + dd) * nx + i + w);
      const m = k & 0xffff;
      const xa = x0 + i * res, xb = x0 + (i + w) * res, za = z0 + j * res, zb = z0 + (j + d) * res;
      const y = h * hres;
      P[0] = xa; P[1] = y; P[2] = za;
      P[3] = xa; P[4] = y; P[5] = zb;
      P[6] = xb; P[7] = y; P[8] = zb;
      P[9] = xb; P[10] = y; P[11] = za;
      const gi = gx0 + i, gj = gz0 + j;
      ST[0] = gi; ST[1] = gj; ST[2] = gi; ST[3] = gj + d; ST[4] = gi + w; ST[5] = gj + d; ST[6] = gi + w; ST[7] = gj;
      AO[0] = a0; AO[1] = a1; AO[2] = a2; AO[3] = a3;
      const flip = (a0 + a2 > a1 + a3) ? 0 : ((a0 + a2 < a1 + a3) ? 1 : 0);
      getGeo(mats.pool[m]).quad(P, 0, 127, 0, mats.r[m], mats.g[m], mats.b[m], AO, mats.layer[m], mats.flags[m], ST, h, resmm, flip);
      i += w;
    }
  }

  // ---- side faces (4 directions), run-merged along the edge
  const emitSide = (dir, line, a0i, a1i, top, bot, m) => {
    const s = side[m] || m;
    const yb = bot * hres, yt = top * hres;
    const aoB = bot <= base ? 3 : 2;
    let n0 = 0, n1 = 0, n2 = 0;
    if (dir === 0) { // +x at x = x0 + (line+1)*res, along z
      const x = x0 + (line + 1) * res, za = z0 + a0i * res, zb = z0 + a1i * res;
      P.set([x, yb, za, x, yt, za, x, yt, zb, x, yb, zb]); n0 = 127;
      setST(gz0 + a0i, gz0 + a1i, bot, top, 0);
    } else if (dir === 1) { // -x
      const x = x0 + line * res, za = z0 + a0i * res, zb = z0 + a1i * res;
      P.set([x, yb, za, x, yb, zb, x, yt, zb, x, yt, za]); n0 = -127;
      setST(gz0 + a0i, gz0 + a1i, bot, top, 1);
    } else if (dir === 2) { // +z
      const z = z0 + (line + 1) * res, xa = x0 + a0i * res, xb = x0 + a1i * res;
      P.set([xa, yb, z, xb, yb, z, xb, yt, z, xa, yt, z]); n2 = 127;
      setST(gx0 + a0i, gx0 + a1i, bot, top, 2);
    } else { // -z
      const z = z0 + line * res, xa = x0 + a0i * res, xb = x0 + a1i * res;
      P.set([xa, yb, z, xa, yt, z, xb, yt, z, xb, yb, z]); n2 = -127;
      setST(gx0 + a0i, gx0 + a1i, bot, top, 3);
    }
    getGeo(mats.pool[s]).quad(P, n0, n1, n2, mats.r[s], mats.g[s], mats.b[s], AO_SIDE[dir](aoB), mats.layer[s], mats.flags[s], ST, line, hresmm, 0);
  };
  const setST = (sa, sb, bot, top, dir) => {
    const A = sa * rr, B = sb * rr;
    if (dir === 0) { ST.set([A, bot, A, top, B, top, B, bot]); }
    else if (dir === 1) { ST.set([A, bot, B, bot, B, top, A, top]); }
    else if (dir === 2) { ST.set([A, bot, B, bot, B, top, A, top]); }
    else { ST.set([A, bot, A, top, B, top, B, bot]); }
  };
  const nb = (c, q) => (V[q] ? base : H[q]);
  // x directions: iterate columns i, run along j
  for (const dir of [0, 1]) {
    const off = dir === 0 ? 1 : -1;
    for (let i = 0; i < nx; i++) {
      let run = -1, rTop = 0, rBot = 0, rM = 0;
      for (let j = 0; j <= nz; j++) {
        let top = 0, bot = 0, m = 0, ok = false;
        if (j < nz) {
          const c = idx(i, j);
          if (!V[c]) {
            const h = H[c], nh = nb(c, c + off);
            if (nh < h) { ok = true; top = h; bot = nh; m = M[c]; }
          }
        }
        if (run >= 0 && (!ok || top !== rTop || bot !== rBot || m !== rM)) {
          emitSide(dir, i, run, j, rTop, rBot, rM);
          run = -1;
        }
        if (ok && run < 0) { run = j; rTop = top; rBot = bot; rM = m; }
      }
    }
  }
  for (const dir of [2, 3]) {
    const off = dir === 2 ? W : -W;
    for (let j = 0; j < nz; j++) {
      let run = -1, rTop = 0, rBot = 0, rM = 0;
      for (let i = 0; i <= nx; i++) {
        let top = 0, bot = 0, m = 0, ok = false;
        if (i < nx) {
          const c = idx(i, j);
          if (!V[c]) {
            const h = H[c], nh = nb(c, c + off);
            if (nh < h) { ok = true; top = h; bot = nh; m = M[c]; }
          }
        }
        if (run >= 0 && (!ok || top !== rTop || bot !== rBot || m !== rM)) {
          emitSide(dir, j, run, i, rTop, rBot, rM);
          run = -1;
        }
        if (ok && run < 0) { run = i; rTop = top; rBot = bot; rM = m; }
      }
    }
  }
  const out = [];
  for (let k = 0; k < POOL_COUNT; k++) if (geo[k] && geo[k].n) out.push({ pool: k, ...geo[k].finish() });
  return out;
}

const AO_SIDE = [
  (b) => [b, 3, 3, b],
  (b) => [b, b, 3, 3],
  (b) => [b, b, 3, 3],
  (b) => [b, 3, 3, b],
];
