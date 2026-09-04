// Population: articulated instanced pedestrians on a navigation graph, cyclists,
// pigeons and lane-following vehicles.
import * as THREE from 'three';
import { Model, meshModelToGeometries } from './voxel.js';
import { SQ, PLAZA, SIDEWALK, ROAD, CHURCH, MONUMENT, FOUNTAIN, ARCH, STREETS, OCC, offsetPolyline, polylineLength, polylineSample } from './layout.js';

const SKIN = ['#f1c9a5', '#e8b58c', '#d9a074', '#c48a5a', '#8d5a3b', '#f5d6b8'];
const HAIR = ['#2b1d14', '#4a3222', '#7a5533', '#b58a4f', '#d8c39a', '#3a3a3a', '#8a8078'];
const SHIRT = ['#e9e4d8', '#3b4a6b', '#7a2e2e', '#2f4a3b', '#c9a24a', '#5c6b8a', '#a35a3a', '#f0f0f0', '#333a44', '#8fa3b8', '#d97b5a', '#6b4a7a', '#c7d1c0', '#2e2e2e', '#e0b0a8'];
const PANTS = ['#2f3a55', '#1f1f24', '#4a4a4a', '#c9b99a', '#3a4a3a', '#5a3d2b', '#6b7a99', '#8a8a8a'];

const _m = new THREE.Matrix4();
const _base = new THREE.Matrix4();
const _loc = new THREE.Matrix4();
const _rot = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();

