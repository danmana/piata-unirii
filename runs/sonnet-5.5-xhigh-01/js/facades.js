/* Piata Unirii — historic Cluj facade generator (Baroque, Neoclassical, Historicist/Eclectic, Secession, Renaissance, Bank).
   Local frame per lot: x along the frontage, z = depth away from the square, front wall plane at z=0, y up from the ground floor. */
(function () {
  'use strict';
  const PU = window.PU;
  const M = PU.M, B = PU.B, Wall = B.Wall, VG = PU.VoxelGrid;

  const ROOFS = {
    roofOrange: ['roofOrange', 'roofTerra', 'roofLight'],
    roofTerra: ['roofTerra', 'roofOrange', 'roofRed'],
    roofRed: ['roofRed', 'roofTerra', 'roofRust'],
    roofRust: ['roofRust', 'roofRed', 'roofBrown'],
    roofLight: ['roofLight', 'roofOrange', 'roofTerra'],
    roofBrown: ['roofBrown', 'roofRust', 'roofRed'],
    slateRoof: ['slateRoof', 'darkSlate', 'zincRoof'],
    zincRoof: ['zincRoof', 'slateRoof', 'zincRoof'],
    copperGreen: ['copperGreen', 'copperGreen', 'zincRoof'],
  };
  const roofSet = (n) => (ROOFS[n] || ROOFS.roofOrange).map((k) => M[k]);
  PU.roofSet = roofSet;
  const GLASS = [M.glassDay, M.glassDay2, M.glassDay3];
  const AWN = [M.awnRed, M.awnGreen, M.awnBlue, M.awnCream];

  function strHash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  PU.strHash = strHash;

  /* ---- window with surround, recess, glass, sill, hood ---- */
  function win(W, sc, y0, ww, wh, o) {
    const vs = W.g.vs;
    const s0 = sc - ww / 2, s1 = sc + ww / 2, y1 = y0 + wh;
    const fw = o.fw === undefined ? 0.5 : o.fw;
    const proud = o.proud === undefined ? 0.5 : o.proud;
    const arch = !!o.arch;
    const outer = arch ? B.roundArch(s0, s1, y0, y1, fw) : B.rectPred(s0 - fw, s1 + fw, y0 - fw, y1 + fw);
    const inner = arch ? B.roundArch(s0, s1, y0, y1, 0) : B.rectPred(s0, s1, y0, y1);
    W.shape(s0 - fw, s1 + fw, y0 - fw, y1 + fw + 0.01, 0, proud, o.frame, outer, 1);
    W.shape(s0, s1, y0, y1 + 0.01, -0.5, proud + 0.02, 0, inner, 0);
    W.shape(s0, s1, y0, y1 + 0.01, -1.0, -0.5, o.glass, inner, 0);
    if (o.mullion) {
      W.fill(sc - vs / 2, y0, -0.5, sc + vs / 2, y1, 0.0, o.frame, 0);
      if (o.transom) W.fill(s0, y0 + wh * 0.62, -0.5, s1, y0 + wh * 0.62 + vs, 0.0, o.frame, 0);
    }
    if (o.sill !== false) W.fill(s0 - fw, y0 - fw - vs, 0, s1 + fw, y0 - fw, proud + 0.5, o.frame, 0);
    const hy = y1 + fw + (arch ? ww / 2 : 0);
    const hw = (ww + 2 * fw) / 2 + 0.5;
    const hood = o.hood;
    if (hood === 'triangle') {
      let k = 0;
      for (let hh = hw; hh > vs * 0.9; hh -= vs) {
        W.fill(sc - hh, hy + k * vs, 0, sc + hh, hy + (k + 1) * vs, proud + 0.5, o.frame, 0);
        k++;
        if (k > 4) break;
      }
    } else if (hood === 'segment') {
      const rows = [hw, hw, hw - vs, hw - 2 * vs];
      rows.forEach((hh, k) => hh > 0 && W.fill(sc - hh, hy + k * vs, 0, sc + hh, hy + (k + 1) * vs, proud + 0.5, o.frame, 0));
    } else if (hood === 'flat') {
      W.fill(sc - hw, hy, 0, sc + hw, hy + vs, proud + 0.5, o.frame, 0);
      W.fill(sc - hw + vs, hy + vs, 0, sc + hw - vs, hy + 2 * vs, proud + 0.25, o.frame, 0);
    }
    if (o.shutters) {
      W.fill(s0 - fw - 0.5, y0 - fw, 0, s0 - fw, y1 + fw, 0.25, o.shutters, 0);
      W.fill(s1 + fw, y0 - fw, 0, s1 + fw + 0.5, y1 + fw, 0.25, o.shutters, 0);
    }
  }

  function balcony(W, sc, y0, ww, mat, rail) {
    const vs = W.g.vs;
    const a = sc - ww / 2 - 0.75, b = sc + ww / 2 + 0.75;
    W.fill(a, y0 - 1.0, 0, b, y0 - 0.5, 1.5, mat, 0);
    W.fill(a, y0 - 0.5, 0, b, y0, 0.5, mat, 0); // corbel
    // railing: top rail + balusters
    W.fill(a, y0 + 0.5, 1.0, b, y0 + 1.0, 1.5, rail, 0);
    W.fill(a, y0 + 0.5, 0.0, a + vs, y0 + 1.0, 1.5, rail, 0);
    W.fill(b - vs, y0 + 0.5, 0.0, b, y0 + 1.0, 1.5, rail, 0);
    for (let s = a; s < b - 0.01; s += vs * 2) W.fill(s, y0, 1.0, s + vs, y0 + 0.5, 1.5, rail, 0);
    for (let t = 0; t < 1.5; t += vs * 2) {
      W.fill(a, y0, t, a + vs, y0 + 0.5, t + vs, rail, 0);
      W.fill(b - vs, y0, t, b, y0 + 0.5, t + vs, rail, 0);
    }
  }

  function doorArch(W, sc, w, hRect, o) {
    // arched entrance: opening w wide, hRect straight part then round arch
    const vs = W.g.vs;
    const s0 = sc - w / 2, s1 = sc + w / 2, yTop = hRect + w / 2;
    const fw = o.fw === undefined ? 0.5 : o.fw;
    W.shape(s0 - fw, s1 + fw, 0, yTop + fw + 0.01, 0, 0.75, o.frame, B.roundArch(s0, s1, 0, yTop, fw), 1);
    W.shape(s0, s1, 0, yTop + 0.01, -1.0, 0.8, 0, B.roundArch(s0, s1, 0, yTop, 0), 0);
    W.shape(s0, s1, 0, yTop + 0.01, -1.5, -1.0, o.door || M.doorWood, B.roundArch(s0, s1, 0, yTop, 0), 0);
    W.shape(s0 + vs, s1 - vs, hRect, yTop, -1.0, -0.5, o.fan || M.glassShop, B.roundArch(s0 + vs, s1 - vs, 0, yTop - vs * 0.5, 0), 0);
    // step
    W.fill(s0 - fw - 0.5, 0, 0.5, s1 + fw + 0.5, 0.5, 1.5, M.greyStone, 0);
    // keystone
    W.fill(sc - vs / 2, yTop + fw - vs, 0, sc + vs / 2, yTop + fw + vs, 1.0, o.frame, 0);
  }

  function shopfront(W, sc, ww, rng, awn) {
    const vs = W.g.vs;
    const s0 = sc - ww / 2, s1 = sc + ww / 2;
    // frame + glazing
    W.fill(s0 - 0.5, 0, 0, s1 + 0.5, 3.6, 0.5, M.doorWood, 1);
    W.carve(s0, 0.5, -0.5, s1, 3.0, 0.6);
    W.fill(s0, 0.5, -1.0, s1, 3.0, -0.5, rng.chance(0.4) ? M.glassShopLit : M.glassShop, 0);
    W.fill(s0 + ww / 2 - vs / 2, 0.5, -0.5, s0 + ww / 2 + vs / 2, 3.0, 0, M.doorWood, 0);
    // sign band
    W.fill(s0 - 0.5, 3.6, 0, s1 + 0.5, 4.2, 0.5, rng.pick([M.signCream, M.signGreen, M.signBlue, M.signRed, M.woodDk]), 0);
    if (awn) {
      for (let k = 0; k < 3; k++) W.fill(s0 - 0.25, 3.0 + k * 0.5, 0, s1 + 0.25, 3.5 + k * 0.5, 2.0 - k * 0.5, awn, 0);
    }
  }

  PU.buildFacade = function (spec, opts) {
    opts = opts || {};
    const vs = opts.vs || 0.5;
    const w = spec.w !== undefined ? spec.w : spec.b - spec.a;
    const d = spec.depth;
    const rng = new PU.RNG(strHash(spec.id || 'x') ^ (PU.SEED | 0));
    const n = spec.floors, fh = spec.fh;
    const gf = fh + 0.8;
    const floorY = [0];
    for (let k = 1; k < n; k++) floorY.push(gf + (k - 1) * fh);
    const H = gf + (n - 1) * fh + 1.5; // eave
    const g = VG.box(-1.5, -1.5, -3.5, w + 1.5, H + 15, d + 1.5, vs);
    const F = new Wall(g, 0, 0, 'front');
    const wall = M[spec.wall], trim = M[spec.trim];
    const style = spec.style;
    const dark = M.iron;
    const roofMats = roofSet(spec.roofMat);
    const wall2 = M[spec.wall2 || spec.wall];

    /* ---- body ---- */
    g.fill(0, -1.5, 0, w, H, d, wall);
    // plinth / rustication band
    const plinthMat = style === 'bank' || spec.rustic ? M.greyStoneLt : M.basement;
    F.fill(-0.0, -1.5, 0, w, 1.0, 0.5, M.basement, 0);
    if (spec.rustic || style === 'bank') {
      F.fill(0, 1.0, 0, w, gf, 0.25, plinthMat, 0);
      for (let y = 1.5; y < gf - 0.4; y += 1.0) F.carve(0, y, 0, w, y + vs, 0.26);
    }
    // string courses at floor levels
    for (let k = 1; k < n; k++) F.fill(0, floorY[k] - 0.5, 0, w, floorY[k], 0.5, trim, 0);
    // crown cornice
    F.fill(-0.5, H - 1.0, 0, w + 0.5, H - 0.5, 0.5, trim, 0);
    F.fill(-0.5, H - 0.5, 0, w + 0.5, H, 1.5, trim, 0);
    for (let s = 0; s < w; s += vs * 2) F.carve(s, H - 1.0, 0.0, s + vs, H - 0.5, 0.5); // dentils
    if (style === 'eclectic' || style === 'historicist' || style === 'secession') {
      // frieze band below the cornice in the accent colour
      F.fill(0, H - 2.5, 0, w, H - 1.5, 0.25, wall2 === wall ? M.darkCream : wall2, 0);
    }
    // corner quoins / lesenes
    if (style !== 'secession' && (spec.corner || style === 'baroque' || style === 'historicist' || style === 'neoclassical')) {
      for (let y = 1.0, alt = 0; y < H - 1.0; y += 1.0, alt++) {
        const t = alt & 1 ? 0.5 : 0.25;
        F.fill(0, y, 0, 1.0, y + 1.0, t, trim, 0);
        F.fill(w - 1.0, y, 0, w, y + 1.0, t, trim, 0);
      }
    }

    /* ---- bays ---- */
    let nb = Math.max(1, Math.round((w - 1.0) / 3.5));
    if ((spec.portal || spec.pediment) && nb % 2 === 0) nb += w > 11 ? 1 : 0;
    if (nb < 3 && (spec.portal || spec.pediment) && w >= 10) nb = 3;
    const m = w / nb;
    const wwid = m >= 3.4 ? 1.5 : m >= 2.6 ? 1.0 : 0.5;
    const ww = Math.max(1.0, wwid);
    const centers = [];
    for (let i = 0; i < nb; i++) centers.push((i + 0.5) * m);
    const mid = (nb - 1) / 2;
    const isCenter = (i) => Math.abs(i - mid) < 0.6;
    const litP = spec.litP === undefined ? 0.26 : spec.litP;
    const glassFor = () => (rng.chance(litP) ? (rng.chance(0.5) ? M.glassLit : M.glassLit2) : rng.pick(GLASS));
    const hood = spec.hoods || (style === 'baroque' ? 'triangle' : style === 'neoclassical' ? 'flat' : style === 'eclectic' ? 'segment' : style === 'historicist' ? 'segment' : null);
    const shutters = style === 'renaissance' || style === 'secession' ? (spec.wall === 'mint' ? M.awnGreen : M.awnGreen) : null;

    // ground floor
    for (let i = 0; i < nb; i++) {
      const sc = centers[i];
      if (spec.skipBelow && sc < spec.skipBelow) continue;
      if (spec.portal && isCenter(i)) {
        doorArch(F, sc, 2.5, 3.5, { frame: trim });
      } else if (spec.shop && !(nb > 2 && i === 0 && !spec.portal && w > 10)) {
        shopfront(F, sc, Math.min(m - 1.0, 3.5), rng, rng.chance(0.6) ? rng.pick(AWN) : null);
      } else if (!spec.shop && !spec.portal && i === Math.floor(nb / 2)) {
        doorArch(F, sc, 2.0, 3.0, { frame: trim });
      } else if (spec.shop && i === 0 && nb > 2 && !spec.portal && w > 10) {
        doorArch(F, sc, 2.0, 3.0, { frame: trim });
      } else {
        win(F, sc, 1.5, ww, 2.0, { frame: trim, glass: glassFor(), hood: style === 'baroque' ? 'flat' : null, arch: style === 'secession' });
      }
    }
    // upper floors
    const wh = fh >= 4.2 ? 3.0 : 2.5;
    for (let k = 1; k < n; k++) {
      const y0 = floorY[k] + (fh - wh) * 0.5 + 0.2;
      const top = k === n - 1;
      for (let i = 0; i < nb; i++) {
        const sc = centers[i];
        if (spec.skipBelow && sc < spec.skipBelow) continue;
        const o = {
          frame: trim, glass: glassFor(), hood: k === 1 && n > 2 ? hood : k === 1 ? hood : null, shutters,
          arch: (style === 'secession' && (top || spec.arched)) || (style === 'renaissance' && false),
          mullion: style === 'renaissance', transom: style === 'renaissance',
        };
        if (style === 'neoclassical') o.hood = k === 1 ? 'flat' : null;
        if (style === 'bank') { o.fw = 0.5; o.hood = k === 1 ? 'flat' : null; }
        const doBalc = spec.balcony && spec.balcony.indexOf(k) >= 0 && (isCenter(i) || (spec.balcony.length > 1 && nb <= 3));
        win(F, sc, y0, ww, wh, o);
        if (doBalc) {
          // French window opening down to the balcony and an iron balcony slab
          F.carve(sc - ww / 2, y0 - 0.5, -0.5, sc + ww / 2, y0, 0.6);
          F.fill(sc - ww / 2, y0 - 0.5, -1.0, sc + ww / 2, y0, -0.5, M.glassDay2, 0);
          balcony(F, sc, y0 - 0.5, ww + 1.0, trim, dark);
        }
      }
      // string course above each floor is already placed; add sill bands for bank
    }
    // giant-order pilasters (neoclassical centre / bank)
    if (style === 'bank' || (style === 'neoclassical' && spec.pediment)) {
      const from = style === 'bank' ? 0 : Math.max(0, Math.floor(mid - 1)), to = style === 'bank' ? nb : Math.min(nb, Math.ceil(mid + 2));
      for (let i = from; i <= to; i++) {
        const sc = i * m;
        F.fill(sc - 0.5, floorY[1] - 0.5, 0, sc + 0.5, H - 1.0, 1.0, trim, 0);
        F.fill(sc - 0.75, floorY[1] - 0.5, 0, sc + 0.75, floorY[1], 1.25, trim, 0);
        F.fill(sc - 0.75, H - 2.0, 0, sc + 0.75, H - 1.0, 1.25, trim, 0);
      }
    }
    // pediment over the central bays
    if (spec.pediment) {
      const pw = Math.min(w - 2, m * 3);
      const c0 = w / 2, hgt = Math.min(3.5, pw * 0.28);
      const rows = Math.round(hgt / vs);
      for (let r = 0; r < rows; r++) {
        const half = pw / 2 - (r * pw) / 2 / rows;
        F.fill(c0 - half, H + r * vs, 0, c0 + half, H + (r + 1) * vs, 1.0, trim, 0);
        if (r > 0 && half > 0.8) F.fill(c0 - half + 0.75, H + r * vs, 0.5, c0 + half - 0.75, H + (r + 1) * vs, 0.9, wall, 0);
      }
    }
    // oriel bay
    if (spec.oriel && n >= 3) {
      const i = Math.max(0, Math.floor(nb / 2) - (nb > 3 ? 1 : 0));
      const sc = centers[i];
      const y0 = floorY[1] - 0.5, y1 = floorY[n - 1] + fh - 0.5;
      F.fill(sc - 1.5, y0, 0.5, sc + 1.5, y1, 1.75, wall, 0);
      F.fill(sc - 1.75, y0 - 0.5, 0.5, sc + 1.75, y0, 2.0, trim, 0);
      F.fill(sc - 1.75, y1, 0.5, sc + 1.75, y1 + 0.5, 2.0, trim, 0);
      F.fill(sc - 1.0, y1 + 0.5, 0.5, sc + 1.0, y1 + 1.0, 1.75, M.slateRoof, 0);
      for (let k = 1; k < n; k++) {
        const wy = floorY[k] + (fh - wh) * 0.5 + 0.2;
        F.carve(sc - 0.5, wy, 1.75 - 0.5, sc + 0.5, wy + wh, 1.8);
        F.fill(sc - 0.5, wy, 1.25 - 0.0, sc + 0.5, wy + wh, 1.75, glassFor(), 0);
        F.fill(sc - 0.5 - vs, wy - vs, 1.75, sc + 0.5 + vs, wy, 2.25, trim, 0);
      }
    }
    // secession frieze: row of small square tiles under the top-floor windows
    if (style === 'secession') {
      const yy = floorY[n - 1] + 0.3;
      for (let s = 0.5; s < w - 0.5; s += 1.0) F.fill(s, yy, 0, s + 0.5, yy + 0.5, 0.25, M.fadedGreen, 0);
    }

    /* ---- roof ---- */
    const pitch = spec.pitch || (spec.roof === 'hip' ? 0.72 : spec.roof === 'mansard' ? 1 : 0.92);
    const zA = -0.6, zB = d + 0.6, xA = -0.4, xB = w + 0.4;
    const kind = spec.roof;
    let roofY = null; // roofY(x,z) -> absolute y of the roof surface or null
    if (kind === 'gable') {
      const nr = d > 17 ? 2 : 1;
      const sub = (zB - zA) / nr;
      roofY = (x, z) => {
        const zz = (z - zA) % sub;
        return H + Math.min(7.5, pitch * Math.min(zz, sub - zz));
      };
    } else if (kind === 'hip') {
      roofY = (x, z) => H + Math.min(9, pitch * Math.min(z - zA, zB - z, x - xA, xB - x));
    } else if (kind === 'gablePerp') {
      roofY = (x, z) => H + Math.min(9, 1.0 * Math.min(x - xA, xB - x));
    } else if (kind === 'mansard') {
      roofY = (x, z) => {
        const dd = Math.min(z - zA, zB - z, x - xA, xB - x);
        return H + (dd <= 2.5 ? 1.5 * dd : 3.75 + 0.3 * (dd - 2.5));
      };
    } else if (kind === 'flatBalustrade') {
      roofY = (x, z) => {
        const lift = x > w * 0.3 && x < w * 0.7 && z > d * 0.28 && z < d * 0.72 ? 1.5 : 0;
        return H + 0.5 + lift;
      };
    }
    if (roofY) {
      const isPerp = kind === 'gablePerp';
      B.columns(g, xA, zA, xB, zB, H - 0.5, (x, z, o) => {
        let yt = roofY(x, z);
        if (kind === 'flatBalustrade') {
          if (z < -0.01 || z > d + 0.01 || x < -0.01 || x > w + 0.01) return false;
        }
        o.top = yt;
        const band = kind === 'gablePerp' ? Math.floor((yt - H) / 0.5) : Math.floor((yt - H) / 0.5);
        o.mat = B.bandMat(roofMats, band, kind === 'gablePerp' ? z : x, strHash(spec.id || '') & 255);
        // gable end walls (party walls / hidden sides)
        if (kind === 'gable' && (x < 0.01 || x > w - 0.01 + 0.0)) o.mat = wall;
        if (isPerp && z < 0.55) o.mat = wall; // front gable in plaster
        if (kind === 'hip' && false) o.mat = wall;
        if (yt <= H + 0.01 && (z < 0 || z > d)) o.low = H - 0.5;
        return true;
      });
      if (isPerp) {
        // front gable wall face and trim rake
        F.fill(0, H, 0, w, H + 0.01, 0, wall, 0);
      }
      // ridge cap line
      if (kind === 'gable') {
        const nr = d > 17 ? 2 : 1;
        const sub = (zB - zA) / nr;
        for (let r = 0; r < nr; r++) {
          const zr = zA + sub * (r + 0.5);
          g.fill(0, H + Math.min(7.5, pitch * sub / 2), zr - 0.25, w, H + Math.min(7.5, pitch * sub / 2) + 0.5, zr + 0.25, M.ridgeCap, 0);
        }
      }
      // dormers
      const nd = spec.dormers || 0;
      if (nd && (kind === 'gable' || kind === 'hip' || kind === 'mansard')) {
        for (let k = 0; k < nd; k++) {
          const xd = (w * (k + 1)) / (nd + 1);
          const zd = kind === 'mansard' ? 1.5 : 2.0;
          const yb = roofY(xd, zd + 0.25) - 0.75;
          g.fill(xd - 1.0, yb, zd - 1.0, xd + 1.0, yb + 2.5, zd + 1.5, kind === 'mansard' ? M.darkSlate : trim, 1);
          g.carve(xd - 0.5, yb + 0.5, zd - 1.0, xd + 0.5, yb + 2.0, zd - 0.5);
          g.fill(xd - 0.5, yb + 0.5, zd - 0.5, xd + 0.5, yb + 2.0, zd, glassFor(), 0);
          g.fill(xd - 1.25, yb + 2.5, zd - 1.25, xd + 1.25, yb + 3.0, zd + 2.0, roofMats[0], 0);
          g.fill(xd - 0.75, yb + 3.0, zd - 0.9, xd + 0.75, yb + 3.5, zd + 1.5, roofMats[1], 0);
        }
      }
      // chimneys
      const nc = spec.chimneys || 0;
      for (let k = 0; k < nc; k++) {
        const cx = w * (0.2 + 0.6 * ((k + rng.f() * 0.4) / Math.max(1, nc)));
        const cz = kind === 'gablePerp' ? d * 0.5 : d * (0.42 + rng.f() * 0.16);
        const ry = roofY(cx, cz);
        g.fill(cx - 0.5, ry - 0.5, cz - 0.5, cx + 0.5, ry + 2.5, cz + 0.5, M.brick, 0);
        g.fill(cx - 0.75, ry + 2.5, cz - 0.75, cx + 0.75, ry + 3.0, cz + 0.75, M.brickDk, 0);
      }
      if (spec.flag) {
        const fx = w * 0.5, fz = d * 0.45, ry = roofY(fx, fz);
        g.fill(fx - 0.25, ry, fz - 0.25, fx + 0.25, ry + 6.5, fz + 0.25, M.iron, 0);
        g.fill(fx + 0.25, ry + 4.5, fz - 0.25, fx + 1.0, ry + 6.0, fz + 0.25, M.flagBlue, 0);
        g.fill(fx + 1.0, ry + 4.5, fz - 0.25, fx + 1.75, ry + 6.0, fz + 0.25, M.flagYellow, 0);
        g.fill(fx + 1.75, ry + 4.5, fz - 0.25, fx + 2.5, ry + 6.0, fz + 0.25, M.flagRed, 0);
      }
    }
    if (kind === 'flatBalustrade') {
      // balustraded parapet all around
      F.fill(-0.5, H, 0, w + 0.5, H + 0.5, 1.0, trim, 0);
      for (let s = 0; s < w; s += vs * 2) F.fill(s, H + 0.5, 0.25, s + vs, H + 1.5, 0.75, trim, 0);
      F.fill(-0.5, H + 1.5, 0, w + 0.5, H + 2.0, 1.0, trim, 0);
      g.fill(-0.5, H, d - 0.5, w + 0.5, H + 2.0, d + 0.5, trim, 0);
      g.fill(-0.5, H, 0, 0.5, H + 2.0, d, trim, 0);
      g.fill(w - 0.5, H, 0, w + 0.5, H + 2.0, d, trim, 0);
      for (const zz of [0, 1]) g.fill(w * 0.3, H + 2.0, d * (zz ? 0.72 : 0.28) - 0.25, w * 0.7, H + 2.6, d * (zz ? 0.72 : 0.28) + 0.25, M.darkSlate, 0);
    }

    /* ---- rear and exposed side walls (seen from the south / outer streets) ---- */
    const plain = { frame: wall2 === wall ? M.darkCream : wall2, fw: 0.5 };
    const paintWalls = (Wl, len, count) => {
      const nn = Math.max(1, Math.round(len / 3.6));
      for (let k = 0; k < count; k++) {
        for (let i = 0; i < nn; i++) {
          const sc = ((i + 0.5) * len) / nn;
          for (let f = 0; f < n; f++) {
            const wy = f === 0 ? 1.7 : floorY[f] + (fh - 2.5) * 0.5 + 0.2;
            win(Wl, sc, wy, 1.0, f === 0 ? 2.0 : 2.5, { frame: plain.frame, glass: glassFor(), sill: true, hood: null });
          }
        }
      }
    };
    if (!spec.noRear) {
      const Bk = new Wall(g, w, d, 'back');
      const nn = Math.max(1, Math.round((w - 1) / 3.6));
      for (let i = 0; i < nn; i++) {
        const sc = ((i + 0.5) * w) / nn;
        for (let f = 0; f < n; f++) {
          const wy = f === 0 ? 1.7 : floorY[f] + (fh - 2.5) * 0.5 + 0.2;
          win(Bk, sc, wy, 1.0, f === 0 ? 2.0 : 2.5, { frame: plain.frame, glass: glassFor(), sill: true });
        }
      }
      // small rear balcony strip / drainpipe accents
      Bk.fill(0, H - 1.0, 0, w, H, 0.75, trim, 0);
    }
    if (spec.sideWinL) paintWalls(new Wall(g, 0, 0, 'west'), d, 1);
    if (spec.sideWinR) paintWalls(new Wall(g, w, d, 'east'), d, 1);
    if (spec.custom) spec.custom({ g, F, w, d, H, floorY, vs, wall, trim, rng, glassFor, roofMats, roofY });
    return { grid: g, w, depth: d, H, floorY, nb, m };
  };
  PU.facadePainters = { win, balcony, doorArch, shopfront };

  /* ---- perimeter buildings ---- */
  PU.buildPerimeter = function (renderer, emit, addHero) {
    const L = PU.L;
    const y0 = L.H_PLAZA;
    const heroRanges = [];
    for (const k of ['banffy', 'mirrorN', 'mirrorS']) heroRanges.push(L.hero[k]);
    const touches = (side, edge, isStart) => {
      // is there another lot (or hero) on the same side that shares this edge?
      for (const o of L.lots) if (o.side === side && (isStart ? o.b === edge : o.a === edge)) return true;
      for (const h of heroRanges) if (h.side === side && (isStart ? h.b === edge : h.a === edge)) return true;
      return false;
    };
    for (const lot of L.lots) {
      const spec = Object.assign({}, lot);
      // local x=0 maps to a (S, W) or b (N, E): keep the two exposed-side flags aligned with that
      const startEdge = lot.side === 'S' || lot.side === 'W' ? lot.a : lot.b;
      const endEdge = lot.side === 'S' || lot.side === 'W' ? lot.b : lot.a;
      const startIsLow = lot.side === 'S' || lot.side === 'W';
      spec.sideWinL = !touches(lot.side, startEdge, startIsLow ? true : false);
      spec.sideWinR = !touches(lot.side, endEdge, startIsLow ? false : true);
      const fr = L.sideFrame(lot.side, lot.a, lot.b);
      const r = PU.buildFacade(spec, { vs: 0.5 });
      const hero = {
        name: 'lot-' + lot.id,
        items: [{ grid: r.grid, skip: [0, 0, 1, 0, 0, 0], thr: 0.34 }],
        xf: { x: fr.x, y: y0, z: fr.z, yaw: fr.yaw },
      };
      addHero(hero, [340, 900], [2, 4]);
      lot.built = r;
    }
  };
})();
