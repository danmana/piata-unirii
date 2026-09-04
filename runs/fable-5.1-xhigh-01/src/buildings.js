// Parametric historic façade generator. Local frame: frontage along +x from 0..w on
// the z=0 plane facing -z; depth along +z; y up from street level.
import { Model } from './voxel.js';
import { roundArch, pointedArch, figure } from './church.js';
import { hash3 } from './rng.js';

const ROOF_COLORS = ['#b5532f', '#a94a2b', '#c0603a', '#8f4a30', '#9c4a2c', '#b95a38', '#7f3d29'];
const SLATE = '#4a4c50';

/** Face helper: axis 'z' (wall runs along x) or 'x' (wall runs along z). */
export function makeFace(axis, pos, sign, a0, a1) {
  return { axis, pos, sign, a0, a1 };
}

export class FacadeBuilder {
  constructor(model, P, spec, rng) {
    this.m = model;
    this.P = P;
    this.spec = spec;
    this.rng = rng;
    this.s = spec.s ?? 0.5;
    const c = (hex, cls) => P.get(hex, cls);
    this.M = {
      wall: c(spec.wall ?? '#e0d3b4', 'wall'),
      wallDark: c(shade(spec.wall ?? '#e0d3b4', -0.08), 'wall'),
      trim: c(spec.trim ?? '#f1ece0', 'stone'),
      stone: c(spec.stone ?? '#cfc7b6', 'stone'),
      roof: c(spec.roof ?? ROOF_COLORS[0], 'roof'),
      roofA: c(shade(spec.roof ?? ROOF_COLORS[0], -0.07), 'roof'),
      roofB: c(shade(spec.roof ?? ROOF_COLORS[0], 0.07), 'roof'),
      slate: c(spec.slate ?? SLATE, 'roof'),
      metal: c(spec.metalColor ?? '#3b4a44', 'metal'),
      dark: c('#2a2622', 'dark'),
      glass: c(spec.glassColor ?? '#3f5163', 'glass'),
      glassLit: c('#8a6a3a', 'glassLit'),
      wood: c(spec.wood ?? '#5a3d26', 'wood'),
      awning: c(spec.awning ?? '#8b3a3a', 'cloth'),
      sign: c(spec.signColor ?? '#2f3a48', 'cloth'),
      chimney: c('#b98a6a', 'wall'),
      bronze: c('#4a453c', 'bronze'),
      lamp: c('#ffe0b0', 'lamp'),
    };
    this.litChance = spec.litChance ?? 0.4;
  }

  // ---- face primitives ---------------------------------------------------
  fbox(f, a0, a1, y0, y1, d0, d1, mat) {
    const p0 = f.pos - f.sign * d0, p1 = f.pos - f.sign * d1;
    if (f.axis === 'z') this.m.box(a0, y0, p0, a1, y1, p1, mat);
    else this.m.box(p0, y0, a0, p1, y1, a1, mat);
  }
  fshape(f, a0, a1, y0, y1, d0, d1, fn, mat) {
    const p0 = f.pos - f.sign * d0, p1 = f.pos - f.sign * d1;
    const lo = Math.min(p0, p1), hi = Math.max(p0, p1);
    if (f.axis === 'z') this.m.shape(a0, y0, lo, a1, y1, hi, (x, y) => fn(x, y), mat);
    else this.m.shape(lo, y0, a0, hi, y1, a1, (x, y, z) => fn(z, y), mat);
  }

  glassMat() {
    return this.rng() < this.litChance ? this.M.glassLit : this.M.glass;
  }

  /** Rectangular or arched window with surround, sill, glazing bars. */
  window(f, c, ww, y0, wh, opts = {}) {
    const s = this.s;
    const M = this.M;
    const fw = opts.frame ?? s;
    const recess = opts.recess ?? 0.5;
    const arch = opts.arch; // 'round' | 'segment' | 'pointed' | undefined
    const hw = ww / 2;
    let inner, outer;
    if (arch === 'round') {
      inner = roundArch(c, hw, y0 + wh - hw);
      outer = roundArch(c, hw + fw, y0 + wh - hw);
    } else if (arch === 'pointed') {
      inner = pointedArch(c, hw, y0 + wh - hw * 1.2);
      outer = pointedArch(c, hw + fw, y0 + wh - hw * 1.2);
    } else if (arch === 'segment') {
      inner = (a, y) => Math.abs(a - c) <= hw && (y <= y0 + wh - 0.4 || Math.hypot((a - c) / hw, (y - (y0 + wh - 0.4)) / 0.4) <= 1);
      outer = (a, y) => Math.abs(a - c) <= hw + fw && (y <= y0 + wh - 0.4 || Math.hypot((a - c) / (hw + fw), (y - (y0 + wh - 0.4)) / (0.4 + fw)) <= 1);
    } else {
      inner = (a, y) => Math.abs(a - c) <= hw;
      outer = (a, y) => Math.abs(a - c) <= hw + fw;
    }
    const yTop = y0 + wh + fw + 0.01;
    const protr = opts.protrude ? s : 0;
    // surround
    this.fshape(f, c - hw - fw - 0.3, c + hw + fw + 0.3, y0 - fw - 0.01, yTop, -protr, s + 0.01, (a, y) => y >= y0 - fw && outer(a, y), opts.surround ?? M.trim);
    // opening
    this.fshape(f, c - hw - 0.3, c + hw + 0.3, y0 - 0.01, yTop, -protr - 0.01, recess, (a, y) => y >= y0 && inner(a, y), 0);
    // glass
    const g = opts.glass ?? this.glassMat();
    this.fshape(f, c - hw - 0.3, c + hw + 0.3, y0 - 0.01, yTop, recess, recess + s, (a, y) => y >= y0 && inner(a, y), g);
    // glazing bars
    if (opts.bars !== false) {
      const bw = s * 0.5;
      if (ww > 1.0) this.fbox(f, c - bw, c + bw, y0, y0 + wh, recess, recess + s, M.trim);
      if (wh > 1.6) this.fbox(f, c - hw, c + hw, y0 + wh * 0.62 - bw, y0 + wh * 0.62 + bw, recess, recess + s, M.trim);
      if (ww > 2.4) {
        this.fbox(f, c - hw / 2 - bw, c - hw / 2 + bw, y0, y0 + wh, recess, recess + s, M.trim);
        this.fbox(f, c + hw / 2 - bw, c + hw / 2 + bw, y0, y0 + wh, recess, recess + s, M.trim);
      }
    }
    // sill
    if (opts.sill !== false) this.fbox(f, c - hw - fw - s * 0.5, c + hw + fw + s * 0.5, y0 - s, y0, -s, 0, M.trim);
    // lintel / pediment
    if (opts.pediment === 'tri') {
      const pw = hw + fw + s;
      this.fshape(f, c - pw - 0.2, c + pw + 0.2, yTop - 0.01, yTop + pw * 0.55 + s, -s, s * 0.5, (a, y) => Math.abs(a - c) <= pw * (1 - (y - yTop) / (pw * 0.55)) && y >= yTop, M.trim);
    } else if (opts.pediment === 'arc') {
      const pw = hw + fw + s;
      this.fshape(f, c - pw - 0.2, c + pw + 0.2, yTop - 0.01, yTop + pw * 0.5 + s, -s, s * 0.5, (a, y) => y >= yTop && Math.hypot((a - c) / pw, (y - yTop) / (pw * 0.5)) <= 1, M.trim);
    } else if (opts.pediment === 'flat' || (opts.pediment === undefined && !arch)) {
      this.fbox(f, c - hw - fw - s * 0.5, c + hw + fw + s * 0.5, yTop - 0.01, yTop + s, -s, 0, M.trim);
    }
    if (opts.shutters) {
      const sc = this.P.get(opts.shutters, 'wood');
      this.fbox(f, c - hw - fw - 0.6, c - hw - fw, y0, y0 + wh, -s * 0.5, 0.01, sc);
      this.fbox(f, c + hw + fw, c + hw + fw + 0.6, y0, y0 + wh, -s * 0.5, 0.01, sc);
    }
  }

