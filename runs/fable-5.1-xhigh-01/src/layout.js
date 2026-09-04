// Geography of Piața Unirii in scene metres. +X = east, +Z = south, +Y = up.
// Fixed landmark positions are constants; only secondary content is procedural.

export const SQ = { x0: -110, x1: 110, z0: -80, z1: 80 }; // building frontage lines
export const SIDEWALK = 4; // along the façades
export const ROAD = 7; // perimeter carriageway
export const PLAZA = { x0: SQ.x0 + SIDEWALK + ROAD, x1: SQ.x1 - SIDEWALK - ROAD, z0: SQ.z0 + SIDEWALK + ROAD, z1: SQ.z1 - SIDEWALK - ROAD };

// St. Michael's Church: nave x0..x1, apse beyond x1, tower at NW corner.
export const CHURCH = {
  x0: -46, x1: 26, z0: -45, z1: -19, // hall body
  apseLen: 11, apseHalfW: 8.5,
  towerX0: -55.5, towerX1: -46, towerZ0: -45, towerZ1: -35.5,
  wallH: 18, ridgeH: 39, towerH: 80,
};
export const CHURCH_CENTER = { x: (CHURCH.x0 + CHURCH.x1) / 2, z: (CHURCH.z0 + CHURCH.z1) / 2 };

// Matthias Corvinus ensemble (pedestal footprint, steps extend ~2 m further)
export const MONUMENT = { cx: -14, cz: 6, w: 9, d: 13 };
// Roman Napoca archaeological window
export const ARCH = { cx: 8, cz: 27, w: 9, d: 4.5 };
// Contemporary fountain
export const FOUNTAIN = { cx: 50, cz: 40, w: 32, d: 16 };

// Street network leaving the square (centerlines), widths include sidewalks.
export const STREETS = [
  { name: 'Napoca', pts: [[-110, 73], [-200, 74], [-320, 78], [-520, 82]], width: 14, traffic: true },
  { name: 'Universitatii', pts: [[-66, 80], [-64, 160], [-58, 260], [-52, 520]], width: 12, traffic: true },
  { name: 'Eroilor', pts: [[110, 69], [200, 74], [330, 86], [520, 100]], width: 22, traffic: true, boulevard: true },
  { name: 'Iuliu Maniu', pts: [[110, 22], [230, 23], [360, 26], [520, 28]], width: 11, traffic: false },
  { name: 'Regele Ferdinand', pts: [[103.5, -80], [104, -180], [106, -320], [108, -520]], width: 13, traffic: true },
  { name: '21 Decembrie', pts: [[110, -72.5], [220, -74], [380, -80], [520, -86]], width: 15, traffic: true },
  { name: 'Memorandumului', pts: [[-110, -72.5], [-210, -71], [-340, -64], [-520, -56]], width: 15, traffic: true },
  { name: 'Matei Corvin', pts: [[-105.5, -80], [-106, -160], [-110, -240], [-114, -320]], width: 9, traffic: false },
  // secondary streets (old-town irregular fabric)
  { name: 'Kogalniceanu', pts: [[-66, 158], [40, 154], [160, 150], [330, 146]], width: 11, traffic: true },
  { name: 'Baba Novac', pts: [[130, 150], [236, 160], [330, 240]], width: 10, traffic: false },
  { name: 'Emil Isac', pts: [[-200, 74], [-206, 160], [-214, 300]], width: 10, traffic: true },
  { name: 'Bolyai', pts: [[236, 23], [234, 74], [232, 150]], width: 8, traffic: false },
  { name: 'Hermann Oberth', pts: [[112, -180], [200, -186], [380, -190]], width: 9, traffic: false },
  { name: 'Horea link', pts: [[-106, -160], [-10, -170], [104, -180]], width: 9, traffic: false },
  { name: 'Sextil Puscariu', pts: [[-210, -71], [-206, -170], [-200, -300]], width: 9, traffic: false },
  { name: 'Avram Iancu ring', pts: [[330, 86], [336, -10], [380, -80]], width: 16, traffic: true },
  { name: 'Brassai', pts: [[-320, 78], [-326, -64]], width: 9, traffic: false },
  { name: 'Potaissa', pts: [[-58, 260], [-214, 300]], width: 9, traffic: false },
  { name: 'Cuza Voda', pts: [[-206, 160], [-64, 160]], width: 8, traffic: false },
  { name: 'David Ferenc', pts: [[-10, -170], [-14, -300]], width: 8, traffic: false },
  { name: 'Ion Ratiu', pts: [[330, 146], [332, 86]], width: 10, traffic: true },
  { name: 'Dorobantilor', pts: [[520, 100], [660, 130]], width: 18, traffic: true },
  { name: 'Horea', pts: [[108, -520], [110, -700]], width: 14, traffic: true },
  { name: 'Motilor', pts: [[-520, 78], [-700, 90]], width: 14, traffic: true },
  { name: 'Ring N', pts: [[-200, -300], [-14, -300], [200, -320], [380, -330]], width: 12, traffic: true },
  { name: 'Ring S', pts: [[-214, 300], [-52, 320], [130, 330], [330, 320]], width: 12, traffic: true },
  { name: 'Splaiul Independentei', pts: [[-540, -404], [-300, -412], [0, -408], [300, -400], [540, -396]], width: 12, traffic: true },
  { name: 'Pasteur', pts: [[-540, 440], [-214, 430], [-52, 436], [200, 444], [540, 450]], width: 12, traffic: true },
  { name: 'Ring W', pts: [[-452, -540], [-448, -300], [-454, 78], [-450, 440]], width: 11, traffic: true },
  { name: 'Ring E', pts: [[452, -540], [456, -300], [450, 100], [454, 450]], width: 11, traffic: true },
  { name: 'Cardinal Hossu', pts: [[-326, -64], [-330, -300], [-334, -412]], width: 9, traffic: false },
  { name: 'Traian', pts: [[380, -330], [376, -400]], width: 9, traffic: false },
  { name: 'Republicii', pts: [[130, 330], [126, 440]], width: 10, traffic: true },
  { name: 'Clinicilor', pts: [[-214, 300], [-330, 300], [-450, 296]], width: 10, traffic: true },
];

