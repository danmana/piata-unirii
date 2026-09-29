/* Piata Unirii — terrain tiers (city ground + far hills). City fabric generation is appended below. */
(function () {
  'use strict';
  const PU = window.PU;
  const L = PU.L, M = PU.M;

  /* ---------------- city ground tiers ---------------- */
  PU.buildCityGround = function (emit, progress) {
    const R0 = { x0: -56, x1: 48, z0: -40, z1: 70 };
    const R1 = { x0: -112, x1: 112, z0: -82, z1: 82 };
    const R2 = { x0: -340, x1: 340, z0: -300, z1: 300 };
    const R3 = { x0: -624, x1: 624, z0: -560, z1: 560 };
    const sample = (x, z, s) => L.groundCell(x, z, s);
    const tiers = [
      { name: 'g0', s: 0.25, ...R0, hole: null, tile: 160, sample },
      { name: 'g1', s: 0.5, ...R1, hole: R0, tile: 96, sample },
      { name: 'g2', s: 1, ...R2, hole: R1, tile: 128, sample },
      { name: 'g3', s: 2, ...R3, hole: R2, tile: 96, sample },
    ];
    let n = 0;
    tiers.forEach((t, i) => {
      n += PU.meshHeightTier(t, emit);
      if (progress) progress(i / tiers.length);
    });
    return n;
  };

  /* ---------------- far terrain (hills, forests, fields) ---------------- */
  PU.buildHills = function (emit, progress) {
    const R3 = { x0: -624, x1: 624, z0: -560, z1: 560 };
    const H1 = { x0: -1392, x1: 1392, z0: -1248, z1: 1248 };
    const H2 = { x0: -3648, x1: 3648, z0: -3456, z1: 3456 };
    const H3 = { x0: -9024, x1: 9024, z0: -8640, z1: 8640 };
    const H4 = { x0: -20160, x1: 20160, z0: -19776, z1: 19776 };
    const mk = (s, qh) => (x, z) => {
      const lc = PU.landCover(x, z);
      const hq = Math.round((lc.h + lc.canopy) / qh) * qh;
      return { mat: lc.mat, h: hq, edge: lc.mat, skip: false };
    };
    const tiers = [
      { name: 'h1', s: 8, ...H1, hole: R3, tile: 64, qh: 2.5 },
      { name: 'h2', s: 24, ...H2, hole: H1, tile: 48, qh: 6 },
      { name: 'h3', s: 64, ...H3, hole: H2, tile: 48, qh: 14 },
      { name: 'h4', s: 192, ...H4, hole: H3, tile: 40, qh: 30 },
    ];
    let n = 0;
    tiers.forEach((t, i) => {
      t.sample = mk(t.s, t.qh);
      n += PU.meshHeightTier(t, emit);
      if (progress) progress((i + 1) / tiers.length);
    });
    return n;
  };
})();
