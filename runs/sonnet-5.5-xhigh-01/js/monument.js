/* Piata Unirii — Matthias Corvinus (Matei Corvin) monumental ensemble, 0.1 m voxels.
   Pale stone pedestal, bronze equestrian king, four bronze generals on the corner plinths, reliefs, banners, patina. */
(function () {
  'use strict';
  const PU = window.PU;
  const M = PU.M, VG = PU.VoxelGrid;
  const hash3 = PU.hash3;

  PU.buildMonument = function () {
    const vs = 0.1;
    const rng = new PU.RNG(1902);
    const g = VG.box(-8.2, -1.2, -6.2, 8.2, 14.2, 6.2, vs);
    const BR = M.bronzeDark;
    const stoneFn = (x, y, z) => {
      const h = hash3(Math.floor(x / 1.3), Math.floor(y / 0.9), Math.floor(z / 1.3), 8);
      return h < 0.16 ? M.pedestalDk : h > 0.86 ? M.limestoneLt : M.pedestal;
    };
    const stone = (x0, y0, z0, x1, y1, z1) => PU.B.patchBox(g, x0, y0, z0, x1, y1, z1, stoneFn, 1.3, 0.9, 1.3);

    /* ---- steps and plinth ---- */
    g.fill(-7.4, -1.2, -5.4, 7.4, 0.25, 5.4, M.greyStoneLt);
    g.fill(-6.8, 0.25, -4.8, 6.8, 0.5, 4.8, M.pedestalDk);
    g.fill(-6.2, 0.5, -4.2, 6.2, 0.75, 4.2, M.greyStoneLt);
    g.fill(-5.7, 0.75, -3.7, 5.7, 1.05, 3.7, M.pedestalDk);
    stone(-5.4, 1.05, -3.4, 5.4, 2.0, 3.4);
    g.fill(-5.65, 2.0, -3.65, 5.65, 2.25, 3.65, M.limestoneLt);
    // corner plinths for the four generals
    const corners = [[-4.55, -2.55], [4.55, -2.55], [-4.55, 2.55], [4.55, 2.55]];
    for (const [cx, cz] of corners) {
      g.fill(cx - 0.75, 2.25, cz - 0.75, cx + 0.75, 2.85, cz + 0.75, M.pedestal);
      g.fill(cx - 0.85, 2.85, cz - 0.85, cx + 0.85, 3.0, cz + 0.85, M.limestoneLt);
    }
    /* ---- main pedestal ---- */
    stone(-3.6, 2.25, -1.95, 3.6, 6.5, 1.95);
    g.fill(-3.8, 2.25, -2.15, 3.8, 2.6, 2.15, M.limestoneLt); // base moulding
    g.fill(-3.75, 6.3, -2.1, 3.75, 6.55, 2.1, M.limestoneLt);
    g.fill(-3.95, 6.55, -2.3, 3.95, 6.85, 2.3, M.limestoneLt); // cornice
    g.fill(-3.7, 6.85, -1.6, 3.7, 7.1, 1.6, M.pedestalDk); // statue plinth
    // decorative dentils
    for (let x = -3.8; x < 3.8; x += 0.3) {
      g.fill(x, 6.35, -2.25, x + 0.16, 6.55, -2.1, M.pedestalDk, 0);
      g.fill(x, 6.35, 2.1, x + 0.16, 6.55, 2.25, M.pedestalDk, 0);
    }
    // bronze relief panels (long faces) and inscription plates (short faces)
    for (const zs of [-1, 1]) {
      const zf = zs * 1.95;
      g.fill(-2.6, 3.4, Math.min(zf, zf - zs * 0.18), 2.6, 5.7, Math.max(zf, zf - zs * 0.18), M.limestoneLt, 0);
      g.fill(-2.45, 3.55, Math.min(zf - zs * 0.05, zf + zs * 0.12), 2.45, 5.55, Math.max(zf - zs * 0.05, zf + zs * 0.12), BR, 0);
      // relief figures: clusters of small ellipsoids and spears
      for (let i = 0; i < 16; i++) {
        const x = -2.2 + (i / 15) * 4.4 + rng.range(-0.1, 0.1);
        const y = rng.range(3.8, 5.0);
        g.ellipsoid(x, y, zf + zs * 0.14, 0.14, 0.32, 0.09, M.bronzeMid);
        g.sphere(x, y + 0.42, zf + zs * 0.14, 0.11, M.bronzeMid);
        if (i % 3 === 0) g.line(x + 0.1, y - 0.3, zf + zs * 0.16, x + 0.35, y + 0.75, zf + zs * 0.16, 0.03, M.bronzeHi);
        if (i % 4 === 1) g.ellipsoid(x - 0.1, y - 0.55, zf + zs * 0.13, 0.3, 0.16, 0.08, M.bronzeMid);
      }
    }
    for (const xs of [-1, 1]) {
      const xf = xs * 3.6;
      g.fill(Math.min(xf, xf - xs * 0.12), 3.6, -1.15, Math.max(xf, xf - xs * 0.12), 5.5, 1.15, M.pedestalDk, 0);
      for (let y = 3.85; y < 5.35; y += 0.32) {
        let z = -0.95;
        while (z < 0.95) {
          const l = rng.range(0.15, 0.55);
          g.fill(Math.min(xf, xf + xs * 0.06), y, z, Math.max(xf, xf + xs * 0.06), y + 0.1, Math.min(0.95, z + l), M.bronzeDark, 0);
          z += l + 0.12;
        }
      }
    }

    /* ---- equestrian king (facing +x). Built at a finer voxel size, then scaled up x1.3 into the main grid ---- */
    const yb = 7.1;
    const SC = 1.3;
    const hg = VG.box(-3.2, yb - 0.3, -1.5, 3.2, yb + 5.4, 1.5, vs / SC);
    {
    const g = hg;
    const ell = (cx, cy, cz, rx, ry, rz, m) => g.ellipsoid(cx, cy, cz, rx, ry, rz, m || BR);
    const cap = (a, b, r0, r1, m) => g.line(a[0], a[1], a[2], b[0], b[1], b[2], r0, m || BR, r1);
    // body
    ell(0.0, yb + 1.9, 0, 1.45, 0.62, 0.5);
    ell(0.85, yb + 1.95, 0, 0.72, 0.7, 0.53);
    ell(-0.95, yb + 1.98, 0, 0.78, 0.68, 0.53);
    // neck and head
    cap([1.15, yb + 2.2, 0], [1.95, yb + 3.3, 0], 0.34, 0.2);
    cap([1.9, yb + 3.32, 0], [2.6, yb + 2.9, 0], 0.22, 0.13);
    ell(2.6, yb + 2.85, 0, 0.16, 0.13, 0.11);
    for (const zs of [-1, 1]) g.fill(1.92, yb + 3.5, zs * 0.11 - 0.03, 2.02, yb + 3.8, zs * 0.11 + 0.03, BR, 0);
    for (let t = 0; t <= 8; t++) {
      const f = t / 8;
      g.fill(1.15 + 0.8 * f - 0.05, yb + 2.4 + 1.0 * f + 0.14, -0.06, 1.15 + 0.8 * f + 0.05, yb + 2.4 + 1.0 * f + 0.34, 0.06, M.bronzeMid, 0); // mane
    }
    // tail
    const tail = [[-1.6, yb + 2.4, 0], [-1.9, yb + 2.05, 0], [-2.05, yb + 1.55, 0], [-2.05, yb + 1.05, 0.05]];
    for (let i = 0; i < tail.length - 1; i++) cap(tail[i], tail[i + 1], 0.16 - i * 0.02, 0.13 - i * 0.02);
    // legs (front-left raised: walking pose)
    const leg = (a, b, c, hoof) => {
      cap(a, b, 0.17, 0.11);
      cap(b, c, 0.11, 0.08);
      if (hoof) g.fill(c[0] - 0.13, c[1] - 0.12, c[2] - 0.11, c[0] + 0.19, c[1] + 0.04, c[2] + 0.11, M.bronzeMid, 0);
    };
    leg([0.85, yb + 1.5, 0.3], [0.9, yb + 0.85, 0.3], [0.9, yb + 0.14, 0.3], true);
    leg([0.85, yb + 1.5, -0.3], [1.25, yb + 1.05, -0.3], [1.6, yb + 0.95, -0.3], true);
    leg([-1.0, yb + 1.55, 0.3], [-1.25, yb + 0.9, 0.3], [-1.05, yb + 0.14, 0.3], true);
    leg([-1.0, yb + 1.55, -0.3], [-1.2, yb + 0.9, -0.3], [-0.95, yb + 0.14, -0.3], true);
    // saddle cloth
    g.fill(-0.55, yb + 2.45, -0.55, 0.65, yb + 2.62, 0.55, M.bronzeMid, 0);
    for (let z = -0.55; z < 0.55; z += 0.12) g.fill(-0.55, yb + 2.3, z, 0.65, yb + 2.45, z + 0.06, M.bronzeMid, 0);
    // king
    const ky = yb + 2.6;
    ell(0.1, ky + 0.55, 0, 0.27, 0.5, 0.3);
    cap([0.05, ky + 0.05, 0.3], [0.45, ky - 0.25, 0.42], 0.14, 0.12);
    cap([0.45, ky - 0.25, 0.42], [0.42, ky - 0.85, 0.42], 0.12, 0.1);
    cap([0.05, ky + 0.05, -0.3], [0.45, ky - 0.25, -0.42], 0.14, 0.12);
    cap([0.45, ky - 0.25, -0.42], [0.42, ky - 0.85, -0.42], 0.12, 0.1);
    for (const zs of [-1, 1]) g.fill(0.32, ky - 0.98, zs * 0.42 - 0.1, 0.62, ky - 0.82, zs * 0.42 + 0.1, M.bronzeMid, 0);
    g.sphere(0.2, ky + 1.28, 0, 0.2, BR);
    g.fill(0.05, ky + 1.5, -0.2, 0.36, ky + 1.62, 0.2, M.bronzeHi, 0); // crown band
    for (let a = 0; a < 6; a++) g.fill(0.2 + Math.cos(a) * 0.17 - 0.04, ky + 1.62, Math.sin(a) * 0.17 - 0.04, 0.2 + Math.cos(a) * 0.17 + 0.04, ky + 1.78, Math.sin(a) * 0.17 + 0.04, M.bronzeHi, 0);
    // shoulders and arms
    cap([0.1, ky + 0.98, -0.34], [0.1, ky + 0.98, 0.34], 0.12, 0.12);
    cap([0.1, ky + 0.98, 0.34], [0.34, ky + 0.62, 0.55], 0.1, 0.09);
    cap([0.34, ky + 0.62, 0.55], [0.55, ky + 0.98, 0.5], 0.09, 0.09);
    cap([0.55, ky + 0.98, 0.5], [0.72, ky + 1.95, 0.5], 0.04, 0.04, M.bronzeHi); // baton
    g.sphere(0.72, ky + 2.0, 0.5, 0.07, M.bronzeHi);
    cap([0.1, ky + 0.98, -0.34], [0.3, ky + 0.55, -0.5], 0.1, 0.09);
    cap([0.3, ky + 0.55, -0.5], [0.6, ky + 0.35, -0.25], 0.09, 0.08);
    cap([0.6, ky + 0.35, -0.25], [2.4, yb + 2.85, -0.1], 0.025, 0.025, M.bronzeHi); // reins
    // cloak streaming behind
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      g.ellipsoid(0.02 - 0.85 * u, ky + 0.95 - 0.95 * Math.pow(u, 1.1), 0, 0.09, 0.34 * (1 - 0.25 * u) + 0.06, 0.44 * (1 - 0.15 * u), M.bronzeMid);
    }
    // sword at the left hip
    cap([0.0, ky + 0.25, -0.58], [-0.6, ky - 0.85, -0.62], 0.045, 0.03, M.bronzeHi);
    g.fill(-0.06, ky + 0.2, -0.75, 0.06, ky + 0.3, -0.42, M.bronzeHi, 0);
    }
    // scale-copy the horse group into the main grid (destination-driven so there are no gaps)
    g.fillFn(-4.0, yb - 0.1, -2.0, 4.0, yb + 7.3, 2.0, (x, y, z) => {
      const v = hg.get(x / SC, yb + (y - yb) / SC, z / SC);
      return v || undefined;
    });

    /* ---- four bronze generals on the corner plinths (x1.3) ---- */
    const SF = 1.3;
    const man = (cx, cy, cz, phi, kind) => {
      const c = Math.cos(phi), s = Math.sin(phi);
      const T = (fx, fy, fz) => [cx + (fx * c - fz * s) * SF, cy + fy * SF, cz + (fx * s + fz * c) * SF];
      const E = (fx, fy, fz, rx, ry, rz, m) => { const p = T(fx, fy, fz); g.ellipsoid(p[0], p[1], p[2], rx * SF, ry * SF, rz * SF, m || BR); };
      const C = (a, b, r0, r1, m) => { const p = T(a[0], a[1], a[2]), q = T(b[0], b[1], b[2]); g.line(p[0], p[1], p[2], q[0], q[1], q[2], r0 * SF, m || BR, r1 * SF); };
      for (const zs of [-1, 1]) {
        E(0.07, 0.15, zs * 0.14, 0.2, 0.16, 0.1, M.bronzeMid);
        C([0.02, 0.3, zs * 0.14], [0.04, 0.85, zs * 0.15], 0.1, 0.12);
        C([0.04, 0.85, zs * 0.15], [0.0, 1.35, zs * 0.14], 0.12, 0.13);
      }
      E(0, 1.45, 0, 0.3, 0.3, 0.3);
      E(0, 1.95, 0, 0.27, 0.5, 0.27);
      E(0, 1.42, 0, 0.32, 0.06, 0.32, M.bronzeMid); // belt
      C([0, 2.35, -0.32], [0, 2.35, 0.32], 0.13, 0.13);
      E(0.02, 2.72, 0, 0.17, 0.18, 0.17);
      if (kind === 0) { // helmet + mace
        E(0.02, 2.82, 0, 0.21, 0.13, 0.21, M.bronzeMid);
        C([0.1, 2.35, 0.32], [0.32, 1.95, 0.4], 0.1, 0.09);
        C([0.32, 1.95, 0.4], [0.34, 2.15, 0.42], 0.09, 0.09);
        C([0.32, 1.7, 0.42], [0.34, 3.15, 0.42], 0.05, 0.05, M.bronzeHi);
        E(0.34, 3.22, 0.42, 0.14, 0.14, 0.14, M.bronzeHi);
        C([0.1, 2.35, -0.32], [0.25, 1.85, -0.38], 0.1, 0.09);
      } else if (kind === 1) { // fur cap + sword raised
        E(0.02, 2.88, 0, 0.22, 0.2, 0.22, M.bronzeMid);
        C([0.1, 2.35, 0.32], [0.38, 2.1, 0.44], 0.1, 0.09);
        C([0.38, 2.1, 0.44], [0.55, 3.35, 0.45], 0.05, 0.03, M.bronzeHi);
        C([0.42, 2.2, 0.3], [0.42, 2.2, 0.62], 0.04, 0.04, M.bronzeHi);
        C([0.1, 2.35, -0.32], [0.24, 1.8, -0.4], 0.1, 0.09);
      } else if (kind === 2) { // banner bearer
        E(0.02, 2.82, 0, 0.2, 0.12, 0.2, M.bronzeMid);
        C([0.1, 2.35, 0.32], [0.3, 2.0, 0.42], 0.1, 0.09);
        C([0.3, 0.3, 0.44], [0.3, 4.05, 0.44], 0.045, 0.045, M.bronzeHi);
        for (let i = 0; i < 16; i++) {
          const p = T(0.3 + i * 0.09, 3.95 - 0.55 + 0.09 * Math.sin(i * 0.55), 0.44);
          g.fill(p[0] - 0.05, p[1], p[2] - 0.05, p[0] + 0.05, p[1] + 1.0 - i * 0.012, p[2] + 0.05, i % 5 === 4 ? M.bronzeHi : M.bronzeMid, 0);
        }
        C([0.1, 2.35, -0.32], [0.25, 1.85, -0.38], 0.1, 0.09);
      } else { // shield and spear
        E(0.02, 2.84, 0, 0.19, 0.17, 0.19, M.bronzeMid);
        E(0.24, 1.85, -0.42, 0.06, 0.38, 0.3, M.bronzeHi);
        C([0.1, 2.35, -0.32], [0.24, 1.9, -0.4], 0.1, 0.09);
        C([0.1, 2.35, 0.32], [0.3, 1.9, 0.42], 0.1, 0.09);
        C([0.3, 0.4, 0.44], [0.3, 3.6, 0.44], 0.04, 0.04, M.bronzeHi);
        E(0.3, 3.72, 0.44, 0.06, 0.16, 0.06, M.bronzeHi);
      }
      // cloak
      for (let i = 0; i <= 7; i++) {
        const u = i / 7;
        E(-0.22 - 0.05 * u, 2.25 - 1.2 * u, 0, 0.07, 0.2, 0.3, M.bronzeMid);
      }
    };
    corners.forEach(([cx, cz], i) => {
      const phi = Math.atan2(cz, cx);
      man(cx, 3.0, cz, phi, i);
    });

    /* ---- bronze patina: green on upward-facing surfaces, dark in recesses, warm highlights on edges ---- */
    const bronzeSet = new Set([M.bronzeDark, M.bronzeMid, M.bronzeHi]);
    const { nx, ny, nz, data } = g;
    for (let k = 0; k < nz; k++)
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const ix = i + nx * (j + ny * k);
          const m = data[ix];
          if (!m || !bronzeSet.has(m)) continue;
          const up = j + 1 < ny ? data[ix + nx] : 0;
          const h = hash3(i >> 1, j >> 1, k >> 1, 11);
          if (!up) {
            if (h < 0.5) data[ix] = M.bronzeGreen;
            else if (h < 0.62) data[ix] = M.bronzePatina;
          } else {
            const sideOpen = (i > 0 && !data[ix - 1]) || (i + 1 < nx && !data[ix + 1]) || (k > 0 && !data[ix - nx * ny]) || (k + 1 < nz && !data[ix + nx * ny]);
            if (sideOpen && h < 0.18) data[ix] = M.bronzeGreen;
            else if (sideOpen && h > 0.93 && m !== M.bronzeHi) data[ix] = M.bronzeHi;
          }
        }

    return {
      name: 'monument',
      items: [{ grid: g, skip: [0, 0, 1, 0, 0, 0], thr: 0.3 }],
      xf: { x: PU.L.monument.x, y: PU.L.H_PLAZA, z: PU.L.monument.z, yaw: 0 },
    };
  };
})();