  balcony(f, c, bw, y, opts = {}) {
    const s = this.s;
    const M = this.M;
    const depth = opts.depth ?? 1.25;
    this.fbox(f, c - bw / 2, c + bw / 2, y - s, y, -depth, 0.01, M.stone);
    // brackets
    this.fbox(f, c - bw / 2 + 0.2, c - bw / 2 + 0.2 + s, y - 2 * s, y - s, -depth * 0.7, 0.01, M.trim);
    this.fbox(f, c + bw / 2 - 0.2 - s, c + bw / 2 - 0.2, y - 2 * s, y - s, -depth * 0.7, 0.01, M.trim);
    // railing
    const rh = 1.0;
    const bar = Math.max(0.12, s * 0.5);
    for (let a = c - bw / 2 + bar; a <= c + bw / 2 - bar + 0.01; a += Math.max(0.5, s * 2)) {
      this.fbox(f, a - bar, a + bar, y, y + rh, -depth, -depth + 2 * bar, M.metal);
    }
    this.fbox(f, c - bw / 2, c + bw / 2, y + rh - bar, y + rh + bar, -depth, -depth + 2 * bar, M.metal);
    this.fbox(f, c - bw / 2, c - bw / 2 + 2 * bar, y, y + rh, -depth, 0, M.metal);
    this.fbox(f, c + bw / 2 - 2 * bar, c + bw / 2, y, y + rh, -depth, 0, M.metal);
  }

  cornice(f, y, depth = 0.5, thick = 0.5, mat) {
    const s = this.s;
    this.fbox(f, f.a0 - s, f.a1 + s, y - thick, y, -depth, 0, mat ?? this.M.trim);
    if (depth > s) this.fbox(f, f.a0 - s, f.a1 + s, y - thick - s, y - thick, -depth + s, 0, mat ?? this.M.trim);
  }

  pilaster(f, a, y0, y1, pw = 0.8, mat) {
    const s = this.s;
    this.fbox(f, a - pw / 2, a + pw / 2, y0, y1, -s, 0, mat ?? this.M.trim);
    this.fbox(f, a - pw / 2 - s, a + pw / 2 + s, y1 - s, y1, -s, 0, mat ?? this.M.trim); // capital
    this.fbox(f, a - pw / 2 - s * 0.5, a + pw / 2 + s * 0.5, y0, y0 + s, -s, 0, mat ?? this.M.trim); // base
  }

  /** Round-arched arcade opening (shops / passages). */
  arcadeArch(f, c, hw, hTop, opts = {}) {
    const s = this.s;
    const M = this.M;
    const ys = hTop - hw;
    const inner = roundArch(c, hw, ys);
    const outer = roundArch(c, hw + s, ys);
    const depth = opts.depth ?? 1.5;
    // stone archivolt
    this.fshape(f, c - hw - s - 0.3, c + hw + s + 0.3, -0.5, hTop + s + 0.2, -s * (opts.protrude ? 1 : 0), s, (a, y) => outer(a, y), opts.surround ?? M.stone);
    // dark interior back
    this.fshape(f, c - hw - 0.3, c + hw + 0.3, -0.5, hTop + 0.2, depth, depth + s, (a, y) => inner(a, y), M.dark);
    this.fshape(f, c - hw - 0.3, c + hw + 0.3, -0.5, hTop + 0.2, -s - 0.01, depth, (a, y) => inner(a, y), 0);
    if (opts.shop) {
      // shop window set back inside the arch
      this.fshape(f, c - hw - 0.3, c + hw + 0.3, 0.6, hTop + 0.2, depth - 0.5, depth - 0.5 + s, (a, y) => inner(a - 0, y) && Math.abs(a - c) < hw - s, opts.glass ?? this.glassMat());
      this.fbox(f, c - hw, c + hw, -0.5, 0.6, depth - 0.5, depth, M.wood);
    } else if (opts.door) {
      this.fbox(f, c - hw + s, c + hw - s, -0.5, hTop - hw * 0.4, depth - 0.5, depth, M.wood);
      this.fbox(f, c - s * 0.25, c + s * 0.25, -0.5, hTop - hw * 0.4, depth - 0.5 - 0.02, depth - 0.5, M.dark);
    }
  }