// ------------------------------------------------------------------ navigation
function buildNav(world) {
  const occ = world.occ;
  const walkable = (x, z) => {
    const v = occ.get(x, z);
    return v === OCC.PLAZA || v === OCC.SIDEWALK;
  };
  const step = 6;
  const nodes = [];
  const index = new Map();
  const key = (i, j) => i * 100000 + j;
  for (let x = -300; x <= 300; x += step) {
    for (let z = -260; z <= 260; z += step) {
      if (!walkable(x, z)) continue;
      const i = Math.round(x / step), j = Math.round(z / step);
      index.set(key(i, j), nodes.length);
      nodes.push({ x, z, i, j, edges: [], id: nodes.length });
    }
  }
  const clear = (ax, az, bx, bz) => {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      if (!walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  };
  for (const n of nodes) {
    for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const o = index.get(key(n.i + di, n.j + dj));
      if (o === undefined) continue;
      const m = nodes[o];
      if (clear(n.x, n.z, m.x, m.z)) { n.edges.push(o); m.edges.push(n.id); }
    }
  }
  const inSquare = nodes.map((n) => n.x > PLAZA.x0 && n.x < PLAZA.x1 && n.z > PLAZA.z0 && n.z < PLAZA.z1);
  return { nodes, walkable, inSquare, nearest(x, z) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < nodes.length; i++) { const d = (nodes[i].x - x) ** 2 + (nodes[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  } };
}

// ------------------------------------------------------------------ pedestrians
class Pedestrians {
  constructor(world, rng, nav) {
    this.world = world;
    this.rng = rng;
    this.nav = nav;
    this.agents = [];
    const groundY = (x, z) => world.groundHeightAt(x, z);
    this.groundY = groundY;
    // --- walkers ---
    const squareNodes = nav.nodes.filter((n, i) => nav.inSquare[i] && n.edges.length >= 3);
    const outerNodes = nav.nodes.filter((n, i) => !nav.inSquare[i] && n.edges.length >= 2);
    const spawnWalker = (node, groupOf = 1) => {
      const leader = this.makeAgent({ mode: 'walk', node: node.id, speed: rng.range(1.0, 1.55) });
      leader.x = node.x; leader.z = node.z;
      leader.jitter = rng.range(-1.6, 1.6);
      this.pickNext(leader);
      for (let g = 1; g < groupOf; g++) {
        const f = this.makeAgent({ mode: 'follow', leader, offset: g === 1 ? 0.9 : -0.9, back: 0.4 * g });
        if (leader.child && g === 1) { f.scale = 0.62; f.child = true; }
      }
    };
    for (let i = 0; i < 150; i++) {
      const n = rng.pick(squareNodes);
      const r = rng();
      spawnWalker(n, r < 0.55 ? 1 : r < 0.9 ? 2 : 3);
    }
    for (let i = 0; i < 110; i++) spawnWalker(rng.pick(outerNodes), rng() < 0.7 ? 1 : 2);
    // --- tourists photographing the monument and the church ---
    const spots = [
      { cx: MONUMENT.cx, cz: MONUMENT.cz + 16, r: 7, tx: MONUMENT.cx, tz: MONUMENT.cz, n: 9 },
      { cx: MONUMENT.cx + 14, cz: MONUMENT.cz + 8, r: 4, tx: MONUMENT.cx, tz: MONUMENT.cz, n: 4 },
      { cx: -14, cz: CHURCH.z1 + 24, r: 8, tx: -14, tz: CHURCH.z1, n: 6 },
      { cx: CHURCH.x0 - 16, cz: (CHURCH.z0 + CHURCH.z1) / 2, r: 5, tx: CHURCH.x0, tz: (CHURCH.z0 + CHURCH.z1) / 2, n: 4 },
      { cx: ARCH.cx, cz: ARCH.cz + 5, r: 4, tx: ARCH.cx, tz: ARCH.cz, n: 4 },
      { cx: CHURCH.x1 + 16, cz: CHURCH.z0 - 12, r: 5, tx: CHURCH.x1, tz: CHURCH.z0, n: 3 },
    ];
    for (const sp of spots) {
      for (let k = 0; k < sp.n; k++) {
        const a = rng() * Math.PI * 2, d = rng() * sp.r;
        const x = sp.cx + Math.cos(a) * d, z = sp.cz + Math.sin(a) * d;
        if (!nav.walkable(x, z)) continue;
        const ag = this.makeAgent({ mode: 'stand', x, z, facing: Math.atan2(sp.tx - x, sp.tz - z) });
        ag.photo = rng() < 0.55;
        ag.timer = rng() * 6;
      }
    }
    // --- sitting: benches, seating steps, café chairs ---
    const seats = rng.shuffle(world.seats.slice());
    for (let i = 0; i < Math.min(seats.length, 42); i++) {
      if (rng() < 0.35) continue;
      const s = seats[i];
      this.makeAgent({ mode: 'sit', x: s.x, z: s.z, facing: s.facing, seatY: 0.46 });
    }
    const cafe = rng.shuffle(world.cafeSeats.slice());
    for (let i = 0; i < Math.min(cafe.length, 90); i++) {
      if (rng() < 0.45) continue;
      const s = cafe[i];
      this.makeAgent({ mode: 'sit', x: s.x, z: s.z, facing: s.facing, seatY: 0.46 });
    }
    // low stone steps that double as seating (south of the fountain and the west ledge)
    const fx0 = FOUNTAIN.cx - FOUNTAIN.w / 2, fz0 = FOUNTAIN.cz - FOUNTAIN.d / 2;
    for (let k = 0; k < 10; k++) this.makeAgent({ mode: 'sit', x: fx0 + rng.range(0, 34), z: fz0 + 20.55, facing: 0, seatY: 0.5 });
    for (let k = 0; k < 8; k++) this.makeAgent({ mode: 'sit', x: PLAZA.x0 + 13.6, z: rng.range(22, 60), facing: Math.PI / 2, seatY: 0.5 });
    // --- children playing near the fountain jets with parents watching ---
    for (let k = 0; k < 9; k++) {
      const b = rng.pick(world.fountainBasins);
      const ag = this.makeAgent({ mode: 'play', cx: (b[0] + b[2]) / 2, cz: (b[1] + b[3]) / 2, rx: (b[2] - b[0]) / 2 + 1.2, rz: (b[3] - b[1]) / 2 + 1.2, phase: rng() * 6.28, speed: rng.range(0.6, 1.1) });
      ag.scale = rng.range(0.55, 0.7);
      ag.child = true;
    }
    for (let k = 0; k < 6; k++) {
      const x = FOUNTAIN.cx + rng.range(-16, 16), z = FOUNTAIN.cz + rng.range(9, 12);
      this.makeAgent({ mode: 'stand', x, z, facing: Math.atan2(FOUNTAIN.cx - x, FOUNTAIN.cz - z) });
    }
  }

  makeAgent(o) {
    const rng = this.rng;
    const a = Object.assign({
      x: 0, z: 0, y: 0, facing: rng() * Math.PI * 2, scale: rng.range(0.9, 1.08), phase: rng() * 6.28,
      skin: rng.pick(SKIN), hair: rng.pick(HAIR), shirt: rng.pick(SHIRT), pants: rng.pick(PANTS),
      timer: 0, child: false,
    }, o);
    if (a.mode === 'walk' && rng() < 0.12) a.child = true; // leader with a child follower
    if (a.mode === 'follow' && a.leader) { a.x = a.leader.x; a.z = a.leader.z; }
    a.y = this.groundY(a.x, a.z);
    this.agents.push(a);
    return a;
  }

  pickNext(a) {
    const nodes = this.nav.nodes;
    const cur = nodes[a.node];
    if (!cur.edges.length) return;
    const hx = Math.sin(a.facing), hz = Math.cos(a.facing);
    let best = null, bw = -Infinity;
    for (const e of cur.edges) {
      if (e === a.prev && cur.edges.length > 1) continue;
      const n = nodes[e];
      const dx = n.x - cur.x, dz = n.z - cur.z;
      const L = Math.hypot(dx, dz);
      const align = (dx * hx + dz * hz) / L;
      const w = align + this.rng() * 1.4 + (this.nav.inSquare[e] ? 0.25 : 0);
      if (w > bw) { bw = w; best = e; }
    }
    a.prev = a.node;
    a.next = best;
    a.t = 0;
    const n = nodes[best];
    a.segLen = Math.hypot(n.x - cur.x, n.z - cur.z);
    a.targetFacing = Math.atan2(n.x - cur.x, n.z - cur.z);
  }

  buildMeshes() {
    const N = this.agents.length;
    const mk = (w, h, d, ty) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, ty, 0); return g; };
    const mat = () => new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
    const parts = {
      head: { geo: mk(0.24, 0.26, 0.24, 0.13), color: 'skin' },
      hair: { geo: mk(0.26, 0.09, 0.26, 0.31), color: 'hair' },
      torso: { geo: mk(0.4, 0.56, 0.24, 0.28), color: 'shirt' },
      legL: { geo: mk(0.15, 0.84, 0.2, -0.42), color: 'pants' },
      legR: { geo: mk(0.15, 0.84, 0.2, -0.42), color: 'pants' },
      armL: { geo: mk(0.11, 0.6, 0.13, -0.3), color: 'shirt' },
      armR: { geo: mk(0.11, 0.6, 0.13, -0.3), color: 'shirt' },
    };
    this.parts = {};
    for (const [name, p] of Object.entries(parts)) {
      const mesh = new THREE.InstancedMesh(p.geo, mat(), N);
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      for (let i = 0; i < N; i++) mesh.setColorAt(i, _c.set(this.agents[i][p.color]));
      mesh.instanceColor.needsUpdate = true;
      this.world.dynamic.add(mesh);
      this.world.disposables.push(p.geo, mesh.material);
      this.parts[name] = mesh;
    }
  }

  update(dt, t) {
    const nodes = this.nav.nodes;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      let swing = 0, armSwing = 0, legBase = 0, torsoLean = 0, armRaise = 0, bob = 0, hipY = 0.86 * a.scale;
      if (a.mode === 'walk') {
        const cur = nodes[a.node], nxt = nodes[a.next];
        a.t += (a.speed * dt) / a.segLen;
        if (a.t >= 1) { a.node = a.next; this.pickNext(a); }
        const cur2 = nodes[a.node], nxt2 = nodes[a.next];
        const tt = Math.min(1, a.t);
        const px = cur2.x + (nxt2.x - cur2.x) * tt, pz = cur2.z + (nxt2.z - cur2.z) * tt;
        // lateral jitter so groups do not walk on rails
        const nx = -Math.cos(a.targetFacing) * 0 + Math.cos(a.targetFacing), nz = -Math.sin(a.targetFacing);
        a.x = px + nx * a.jitter * 0.3; a.z = pz + nz * a.jitter * 0.3;
        // smooth facing
        let d = a.targetFacing - a.facing;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        a.facing += d * Math.min(1, dt * 6);
        a.phase += dt * a.speed * 4.2;
        swing = Math.sin(a.phase) * 0.55;
        armSwing = -swing * 0.8;
        bob = Math.abs(Math.cos(a.phase)) * 0.04;
        a.y = this.groundY(a.x, a.z);
        void cur; void nxt;
      } else if (a.mode === 'follow') {
        const L = a.leader;
        const rx = Math.cos(L.facing), rz = -Math.sin(L.facing);
        const bx = -Math.sin(L.facing), bz = -Math.cos(L.facing);
        a.x = L.x + rx * a.offset + bx * a.back; a.z = L.z + rz * a.offset + bz * a.back;
        a.facing = L.facing;
        a.phase += dt * L.speed * 4.2 * (a.child ? 1.5 : 1);
        swing = Math.sin(a.phase) * 0.55;
        armSwing = -swing * 0.8;
        bob = Math.abs(Math.cos(a.phase)) * 0.04;
        a.y = this.groundY(a.x, a.z);
      } else if (a.mode === 'stand') {
        a.timer -= dt;
        if (a.timer < 0) { a.photoing = a.photo && !a.photoing; a.timer = a.photoing ? 2.5 + this.rng() * 2 : 3 + this.rng() * 8; }
        armRaise = a.photoing ? -1.5 : -0.1;
        swing = 0.05 * Math.sin(t * 0.7 + a.phase);
      } else if (a.mode === 'sit') {
        hipY = a.seatY;
        legBase = 1.25;
        torsoLean = 0.08;
        armRaise = -0.6;
      } else if (a.mode === 'play') {
        a.phase += dt * a.speed;
        const ang = a.phase;
        const nx = a.cx + Math.cos(ang) * a.rx, nz = a.cz + Math.sin(ang * 1.3) * a.rz;
        a.facing = Math.atan2(nx - a.x, nz - a.z);
        a.x = nx; a.z = nz;
        a.y = this.groundY(a.x, a.z);
        a.gait = (a.gait || 0) + dt * 9;
        swing = Math.sin(a.gait) * 0.8;
        armSwing = -swing;
        bob = Math.abs(Math.cos(a.gait)) * 0.06;
      } else if (a.mode === 'ride') {
        // positioned by the cyclists system: legs pedal, torso leans forward
        hipY = 0.95;
        legBase = 0.55;
        swing = Math.sin(a.phase) * 0.5;
        torsoLean = 0.38;
        armRaise = -0.9;
      }
      this.pose(i, a, hipY + bob, swing, armSwing, legBase, torsoLean, armRaise);
    }
    for (const mesh of Object.values(this.parts)) mesh.instanceMatrix.needsUpdate = true;
  }

  pose(i, a, hipY, swing, armSwing, legBase, torsoLean, armRaise) {
    const s = a.scale;
    _p.set(a.x, a.y + hipY, a.z);
    _q.setFromAxisAngle(_up, a.facing);
    _s.set(s, s, s);
    _base.compose(_p, _q, _s);
    const part = (mesh, ox, oy, oz, rx) => {
      _loc.makeTranslation(ox, oy, oz);
      if (rx) { _rot.makeRotationX(rx); _loc.multiply(_rot); }
      _m.multiplyMatrices(_base, _loc);
      mesh.setMatrixAt(i, _m);
    };
    const P = this.parts;
    part(P.legL, -0.1, 0, 0, legBase * -1 + swing);
    part(P.legR, 0.1, 0, 0, legBase * -1 - swing);
    part(P.torso, 0, 0, 0, torsoLean);
    const ty = 0.56 * Math.cos(torsoLean), tz = Math.sin(torsoLean) * 0.56;
    part(P.head, 0, ty + 0.02, tz, 0);
    part(P.hair, 0, ty + 0.02, tz, 0);
    part(P.armL, -0.26, ty - 0.04, tz, armRaise + armSwing);
    part(P.armR, 0.26, ty - 0.04, tz, armRaise - armSwing);
  }
}

