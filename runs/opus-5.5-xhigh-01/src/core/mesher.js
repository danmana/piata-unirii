// Greedy voxel mesher with baked per-vertex ambient occlusion.
// - Only faces exposed to air are generated (no hidden interior geometry).
// - Coplanar faces with identical material + AO pattern are merged into
//   larger quads (greedy meshing), which keeps walls, roofs and paving cheap.
// - Isolated "detail" voxels (<= 1 solid neighbour: pinnacle tips, crockets,
//   dentils, leaf tips, statue extremities...) are emitted as instances for the
//   per-material instanced cube pools instead of as faces.

import { GeoOut, InstOut } from './geo.js';
import { POOL_COUNT, AIR, HIDDEN } from './mat.js';

const AO_TABLE = [0, 1, 2, 3];

export function meshGrid(grid, mats, xf = null, opts = {}) {
  grid.prepareBoundary();
  const { nx, ny, nz, sy, sz, data, vs } = grid;
  const dims = [nx, ny, nz];
  const st = [1, sy, sz];
  const org = [grid.ox, grid.oy, grid.oz];
  const detailOn = opts.detail !== false;
  const vsmm = Math.min(32767, Math.round(vs * 1000));

  const tx = xf ? xf.x : 0, ty = xf ? xf.y : 0, tz = xf ? xf.z : 0;
  const rot = xf ? xf.rot || 0 : 0;
  const cr = Math.cos(rot), sr = Math.sin(rot);

  const geo = new Array(POOL_COUNT).fill(null);
  const inst = new Array(POOL_COUNT).fill(null);
  const getGeo = (p) => geo[p] || (geo[p] = new GeoOut(1024));
  const getInst = (p) => inst[p] || (inst[p] = new InstOut(256));

  // ---- detail voxel classification
  let det = null;
  if (detailOn) {
    det = new Uint8Array(data.length);
    for (let j = 1; j < ny - 1; j++) {
      for (let k = 1; k < nz - 1; k++) {
        let idx = j * sy + k * sz + 1;
        for (let i = 1; i < nx - 1; i++, idx++) {
          const m = data[idx];
          if (m <= HIDDEN) continue;
          const c = (data[idx + 1] !== AIR) + (data[idx - 1] !== AIR) + (data[idx + sz] !== AIR) +
            (data[idx - sz] !== AIR) + (data[idx + sy] !== AIR) + (data[idx - sy] !== AIR);
          if (c <= 1) {
            det[idx] = 1;
            // occlusion estimate from the 3x3x3 neighbourhood
            let occ = 0;
            for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) {
              if (data[idx + dj * sy + dk * sz + di] !== AIR) occ++;
            }
            const ao = Math.max(0.6, 1.08 - occ * 0.045);
            const jit = 0.94 + ((i * 73856093 ^ j * 19349663 ^ k * 83492791) >>> 0) % 1000 / 1000 * 0.12;
            const f = ao * jit;
            const lx = org[0] + (i - 0.5) * vs, ly = org[1] + (j - 0.5) * vs, lz = org[2] + (k - 0.5) * vs;
            const wx = tx + cr * lx + sr * lz, wz = tz - sr * lx + cr * lz;
            getInst(mats.pool[m]).push(wx, ty + ly, wz,
              Math.min(255, mats.r[m] * f), Math.min(255, mats.g[m] * f), Math.min(255, mats.b[m] * f),
              mats.layer[m], mats.flags[m]);
          }
        }
      }
    }
  }

  const P = new Float32Array(12);
  const ST = new Int16Array(8);
  const AO = [3, 3, 3, 3];
  const cU = [0, 0, 0, 0], cV = [0, 0, 0, 0];
  const L = [0, 0, 0];
  const aoE = [3, 3, 3, 3];

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3, v = (d + 2) % 3;
    const du = dims[u], dv = dims[v], dd = dims[d];
    const sd = st[d], su = st[u], sv = st[v];
    const mask = new Int32Array(du * dv);
    for (let side = 0; side < 2; side++) {
      const dir = side === 0 ? 1 : -1;
      const off = dir * sd;
      // normal (local) components
      const nl = [0, 0, 0];
      nl[d] = dir;
      const wnx = Math.round((cr * nl[0] + sr * nl[2]) * 127);
      const wny = nl[1] * 127;
      const wnz = Math.round((-sr * nl[0] + cr * nl[2]) * 127);
      for (let s = 1; s < dd - 1; s++) {
        // --- build mask
        let any = false;
        for (let j = 1; j < dv - 1; j++) {
          let mi = j * du + 1;
          let idx = s * sd + 1 * su + j * sv;
          for (let i = 1; i < du - 1; i++, mi++, idx += su) {
            const m = data[idx];
            if (m <= HIDDEN || (det !== null && det[idx]) || data[idx + off] !== AIR) { mask[mi] = 0; continue; }
            const nb = idx + off;
            const s1 = data[nb - su] !== AIR ? 1 : 0, s2 = data[nb + su] !== AIR ? 1 : 0;
            const t1 = data[nb - sv] !== AIR ? 1 : 0, t2 = data[nb + sv] !== AIR ? 1 : 0;
            const c00 = data[nb - su - sv] !== AIR ? 1 : 0, c10 = data[nb + su - sv] !== AIR ? 1 : 0;
            const c11 = data[nb + su + sv] !== AIR ? 1 : 0, c01 = data[nb - su + sv] !== AIR ? 1 : 0;
            const a0 = (s1 && t1) ? 0 : 3 - (s1 + t1 + c00);
            const a1 = (s2 && t1) ? 0 : 3 - (s2 + t1 + c10);
            const a2 = (s2 && t2) ? 0 : 3 - (s2 + t2 + c11);
            const a3 = (s1 && t2) ? 0 : 3 - (s1 + t2 + c01);
            mask[mi] = m | (a0 << 16) | (a1 << 18) | (a2 << 20) | (a3 << 22);
            any = true;
          }
        }
        if (!any) continue;
        // --- greedy merge
        const plane = side === 0 ? s + 1 : s;
        for (let j = 1; j < dv - 1; j++) {
          for (let i = 1; i < du - 1;) {
            const k = mask[j * du + i];
            if (k === 0) { i++; continue; }
            const a0 = (k >> 16) & 3, a1 = (k >> 18) & 3, a2 = (k >> 20) & 3, a3 = (k >> 22) & 3;
            const canU = a0 === a1 && a3 === a2;
            const canV = a0 === a3 && a1 === a2;
            let w = 1;
            if (canU) while (i + w < du - 1 && mask[j * du + i + w] === k) w++;
            let h = 1;
            if (canV) {
              outer: while (j + h < dv - 1) {
                const row = (j + h) * du + i;
                for (let t = 0; t < w; t++) if (mask[row + t] !== k) break outer;
                h++;
              }
            }
            for (let hh = 0; hh < h; hh++) mask.fill(0, (j + hh) * du + i, (j + hh) * du + i + w);
            // --- emit
            const m = k & 0xffff;
            cU[0] = i; cV[0] = j; cU[1] = i + w; cV[1] = j; cU[2] = i + w; cV[2] = j + h; cU[3] = i; cV[3] = j + h;
            AO[0] = AO_TABLE[a0]; AO[1] = AO_TABLE[a1]; AO[2] = AO_TABLE[a2]; AO[3] = AO_TABLE[a3];
            const order = side === 0 ? ORDER_POS : ORDER_NEG;
            aoE[0] = AO[order[0]]; aoE[1] = AO[order[1]]; aoE[2] = AO[order[2]]; aoE[3] = AO[order[3]];
            for (let c = 0; c < 4; c++) {
              const oc = order[c];
              L[d] = plane; L[u] = cU[oc]; L[v] = cV[oc];
              const lx = org[0] + (L[0] - 1) * vs, ly = org[1] + (L[1] - 1) * vs, lz = org[2] + (L[2] - 1) * vs;
              P[c * 3] = tx + cr * lx + sr * lz;
              P[c * 3 + 1] = ty + ly;
              P[c * 3 + 2] = tz - sr * lx + cr * lz;
              // canonical surface coordinates: s horizontal, t vertical (or z on horizontal faces)
              const X = L[0] - 1, Y = L[1] - 1, Z = L[2] - 1;
              if (d === 0) { ST[c * 2] = Z; ST[c * 2 + 1] = Y; }
              else if (d === 1) { ST[c * 2] = X; ST[c * 2 + 1] = Z; }
              else { ST[c * 2] = X; ST[c * 2 + 1] = Y; }
            }
            const flip = (a0 + a2 > a1 + a3) ? 0 : ((a0 + a2 < a1 + a3) ? 1 : 0);
            getGeo(mats.pool[m]).quad(P, wnx, wny, wnz, mats.r[m], mats.g[m], mats.b[m], aoE,
              mats.layer[m], mats.flags[m], ST, s - 1, vsmm, flip);
            i += w;
          }
        }
      }
    }
  }

  const out = { geo: [], inst: [], vs };
  for (let p = 0; p < POOL_COUNT; p++) {
    if (geo[p] && geo[p].n > 0) out.geo.push({ pool: p, ...geo[p].finish() });
    if (inst[p] && inst[p].n > 0) out.inst.push({ pool: p, rot, ...inst[p].finish() });
  }
  return out;
}

const ORDER_POS = [0, 1, 2, 3];
const ORDER_NEG = [0, 3, 2, 1];

// Mesh a grid at several LOD levels (each level = 2x coarser voxels).
export function meshLods(grid, mats, xf, levels = 3, opts = {}) {
  const res = [];
  let g = grid;
  for (let l = 0; l < levels; l++) {
    if (l > 0) g = g.downsample();
    res.push(meshGrid(g, mats, xf, opts));
  }
  return res;
}