  /** Shopfront: wide glass with frame, fascia sign and optional awning. */
  shopfront(f, c, ww, hTop, opts = {}) {
    const s = this.s;
    const M = this.M;
    const hw = ww / 2;
    this.fbox(f, c - hw - s, c + hw + s, -0.5, hTop + s, 0, s, M.dark); // frame
    this.fbox(f, c - hw, c + hw, 0.3, hTop, -0.01, 0.5, 0);
    this.fbox(f, c - hw, c + hw, 0.3, hTop, 0.5, 0.5 + s, opts.glass ?? this.glassMat());
    this.fbox(f, c - hw, c + hw, -0.5, 0.3, 0, 0.5, M.dark);
    if (opts.door) {
      const dc = c + hw - 0.8;
      this.fbox(f, dc - 0.6, dc + 0.6, -0.5, 2.4, 0.5, 0.5 + s, M.wood);
    }
    // fascia sign
    const sc = opts.signColor ? this.P.get(opts.signColor, 'cloth') : M.sign;
    this.fbox(f, c - hw - s, c + hw + s, hTop + s, hTop + s + 0.6, -s * 0.5, 0.01, sc);
    // lettering suggestion
    for (let a = c - hw + 0.5; a < c + hw - 0.5; a += 0.6) {
      if (hash3(Math.round(a * 10), Math.round(c * 7), 1, 3) < 0.6) this.fbox(f, a, a + 0.3, hTop + s + 0.15, hTop + s + 0.45, -s * 0.5 - 0.03, -s * 0.5, M.trim);
    }
    if (opts.awning) {
      const ac = this.P.get(opts.awning, 'cloth');
      const aw = hw + 0.2;
      // sloped awning made of stepped slabs
      const steps = Math.max(2, Math.round(1.6 / s));
      for (let k = 0; k < steps; k++) {
        const dd = 0.2 + k * (1.6 / steps);
        this.fbox(f, c - aw, c + aw, hTop + 0.9 - k * (0.5 / steps) - s * 0.5, hTop + 0.9 - k * (0.5 / steps), -dd - 1.6 / steps, -dd, ac);
      }
    }
  }

  gate(f, c, hw, hTop, opts = {}) {
    const s = this.s;
    const M = this.M;
    const ys = hTop - hw;
    const inner = roundArch(c, hw, ys);
    const outer = roundArch(c, hw + s * 1.5, ys);
    const depth = opts.depth ?? 2.5;
    this.fshape(f, c - hw - s * 2 - 0.3, c + hw + s * 2 + 0.3, -0.5, hTop + s * 1.5 + 0.3, -s, s, (a, y) => outer(a, y), M.stone);
    // keystone
    this.fbox(f, c - s, c + s, hTop - s * 0.5, hTop + s * 2, -s * 1.5, s, M.trim);
    this.fshape(f, c - hw - 0.3, c + hw + 0.3, -0.5, hTop + 0.3, -s - 0.01, depth, (a, y) => inner(a, y), 0);
    // wooden double door with a fanlight
    this.fshape(f, c - hw - 0.3, c + hw + 0.3, -0.5, hTop + 0.3, depth * 0.55, depth * 0.55 + s, (a, y) => inner(a, y), M.wood);
    this.fbox(f, c - s * 0.3, c + s * 0.3, -0.5, ys, depth * 0.55 - 0.02, depth * 0.55, M.dark);
    this.fshape(f, c - hw - 0.3, c + hw + 0.3, ys + 0.2, hTop + 0.3, depth * 0.55 - 0.02, depth * 0.55 + s, (a, y) => inner(a, y) && y > ys + 0.2, M.glass);
    // passage interior
    this.fshape(f, c - hw - 0.3, c + hw + 0.3, -0.5, hTop + 0.3, depth * 0.55 + s, depth * 0.55 + s + 0.01, (a, y) => inner(a, y), M.dark);
  }

  /** Small roof-slope dormer with a window on the -z (front) slope. */
  dormer(x, zBase, yBase, mat) {
    const s = this.s;
    const M = this.M;
    const w = 1.4, h = 1.7, dp = 1.6;
    this.m.box(x - w / 2, yBase - 0.5, zBase, x + w / 2, yBase + h, zBase + dp, mat ?? M.wall);
    this.m.box(x - 0.45, yBase + 0.35, zBase - 0.01, x + 0.45, yBase + 1.35, zBase + 0.3, 0);
    this.m.box(x - 0.45, yBase + 0.35, zBase + 0.3, x + 0.45, yBase + 1.35, zBase + 0.3 + s, this.glassMat());
    this.m.box(x - s * 0.25, yBase + 0.35, zBase + 0.3, x + s * 0.25, yBase + 1.35, zBase + 0.3 + s, M.trim);
    // small gable roof
    this.m.shape(x - w / 2 - s, yBase + h - 0.1, zBase - s, x + w / 2 + s, yBase + h + 1.1, zBase + dp + s, (px, py, pz) => py - (yBase + h - 0.1) <= (w / 2 + s - Math.abs(px - x)) * 1.1, M.roofA);
  }

  chimney(x, z, yTop, h = 1.6) {
    this.m.box(x - 0.45, yTop - 1.5, z - 0.45, x + 0.45, yTop + h, z + 0.45, this.M.chimney);
    this.m.box(x - 0.55, yTop + h - 0.3, z - 0.55, x + 0.55, yTop + h, z + 0.55, this.M.dark);
  }
}

