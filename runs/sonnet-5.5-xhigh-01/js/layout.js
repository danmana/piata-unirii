/* Piata Unirii — fixed layout: landmarks, perimeter lots, street network, occupancy grid, ground classification.
   World axes: +x east, +z south (north = -z), +y up. Units: metres. */
(function () {
  'use strict';
  const PU = window.PU;
  const M = PU.M;
  const L = (PU.L = {});
  const clamp = PU.clamp;

  /* ---------------------------------------------------------------- */
  /* Plaza geometry: facade line at x=+-110, z=+-80 (220 m x 160 m)   */
  L.BX = 110;
  L.BZ = 80;
  L.RING = { sw: 5.5, curb: 0.5, road: 6.5 }; // metres inward from the facade line
  L.H_ROAD = 0.0;
  L.H_PLAZA = 0.15; // pedestrian level (kerb height 0.15 m)
  const dRoadIn = L.RING.sw + L.RING.curb; // 6.0
  const dPlazaIn = dRoadIn + L.RING.road + L.RING.curb; // 13.0
  L.dRoadIn = dRoadIn;
  L.dPlazaIn = dPlazaIn;

  /* ---------------------------------------------------------------- */
  /* Fixed landmarks (world coordinates of the church-local origin etc.) */
  L.church = {
    ox: -2, oz: -12, y0: 0.45, // local origin in world; platform level
    // world rects (x0,x1,z0,z1) covering tower, hall and presbytery
    rects: [
      { x0: -40.5, x1: -27.5, z0: -19.5, z1: -4.5 }, // tower + buttresses
      { x0: -28.6, x1: 16.6, z0: -27.6, z1: 3.6 }, // hall incl. buttresses
      { x0: 16, x1: 32.6, z0: -19.6, z1: -4.4 }, // presbytery + apse
    ],
  };
  L.hallCenterX = -6; // hall centre in world
  L.monument = { x: -6, z: 21, hw: 7.6, hd: 5.6 };
  L.roman = { x: -6, z: 35, hw: 5.4, hd: 2.0 };
  L.fountain = { x: 28, z: 55, hw: 19, hd: 9 };
  L.basinCx = [-12.5, 0, 12.5]; // relative to fountain centre
  L.basinHW = 5, L.basinHD = 6.6;

  /* mouths (gaps) of the streets that leave the square */
  L.gaps = {
    A: { side: 'N', a: -84, b: -72 },
    B: { side: 'N', a: 66, b: 78 },
    C: { side: 'E', a: 46, b: 58 },
    D: { side: 'S', a: 58, b: 70 },
    E: { side: 'S', a: -72, b: -60 },
    F: { side: 'W', a: 42, b: 54 },
  };

  /* ---------------------------------------------------------------- */
  /* Perimeter lots. a..b measured along the side: N/S west->east (x), E/W north->south (z). */
  const P = [];
  const lot = (o) => P.push(o);
  // NORTH (z=-80)
  lot({ id: 'N1', side: 'N', a: -110, b: -96, depth: 19, floors: 3, fh: 3.9, style: 'historicist', wall: 'ochre', trim: 'whiteStone', roof: 'hip', roofMat: 'roofRust', corner: true, shop: true, balcony: [1], chimneys: 2 });
  lot({ id: 'N2', side: 'N', a: -96, b: -84, depth: 18, floors: 2, fh: 3.9, style: 'baroque', wall: 'dustyPink', trim: 'whiteStone', roof: 'gable', roofMat: 'roofOrange', dormers: 1, chimneys: 1, shop: true });
  lot({ id: 'N3', side: 'N', a: -72, b: -52, depth: 21, floors: 3, fh: 4.0, style: 'baroque', wall: 'paleYellow', trim: 'whiteStone', roof: 'gable', roofMat: 'roofTerra', portal: true, hoods: 'triangle', dormers: 2, chimneys: 2, name: 'Mauksch-Hintz House', shop: true });
  lot({ id: 'N4', side: 'N', a: -52, b: -28, depth: 22, floors: 3, fh: 4.2, style: 'neoclassical', wall: 'beige', trim: 'whiteStone', roof: 'hip', roofMat: 'roofOrange', portal: true, pediment: true, rustic: true, chimneys: 2, name: 'Kemény Palace', balcony: [1], shop: false });
  lot({ id: 'N5', side: 'N', a: -28, b: -10, depth: 19, floors: 3, fh: 3.9, style: 'eclectic', wall: 'fadedGreen', trim: 'cream', roof: 'gable', roofMat: 'roofRed', oriel: true, dormers: 1, chimneys: 1, shop: true });
  lot({ id: 'N6', side: 'N', a: -10, b: 8, depth: 20, floors: 2, fh: 4.2, style: 'renaissance', wall: 'dustyPink', trim: 'limestoneLt', roof: 'gablePerp', roofMat: 'roofOrange', chimneys: 1, name: 'Rucska House', shop: true });
  lot({ id: 'N7', side: 'N', a: 8, b: 24, depth: 20, floors: 4, fh: 3.7, style: 'historicist', wall: 'cream', trim: 'whiteStone', roof: 'mansard', roofMat: 'slateRoof', balcony: [1, 2], dormers: 2, chimneys: 1, shop: true });
  lot({ id: 'N8', side: 'N', a: 24, b: 42, depth: 19, floors: 3, fh: 3.9, style: 'secession', wall: 'salmon', trim: 'ivory', roof: 'gable', roofMat: 'roofLight', arched: true, chimneys: 2, shop: true });
  lot({ id: 'N9', side: 'N', a: 42, b: 54, depth: 18, floors: 2, fh: 4.0, style: 'neoclassical', wall: 'paleYellow', trim: 'whiteStone', roof: 'gable', roofMat: 'roofBrown', chimneys: 1, shop: true });
  lot({ id: 'N10', side: 'N', a: 54, b: 66, depth: 18, floors: 3, fh: 3.8, style: 'eclectic', wall: 'softGrey', trim: 'whiteStone', roof: 'hip', roofMat: 'roofTerra', balcony: [1], chimneys: 1, shop: true });
  lot({ id: 'N11', side: 'N', a: 78, b: 94, depth: 19, floors: 3, fh: 4.0, style: 'baroque', wall: 'lightOchre', trim: 'whiteStone', roof: 'gable', roofMat: 'roofOrange', hoods: 'segment', dormers: 1, chimneys: 2, shop: true });
  lot({ id: 'N12', side: 'N', a: 94, b: 110, depth: 20, floors: 4, fh: 3.7, style: 'historicist', wall: 'dustyPink', trim: 'ivory', roof: 'hip', roofMat: 'roofRust', corner: true, balcony: [1], chimneys: 2, shop: true });
  // WEST (x=-110)
  lot({ id: 'W1', side: 'W', a: -80, b: -64, depth: 19, floors: 2, fh: 3.9, style: 'baroque', wall: 'paleGreen', trim: 'whiteStone', roof: 'gable', roofMat: 'roofRed', dormers: 1, chimneys: 2, name: 'Roman Catholic parish house' });
  lot({ id: 'W2', side: 'W', a: -64, b: -46, depth: 20, floors: 3, fh: 4.0, style: 'baroque', wall: 'palePink', trim: 'whiteStone', roof: 'gable', roofMat: 'roofOrange', hoods: 'segment', balcony: [1], chimneys: 2, name: 'Wass House', shop: true });
  lot({ id: 'W3', side: 'W', a: -46, b: -22, depth: 22, floors: 3, fh: 4.3, style: 'neoclassical', wall: 'cream', trim: 'whiteStone', roof: 'hip', roofMat: 'roofTerra', pediment: true, portal: true, rustic: true, chimneys: 2, name: 'Jósika Palace' });
  lot({ id: 'W4', side: 'W', a: -22, b: 4, depth: 22, floors: 3, fh: 4.4, style: 'baroque', wall: 'lightOchre', trim: 'ivory', roof: 'hip', roofMat: 'roofOrange', portal: true, balcony: [1], hoods: 'triangle', dormers: 3, chimneys: 2, name: 'Rhédey Palace' });
  lot({ id: 'W5', side: 'W', a: 4, b: 16, depth: 18, floors: 2, fh: 4.0, style: 'neoclassical', wall: 'paleBlueGrey', trim: 'whiteStone', roof: 'gable', roofMat: 'roofBrown', chimneys: 1, shop: true });
  lot({ id: 'W6', side: 'W', a: 16, b: 30, depth: 19, floors: 3, fh: 3.9, style: 'secession', wall: 'mint', trim: 'ivory', roof: 'gable', roofMat: 'roofLight', arched: true, oriel: true, chimneys: 1, shop: true });
  lot({ id: 'W7', side: 'W', a: 30, b: 42, depth: 18, floors: 3, fh: 3.8, style: 'eclectic', wall: 'beige', trim: 'whiteStone', roof: 'gable', roofMat: 'roofRed', balcony: [1], chimneys: 1, shop: true });
  // SOUTH (z=+80)
  lot({ id: 'S2', side: 'S', a: -82, b: -72, depth: 18, floors: 3, fh: 3.8, style: 'historicist', wall: 'ochre', trim: 'cream', roof: 'gable', roofMat: 'roofTerra', corner: true, balcony: [1], chimneys: 1, shop: true });
  lot({ id: 'S3', side: 'S', a: -60, b: -40, depth: 20, floors: 3, fh: 4.0, style: 'baroque', wall: 'paleYellow', trim: 'whiteStone', roof: 'gable', roofMat: 'roofOrange', hoods: 'triangle', dormers: 2, chimneys: 2, shop: true });
  lot({ id: 'S4', side: 'S', a: -40, b: -14, depth: 21, floors: 3, fh: 4.1, style: 'renaissance', wall: 'cream', trim: 'limestoneLt', roof: 'hip', roofMat: 'roofRed', portal: true, pediment: true, dormers: 3, chimneys: 2, flag: true, name: 'Old Town Hall (Casa Sfatului)', shop: false });
  lot({ id: 'S5', side: 'S', a: -14, b: 22, depth: 22, floors: 4, fh: 4.4, style: 'bank', wall: 'greyStoneLt', trim: 'whiteStone', roof: 'flatBalustrade', roofMat: 'zincRoof', rustic: true, portal: true, pediment: false, name: 'National Bank' });
  lot({ id: 'S6', side: 'S', a: 22, b: 40, depth: 19, floors: 3, fh: 3.9, style: 'eclectic', wall: 'palePink', trim: 'whiteStone', roof: 'gable', roofMat: 'roofRust', oriel: true, dormers: 1, chimneys: 1, shop: true });
  lot({ id: 'S7', side: 'S', a: 40, b: 58, depth: 19, floors: 3, fh: 3.9, style: 'neoclassical', wall: 'mint', trim: 'whiteStone', roof: 'gable', roofMat: 'roofOrange', chimneys: 2, balcony: [1], shop: true });
  lot({ id: 'S8', side: 'S', a: 70, b: 88, depth: 19, floors: 3, fh: 3.9, style: 'baroque', wall: 'beige', trim: 'whiteStone', roof: 'hip', roofMat: 'roofTerra', hoods: 'segment', chimneys: 2, shop: true });
  lot({ id: 'S9', side: 'S', a: 88, b: 110, depth: 20, floors: 4, fh: 3.7, style: 'historicist', wall: 'softGrey', trim: 'cream', roof: 'hip', roofMat: 'roofBrown', corner: true, balcony: [1, 2], chimneys: 2, shop: true });
  // EAST (x=+110) — Bánffy Palace and the Mirror Buildings are hero builds
  lot({ id: 'E1', side: 'E', a: -80, b: -65, depth: 20, floors: 2, fh: 4.0, style: 'neoclassical', wall: 'paleYellow', trim: 'whiteStone', roof: 'gable', roofMat: 'roofOrange', chimneys: 1, shop: true });
  lot({ id: 'E2', side: 'E', a: -65, b: -50, depth: 20, floors: 3, fh: 3.9, style: 'eclectic', wall: 'dustyPink', trim: 'ivory', roof: 'gable', roofMat: 'roofRed', balcony: [1], chimneys: 2, shop: true });
  L.lots = P;
  L.hero = {
    banffy: { side: 'E', a: -50, b: 24, depth: 34 },
    mirrorN: { side: 'E', a: 24, b: 46, depth: 22 },
    mirrorS: { side: 'E', a: 58, b: 80, depth: 22 },
    continental: { west: { x0: -132, x1: -110, z0: 54, z1: 80 }, south: { x0: -110, x1: -82, z0: 80, z1: 102 }, corner: { x0: -132, x1: -110, z0: 80, z1: 102 } },
  };

  /* frame for a lot on a side: local x along frontage, local z = depth away from the plaza, front at z=0.
     Returns { x, z, yaw, w } world origin (front-left corner in local coords) and rotation about Y. */
  L.sideFrame = function (side, a, b) {
    const w = b - a;
    switch (side) {
      case 'S': return { x: a, z: L.BZ, yaw: 0, w };
      case 'N': return { x: b, z: -L.BZ, yaw: Math.PI, w };
      case 'E': return { x: L.BX, z: b, yaw: Math.PI / 2, w };
      case 'W': return { x: -L.BX, z: a, yaw: -Math.PI / 2, w };
    }
  };
  /* world AABB of a lot footprint */
  L.lotRect = function (side, a, b, d) {
    switch (side) {
      case 'S': return { x0: a, x1: b, z0: L.BZ, z1: L.BZ + d };
      case 'N': return { x0: a, x1: b, z0: -L.BZ - d, z1: -L.BZ };
      case 'E': return { x0: L.BX, x1: L.BX + d, z0: a, z1: b };
      case 'W': return { x0: -L.BX - d, x1: -L.BX, z0: a, z1: b };
    }
  };

  /* ---------------------------------------------------------------- */
  /* Street network */
  const smoothPts = (pts, iters) => {
    let p = pts;
    for (let k = 0; k < (iters || 2); k++) {
      const q = [p[0]];
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
        q.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      q.push(p[p.length - 1]);
      p = q;
    }
    return p;
  };
  const streets = [];
  const street = (o) => {
    o.pts = smoothPts(o.pts, o.smooth === undefined ? 2 : o.smooth);
    streets.push(o);
    return o;
  };
  street({ id: 'A', name: 'Str. Memorandumului', label: 'Memorandumului', w: 11, sw: 2.4, ped: true, cars: false, pts: [[-78, -71], [-78, -112], [-92, -150], [-118, -190], [-152, -232], [-195, -285], [-250, -350], [-320, -430], [-400, -520], [-470, -600]] });
  street({ id: 'B', name: 'Str. Regele Ferdinand', label: 'Regele Ferdinand / 21 Decembrie', w: 14, sw: 2.8, ped: false, cars: true, pts: [[72, -71], [72, -112], [88, -150], [112, -190], [146, -232], [190, -285], [245, -350], [315, -430], [395, -520], [470, -600]] });
  street({ id: 'C', name: 'Str. Iuliu Maniu', label: 'Iuliu Maniu', w: 12, sw: 2.0, ped: false, cars: true, pts: [[101, 52], [152, 52], [215, 54], [280, 62], [350, 74], [430, 92], [520, 112], [600, 130]] });
  street({ id: 'D', name: 'Bulevardul Eroilor', label: 'Bulevardul Eroilor', w: 20, sw: 4.0, ped: false, cars: true, boulevard: true, pts: [[64, 71], [64, 112], [80, 152], [108, 192], [146, 236], [190, 284], [245, 346], [315, 420], [390, 505], [450, 590]] });
  street({ id: 'E', name: 'Str. Universității', label: 'Universității', w: 11, sw: 2.4, ped: false, cars: true, pts: [[-66, 71], [-66, 112], [-82, 152], [-108, 194], [-144, 240], [-190, 292], [-250, 352], [-320, 428], [-400, 515], [-460, 590]] });
  street({ id: 'F', name: 'Str. Napoca', label: 'Napoca', w: 12, sw: 2.4, ped: true, cars: false, pts: [[-101, 48], [-142, 48], [-190, 56], [-245, 76], [-305, 104], [-370, 140], [-440, 182], [-520, 232], [-600, 290]] });

  // ring roads: superellipse with noise (deterministic)
  const ringPts = (rx, rz, n, amp, seed, ex) => {
    const rng = new PU.RNG(seed);
    const pts = [];
    const ph = [rng.range(0, 6), rng.range(0, 6), rng.range(0, 6)];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const c = Math.cos(t), s = Math.sin(t);
      const k = Math.pow(Math.pow(Math.abs(c), ex) + Math.pow(Math.abs(s), ex), -1 / ex);
      const j = 1 + 0.06 * Math.sin(t * 3 + ph[0]) + 0.04 * Math.sin(t * 5 + ph[1]) + 0.025 * Math.sin(t * 9 + ph[2]);
      pts.push([c * k * rx * j + rng.range(-amp, amp), s * k * rz * j + rng.range(-amp, amp)]);
    }
    pts.push(pts[0]);
    return pts;
  };
  // ring 1 hugs the back of the perimeter buildings
  street({ id: 'R1', name: 'Back street', w: 9, sw: 1.8, cars: true, smooth: 1, pts: [[-138, -108], [-100, -108.5], [-78, -112], [-30, -109], [20, -108], [72, -112], [112, -109], [150, -108], [150.5, -60], [150, -5], [150, 30], [150, 52], [150, 90], [149, 108], [110, 108.5], [64, 112], [10, 108], [-30, 108], [-66, 112], [-100, 108], [-138, 108], [-138.5, 70], [-138, 48], [-138.5, 0], [-138, -60], [-138, -108]] });
  const ring2 = ringPts(255, 200, 44, 3, 11, 3.4);
  const ring3 = ringPts(380, 310, 56, 4, 12, 3.2);
  const ring4 = ringPts(500, 420, 64, 5, 13, 3.0);
  street({ id: 'R2', name: 'Ring 2', w: 9, sw: 1.8, cars: true, smooth: 1, pts: ring2 });
  street({ id: 'R3', name: 'Ring 3', w: 10, sw: 2, cars: true, smooth: 1, pts: ring3 });
  street({ id: 'R4', name: 'Ring 4', w: 10, sw: 2, cars: true, smooth: 1, pts: ring4 });
  // radial lanes between the spokes
  const lanes = [
    [[-138, -30], [-190, -30], [-225, -45], [-262, -75], [-310, -120]],
    [[-138, 20], [-205, 24], [-255, 40], [-320, 68], [-400, 112]],
    [[-100, 108], [-108, 150], [-160, 190], [-215, 225], [-280, 282]],
    [[-30, 108], [-28, 150], [-46, 200], [-70, 255], [-96, 320], [-140, 400]],
    [[10, 108], [22, 160], [26, 215], [50, 270], [92, 340], [140, 420]],
    [[110, 108], [140, 150], [180, 190], [235, 232], [300, 290]],
    [[150, 90], [200, 108], [255, 140], [310, 190], [380, 250]],
    [[150, -30], [205, -25], [260, -10], [330, 10], [420, 30]],
    [[150, -108], [205, -125], [262, -150], [330, -185], [420, -240]],
    [[112, -109], [130, -160], [160, -215], [205, -268], [270, -330]],
    [[20, -108], [30, -160], [52, -215], [70, -280], [100, -350], [140, -430]],
    [[-30, -109], [-40, -160], [-52, -215], [-70, -280], [-104, -350], [-150, -430]],
    [[-138, -108], [-170, -150], [-215, -190], [-270, -235], [-340, -285]],
    [[-138, -60], [-195, -70], [-250, -90], [-320, -125], [-400, -165]],
  ];
  lanes.forEach((p, i) => street({ id: 'L' + i, name: 'Lane', w: 7.5, sw: 1.6, cars: false, smooth: 2, pts: p }));
  L.streets = streets;

  /* ---------------------------------------------------------------- */
  /* Occupancy grid (1 m) */
  const T = (L.T = { FREE: 0, ROAD: 1, SIDEWALK: 2, BUILD: 3, FIXED: 4, PEDROAD: 5, YARD: 6, PARK: 7, PLAZA: 8 });
  class OccGrid {
    constructor(hx, hz, res) {
      this.res = res;
      this.x0 = -hx;
      this.z0 = -hz;
      this.nx = Math.ceil((2 * hx) / res);
      this.nz = Math.ceil((2 * hz) / res);
      this.a = new Uint8Array(this.nx * this.nz);
    }
    get(x, z) {
      const i = Math.floor((x - this.x0) / this.res), j = Math.floor((z - this.z0) / this.res);
      if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return 255;
      return this.a[i + j * this.nx];
    }
    set(x, z, v) {
      const i = Math.floor((x - this.x0) / this.res), j = Math.floor((z - this.z0) / this.res);
      if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return;
      this.a[i + j * this.nx] = v;
    }
    /* iterate cells whose centre lies inside an oriented rect; fn(i,j,index) */
    eachInRect(cx, cz, hw, hd, yaw, fn) {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
      const i0 = Math.max(0, Math.floor((cx - ex - this.x0) / this.res)), i1 = Math.min(this.nx - 1, Math.floor((cx + ex - this.x0) / this.res));
      const j0 = Math.max(0, Math.floor((cz - ez - this.z0) / this.res)), j1 = Math.min(this.nz - 1, Math.floor((cz + ez - this.z0) / this.res));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const x = this.x0 + (i + 0.5) * this.res - cx, z = this.z0 + (j + 0.5) * this.res - cz;
          const u = x * c - z * s, v = x * s + z * c; // rotate by -yaw
          if (Math.abs(u) <= hw && Math.abs(v) <= hd) fn(i, j, i + j * this.nx);
        }
    }
    rectFree(cx, cz, hw, hd, yaw) {
      let ok = true;
      this.eachInRect(cx, cz, hw, hd, yaw, (i, j, k) => {
        if (this.a[k] !== T.FREE && this.a[k] !== T.YARD && this.a[k] !== T.PARK) ok = false;
      });
      return ok;
    }
    mark(cx, cz, hw, hd, yaw, v) {
      this.eachInRect(cx, cz, hw, hd, yaw, (i, j, k) => (this.a[k] = v));
    }
    /* thick polyline; only overwrite cells with priority lower than v */
    markSeg(x0, z0, x1, z1, half, v, pri) {
      const dx = x1 - x0, dz = z1 - z0;
      const len = Math.hypot(dx, dz) || 1;
      const ux = dx / len, uz = dz / len;
      const yaw = Math.atan2(uz, ux);
      this.eachInRect((x0 + x1) / 2, (z0 + z1) / 2, len / 2 + 0.5, half, yaw, (i, j, k) => {
        const cur = this.a[k];
        if (pri[v] >= pri[cur]) this.a[k] = v;
      });
    }
  }
  L.OccGrid = OccGrid;
  L.PRI = [];
  L.PRI[T.FREE] = 0; L.PRI[T.YARD] = 0; L.PRI[T.PARK] = 0;
  L.PRI[T.SIDEWALK] = 2; L.PRI[T.ROAD] = 3; L.PRI[T.PEDROAD] = 3;
  L.PRI[T.BUILD] = 6; L.PRI[T.FIXED] = 8; L.PRI[T.PLAZA] = 8;
  L.PRI[255] = 9;

  L.grid = null;
  /* build the occupancy grid: plaza, fixed perimeter lots, street corridors */
  L.initGrid = function () {
    const g = (L.grid = new OccGrid(700, 640, 1));
    // the plaza interior (inside the facade line) is fixed: no random buildings may appear there
    g.mark(0, 0, L.BX, L.BZ, 0, T.PLAZA);
    // fixed perimeter lots
    for (const p of P) {
      const r = L.lotRect(p.side, p.a, p.b, p.depth);
      g.mark((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (r.x1 - r.x0) / 2, (r.z1 - r.z0) / 2, 0, T.FIXED);
    }
    const hb = L.hero;
    for (const k of ['banffy', 'mirrorN', 'mirrorS']) {
      const h = hb[k], r = L.lotRect(h.side, h.a, h.b, h.depth);
      g.mark((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (r.x1 - r.x0) / 2, (r.z1 - r.z0) / 2, 0, T.FIXED);
    }
    for (const k of ['west', 'south', 'corner']) {
      const r = hb.continental[k];
      g.mark((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (r.x1 - r.x0) / 2, (r.z1 - r.z0) / 2, 0, T.FIXED);
    }
    // Iuliu Maniu Street: fixed mirrored building rows beyond the Mirror Buildings
    for (const [xa, xb] of [[132, 145.5], [154.5, 234]]) {
      g.mark((xa + xb) / 2, 35.5, (xb - xa) / 2, 10.5, 0, T.FIXED);
      g.mark((xa + xb) / 2, 68.5, (xb - xa) / 2, 10.5, 0, T.FIXED);
    }
    // streets: sidewalks first (wider), then carriageways
    for (const s of streets) {
      const road = s.w - 2 * s.sw;
      for (let i = 0; i < s.pts.length - 1; i++) {
        const a = s.pts[i], b = s.pts[i + 1];
        g.markSeg(a[0], a[1], b[0], b[1], s.w / 2, T.SIDEWALK, L.PRI);
      }
      for (let i = 0; i < s.pts.length - 1; i++) {
        const a = s.pts[i], b = s.pts[i + 1];
        g.markSeg(a[0], a[1], b[0], b[1], road / 2, s.ped ? T.PEDROAD : T.ROAD, L.PRI);
      }
    }
    return g;
  };

  /* ---------------------------------------------------------------- */
  /* Ground classification helpers */
  const rectDist = (r, x, z) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
  L.churchDist = function (x, z) {
    let d = 1e9;
    for (const r of L.church.rects) {
      const dd = rectDist(r, x, z);
      if (dd < d) d = dd;
      if (d === 0) return 0;
    }
    return d;
  };
  L.inRect = (r, x, z) => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1;

  /* undulating city terrain outside the square (metres), quantised by the caller */
  L.terrainBase = function (x, z) {
    const rx = Math.abs(x) - 118, rz = Math.abs(z) - 88;
    const out = Math.max(rx, rz);
    const k = PU.smoothstep(0, 80, out);
    const n = (PU.fbm2(x * 0.006 + 12.3, z * 0.006 - 4.1, 3, 5) - 0.5) * 3.2 + (PU.fbm2(x * 0.02, z * 0.02, 2, 6) - 0.5) * 0.7;
    return n * k;
  };
  /* far hills (all terrain beyond the city) */
  L.hillHeight = function (x, z) {
    const r = Math.hypot(x, z);
    const th = Math.atan2(z, x);
    const rise = PU.smoothstep(560, 2900, r);
    // directional ridges: Cetatuia (N-NE), Hoia (W), Feleac (SE) ...
    const dirAmp =
      70 +
      200 * Math.max(0, Math.cos(th + 1.2)) ** 2 + // NNE (Cetatuia)
      170 * Math.max(0, Math.cos(th - 0.9)) ** 2 + // SE (Feleac)
      120 * Math.max(0, Math.cos(th - 2.9)) ** 2 + // W (Hoia)
      45 * PU.noise2(th * 2.2, 3.3, 9);
    const far = PU.smoothstep(2500, 12000, r);
    const n = PU.fbm2(x * 0.0011 + 5, z * 0.0011 - 3, 4, 21);
    let h = rise * dirAmp * (0.35 + 0.9 * n) + far * 330 * (0.4 + 0.9 * PU.fbm2(x * 0.0004, z * 0.0004, 3, 23));
    // gentle valley floor around the city
    return h + L.terrainBase(x, z) * (1 - rise) * 0.0 + 0;
  };
  L.baseHeightAt = function (x, z) {
    // city ground: 0 near the square, undulating outward
    const t = L.terrainBase(x, z) + L.hillHeight(x, z);
    return Math.round(t * 4) / 4;
  };

  /* ground height for placing objects (quantised like the ground mesh) */
  L.groundH = function (x, z) {
    const c = L.groundCell(x, z, 0.25);
    return c.h;
  };

  /* main classification: fills and returns {mat, h, edge, skip}; used by the ground mesher and the population system */
  const out = { mat: 0, h: 0, edge: 0, skip: false, kind: '' };
  const Mm = M;
  const plazaPattern = (x, z) => {
    const cx = Math.floor((x + 120) / 9), cz = Math.floor((z + 90) / 9);
    const h = PU.hash2(cx, cz, 77);
    if (h < 0.16) return Mm.plazaGrey;
    return (cx + cz) & 1 ? Mm.plazaBeige : Mm.plazaPale;
  };
  L.plazaPattern = plazaPattern;

  L.groundCell = function (x, z, cell) {
    const o = out;
    o.skip = false;
    o.kind = '';
    o.edge = Mm.stepEdge;
    const ax = Math.abs(x), az = Math.abs(z);
    // ---------- inside the facade line ----------
    if (ax < L.BX && az < L.BZ) {
      const d = Math.min(L.BX - ax, L.BZ - az);
      // street mouths: carriageway continues through the sidewalk band
      if (d < dRoadIn && L.inMouth(x, z)) {
        o.mat = L.mouthPed(x, z) ? Mm.sidewalkLt : Mm.road;
        o.h = L.mouthPed(x, z) ? L.H_PLAZA : L.H_ROAD;
        o.edge = Mm.curb;
        o.kind = 'road';
        return o;
      }
      if (d < L.RING.sw) {
        o.mat = Mm.sidewalk;
        o.h = L.H_PLAZA;
        o.edge = Mm.curb;
        o.kind = 'sidewalk';
        return o;
      }
      if (d < dRoadIn) {
        o.mat = Mm.curb;
        o.h = L.H_PLAZA;
        o.kind = 'curb';
        return o;
      }
      if (d < dRoadIn + L.RING.road) {
        o.mat = L.crossing(x, z) === 2 ? Mm.roadLine : Mm.road;
        o.h = L.H_ROAD;
        o.edge = Mm.curb;
        o.kind = 'road';
        return o;
      }
      if (d < dPlazaIn) {
        o.mat = Mm.curb;
        o.h = L.H_PLAZA;
        o.kind = 'curb';
        return o;
      }
      // ---------- pedestrian square ----------
      let h = L.H_PLAZA;
      let mat = plazaPattern(x, z);
      o.kind = 'plaza';
      // monument and archaeological window are built as objects: leave a hole under them
      // (holes are deliberately a little smaller than the objects that fill them, so no sliver of void can appear)
      const mo = L.monument;
      if (Math.abs(x - mo.x) < 7.0 && Math.abs(z - mo.z) < 5.0) { o.skip = true; return o; }
      const rm = L.roman;
      if (Math.abs(x - rm.x) < 5.1 && Math.abs(z - rm.z) < 1.7) { o.skip = true; return o; }
      // church + grounds (the church's solid base overlaps the ground, so no hole is needed under it)
      const dc = L.churchDist(x, z);
      if (dc <= 0) { o.mat = Mm.step; o.h = 0.45; o.kind = 'apron'; return o; }
      const southSide = z > -8;
      const lawnW = southSide ? 4.5 : x < -30 ? 8 : x > 20 ? 9 : 11;
      if (dc < lawnW + 0.001) {
        if (dc < 1.5) { o.mat = Mm.step; o.h = 0.45; o.kind = 'apron'; return o; }
        if (dc < 3.5) { o.mat = Mm.path; o.h = 0.45; o.kind = 'path'; return o; }
        // paths crossing the lawn
        const inN = Math.abs(x + 6) < 1.5 && z < -20;
        const inE = Math.abs(z + 12) < 1.5 && x > 30;
        const inW = Math.abs(z + 12) < 1.5 && x < -40;
        if (inN || inE || inW) { o.mat = Mm.path; o.h = 0.27; o.kind = 'path'; return o; }
        o.mat = ((Math.floor(x * 0.5) + Math.floor(z * 0.5)) & 3) === 0 ? Mm.grassLt : ((Math.floor(x * 0.25) ^ Math.floor(z * 0.25)) & 1 ? Mm.lawn : Mm.grass);
        o.h = 0.27;
        o.kind = 'lawn';
        return o;
      }
      // north terrace: low broad step doubling as seating
      if (z < -50 && z > -66 && x > -84 && x < 84) { o.mat = ((Math.floor(x / 6) + Math.floor(z / 6)) & 1) ? Mm.plazaPale : Mm.plazaBeige; o.h = 0.45; o.kind = 'terrace'; return o; }
      // Banffy forecourt (east): raised, stepped
      if (x > 82 && z > -54 && z < 26) { o.mat = Mm.plazaBeige; o.h = x > 90 ? 0.6 : 0.45; o.kind = 'terrace'; return o; }
      // fountain area
      const f = L.fountain;
      const u = x - f.x, v = z - f.z;
      if (Math.abs(u) < f.hw && Math.abs(v) < f.hd) {
        o.mat = Mm.plazaBand;
        o.h = L.H_PLAZA;
        o.kind = 'fountainplaza';
        for (const bc of L.basinCx) {
          const bu = u - bc, bv = v;
          if (Math.abs(bu) < L.basinHW + 0.5 && Math.abs(bv) < L.basinHD + 0.5) {
            if (Math.abs(bu) < L.basinHW && Math.abs(bv) < L.basinHD) { o.mat = Mm.waterA; o.h = -0.08; o.kind = 'water'; o.edge = Mm.stepEdge; }
            else { o.mat = Mm.stepEdge; o.h = 0.42; o.kind = 'rim'; }
            return o;
          }
        }
        // reflective water tables
        for (const tu of [-16.6, 16.6]) {
          const bu = u - tu;
          if (Math.abs(bu) < 1.6 && Math.abs(v) < 5.2) {
            if (Math.abs(bu) < 1.2 && Math.abs(v) < 4.8) { o.mat = Mm.waterTable; o.h = 0.52; o.kind = 'water'; }
            else { o.mat = Mm.stepEdge; o.h = 0.62; o.kind = 'rim'; }
            return o;
          }
        }
        return o;
      }
      // fountain edge coping
      if (Math.abs(u) < f.hw + 1 && Math.abs(v) < f.hd + 1) { o.mat = Mm.stepEdge; o.h = 0.3; o.kind = 'rim'; return o; }
      o.mat = mat;
      o.h = h;
      return o;
    }
    // ---------- outside the facade line ----------
    const g = L.grid;
    const t = g ? g.get(x, z) : T.FREE;
    const base = L.baseHeightAt(x, z);
    o.h = base;
    if (t === T.BUILD || t === T.FIXED) { o.mat = Mm.courtyard; o.h = base - 0.05; o.kind = 'yard'; return o; }
    if (t === T.ROAD) { o.mat = Mm.road; o.edge = Mm.curb; o.kind = 'road'; return o; }
    if (t === T.PEDROAD) { o.mat = Mm.sidewalkLt; o.kind = 'ped'; o.h = base + 0.05; return o; }
    if (t === T.SIDEWALK) { o.mat = Mm.sidewalk; o.h = base + 0.15; o.edge = Mm.curb; o.kind = 'sidewalk'; return o; }
    // yards: mix of cobbles, gravel and grass
    const hh = PU.hash2(Math.floor(x / 6), Math.floor(z / 6), 31);
    if (hh < 0.35) { o.mat = Mm.courtyard; o.kind = 'yard'; }
    else if (hh < 0.7) { o.mat = Mm.grassDk; o.kind = 'park'; }
    else { o.mat = Mm.dirt; o.kind = 'yard'; }
    o.h = base - 0.05;
    return o;
  };

  /* pedestrian crossings over the ring road: centres along each side (x for N/S, z for E/W), 7 m wide */
  L.crossCenters = {
    N: [-78, 72, -40, 0, 38],
    S: [-66, 64, -30, 12, 42],
    W: [48, -50, -12, 24],
    E: [52, -40, -13, 20],
  };
  L.crossHW = 3.5;
  /* returns 0 = not in a crossing, 1 = in a crossing (stripe gap), 2 = in a crossing (stripe) — for cells of the ring road */
  L.crossing = function (x, z) {
    const ax = Math.abs(x), az = Math.abs(z);
    const dx = L.BX - ax, dz = L.BZ - az;
    let list, along;
    if (dx < dz) { list = x > 0 ? L.crossCenters.E : L.crossCenters.W; along = z; }
    else { list = z > 0 ? L.crossCenters.S : L.crossCenters.N; along = x; }
    for (const c of list) {
      const r = along - c;
      if (r > -L.crossHW && r < L.crossHW) return Math.floor((r + L.crossHW) / 0.5) % 2 === 0 ? 2 : 1;
    }
    return 0;
  };

  /* street mouths inside the facade line (so sidewalks are interrupted where streets enter) */
  L.inMouth = function (x, z) {
    for (const k in L.gaps) {
      const g = L.gaps[k];
      if (g.side === 'N' && z < 0 && x >= g.a && x <= g.b) return true;
      if (g.side === 'S' && z > 0 && x >= g.a && x <= g.b) return true;
      if (g.side === 'E' && x > 0 && z >= g.a && z <= g.b) return true;
      if (g.side === 'W' && x < 0 && z >= g.a && z <= g.b) return true;
    }
    return false;
  };
  L.mouthPed = function (x, z) {
    // pedestrian streets: Memorandumului (A) and Napoca (F): stone crossing instead of asphalt
    const a = L.gaps.A, f = L.gaps.F;
    return (z < 0 && x >= a.a && x <= a.b) || (x < 0 && z >= f.a && z <= f.b);
  };
})();