// ------------------------------------------------------------------ pigeons
class Pigeons {
  constructor(world, rng) {
    this.world = world;
    this.rng = rng;
    const homes = [
      { x: MONUMENT.cx, z: MONUMENT.cz + 12, r: 9 }, { x: MONUMENT.cx - 12, z: MONUMENT.cz + 4, r: 6 }, { x: FOUNTAIN.cx - 10, z: FOUNTAIN.cz - 14, r: 7 },
      { x: -20, z: 60, r: 8 }, { x: 40, z: -58, r: 6 }, { x: CHURCH.x1 + 20, z: CHURCH.z1 + 10, r: 6 }, { x: -60, z: 30, r: 7 },
    ];
    this.homes = homes;
    this.birds = [];
    for (let i = 0; i < 44; i++) {
      const h = rng.pick(homes);
      const a = rng() * 6.28, d = rng() * h.r;
      const x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d;
      this.birds.push({ x, z, y: world.groundHeightAt(x, z), facing: rng() * 6.28, state: 'ground', timer: rng() * 4, home: h, color: rng.pick(['#6d6f75', '#4a4c52', '#8d8f94', '#5a5d66', '#a29e98']), flap: 0 });
    }
    const body = new THREE.BoxGeometry(0.16, 0.14, 0.3); body.translate(0, 0.12, 0);
    const head = new THREE.BoxGeometry(0.09, 0.1, 0.1); head.translate(0, 0.22, 0.16);
    const wing = new THREE.BoxGeometry(0.5, 0.03, 0.2); wing.translate(0, 0.16, -0.02);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
    this.meshes = [body, head, wing].map((g) => {
      const m = new THREE.InstancedMesh(g, mat, this.birds.length);
      m.frustumCulled = false; m.castShadow = false;
      this.birds.forEach((b, i) => m.setColorAt(i, _c.set(b.color)));
      m.instanceColor.needsUpdate = true;
      world.dynamic.add(m);
      world.disposables.push(g);
      return m;
    });
    world.disposables.push(mat);
  }
  update(dt, t) {
    const rng = this.rng;
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      b.timer -= dt;
      if (b.state === 'ground') {
        if (b.timer < 0) {
          if (rng() < 0.25) {
            // fly to another home spot
            const h = rng.pick(this.homes);
            const a = rng() * 6.28, d = rng() * h.r;
            b.tx = h.x + Math.cos(a) * d; b.tz = h.z + Math.sin(a) * d; b.home = h;
            b.sx = b.x; b.sz = b.z; b.sy = b.y; b.ty = this.world.groundHeightAt(b.tx, b.tz);
            b.state = 'fly'; b.ft = 0; b.dur = 1.8 + Math.hypot(b.tx - b.x, b.tz - b.z) * 0.06;
            b.facing = Math.atan2(b.tx - b.x, b.tz - b.z);
          } else {
            b.facing += rng.range(-1.2, 1.2);
            b.hop = rng.range(0.4, 1.4);
          }
          b.timer = 0.8 + rng() * 2.5;
        }
        if (b.hop > 0) {
          const step = Math.min(b.hop, dt * 0.8);
          b.hop -= step;
          b.x += Math.sin(b.facing) * step; b.z += Math.cos(b.facing) * step;
          b.y = this.world.groundHeightAt(b.x, b.z);
        }
        b.flap = 0;
        b.bob = Math.sin(t * 9 + i) * 0.01;
      } else {
        b.ft += dt / b.dur;
        const k = Math.min(1, b.ft);
        b.x = b.sx + (b.tx - b.sx) * k; b.z = b.sz + (b.tz - b.sz) * k;
        b.y = b.sy + (b.ty - b.sy) * k + Math.sin(k * Math.PI) * (4 + b.dur);
        b.flap = Math.sin(t * 22 + i) * 0.6;
        b.bob = 0;
        if (k >= 1) { b.state = 'ground'; b.timer = 1 + rng() * 3; b.y = b.ty; }
      }
      _p.set(b.x, b.y + b.bob, b.z);
      _q.setFromAxisAngle(_up, b.facing);
      _s.set(1, 1, 1);
      _base.compose(_p, _q, _s);
      this.meshes[0].setMatrixAt(i, _base);
      this.meshes[1].setMatrixAt(i, _base);
      // wings: spread while flying, folded on the ground
      _loc.makeRotationZ(b.flap);
      _s.set(b.state === 'fly' ? 1 : 0.35, 1, 1);
      _rot.makeScale(_s.x, _s.y, _s.z);
      _m.multiplyMatrices(_base, _loc).multiply(_rot);
      this.meshes[2].setMatrixAt(i, _m);
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ vehicles
function vehicleModel(P, kind) {
  const m = new Model(P);
  const paint = P.get('#ffffff', 'paint'), glass = P.get('#1f2a36', 'glassDark'), dark = P.get('#1c1d20', 'dark'), chrome = P.get('#c8ccd0', 'metal'), lamp = P.get('#ffe9c4', 'lamp'), tail = P.get('#c8342a', 'cloth'), sign = P.get('#f2c22e', 'cloth');
  const s = 0.125;
  if (kind === 'car' || kind === 'taxi') {
    m.addGrid([-2.3, 0, -1.1], [2.3, 2.2, 1.1], s).solidBelow = false;
    m.box(-2.1, 0.35, -0.85, 2.1, 1.0, 0.85, paint);
    m.shape(-1.3, 1.0, -0.8, 1.2, 1.55, 0.8, (x, y) => y - 1.0 <= 0.55 - Math.max(0, (Math.abs(x + 0.05) - 0.9)) * 0.9, paint);
    m.shape(-1.32, 1.05, -0.82, 1.22, 1.45, 0.82, (x, y, z) => (Math.abs(z) > 0.72 || x > 1.0 || x < -1.15) && y - 1.0 <= 0.5 - Math.max(0, (Math.abs(x + 0.05) - 0.9)) * 0.9, glass);
    for (const wx of [-1.35, 1.35]) for (const wz of [-0.8, 0.8]) m.shape(wx - 0.35, 0, wz - 0.12, wx + 0.35, 0.7, wz + 0.12, (x, y, z) => Math.hypot(x - wx, y - 0.35) <= 0.34, dark);
    m.box(2.05, 0.6, -0.75, 2.15, 0.8, -0.45, lamp); m.box(2.05, 0.6, 0.45, 2.15, 0.8, 0.75, lamp);
    m.box(-2.15, 0.6, -0.8, -2.05, 0.8, -0.5, tail); m.box(-2.15, 0.6, 0.5, -2.05, 0.8, 0.8, tail);
    m.box(-2.12, 0.42, -0.85, 2.12, 0.52, 0.85, dark); // sill line
    m.box(2.1, 0.45, -0.85, 2.2, 0.62, 0.85, chrome);
    if (kind === 'taxi') m.box(-0.35, 1.55, -0.2, 0.35, 1.8, 0.2, sign);
  } else if (kind === 'van') {
    m.addGrid([-2.8, 0, -1.2], [2.8, 2.6, 1.2], s).solidBelow = false;
    m.box(-2.6, 0.4, -1.0, 2.6, 2.3, 1.0, paint);
    m.shape(1.4, 1.3, -1.02, 2.62, 2.1, 1.02, (x, y, z) => (Math.abs(z) > 0.9 || x > 2.4) && y > 1.3 && y < 2.05, glass);
    m.box(-2.55, 1.35, -1.02, -2.4, 2.0, 1.02, glass);
    for (const wx of [-1.7, 1.7]) for (const wz of [-0.95, 0.95]) m.shape(wx - 0.38, 0, wz - 0.12, wx + 0.38, 0.8, wz + 0.12, (x, y, z) => Math.hypot(x - wx, y - 0.4) <= 0.38, dark);
    m.box(2.55, 0.8, -0.9, 2.65, 1.05, -0.55, lamp); m.box(2.55, 0.8, 0.55, 2.65, 1.05, 0.9, lamp);
    m.box(-2.65, 0.8, -0.95, -2.55, 1.15, -0.65, tail); m.box(-2.65, 0.8, 0.65, -2.55, 1.15, 0.95, tail);
  } else {
    // bus
    m.addGrid([-6.2, 0, -1.4], [6.2, 3.6, 1.4], s).solidBelow = false;
    m.box(-6.0, 0.45, -1.25, 6.0, 3.2, 1.25, paint);
    m.box(-5.8, 1.5, -1.27, 5.8, 2.7, 1.27, glass);
    for (let x = -5.6; x < 5.6; x += 1.6) m.box(x - 0.06, 1.5, -1.28, x + 0.06, 2.7, 1.28, paint);
    m.box(5.95, 1.3, -1.15, 6.05, 2.8, 1.15, glass);
    m.box(-6.05, 1.5, -1.1, -5.95, 2.6, 1.1, glass);
    for (const wx of [-3.9, 3.6]) for (const wz of [-1.15, 1.15]) m.shape(wx - 0.5, 0, wz - 0.15, wx + 0.5, 1.0, wz + 0.15, (x, y, z) => Math.hypot(x - wx, y - 0.5) <= 0.5, dark);
    m.box(5.95, 0.8, -1.1, 6.05, 1.1, -0.7, lamp); m.box(5.95, 0.8, 0.7, 6.05, 1.1, 1.1, lamp);
    m.box(-6.05, 0.8, -1.2, -5.95, 1.2, -0.8, tail); m.box(-6.05, 0.8, 0.8, -5.95, 1.2, 1.2, tail);
    m.box(-2, 3.2, -0.9, 2, 3.5, 0.9, dark); // roof unit
    m.box(-5.8, 0.5, -1.28, 5.8, 0.9, 1.28, dark);
  }
  return m;
}

class Vehicles {
  constructor(world, rng) {
    this.world = world;
    this.rng = rng;
    const P = world.palette;
    const M = world.materials;
    this.kinds = {};
    const lanes = [];
    // one-way loop on the perimeter carriageway (right-hand traffic keeps the plaza on the left)
    const lx = SQ.x1 - SIDEWALK - ROAD / 2, lz = SQ.z1 - SIDEWALK - ROAD / 2;
    lanes.push({ pts: [[-lx, lz], [lx, lz], [lx, -lz], [-lx, -lz], [-lx, lz]], loop: true, speed: 5.5, kinds: ['car', 'car', 'car', 'taxi', 'van'], density: 1 / 55 });
    for (const st of STREETS) {
      if (!st.traffic) continue;
      const sw = st.sidewalk ?? 2.5;
      const cw = st.width - 2 * sw;
      const L = polylineLength(st.pts);
      if (L < 60) continue;
      const far = Math.hypot(st.pts[Math.floor(st.pts.length / 2)][0], st.pts[Math.floor(st.pts.length / 2)][1]) > 150;
      const kinds = st.width >= 14 ? ['car', 'car', 'car', 'taxi', 'van', ...(far ? ['bus'] : [])] : ['car', 'car', 'taxi', 'van'];
      const right = offsetPolyline(st.pts, cw / 4);
      const left = offsetPolyline(st.pts.slice().reverse(), cw / 4);
      lanes.push({ pts: right, loop: false, speed: st.width >= 14 ? 10 : 7.5, kinds, density: st.width >= 14 ? 1 / 55 : 1 / 80 });
      lanes.push({ pts: left, loop: false, speed: st.width >= 14 ? 10 : 7.5, kinds, density: st.width >= 14 ? 1 / 55 : 1 / 80 });
    }
    this.lanes = lanes;
    this.vehicles = [];
    for (const lane of lanes) {
      lane.L = polylineLength(lane.pts);
      const n = Math.max(1, Math.round(lane.L * lane.density));
      lane.cars = [];
      for (let i = 0; i < n; i++) {
        const kind = rng.pick(lane.kinds);
        const v = { lane, kind, s: (lane.L * (i + rng() * 0.6)) / n, speed: lane.speed * rng.range(0.85, 1.1), v: 0, color: this.pickColor(kind) };
        if (kind === 'bus' && lane.cars.some((c) => c.kind === 'bus')) v.kind = 'car';
        lane.cars.push(v);
        this.vehicles.push(v);
      }
      lane.cars.sort((a, b) => a.s - b.s);
    }
    // instanced meshes per kind and class
    for (const kind of ['car', 'taxi', 'van', 'bus']) {
      const list = this.vehicles.filter((v) => v.kind === kind);
      const geos = meshModelToGeometries(vehicleModel(P, kind));
      const meshes = [];
      for (const cls of Object.keys(geos)) {
        const mesh = new THREE.InstancedMesh(geos[cls], M[cls] || M.dark, Math.max(1, list.length));
        mesh.frustumCulled = false;
        mesh.castShadow = cls === 'paint';
        if (cls === 'paint') { list.forEach((v, i) => mesh.setColorAt(i, _c.set(v.color))); if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
        mesh.count = list.length;
        world.dynamic.add(mesh);
        world.disposables.push(geos[cls]);
        meshes.push(mesh);
      }
      this.kinds[kind] = { list, meshes };
    }
  }
  pickColor(kind) {
    const rng = this.rng;
    if (kind === 'taxi') return '#f2c22e';
    if (kind === 'bus') return rng.pick(['#7b4fa3', '#f0eeea', '#6a3f8f']);
    if (kind === 'van') return rng.pick(['#f2f0ea', '#e8e6df', '#3b4a6b', '#c8c4b8']);
    return rng.pick(['#d8d5cc', '#2b2b2e', '#8a8d92', '#3b4a6b', '#7a2e2e', '#e8e6df', '#2f4a3b', '#c9a24a', '#5c6b8a', '#4a4a4a', '#a35a3a', '#1f2a4a']);
  }
  update(dt) {
    for (const lane of this.lanes) {
      const cars = lane.cars;
      for (let i = 0; i < cars.length; i++) {
        const v = cars[i];
        // follow the vehicle ahead
        const ahead = cars[(i + 1) % cars.length];
        let gap = ahead.s - v.s;
        if (gap <= 0) gap += lane.L;
        if (cars.length === 1) gap = 1e9;
        const minGap = v.kind === 'bus' ? 14 : 8;
        const target = gap < minGap ? 0 : gap < minGap * 2.2 ? v.speed * ((gap - minGap) / (minGap * 1.2)) : v.speed;
        v.v += (target - v.v) * Math.min(1, dt * 2.5);
        v.s += v.v * dt;
        if (v.s >= lane.L) { v.s -= lane.L; }
      }
      cars.sort((a, b) => a.s - b.s);
    }
    for (const kind of Object.keys(this.kinds)) {
      const { list, meshes } = this.kinds[kind];
      for (let i = 0; i < list.length; i++) {
        const v = list[i];
        const p = polylineSample(v.lane.pts, v.s);
        const y = this.world.groundHeightAt(p.x, p.z);
        _p.set(p.x, y, p.z);
        _q.setFromAxisAngle(_up, Math.atan2(-p.dir[1], p.dir[0]));
        _s.set(1, 1, 1);
        _base.compose(_p, _q, _s);
        for (const m of meshes) m.setMatrixAt(i, _base);
      }
      for (const m of meshes) m.instanceMatrix.needsUpdate = true;
    }
  }
}

// ------------------------------------------------------------------ cyclists
class Cyclists {
  constructor(world, rng, peds) {
    this.world = world;
    this.rng = rng;
    this.peds = peds;
    const inner = 4;
    const ix = PLAZA.x1 - inner - 9, iz = PLAZA.z1 - inner - 9;
    const loopA = [[-ix, iz - 8], [ix - 20, iz - 8], [ix, iz - 20], [ix, -iz + 10], [ix - 12, -iz], [-ix + 10, -iz], [-ix, -iz + 12], [-ix, iz - 8]];
    const loopB = loopA.slice().reverse();
    const lx = SQ.x1 - SIDEWALK - ROAD + 1.2, lz = SQ.z1 - SIDEWALK - ROAD + 1.2;
    const loopC = [[-lx, lz], [lx, lz], [lx, -lz], [-lx, -lz], [-lx, lz]];
    this.paths = [loopA, loopB, loopC].map((pts) => ({ pts, L: polylineLength(pts) }));
    this.riders = [];
    const geos = world.bikeGeo;
    const N = 12;
    for (let i = 0; i < N; i++) {
      const path = this.paths[i % 3];
      const rider = peds.makeAgent({ mode: 'ride', x: 0, z: 0, facing: 0 });
      rider.phase = rng() * 6.28;
      this.riders.push({ path, s: (path.L * i) / N * 0.97 + rng() * 5, speed: rng.range(3.6, 5.2), rider, cargo: i % 4 === 0 });
    }
    const M = world.materials;
    this.meshes = [];
    for (const cls of Object.keys(geos)) {
      const mesh = new THREE.InstancedMesh(geos[cls], M[cls] || M.dark, N);
      mesh.frustumCulled = false;
      world.dynamic.add(mesh);
      this.meshes.push(mesh);
    }
    const cargoGeo = new THREE.BoxGeometry(0.5, 0.45, 0.45); cargoGeo.translate(-0.7, 1.15, 0);
    const cargoMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    this.cargo = new THREE.InstancedMesh(cargoGeo, cargoMat, N);
    this.cargo.frustumCulled = false;
    this.riders.forEach((r, i) => this.cargo.setColorAt(i, _c.set(r.cargo ? rng.pick(['#e0a030', '#2f7a4a', '#c8342a', '#f0f0f0']) : '#000000')));
    this.cargo.instanceColor.needsUpdate = true;
    world.dynamic.add(this.cargo);
    world.disposables.push(cargoGeo, cargoMat);
  }
  update(dt) {
    for (let i = 0; i < this.riders.length; i++) {
      const r = this.riders[i];
      r.s += r.speed * dt;
      if (r.s >= r.path.L) r.s -= r.path.L;
      const p = polylineSample(r.path.pts, r.s);
      const y = this.world.groundHeightAt(p.x, p.z);
      const yaw = Math.atan2(-p.dir[1], p.dir[0]);
      _p.set(p.x, y, p.z);
      _q.setFromAxisAngle(_up, yaw);
      _s.set(1, 1, 1);
      _base.compose(_p, _q, _s);
      for (const m of this.meshes) m.setMatrixAt(i, _base);
      const cs = r.cargo ? 1 : 0.0001;
      _s.set(cs, cs, cs);
      _m.compose(_p, _q, _s);
      this.cargo.setMatrixAt(i, _m);
      // rider sits on the saddle facing +x local => facing angle for pedestrians uses sin/cos convention
      r.rider.x = p.x - p.dir[0] * 0.1; r.rider.z = p.z - p.dir[1] * 0.1; r.rider.y = y;
      r.rider.facing = Math.atan2(p.dir[0], p.dir[1]);
      r.rider.phase += dt * r.speed * 2.2;
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
    this.cargo.instanceMatrix.needsUpdate = true;
  }
}

export function buildAgents(world) {
  const rng = world.rng.fork('agents');
  const nav = buildNav(world);
  const peds = new Pedestrians(world, rng.fork('peds'), nav);
  const pigeons = new Pigeons(world, rng.fork('pigeons'));
  const vehicles = new Vehicles(world, rng.fork('vehicles'));
  const cyclists = new Cyclists(world, rng.fork('cyclists'), peds);
  peds.buildMeshes();
  world.stats.pedestrians = peds.agents.length;
  world.stats.vehicles = vehicles.vehicles.length;
  world.updaters.push((dt, t) => {
    peds.update(dt, t);
    pigeons.update(dt, t);
    vehicles.update(dt, t);
    cyclists.update(dt, t);
  });
}