/** Darken/lighten a hex colour by a fraction. */
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const adj = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + f))));
  r = adj(r); g = adj(g); b = adj(b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** Gable / hip roof wedge over rectangle [x0,x1]x[z0,z1], ridge along x. */
function roofWedge(model, x0, z0, x1, z1, eaveY, pitch, mat, { overhang = 0.5, hip = false, gableWall = null, maxRise = 12, ridgeAlongZ = false, s = 0.5 } = {}) {
  const zc = (z0 + z1) / 2, xc = (x0 + x1) / 2;
  const hz = (z1 - z0) / 2 + overhang, hx = (x1 - x0) / 2 + overhang;
  const across = ridgeAlongZ ? hx : hz;
  const rise = Math.min(maxRise, across * pitch);
  const top = eaveY - s + rise + 0.01;
  const surf = (x, z) => {
    const dz = across - Math.abs(ridgeAlongZ ? x - xc : z - zc);
    let y = eaveY - s + Math.min(rise, dz * pitch);
    if (hip) {
      const dEnd = (ridgeAlongZ ? hz - Math.abs(z - zc) : hx - Math.abs(x - xc));
      y = Math.min(y, eaveY - s + dEnd * pitch);
    }
    return y;
  };
  model.shape(x0 - overhang, eaveY - s, z0 - overhang, x1 + overhang, top + 0.5, z1 + overhang, (x, y, z) => {
    const t = surf(x, z);
    return y <= t && y > t - 4.5;
  }, mat);
  if (gableWall && !hip) {
    // fill triangular gable ends within the wall thickness
    const ends = ridgeAlongZ ? [[x0 - overhang, x1 + overhang, z0, z0 + 0.5], [x0 - overhang, x1 + overhang, z1 - 0.5, z1]] : [[x0, x0 + 0.5, z0 - overhang, z1 + overhang], [x1 - 0.5, x1, z0 - overhang, z1 + overhang]];
    for (const [ex0, ex1, ez0, ez1] of ends) {
      model.shape(ex0, eaveY - s, ez0, ex1, top + 0.5, ez1, (x, y, z) => y <= surf(x, z) - 0.01, gableWall);
    }
  }
  return { rise, top: eaveY - s + rise, surf };
}

/**
 * Build a complete building model from a spec. Returns { model, H, roofTop }.
 */
export function buildBuilding(spec, P, rng) {
  const s = spec.s ?? 0.5;
  const w = spec.w, d = spec.d;
  const floors = spec.floors ?? 2;
  const groundH = spec.groundH ?? 4.6;
  const floorH = spec.floorH ?? 3.8;
  const atticH = spec.attic ? (spec.atticH ?? 2.6) : 0;
  const H = groundH + floors * floorH + atticH;
  const roofType = spec.roofType ?? 'gable';
  const pitch = spec.pitch ?? 0.95;
  const simple = !!spec.simple;

  const model = new Model(P);
  const maxRise = roofType === 'mansard' ? 8 : Math.min(spec.maxRise ?? 8.5, Math.max(4, Math.min(w, d) / 2 * pitch));
  model.addGrid([-2.5, -1.5, -3], [w + 2.5, H + maxRise + 6.5, d + 2.5], s);
  const B = new FacadeBuilder(model, P, spec, rng);
  const M = B.M;

  // ---- footprint: solid block or ring around a courtyard ----
  const courtyard = spec.courtyard && w >= 22 && d >= 24;
  const fd = spec.frontDepth ?? 13, sw = spec.wingW ?? 7.5, rd = spec.rearDepth ?? 8;
  model.box(0, -1.5, 0, w, H, d, M.wall);
  let court = null;
  if (courtyard) {
    court = { x0: sw, z0: fd, x1: w - sw, z1: d - rd };
    model.carve(court.x0, -1.5, court.z0, court.x1, H + 20, court.z1);
  }

  // ---- roof ----
  let roofTop = H + 2;
  if (roofType === 'flat') {
    model.box(-0.3, H, -0.3, w + 0.3, H + 0.8, d + 0.3, M.trim); // parapet
    model.box(0.3, H, 0.3, w - 0.3, H + 0.5, d - 0.3, M.slate);
    roofTop = H + 0.8;
  } else if (roofType === 'mansard') {
    // steep dark lower slope, shallow upper slope
    const inset = (x, z) => Math.min(x + 0.5, w + 0.5 - x, z + 0.5, d + 0.5 - z);
    const f = (t) => (t <= 2.1 ? 2.2 * t : 4.6 + 0.4 * (t - 2.1));
    model.shape(-0.5, H - s, -0.5, w + 0.5, H + 8.5, d + 0.5, (x, y, z) => {
      const t = inset(x, z);
      if (court && x > court.x0 + 0.5 && x < court.x1 - 0.5 && z > court.z0 + 0.5 && z < court.z1 - 0.5) return false;
      const top = H - s + f(t);
      return y <= top && y > top - 4;
    }, M.slate);
    roofTop = H - s + f(Math.min(w, d) / 2);
    // ridge cresting
    model.box(w * 0.2, roofTop - 0.2, d / 2 - 0.15, w * 0.8, roofTop + 0.5, d / 2 + 0.15, M.metal);
  } else if (courtyard) {
    // one gable per wing
    const r1 = roofWedge(model, 0, 0, w, fd, H, pitch, M.roof, { hip: spec.hip, gableWall: M.wall, maxRise, s });
    roofWedge(model, 0, fd - 1, sw, d - rd + 1, H - 0.5, pitch * 0.9, M.roof, { ridgeAlongZ: true, hip: true, maxRise: maxRise * 0.8, s });
    roofWedge(model, w - sw, fd - 1, w, d - rd + 1, H - 0.5, pitch * 0.9, M.roof, { ridgeAlongZ: true, hip: true, maxRise: maxRise * 0.8, s });
    roofWedge(model, 0, d - rd, w, d, H - 1.0, pitch * 0.9, M.roof, { hip: true, maxRise: maxRise * 0.8, s });
    roofTop = r1.top;
    // reopen the courtyard through any roof spill
    model.carve(court.x0 + 0.6, H - 0.4, court.z0 + 0.6, court.x1 - 0.6, H + 30, court.z1 - 0.6);
  } else if (d > 17 && !spec.singleRoof) {
    // front wing + lower rear wing with a valley
    const fdp = Math.min(13, d * 0.55);
    const r1 = roofWedge(model, 0, 0, w, fdp, H, pitch, M.roof, { hip: spec.hip, gableWall: M.wall, maxRise, s });
    roofWedge(model, 0, fdp - 0.5, w, d, H - 0.75, pitch * 0.85, M.roof, { hip: true, maxRise: maxRise * 0.75, s });
    roofTop = r1.top;
  } else {
    const r = roofWedge(model, 0, 0, w, d, H, pitch, M.roof, { hip: spec.hip, gableWall: M.wall, maxRise, s });
    roofTop = r.top;
  }
  // tile course variation
  if (!simple) {
    model.paint(-1, H - 1, -1, w + 1, roofTop + 1, d + 1, (x, y, z, cur) => {
      if (cur !== M.roof) return 0;
      const row = Math.floor(y / (s * 2));
      const v = (row * 7919 + Math.floor(x / 9) * 31) % 11;
      return v < 3 ? M.roofA : v > 8 ? M.roofB : 0;
    });
  }

  // ---- faces ----
  const front = makeFace('z', 0, -1, 0, w);
  const bayW = spec.bayW ?? 3.4;
  const margin = spec.margin ?? Math.max(1.3, bayW * 0.45);
  const nBays = Math.max(1, Math.floor((w - 2 * margin + 0.4) / bayW));
  const spacing = (w - 2 * margin) / nBays;
  const bayC = (i) => margin + spacing * (i + 0.5);
  const centreBay = Math.floor(nBays / 2);
  const ww = spec.windowW ?? Math.min(1.6, spacing * 0.42);
  const wh = spec.windowH ?? 2.5;
  const risalit = spec.risalit; // { bays, proj }
  const risBays = new Set();
  if (risalit) {
    const half = Math.floor(risalit.bays / 2);
    for (let i = centreBay - half; i <= centreBay + half; i++) risBays.add(i);
  }

  // risalit projection (front wall pushed forward for the central bays)
  if (risalit && !simple) {
    const ra0 = bayC(Math.min(...risBays)) - spacing / 2, ra1 = bayC(Math.max(...risBays)) + spacing / 2;
    model.box(ra0, -1.5, -risalit.proj, ra1, H + (spec.pediment ? 0 : 0), 0.01, M.wall);
  }
  const faceAt = (i) => (risalit && risBays.has(i) ? makeFace('z', -risalit.proj, -1, 0, w) : front);

  // plinth
  B.fbox(front, -0.2, w + 0.2, -1.5, 0.6, -s * 0.5, 0, M.stone);

  // ---- ground floor ----
  const gType = spec.ground ?? 'shops';
  const gateBay = spec.gateBay === 'center' ? centreBay : (spec.gateBay ?? (gType === 'gate' ? centreBay : -1));
  for (let i = 0; i < nBays; i++) {
    const c = bayC(i);
    const f = faceAt(i);
    if (simple) {
      B.window(f, c, ww * 1.1, 1.0, 2.6, { bars: false, sill: false, pediment: 'none', recess: 0.5 });
      continue;
    }
    if (i === gateBay) {
      B.gate(f, c, Math.min(1.9, spacing * 0.36), groundH - 0.8, {});
      continue;
    }
    if (gType === 'arcade') {
      B.arcadeArch(f, c, Math.min(1.7, spacing * 0.34), groundH - 0.7, { shop: i % 2 === 0, door: i % 2 === 1, protrude: s <= 0.25 });
    } else if (gType === 'shops') {
      const awn = rng() < 0.45 ? rng.pick(['#8b3a3a', '#2f4a3b', '#a8894a', '#4a3b5c', '#7a2e2e', '#3b5a6b']) : null;
      B.shopfront(f, c, Math.min(spacing * 0.7, 3.2), Math.min(3.4, groundH - 1.1), { door: i % 3 === 1, awning: awn, signColor: rng.pick(['#2f3a48', '#4a2f2f', '#2f4a3b', '#3a3a3a', '#5a4a2f']) });
    } else if (gType === 'palace') {
      // tall arched windows with rustication rhythm
      B.window(f, c, ww * 1.05, 1.3, groundH - 2.3, { arch: 'segment', pediment: 'none' });
    } else {
      B.window(f, c, ww, 1.1, groundH - 2.2, { pediment: 'flat' });
    }
  }
  // rustication bands on the ground floor
  if (spec.rustication && !simple) {
    if (s <= 0.25) {
      for (let y = 0.9; y < groundH - 0.4; y += 1.0) B.fbox(front, -0.01, w + 0.01, y - 0.125, y + 0.125, -0.01, 0.25, M.wallDark);
      if (risalit) for (let y = 0.9; y < groundH - 0.4; y += 1.0) B.fbox(makeFace('z', -risalit.proj, -1, 0, w), bayC(Math.min(...risBays)) - spacing / 2, bayC(Math.max(...risBays)) + spacing / 2, y - 0.125, y + 0.125, -0.01, 0.25, M.wallDark);
    } else {
      for (let y = 1.0; y < groundH - 0.4; y += 1.0) B.fbox(front, 0, w, y - 0.25, y + 0.25, 0, s, M.wallDark);
    }
  }
  // string course above the ground floor
  if (!simple) B.cornice(front, groundH + 0.25, s, s);
  if (risalit && !simple) B.cornice(makeFace('z', -risalit.proj, -1, bayC(Math.min(...risBays)) - spacing / 2, bayC(Math.max(...risBays)) + spacing / 2), groundH + 0.25, s, s);

  // ---- upper floors ----
  const balconyMode = spec.balconies ?? 'none';
  for (let fl = 0; fl < floors; fl++) {
    const y = groundH + fl * floorH;
    const isNoble = fl === 0;
    const sill = y + (spec.sillH ?? 1.0);
    for (let i = 0; i < nBays; i++) {
      const c = bayC(i);
      const f = faceAt(i);
      if (simple) {
        B.window(f, c, ww, sill, wh, { bars: false, sill: false, pediment: 'none', recess: 0.5 });
        continue;
      }
      const inRis = risBays.has(i);
      const hasBalcony = balconyMode === 'all' || (balconyMode === 'center' && i === centreBay && isNoble) || (balconyMode === 'alternate' && isNoble && i % 2 === 0) || (balconyMode === 'ends' && isNoble && (i === 0 || i === nBays - 1)) || (balconyMode === 'risalit' && inRis && isNoble);
      if (spec.loggia && inRis && fl === floors - 1) {
        // open loggia arches with columns
        B.arcadeArch(f, c, Math.min(1.5, spacing * 0.32), y + floorH - 0.6, { depth: 2.2 });
        B.fbox(f, c - spacing / 2 - 0.35, c - spacing / 2 + 0.35, y, y + floorH - 0.5, -s, 0, M.trim);
        continue;
      }
      const pediment = isNoble ? (spec.style === 'baroque' ? (i % 2 ? 'arc' : 'tri') : spec.style === 'neoclassical' ? 'tri' : spec.style === 'secession' ? 'none' : 'flat') : 'flat';
      const arch = spec.style === 'secession' && fl === floors - 1 ? 'segment' : spec.style === 'renaissance' && isNoble ? 'round' : undefined;
      const y0 = hasBalcony ? y + 0.1 : sill;
      const hgt = hasBalcony ? wh + (sill - y) - 0.1 : wh;
      B.window(f, c, ww, y0, hgt, { arch, pediment, protrude: s <= 0.25 && isNoble, shutters: spec.shutters });
      if (hasBalcony) B.balcony(f, c, Math.min(spacing * 0.8, ww + 1.6), y);
    }
    if (fl > 0 && !simple) B.cornice(front, y + 0.25, s, s);
    if (fl > 0 && risalit && !simple) B.cornice(makeFace('z', -risalit.proj, -1, bayC(Math.min(...risBays)) - spacing / 2, bayC(Math.max(...risBays)) + spacing / 2), y + 0.25, s, s);
  }
  // attic band windows
  if (atticH > 0 && !simple) {
    const y = groundH + floors * floorH;
    for (let i = 0; i < nBays; i++) {
      B.window(faceAt(i), bayC(i), ww * 0.8, y + 0.6, atticH - 1.4, { pediment: 'none', bars: false });
    }
  }
  // pilasters between bays through the upper floors
  if (spec.pilasters && !simple) {
    for (let i = 0; i <= nBays; i++) {
      const a = margin + spacing * i;
      if (a < 0.6 || a > w - 0.6) continue;
      if (risalit && risBays.has(i) && risBays.has(i - 1)) continue;
      B.pilaster(front, a, groundH + 0.25, H - 0.9, spec.pilasterW ?? 0.8);
    }
  }
  if (risalit && spec.columns && !simple) {
    const ra0 = bayC(Math.min(...risBays)) - spacing / 2, ra1 = bayC(Math.max(...risBays)) + spacing / 2;
    const rf = makeFace('z', -risalit.proj, -1, ra0, ra1);
    for (let a = ra0 + 0.6; a <= ra1 - 0.5; a += spacing) B.pilaster(rf, a, groundH + 0.25, H - 0.9, 0.9);
    B.pilaster(rf, ra1 - 0.6, groundH + 0.25, H - 0.9, 0.9);
  }
  // main cornice(s)
  if (!simple) {
    B.cornice(front, H, 0.5 + s, 0.75);
    if (risalit) B.cornice(makeFace('z', -risalit.proj, -1, bayC(Math.min(...risBays)) - spacing / 2, bayC(Math.max(...risBays)) + spacing / 2), H, 0.5 + s, 0.75);
  } else {
    B.cornice(front, H, s, s);
  }
  // pediment over the risalit
  if (risalit && spec.pediment && !simple) {
    const ra0 = bayC(Math.min(...risBays)) - spacing / 2 - 0.3, ra1 = bayC(Math.max(...risBays)) + spacing / 2 + 0.3;
    const pc = (ra0 + ra1) / 2, pw = (ra1 - ra0) / 2, ph = pw * 0.42;
    model.shape(ra0 - 0.5, H - 0.01, -risalit.proj - 0.6, ra1 + 0.5, H + ph + 0.6, 1.0, (x, y, z) => Math.abs(x - pc) <= pw * (1 - (y - H) / ph) && y >= H, M.wall);
    model.shape(ra0 - 0.5, H - 0.01, -risalit.proj - 0.6, ra1 + 0.5, H + ph + 0.8, -risalit.proj + 0.3, (x, y, z) => {
      const lim = pw * (1 - (y - H) / ph);
      return y >= H && Math.abs(x - pc) <= lim + 0.35 && Math.abs(x - pc) > lim - 0.15;
    }, M.trim);
    model.box(ra0 - 0.5, H - 0.01, -risalit.proj - 0.6, ra1 + 0.5, H + 0.45, -risalit.proj + 0.3, M.trim);
  }
  // attic balustrade with statues / urns along the roofline
  if (spec.statues && !simple) {
    const ra0 = risalit ? bayC(Math.min(...risBays)) - spacing / 2 : 1.0, ra1 = risalit ? bayC(Math.max(...risBays)) + spacing / 2 : w - 1.0;
    const zb = risalit ? -risalit.proj : 0;
    model.box(ra0, H, zb - 0.3, ra1, H + 1.1, zb + 0.9, M.trim); // parapet
    for (let a = ra0 + 0.4; a < ra1 - 0.3; a += 0.8) model.box(a, H, zb - 0.3, a + 0.4, H + 1.1, zb + 0.9, 0); // balusters gap
    model.box(ra0, H + 0.9, zb - 0.35, ra1, H + 1.2, zb + 0.95, M.trim); // rail
    model.box(ra0, H, zb - 0.35, ra1, H + 0.25, zb + 0.95, M.trim);
    const n = spec.statues;
    for (let k = 0; k < n; k++) {
      const a = ra0 + ((k + 0.5) / n) * (ra1 - ra0);
      model.box(a - 0.6, H, zb - 0.4, a + 0.6, H + 1.35, zb + 1.0, M.trim);
      figure(model, M.stone, a, H + 1.35, zb + 0.3, 2.6, Math.PI, { head: M.stone });
    }
  }
  if (spec.urns && !simple) {
    for (let k = 0; k < spec.urns; k++) {
      const a = 1.2 + ((k + 0.5) / spec.urns) * (w - 2.4);
      if (risalit && a > bayC(Math.min(...risBays)) - spacing / 2 && a < bayC(Math.max(...risBays)) + spacing / 2) continue;
      model.box(a - 0.5, H, -0.4, a + 0.5, H + 0.6, 0.6, M.trim);
      model.ellipsoid(a, H + 1.15, 0.1, 0.45, 0.55, 0.45, M.trim);
    }
  }

  // ---- dormers & chimneys ----
  if (!simple && roofType !== 'flat') {
    const nd = spec.dormers ?? (rng() < 0.6 ? Math.max(1, Math.floor(nBays / 2)) : 0);
    for (let k = 0; k < nd; k++) {
      const a = margin + spacing * ((nBays / nd) * (k + 0.5));
      const zBase = roofType === 'mansard' ? 0.35 : 1.2;
      const yBase = roofType === 'mansard' ? H + 0.6 : H - s + (zBase + 0.5) * pitch - 0.3;
      B.dormer(a, zBase, yBase, roofType === 'mansard' ? M.slate : M.wall);
    }
  }
  const nc = spec.chimneys ?? rng.int(1, 3);
  const ridgeZ = courtyard ? fd / 2 : Math.min(d, 13) / 2;
  for (let k = 0; k < nc; k++) {
    const a = 1.5 + rng() * (w - 3);
    const zc = ridgeZ + rng.range(-1.5, 1.5);
    const yTop = roofType === 'mansard' ? roofTop : Math.min(roofTop, H - s + (Math.min(zc, ridgeZ * 2 - zc) + 0.5) * pitch);
    B.chimney(a, zc, yTop, rng.range(1.2, 2.0));
  }

  // ---- corner treatments ----
  if (spec.cornerRound || spec.turret) {
    const opt = spec.turret ?? spec.cornerRound;
    const r = opt.r ?? 3.5;
    const cx = opt.end === 'left' ? r : w - r;
    const cz = r;
    // carve the square corner outside the quarter circle
    const ex0 = opt.end === 'left' ? -1 : w - r, ex1 = opt.end === 'left' ? r : w + 1;
    model.shape(ex0 - 2, -1.5, -3, ex1 + 2, H + maxRise + 6, r, (x, y, z) => {
      const inCorner = opt.end === 'left' ? x < cx : x > cx;
      return inCorner && z < cz && (x - cx) * (x - cx) + (z - cz) * (z - cz) > r * r;
    }, 0);
    // roof over the rounded corner is a conical cap unless a turret takes over
    const turretTop = spec.turret ? H + (opt.rise ?? 2.4) : H;
    if (spec.turret) {
      model.cylinder(cx, cz, r, r, H - 0.5, turretTop, M.wall);
      model.cylinder(cx, cz, r + 0.35, r + 0.35, turretTop - 0.6, turretTop, M.trim);
      // small round windows on the turret drum
      for (const ang of [-Math.PI * 0.75, -Math.PI * 0.5, -Math.PI * 0.25]) {
        const wx = cx + Math.cos(ang) * (r - 0.3), wz = cz + Math.sin(ang) * (r - 0.3);
        model.shape(wx - 0.9, turretTop - 2.0, wz - 0.9, wx + 0.9, turretTop - 0.9, wz + 0.9, (x, y, z) => Math.hypot(x - wx, z - wz) < 0.55 && Math.hypot(x - cx, z - cz) > r - 0.6, M.dark);
      }
      if (opt.type === 'dome') {
        model.ellipsoid(cx, turretTop, cz, r + 0.3, r * 0.85, r + 0.3, M.slate, (x, y) => y >= turretTop);
        model.cylinder(cx, cz, r * 0.28, r * 0.28, turretTop + r * 0.8, turretTop + r * 0.85 + 1.2, M.trim);
        model.cone(cx, cz, r * 0.36, 0.05, turretTop + r * 0.85 + 1.2, turretTop + r * 0.85 + 2.6, M.slate, 8);
        model.box(cx - 0.1, turretTop + r * 0.85 + 2.4, cz - 0.1, cx + 0.1, turretTop + r * 0.85 + 3.6, cz + 0.1, M.metal);
      } else {
        // helmet: bulbous base then slender spire
        model.ellipsoid(cx, turretTop + 0.2, cz, r + 0.3, r * 0.55, r + 0.3, M.slate, (x, y) => y >= turretTop);
        model.cone(cx, cz, r * 0.75, 0.15, turretTop + r * 0.5, turretTop + r * 0.5 + r * 1.7, M.slate, 8);
        model.box(cx - 0.1, turretTop + r * 0.5 + r * 1.6, cz - 0.1, cx + 0.1, turretTop + r * 0.5 + r * 1.7 + 1.4, cz + 0.1, M.metal);
        model.ellipsoid(cx, turretTop + r * 0.5 + r * 1.7 + 1.0, cz, 0.3, 0.3, 0.3, M.metal);
      }
    } else {
      model.cone(cx, cz, r + 0.5, 0.3, H - s, H - s + (r + 0.5) * pitch, M.roof, 0);
    }
    // windows on the curved face: recesses at fixed angles for each floor
    const angs = r >= 3.2 ? [-Math.PI * 0.72, -Math.PI * 0.5, -Math.PI * 0.28] : [-Math.PI * 0.5];
    const facing = opt.end === 'left' ? angs.map((a) => Math.PI - a) : angs; // mirror for the left end
    for (let fl = 0; fl <= floors; fl++) {
      const y0 = fl === 0 ? 1.2 : groundH + (fl - 1) * floorH + 1.0;
      const hgt = fl === 0 ? groundH - 2.0 : wh;
      for (const ang of facing) {
        const half = (fl === 0 ? 1.0 : ww / 2) / r;
        model.shape(cx - r - 1, y0, cz - r - 1, cx + r + 1, y0 + hgt + 0.01, cz + r + 1, (x, y, z) => {
          const rr = Math.hypot(x - cx, z - cz);
          if (rr < r - 0.5 || rr > r + 0.02) return false;
          const a = Math.atan2(z - cz, x - cx);
          let da = Math.abs(a - ang);
          if (da > Math.PI) da = 2 * Math.PI - da;
          return da <= half;
        }, 0);
        model.shape(cx - r - 1, y0, cz - r - 1, cx + r + 1, y0 + hgt + 0.01, cz + r + 1, (x, y, z) => {
          const rr = Math.hypot(x - cx, z - cz);
          if (rr < r - 0.5 - s || rr > r - 0.5) return false;
          const a = Math.atan2(z - cz, x - cx);
          let da = Math.abs(a - ang);
          if (da > Math.PI) da = 2 * Math.PI - da;
          return da <= half;
        }, B.glassMat());
      }
      // sill ring per floor
      model.shape(cx - r - 0.5, y0 - s, cz - r - 0.5, cx + r + 0.5, y0, cz + r + 0.5, (x, y, z) => {
        const rr = Math.hypot(x - cx, z - cz);
        const inCorner = opt.end === 'left' ? x <= cx + 0.01 : x >= cx - 0.01;
        return inCorner && z <= cz + 0.01 && rr > r - 0.2 && rr <= r + s;
      }, M.trim);
    }
    // cornice ring at H
    model.shape(cx - r - 1, H - 0.75, cz - r - 1, cx + r + 1, H, cz + r + 1, (x, y, z) => {
      const rr = Math.hypot(x - cx, z - cz);
      const inCorner = opt.end === 'left' ? x <= cx + 0.01 : x >= cx - 0.01;
      return inCorner && z <= cz + 0.01 && rr > r - 0.2 && rr <= r + 0.5 + s;
    }, M.trim);
  }

  // ---- exposed side faces (street corners) get simpler windows ----
  for (const side of spec.exposedSides ?? []) {
    const f = side === 'left' ? makeFace('x', 0, -1, 0, d) : makeFace('x', w, 1, 0, d);
    const nb = Math.max(1, Math.floor((d - 2.5) / bayW));
    const sp = (d - 2.5) / nb;
    const skipNear = (spec.cornerRound || spec.turret) && ((spec.cornerRound ?? spec.turret).end === side) ? ((spec.cornerRound ?? spec.turret).r ?? 3.5) : 0;
    for (let fl = 0; fl <= floors; fl++) {
      const y0 = fl === 0 ? 1.2 : groundH + (fl - 1) * floorH + 1.0;
      const hgt = fl === 0 ? groundH - 2.2 : wh;
      for (let i = 0; i < nb; i++) {
        const c = 1.25 + sp * (i + 0.5);
        if (c < skipNear + 0.9) continue;
        if (court && c > court.z0 - 0.5 && c < court.z1 + 0.5 && false) continue;
        B.window(f, c, ww, y0, hgt, { pediment: fl === 1 ? 'flat' : 'none', bars: !simple });
      }
      if (fl > 0 && !simple) B.cornice(f, groundH + (fl - 1) * floorH + 0.25, s, s);
    }
    if (!simple) B.cornice(f, H, 0.5 + s, 0.75);
  }

  // ---- courtyard inner faces: plain windows ----
  if (court && !simple) {
    const inner = [
      makeFace('z', court.z0, 1, court.x0, court.x1), // front wing inner face (faces +z)
      makeFace('z', court.z1, -1, court.x0, court.x1),
      makeFace('x', court.x0, 1, court.z0, court.z1),
      makeFace('x', court.x1, -1, court.z0, court.z1),
    ];
    for (const f of inner) {
      const len = f.a1 - f.a0;
      const nb = Math.max(1, Math.floor(len / 3.2));
      const sp = len / nb;
      for (let fl = 0; fl <= floors; fl++) {
        const y0 = fl === 0 ? 1.0 : groundH + (fl - 1) * floorH + 1.0;
        const hgt = fl === 0 ? 2.6 : wh - 0.3;
        for (let i = 0; i < nb; i++) B.window(f, f.a0 + sp * (i + 0.5), ww * 0.9, y0, hgt, { pediment: 'none', bars: false, sill: false });
      }
    }
    // courtyard paving and a tree-sized planter are added by the world (ground) — carve to ground level
    model.box(court.x0, -1.5, court.z0, court.x1, 0.0, court.z1, M.stone);
  }

  // ---- evening lamps over shop entrances ----
  if (!simple && spec.lamps !== false) {
    for (let i = 0; i < nBays; i += 2) {
      const c = bayC(i) + spacing * 0.5;
      if (c > w - 1) continue;
      model.box(c - 0.15, groundH - 0.9, -0.55, c + 0.15, groundH - 0.6, 0.01, M.metal);
      model.box(c - 0.2, groundH - 1.25, -0.75, c + 0.2, groundH - 0.9, -0.35, M.lamp);
    }
  }

  return { model, H, roofTop, nBays, spacing, bayC };
}
