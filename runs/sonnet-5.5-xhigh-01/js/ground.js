/* Piata Unirii — continuous voxel ground: heightfield tiers meshed with greedy merging.
   Every tier is a grid of square columns; adjacent tiers are aligned so there are no voids. */
(function () {
  'use strict';
  const PU = window.PU;
  const L = PU.L, M = PU.M, PAL = PU.PAL;
  const packN = PU.packN, packC = PU.packC, packM = PU.packM;

  const NUP = packN(0, 1, 0), NPX = packN(1, 0, 0), NNX = packN(-1, 0, 0), NPZ = packN(0, 0, 1), NNZ = packN(0, 0, -1);

  function texVarFor(mat) {
    if (mat === M.road || mat === M.roadDk || mat === M.roadLine) return 2;
    if (mat === M.sidewalk || mat === M.sidewalkLt || mat === M.curb || mat === M.courtyard || mat === M.stepEdge) return 1;
    return 0;
  }
  PU.texVarFor = texVarFor;

  /* spec: { name, s, x0,z0,x1,z1, hole:{x0,z0,x1,z1}|null, tile (cells), sample(x,z,s) -> {mat,h,edge,skip}, cast:false, qh }
     emit(name, builder) is called once per tile */
  PU.meshHeightTier = function (spec, emit) {
    const s = spec.s;
    const nx = Math.round((spec.x1 - spec.x0) / s), nz = Math.round((spec.z1 - spec.z0) / s);
    const mat = new Uint8Array(nx * nz), edg = new Uint8Array(nx * nz), hh = new Float32Array(nx * nz);
    const hole = spec.hole;
    const sample = spec.sample;
    for (let j = 0; j < nz; j++) {
      const z = spec.z0 + (j + 0.5) * s;
      for (let i = 0; i < nx; i++) {
        const x = spec.x0 + (i + 0.5) * s;
        const k = i + j * nx;
        if (hole && x > hole.x0 && x < hole.x1 && z > hole.z0 && z < hole.z1) {
          mat[k] = 0;
          hh[k] = -99;
          continue;
        }
        const c = sample(x, z, s);
        if (c.skip) { mat[k] = 0; hh[k] = -99; continue; }
        mat[k] = c.mat;
        edg[k] = c.edge || c.mat;
        hh[k] = c.h;
      }
    }
    const tile = spec.tile || 128;
    const tsz = tile * s;
    const builders = new Map();
    const getB = (x, z) => {
      const tx = Math.floor((x - spec.x0) / tsz), tz = Math.floor((z - spec.z0) / tsz);
      const key = tx + ',' + tz;
      let b = builders.get(key);
      if (!b) { b = new PU.GeoBuilder(); builders.set(key, b); }
      return b;
    };
    const vc = PU.vsCode(s);
    const col = (m) => packC(PAL.r[m], PAL.g[m], PAL.b[m], 255);
    const miscFor = (m) => packM(texVarFor(m), vc, PAL.em[m], 0);
    const c12 = new Array(12);

    // neighbour height (in metres) at a given world position; -99 for skip/unknown-hole
    const nbH = (x, z) => {
      if (x > spec.x0 && x < spec.x1 && z > spec.z0 && z < spec.z1 && !(hole && x > hole.x0 && x < hole.x1 && z > hole.z0 && z < hole.z1)) {
        const i = Math.floor((x - spec.x0) / s), j = Math.floor((z - spec.z0) / s);
        return hh[i + j * nx];
      }
      const c = sample(x, z, s);
      return c.skip ? -99 : c.h;
    };

    // ---- top faces (greedy) ----
    const used = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = i + j * nx;
        if (used[k] || !mat[k]) continue;
        const m = mat[k], h = hh[k];
        let w = 1;
        while (i + w < nx && (i + w) % tile !== 0) {
          const k2 = k + w;
          if (used[k2] || mat[k2] !== m || hh[k2] !== h) break;
          w++;
        }
        let d = 1;
        outer: while (j + d < nz && (j + d) % tile !== 0) {
          for (let x = 0; x < w; x++) {
            const k2 = k + d * nx + x;
            if (used[k2] || mat[k2] !== m || hh[k2] !== h) break outer;
          }
          d++;
        }
        for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) used[k + y * nx + x] = 1;
        const xa = spec.x0 + i * s, xb = spec.x0 + (i + w) * s, za = spec.z0 + j * s, zb = spec.z0 + (j + d) * s;
        c12[0] = xa; c12[1] = h; c12[2] = za;
        c12[3] = xa; c12[4] = h; c12[5] = zb;
        c12[6] = xb; c12[7] = h; c12[8] = zb;
        c12[9] = xb; c12[10] = h; c12[11] = za;
        const cc = col(m);
        getB((xa + xb) / 2, (za + zb) / 2).quad(PAL.pool[m], c12, NUP, cc, cc, cc, cc, miscFor(m), false);
      }
    }

    // is a neighbouring position outside this tier (or inside its hole)? — those borders get a short skirt to close cracks
    const isBnd = (x, z) => !(x > spec.x0 && x < spec.x1 && z > spec.z0 && z < spec.z1) || !!(hole && x > hole.x0 && x < hole.x1 && z > hole.z0 && z < hole.z1);
    // ---- side faces ----
    const side = (dir) => {
      // dir: 0 +x, 1 -x, 2 +z, 3 -z ; scan runs along the border
      const alongX = dir >= 2; // faces perpendicular to z run along x
      const nA = alongX ? nx : nz, nB = alongX ? nz : nx;
      for (let b = 0; b < nB; b++) {
        let a = 0;
        while (a < nA) {
          const i = alongX ? a : b, j = alongX ? b : a;
          const k = i + j * nx;
          if (!mat[k]) { a++; continue; }
          const h = hh[k];
          const xc = spec.x0 + (i + 0.5) * s, zc = spec.z0 + (j + 0.5) * s;
          let hn, nxp, nzp;
          if (dir === 0) { nxp = xc + s; nzp = zc; }
          else if (dir === 1) { nxp = xc - s; nzp = zc; }
          else if (dir === 2) { nxp = xc; nzp = zc + s; }
          else { nxp = xc; nzp = zc - s; }
          hn = nbH(nxp, nzp);
          const bnd = isBnd(nxp, nzp);
          if (!bnd && (hn <= -98 || !(h > hn + 0.001))) { a++; continue; }
          const em = edg[k];
          // extend run
          let len = 1;
          while (a + len < nA && (a + len) % tile !== 0) {
            const i2 = alongX ? a + len : b, j2 = alongX ? b : a + len;
            const k2 = i2 + j2 * nx;
            if (!mat[k2] || hh[k2] !== h || edg[k2] !== em) break;
            const x2 = spec.x0 + (i2 + 0.5) * s, z2 = spec.z0 + (j2 + 0.5) * s;
            let hn2, nx2p, nz2p;
            if (dir === 0) { nx2p = x2 + s; nz2p = z2; }
            else if (dir === 1) { nx2p = x2 - s; nz2p = z2; }
            else if (dir === 2) { nx2p = x2; nz2p = z2 + s; }
            else { nx2p = x2; nz2p = z2 - s; }
            hn2 = nbH(nx2p, nz2p);
            if (hn2 !== hn || isBnd(nx2p, nz2p) !== bnd) break;
            len++;
          }
          const y0 = bnd ? (hn <= -98 ? h : Math.min(h, hn)) - 1.2 : hn, y1 = h;
          let n, misc = miscFor(em);
          const cc = col(em);
          if (dir === 0 || dir === 1) {
            const X = spec.x0 + (dir === 0 ? i + 1 : i) * s;
            const za = spec.z0 + j * s, zb = spec.z0 + (j + len) * s;
            if (dir === 0) {
              c12[0] = X; c12[1] = y0; c12[2] = za; c12[3] = X; c12[4] = y1; c12[5] = za; c12[6] = X; c12[7] = y1; c12[8] = zb; c12[9] = X; c12[10] = y0; c12[11] = zb;
              n = NPX;
            } else {
              c12[0] = X; c12[1] = y0; c12[2] = za; c12[3] = X; c12[4] = y0; c12[5] = zb; c12[6] = X; c12[7] = y1; c12[8] = zb; c12[9] = X; c12[10] = y1; c12[11] = za;
              n = NNX;
            }
            getB(X, (za + zb) / 2).quad(PAL.pool[em], c12, n, cc, cc, cc, cc, misc, false);
          } else {
            const Z = spec.z0 + (dir === 2 ? j + 1 : j) * s;
            const xa = spec.x0 + i * s, xb = spec.x0 + (i + len) * s;
            if (dir === 2) {
              c12[0] = xa; c12[1] = y0; c12[2] = Z; c12[3] = xb; c12[4] = y0; c12[5] = Z; c12[6] = xb; c12[7] = y1; c12[8] = Z; c12[9] = xa; c12[10] = y1; c12[11] = Z;
              n = NPZ;
            } else {
              c12[0] = xa; c12[1] = y0; c12[2] = Z; c12[3] = xa; c12[4] = y1; c12[5] = Z; c12[6] = xb; c12[7] = y1; c12[8] = Z; c12[9] = xb; c12[10] = y0; c12[11] = Z;
              n = NNZ;
            }
            getB((xa + xb) / 2, Z).quad(PAL.pool[em], c12, n, cc, cc, cc, cc, misc, false);
          }
          a += len;
        }
      }
    };
    side(0); side(1); side(2); side(3);

    let idx = 0;
    for (const [key, b] of builders) {
      if (b.isEmpty()) continue;
      emit(spec.name + '#' + key, b, spec);
      idx++;
    }
    return idx;
  };
})();