// Subtle real-world elevation: the square rises gently toward the south.
export function elevation(x, z) {
  // ~1% grade rising to the south (toward Feleac), gently warped east-west.
  const base = 0.0105 * (z + 40) + 0.0012 * (x - 20);
  const warp = 0.35 * Math.sin(x * 0.011 + 0.4) * Math.cos(z * 0.009);
  return base + warp;
}

export const OCC = { FREE: 0, ROAD: 1, PLAZA: 2, BUILDING: 3, GREEN: 4, RESERVED: 5, SIDEWALK: 6, TREE: 7 };

/** 1 m occupancy grid used for collision-free placement. */
export class Occupancy {
  constructor(half = 560, cell = 1) {
    this.half = half;
    this.cell = cell;
    this.n = Math.ceil((2 * half) / cell);
    this.data = new Uint8Array(this.n * this.n);
  }
  ix(x) { return Math.floor((x + this.half) / this.cell); }
  get(x, z) {
    const i = this.ix(x), j = this.ix(z);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return OCC.RESERVED;
    return this.data[i * this.n + j];
  }
  set(x, z, v) {
    const i = this.ix(x), j = this.ix(z);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return;
    this.data[i * this.n + j] = v;
  }
  markRect(x0, z0, x1, z1, v) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    for (let x = x0 + 0.5; x < x1; x += this.cell) for (let z = z0 + 0.5; z < z1; z += this.cell) this.set(x, z, v);
  }
  /** Cells of a rotated rectangle: origin (x,z), yaw rot, size w (local x) x d (local z). */
  *rectCells(x, z, rot, w, d) {
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const step = this.cell;
    for (let lx = step / 2; lx < w; lx += step) {
      for (let lz = step / 2; lz < d; lz += step) {
        yield [x + lx * cr + lz * sr, z - lx * sr + lz * cr];
      }
    }
  }
  rectFree(x, z, rot, w, d, allowed = [OCC.FREE]) {
    for (const [wx, wz] of this.rectCells(x, z, rot, w, d)) {
      if (!allowed.includes(this.get(wx, wz))) return false;
    }
    return true;
  }
  markRot(x, z, rot, w, d, v) {
    for (const [wx, wz] of this.rectCells(x, z, rot, w, d)) this.set(wx, wz, v);
  }
  /** Thick polyline (streets). */
  markPolyline(pts, width, v) {
    const hw = width / 2;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      const minX = Math.min(ax, bx) - hw, maxX = Math.max(ax, bx) + hw;
      const minZ = Math.min(az, bz) - hw, maxZ = Math.max(az, bz) + hw;
      for (let x = Math.floor(minX) + 0.5; x < maxX; x += this.cell) {
        for (let z = Math.floor(minZ) + 0.5; z < maxZ; z += this.cell) {
          const px = x - ax, pz = z - az;
          const t = Math.max(0, Math.min(len, px * dx + pz * dz));
          const qx = px - dx * t, qz = pz - dz * t;
          if (qx * qx + qz * qz <= hw * hw) this.set(x, z, v);
        }
      }
    }
  }
}

/** Distance from point to a polyline + closest segment direction. */
export function polylineDistance(pts, x, z) {
  let best = Infinity;
  let dir = [1, 0];
  let tBest = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const dx = (bx - ax) / len, dz = (bz - az) / len;
    const px = x - ax, pz = z - az;
    const t = Math.max(0, Math.min(len, px * dx + pz * dz));
    const qx = px - dx * t, qz = pz - dz * t;
    const d = Math.hypot(qx, qz);
    if (d < best) { best = d; dir = [dx, dz]; tBest = t; }
  }
  return { dist: best, dir, t: tBest };
}

/** Sample a polyline at arc length s: returns { x, z, dir:[dx,dz] }. */
export function polylineSample(pts, s) {
  let acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (s <= acc + len || i === pts.length - 2) {
      const t = Math.max(0, Math.min(1, (s - acc) / len));
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dir: [(bx - ax) / len, (bz - az) / len] };
    }
    acc += len;
  }
  return { x: pts[0][0], z: pts[0][1], dir: [1, 0] };
}

export function polylineLength(pts) {
  let acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) acc += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  return acc;
}

/** Offset a polyline sideways by `off` metres (positive = right of travel direction). */
export function offsetPolyline(pts, off) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
    // right-hand normal in (x, z) with +z south: right of (dx,dz) is (-dz, dx)
    out.push([pts[i][0] - dz * off, pts[i][1] + dx * off]);
  }
  return out;
}

export function inRect(x, z, r) {
  return x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1;
}
