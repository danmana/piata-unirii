// Population: small articulated voxel characters (instanced body parts) —
// strollers and small groups, tourists photographing the church and statue,
// bench sitters, café patrons, children at the fountain, cyclists, delivery
// bikes on the ring road, pedestrians on the old-town sidewalks and pigeons.

import * as THREE from 'three';
import { POOL } from '../core/mat.js';
import { RNG, mixSeed } from '../core/rng.js';
import { voxelBoxGeometry } from '../render/materials.js';
import { SQ, PLAZA, ROAD_RING, CHURCH, TOWER, MONUMENT, ARCH, FOUNTAIN, GROUNDS, STREETS } from '../plan/site.js';

const TOPS = ['#f2efe8', '#1f2a3c', '#8b2b2b', '#3e5a44', '#c9a24a', '#2b2b2b', '#6a8caf', '#d9c7a8', '#a35d3b', '#5b4b6b', '#e8b4a0', '#9aa7b0', '#44617a', '#b8b2a0'];
const BOTTOMS = ['#2f3d52', '#1d1d1f', '#5a5e63', '#c2b59a', '#3b4c63', '#6b5a48', '#27303b'];
const SKIN = ['#e8c4a8', '#dcb492', '#c99d7c', '#f0d2bd', '#b98a68', '#8d6448'];
const HAIR = ['#2a211b', '#4a3526', '#6b4a2e', '#a88455', '#c9c2b8', '#1b1716', '#7a4b32'];
const PARTS = 11;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qy = new THREE.Quaternion(), _qx = new THREE.Quaternion();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _X = new THREE.Vector3(1, 0, 0), _Y = new THREE.Vector3(0, 1, 0);

class WalkGrid {
  constructor(plan) {
    this.x0 = -172; this.z0 = -142; this.res = 0.5;
    this.w = Math.round(344 / this.res); this.h = Math.round(284 / this.res);
    this.a = new Uint8Array(this.w * this.h);
    const occ = plan.occ;
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const x = this.x0 + (i + 0.5) * this.res, z = this.z0 + (j + 0.5) * this.res;
      let ok = false;
      if (x > SQ.W + 0.6 && x < SQ.E - 0.6 && z > SQ.N + 0.6 && z < SQ.S - 0.6) {
        const inRoad = x > ROAD_RING.W.x0 - 0.3 && x < ROAD_RING.E.x1 + 0.3 && z > ROAD_RING.N.z0 - 0.3 && z < ROAD_RING.S.z1 + 0.3 &&
          !(x > PLAZA.x0 + 0.4 && x < PLAZA.x1 - 0.4 && z > PLAZA.z0 + 0.4 && z < PLAZA.z1 - 0.4);
        ok = !inRoad;
      } else if (occ.get(x, z) === 1) {
        // sidewalks of streets (pedestrian streets fully)
        for (const st of STREETS) {
          const d = distPoly(st.pts, x, z);
          if (d > st.w / 2 - 0.4) continue;
          if (st.kind === 'ped' || d > st.w / 2 - st.walk + 0.4) { ok = true; break; }
        }
      }
      this.a[j * this.w + i] = ok ? 1 : 0;
    }
    // crosswalks across the ring road
    for (const x of [-62, -6, 52]) { this.rect(x + 0.3, ROAD_RING.N.z0 - 0.5, x + 3.7, ROAD_RING.N.z1 + 0.5, 1); this.rect(x + 0.3, ROAD_RING.S.z0 - 0.5, x + 3.7, ROAD_RING.S.z1 + 0.5, 1); }
    for (const z of [-42, 30]) { this.rect(ROAD_RING.W.x0 - 0.5, z + 0.3, ROAD_RING.W.x1 + 0.5, z + 3.7, 1); this.rect(ROAD_RING.E.x0 - 0.5, z + 0.3, ROAD_RING.E.x1 + 0.5, z + 3.7, 1); }
    // obstacles
    this.rect(CHURCH.x - 4.8, CHURCH.z - 12 - 3.6, CHURCH.x + 72.2, CHURCH.z + 12 + 3.4, 0);
    this.rect(TOWER.x0 - 2.5, TOWER.z0 - 2.6, TOWER.x1 + 2.5, TOWER.z1, 0);
    for (const g of GROUNDS.grass) this.rect(g.x0 - 0.4, g.z0 - 0.4, g.x1 + 0.4, g.z1 + 0.4, 0);
    this.rect(MONUMENT.x - 6.9, MONUMENT.z - 4.4, MONUMENT.x + 6.9, MONUMENT.z + 4.4, 0);
    this.rect(ARCH.x0 - 1.1, ARCH.z0 - 1.1, ARCH.x1 + 1.1, ARCH.z1 + 1.1, 0);
    for (const t of FOUNTAIN.tables) this.rect(t.x0 - 0.6, t.z0 - 0.6, t.x1 + 0.6, t.z1 + 0.6, 0);
    for (const p of plan.props) {
      const r = { cafe: 1.05, umbrella: 0.2, bench: 1.0, planter: 0.8, rack: 1.4, bike: 0.9, board: 0.8, bin: 0.35, lamp: 0.25, streetlamp: 0.25 }[p.kind];
      if (r) this.disc(p.x, p.z, r, 0);
    }
    for (const t of plan.trees) this.disc(t.x, t.z, 0.8, 0);
  }
  idx(x, z) {
    const i = Math.floor((x - this.x0) / this.res), j = Math.floor((z - this.z0) / this.res);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return j * this.w + i;
  }
  ok(x, z) { const k = this.idx(x, z); return k >= 0 && this.a[k] === 1; }
  rect(x0, z0, x1, z1, v) {
    for (let z = z0; z < z1; z += this.res * 0.5) for (let x = x0; x < x1; x += this.res * 0.5) { const k = this.idx(x, z); if (k >= 0) this.a[k] = v; }
  }
  disc(cx, cz, r, v) {
    for (let z = cz - r; z <= cz + r; z += this.res * 0.5) for (let x = cx - r; x <= cx + r; x += this.res * 0.5) {
      if ((x - cx) ** 2 + (z - cz) ** 2 > r * r) continue;
      const k = this.idx(x, z); if (k >= 0) this.a[k] = v;
    }
  }
  clear(x0, z0, x1, z1) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.ceil(L / 0.5);
    for (let i = 1; i <= n; i++) { const t = i / n; if (!this.ok(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false; }
    return true;
  }
  randomNear(rng, x, z, r0, r1) {
    for (let k = 0; k < 14; k++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(r0, r1);
      const tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r;
      if (this.ok(tx, tz) && this.clear(x, z, tx, tz)) return [tx, tz];
    }
    return null;
  }
  randomAny(rng, box) {
    for (let k = 0; k < 200; k++) {
      const x = rng.range(box[0], box[2]), z = rng.range(box[1], box[3]);
      if (this.ok(x, z)) return [x, z];
    }
    return [0, 30];
  }
}

function distPoly(pts, x, z) {
  let best = 1e9;
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, az] = pts[s], [bx, bz] = pts[s + 1];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    let t = ((x - ax) * dx + (z - az) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = x - ax - dx * t, ez = z - az - dz * t;
    best = Math.min(best, Math.sqrt(ex * ex + ez * ez));
  }
  return best;
}

export class People {
  constructor(app, plan, templates) {
    this.app = app;
    this.plan = plan;
    this.scene = app.scene;
    const rng = this.rng = new RNG(mixSeed(plan.varSeed, 0xbeef));
    this.grid = new WalkGrid(plan);
    const agents = this.agents = [];
    const gh = plan.groundHeight;
    const col = () => ({
      top: rng.pick(TOPS), bottom: rng.pick(BOTTOMS), skin: rng.pick(SKIN), hair: rng.pick(HAIR),
      shoes: rng.pick(['#2a2522', '#3d3a36', '#e8e4dc', '#5a3e2b']), acc: rng.pick(['#3a3a3a', '#6b4a2e', '#2c4a6b', '#8b2b2b', '#c9a24a']),
    });
    const mk = (kind, x, z, extra = {}) => {
      const a = {
        kind, x, z, y: gh(x, z), yaw: rng.range(0, Math.PI * 2), speed: rng.range(1.05, 1.5), phase: rng.range(0, 6.28),
        s: kind === 'child' ? rng.range(0.62, 0.75) : rng.range(0.93, 1.08), c: col(), state: 'walk', t: rng.range(0, 6),
        acc: rng.weighted(['none', 'backpack', 'bag', 'none'], [4, 1.4, 1.4, 1]), tx: x, tz: z, head: 0, ...extra,
      };
      agents.push(a);
      return a;
    };
    const plazaBox = [PLAZA.x0 + 1, PLAZA.z0 + 1, PLAZA.x1 - 1, PLAZA.z1 - 1];
    const squareBox = [SQ.W + 1, SQ.N + 1, SQ.E - 1, SQ.S - 1];
    // strollers and groups
    for (let i = 0; i < 120; i++) {
      const [x, z] = this.grid.randomAny(rng, i % 3 === 0 ? squareBox : plazaBox);
      const lead = mk('walk', x, z);
      if (rng.chance(0.28)) {
        const n = rng.int(1, 2);
        for (let k = 0; k < n; k++) {
          const f = mk('follow', x + rng.range(-1, 1), z + rng.range(-1, 1));
          f.lead = lead; f.off = [(k + 1) * 0.65 * (k % 2 ? -1 : 1), -0.3 * k];
          if (rng.chance(0.2)) { f.s *= 0.7; }
        }
      }
    }
    // tourists
    for (let i = 0; i < 22; i++) {
      const spot = rng.pick(plan.photoSpots);
      const a = mk('tourist', spot.x + rng.range(-4, 4), spot.z + rng.range(-4, 4), { acc: rng.chance(0.6) ? 'backpack' : 'camera', camera: true });
      a.spot = spot; a.state = rng.chance(0.5) ? 'photo' : 'walk';
      if (!this.grid.ok(a.x, a.z)) { const p = this.grid.randomAny(rng, plazaBox); a.x = p[0]; a.z = p[1]; }
    }
    // sitters on benches and café patrons
    for (const seat of plan.seats) if (rng.chance(0.55)) { const a = mk('sit', seat.x, seat.z, { yaw: seat.rot, sy: seat.y }); a.state = 'sit'; }
    for (const seat of plan.cafeSeats) { const a = mk('sit', seat.x, seat.z, { yaw: seat.rot, sy: seat.y, cafe: true }); a.state = 'sit'; a.acc = 'none'; }
    // children by the fountain jets
    const J = FOUNTAIN.jets;
    for (let i = 0; i < 10; i++) {
      const a = mk('child', rng.range(J.x0, J.x1), rng.range(J.z0, J.z1));
      a.speed = rng.range(1.8, 2.8); a.box = [J.x0 - 2, J.z0 - 2, J.x1 + 2, J.z1 + 2];
    }
    // a few parents watching
    for (let i = 0; i < 4; i++) { const a = mk('stand', rng.range(J.x0 - 4, J.x1 + 3), J.z1 + rng.range(2, 4)); a.state = 'stand'; a.yaw = Math.PI + rng.range(-0.5, 0.5); }
    // cyclists and delivery bikes on the ring road
    this.ring = ringPath();
    for (let i = 0; i < 9; i++) {
      const a = mk('cycle', 0, 0, { u: rng.range(0, this.ring.len), speed: rng.range(4.0, 5.6), delivery: i < 3 });
      a.lane = rng.range(1.6, 2.5);
      a.acc = a.delivery ? 'box' : 'none';
      if (a.delivery) a.c.acc = rng.pick(['#e0662b', '#2fa36b', '#e23a6e', '#f2c230']);
    }
    // sidewalk pedestrians in the surrounding streets
    this.walkways = [];
    for (const st of STREETS) {
      if (st.kind === 'ped' || st.id === 'eroilor' || st.id === 'maniu' || st.id === 'napoca' || st.id === 'memo' || st.id === 'dec21' || st.id === 'ferdinand') {
        for (const side of [-1, 1]) {
          const off = st.kind === 'ped' ? side * st.w * 0.25 : side * (st.w / 2 - st.walk / 2);
          this.walkways.push(offsetPath(st.pts, off));
        }
      }
    }
    for (let i = 0; i < 70; i++) {
      const w = rng.pick(this.walkways);
      mk('street', 0, 0, { way: w, u: rng.range(0, w.len), dir: rng.chance(0.5) ? 1 : -1 });
    }
    this.count = agents.length;

    // ---- rendering
    const geo = voxelBoxGeometry(15, 0);
    this.mesh = new THREE.InstancedMesh(geo, app.pools.list[POOL.fabric], agents.length * PARTS);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    agents.forEach((a, i) => {
      const cols = [a.c.bottom, a.c.bottom, a.c.bottom, a.c.bottom, a.c.top, a.c.skin, a.c.hair, a.c.top, a.c.top, a.c.acc, a.c.shoes];
      if (a.acc === 'camera') cols[9] = '#1d1d1d';
      for (let k = 0; k < PARTS; k++) this.mesh.setColorAt(i * PARTS + k, _c.set(cols[k]));
    });
    this.mesh.instanceColor.needsUpdate = true;
    this.scene.add(this.mesh);
    // bicycles under cyclists (dynamic instances of the bike template)
    this.cyclists = agents.filter((a) => a.kind === 'cycle');
    this.bikeMeshes = [];
    const bike = templates.get('prop:bike');
    if (bike) {
      for (const part of bike.lods[0]) {
        const m = new THREE.InstancedMesh(part.geo, app.pools.list[part.pool], this.cyclists.length);
        m.frustumCulled = false; m.castShadow = false;
        for (let i = 0; i < this.cyclists.length; i++) m.setColorAt(i, _c.set(part.pool === POOL.paint ? rng.pick(['#2c4a6b', '#6b2c2c', '#2f2f2f', '#d8d4ca']) : '#ffffff'));
        this.scene.add(m);
        this.bikeMeshes.push(m);
      }
    }
    // soft contact shadows
    this.blobTex = blobTexture();
    const bm = new THREE.MeshBasicMaterial({ map: this.blobTex, color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, fog: false });
    const bg = new THREE.PlaneGeometry(1, 1); bg.rotateX(-Math.PI / 2);
    this.blobs = new THREE.InstancedMesh(bg, bm, agents.length);
    this.blobs.frustumCulled = false;
    this.blobs.renderOrder = 1;
    this.scene.add(this.blobs);
    // pigeons
    this.pigeons = [];
    const flocks = [[-30, 30], [30, 20], [-60, -20], [60, -50], [0, 55], [-75, 40]];
    for (const [fx, fz] of flocks) {
      const n = rng.int(4, 9);
      for (let i = 0; i < n; i++) {
        const x = fx + rng.range(-3, 3), z = fz + rng.range(-3, 3);
        this.pigeons.push({ x, z, y: gh(x, z), yaw: rng.range(0, 6.28), t: rng.range(0, 5), fly: 0, vx: 0, vz: 0, vy: 0, peck: rng.range(0, 6) });
      }
    }
    this.pigeonMesh = new THREE.InstancedMesh(geo, app.pools.list[POOL.fabric], this.pigeons.length * 3);
    this.pigeonMesh.frustumCulled = false;
    this.pigeonMesh.castShadow = false;
    this.pigeons.forEach((p, i) => {
      const g = rng.pick(['#8e9196', '#7c8085', '#9a9a98', '#6d7075']);
      this.pigeonMesh.setColorAt(i * 3, _c.set(g));
      this.pigeonMesh.setColorAt(i * 3 + 1, _c.set('#5d6a66'));
      this.pigeonMesh.setColorAt(i * 3 + 2, _c.set('#55585c'));
    });
    this.scene.add(this.pigeonMesh);
    this.frame = 0;
  }

  update(dt, time, camera) {
    const g = this.grid, rng = this.rng, gh = this.plan.groundHeight;
    this.frame++;
    for (const a of this.agents) {
      switch (a.kind) {
        case 'walk': case 'tourist': case 'child': this.stepWalker(a, dt, rng, g, gh); break;
        case 'follow': {
          const L = a.lead;
          const c = Math.cos(L.yaw), s = Math.sin(L.yaw);
          const tx = L.x + c * a.off[0] + s * a.off[1], tz = L.z - s * a.off[0] + c * a.off[1];
          const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
          const sp = L.state === 'walk' ? Math.min(L.speed * 1.25, d * 2.5) : Math.min(1.2, d * 2);
          if (d > 0.05) { a.x += (dx / d) * sp * dt; a.z += (dz / d) * sp * dt; a.yaw = lerpAngle(a.yaw, Math.atan2(dx, dz), Math.min(1, dt * 6)); }
          a.moving = sp > 0.2;
          a.phase += sp * dt * 3.4 / a.s;
          a.y = gh(a.x, a.z);
          if (d > 25) { a.x = tx; a.z = tz; }
          break;
        }
        case 'cycle': {
          a.u = (a.u + a.speed * dt) % this.ring.len;
          const p = samplePath(this.ring, a.u, a.lane);
          a.x = p[0]; a.z = p[1]; a.yaw = p[2]; a.y = 0; a.phase += dt * a.speed * 1.6; a.moving = true;
          break;
        }
        case 'street': {
          a.u += a.dir * a.speed * dt;
          if (a.u > a.way.len || a.u < 0) { a.dir = -a.dir; a.u = Math.max(0, Math.min(a.way.len, a.u)); }
          const p = samplePath(a.way, a.u, 0);
          a.x = p[0]; a.z = p[1]; a.yaw = p[2] + (a.dir < 0 ? Math.PI : 0); a.y = 0.25; a.moving = true;
          a.phase += a.speed * dt * 3.4 / a.s;
          break;
        }
        case 'sit': a.moving = false; a.head = Math.sin(time * 0.3 + a.phase) * 0.5; break;
        case 'stand': a.moving = false; a.head = Math.sin(time * 0.4 + a.phase) * 0.6; break;
      }
    }
    this.render(time, camera);
    this.updatePigeons(dt, time);
  }

  stepWalker(a, dt, rng, g, gh) {
    if (a.state === 'photo') {
      a.t -= dt;
      a.moving = false;
      const sp = a.spot;
      a.yaw = lerpAngle(a.yaw, Math.atan2(sp.tx - a.x, sp.tz - a.z), Math.min(1, dt * 3));
      if (a.t <= 0) { a.state = 'walk'; a.t = rng.range(8, 20); a.tx = a.x; a.tz = a.z; }
      return;
    }
    if (a.state === 'pause') {
      a.t -= dt; a.moving = false;
      if (a.t <= 0) a.state = 'walk';
      return;
    }
    const dx = a.tx - a.x, dz = a.tz - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.4) {
      // choose next target
      if (a.kind === 'tourist' && a.goPhoto) {
        a.state = 'photo'; a.t = rng.range(4, 10); a.goPhoto = false; return;
      }
      if (a.kind === 'tourist' && rng.chance(0.5)) {
        const sp = rng.pick(this.plan.photoSpots);
        if (g.ok(sp.x, sp.z) && g.clear(a.x, a.z, sp.x, sp.z)) { a.tx = sp.x; a.tz = sp.z; a.spot = sp; a.goPhoto = true; return; }
      }
      if (a.kind === 'child') {
        const b = a.box;
        a.tx = rng.range(b[0], b[2]); a.tz = rng.range(b[1], b[3]);
        if (!g.ok(a.tx, a.tz)) { a.tx = a.x; a.tz = a.z; }
        if (rng.chance(0.25)) { a.state = 'pause'; a.t = rng.range(0.5, 2.5); }
        return;
      }
      if (rng.chance(0.12)) { a.state = 'pause'; a.t = rng.range(1, 5); }
      const r = g.randomNear(rng, a.x, a.z, 6, 42);
      if (r) { a.tx = r[0]; a.tz = r[1]; }
      else { a.tx = a.x + rng.range(-2, 2); a.tz = a.z + rng.range(-2, 2); if (!g.ok(a.tx, a.tz)) { a.tx = a.x; a.tz = a.z; } }
      return;
    }
    const sp = a.speed;
    const nx = a.x + (dx / d) * sp * dt, nz = a.z + (dz / d) * sp * dt;
    if (!g.ok(nx, nz) && a.kind !== 'child') { a.tx = a.x; a.tz = a.z; return; }
    a.x = nx; a.z = nz;
    a.yaw = lerpAngle(a.yaw, Math.atan2(dx, dz), Math.min(1, dt * 5));
    a.moving = true;
    a.phase += sp * dt * 3.4 / a.s;
    a.y = gh(a.x, a.z);
    if (a.kind === 'child') a.jump = Math.max(0, Math.sin(a.phase * 0.5)) * 0.18;
  }

  render(time, camera) {
    const mesh = this.mesh;
    let bi = 0;
    const cp = camera.position;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      const far = (a.x - cp.x) ** 2 + (a.z - cp.z) ** 2 > 900 * 900;
      if (far) { for (let k = 0; k < PARTS; k++) setZero(mesh, i * PARTS + k); setZeroBlob(this.blobs, i); continue; }
      poseAgent(a, time, mesh, i * PARTS);
      // contact shadow
      const r = a.kind === 'cycle' ? 1.6 : 0.8 * a.s;
      _m.compose(_p.set(a.x, (a.kind === 'sit' ? a.sy - 0.45 : a.y) + 0.02, a.z), _q.identity(), _s.set(r, 1, r));
      this.blobs.setMatrixAt(i, _m);
      if (a.kind === 'cycle' && this.bikeMeshes.length) {
        _qy.setFromAxisAngle(_Y, a.yaw - Math.PI / 2);
        _m.compose(_p.set(a.x, a.y + 0.25, a.z), _qy, _s.set(1, 1, 1));
        for (const bm of this.bikeMeshes) bm.setMatrixAt(bi, _m);
        bi++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.blobs.instanceMatrix.needsUpdate = true;
    for (const bm of this.bikeMeshes) bm.instanceMatrix.needsUpdate = true;
  }

  updatePigeons(dt, time) {
    const pm = this.pigeonMesh;
    const gh = this.plan.groundHeight;
    this.pigeons.forEach((p, i) => {
      if (p.fly > 0) {
        p.fly -= dt;
        p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
        p.vy -= 1.2 * dt;
        const gy = gh(p.x, p.z);
        if (p.fly <= 0 || p.y <= gy) { p.fly = 0; p.y = gy; }
      } else {
        p.t += dt;
        // startle when a walker comes close (checked sparsely)
        if (((i + this.frame) % 20) === 0) {
          for (const a of this.agents) {
            if (!a.moving || a.kind === 'cycle') continue;
            if ((a.x - p.x) ** 2 + (a.z - p.z) ** 2 < 2.2) {
              const ang = Math.atan2(p.x - a.x, p.z - a.z) + (Math.random() - 0.5);
              p.vx = Math.sin(ang) * 5; p.vz = Math.cos(ang) * 5; p.vy = 3.2; p.fly = 2.2; p.yaw = ang;
              break;
            }
          }
        }
        if (Math.sin(p.t * 0.7 + i) > 0.97) p.yaw += 0.05;
      }
      const flap = p.fly > 0 ? Math.sin(time * 30 + i) * 0.5 : 0;
      const peck = p.fly > 0 ? 0 : Math.max(0, Math.sin(p.t * 3 + p.peck)) * 0.08;
      _qy.setFromAxisAngle(_Y, p.yaw);
      const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
      _m.compose(_p.set(p.x, p.y + 0.13, p.z), _qy, _s.set(0.17 + Math.abs(flap) * 0.3, 0.14, 0.3));
      pm.setMatrixAt(i * 3, _m);
      _m.compose(_p.set(p.x + s * 0.17, p.y + 0.25 - peck * 1.5, p.z + c * 0.17), _qy, _s.set(0.09, 0.1, 0.1));
      pm.setMatrixAt(i * 3 + 1, _m);
      _m.compose(_p.set(p.x - s * 0.2, p.y + 0.14, p.z - c * 0.2), _qy, _s.set(0.1, 0.04, 0.14));
      pm.setMatrixAt(i * 3 + 2, _m);
    });
    pm.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const m of [this.mesh, this.blobs, this.pigeonMesh, ...this.bikeMeshes]) { this.scene.remove(m); m.dispose(); }
    this.mesh.geometry.dispose();
    this.blobs.geometry.dispose(); this.blobs.material.dispose(); this.blobTex.dispose();
  }
}

function setZero(mesh, i) { _m.makeScale(0, 0, 0); mesh.setMatrixAt(i, _m); }
function setZeroBlob(mesh, i) { _m.makeScale(0, 0, 0); mesh.setMatrixAt(i, _m); }

function lerpAngle(a, b, t) {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * t;
}

// Compose the articulated body (11 boxes) of one agent
function poseAgent(a, time, mesh, base) {
  const s = a.s;
  const sit = a.kind === 'sit' || a.kind === 'cycle';
  let tl = 0, tr = 0, kl = 0, kr = 0, al = 0, ar = 0, bob = 0, lean = 0;
  const walk = a.moving;
  if (a.kind === 'cycle') {
    const ph = a.phase;
    tl = 1.2 + Math.sin(ph) * 0.35; tr = 1.2 - Math.sin(ph) * 0.35;
    kl = 1.3 + Math.cos(ph) * 0.3; kr = 1.3 - Math.cos(ph) * 0.3;
    al = 0.95; ar = 0.95; lean = 0.35;
  } else if (sit) {
    tl = tr = Math.PI / 2; kl = kr = Math.PI / 2;
    al = ar = a.cafe ? 0.55 + Math.sin(time * 0.6 + a.phase) * 0.15 : 0.25;
  } else if (walk) {
    const ph = a.phase;
    const amp = a.kind === 'child' ? 0.7 : 0.48;
    tl = Math.sin(ph) * amp; tr = -tl;
    kl = Math.max(0, -Math.sin(ph + 0.4)) * 0.9; kr = Math.max(0, Math.sin(ph + 0.4)) * 0.9;
    al = -tl * 0.8; ar = -tr * 0.8;
    bob = Math.abs(Math.cos(ph)) * 0.035 * s;
  } else if (a.state === 'photo') {
    al = 1.85; ar = 1.75;
  }
  if (a.acc === 'bag' && !sit) ar = Math.min(ar, 0.12);
  const hipY = 0.92 * s;
  let rootY = a.y + bob + (a.jump || 0);
  if (a.kind === 'sit') rootY = a.sy - hipY + 0.02;
  if (a.kind === 'cycle') rootY = a.y + 0.2;
  const yaw = a.yaw;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  _qy.setFromAxisAngle(_Y, yaw);
  const put = (k, lx, ly, lz, ang, sx, sy_, sz) => {
    // local (lx,ly,lz) -> world
    const wx = a.x + cy * lx + sy * lz, wz = a.z - sy * lx + cy * lz;
    _qx.setFromAxisAngle(_X, -ang);
    _q.multiplyQuaternions(_qy, _qx);
    _m.compose(_p.set(wx, rootY + ly, wz), _q, _s.set(sx, sy_, sz));
    mesh.setMatrixAt(base + k, _m);
  };
  const TL = 0.46 * s, SL = 0.46 * s, AL = 0.6 * s, TH = 0.6 * s;
  // legs
  const legs = [[-1, tl, kl], [1, tr, kr]];
  legs.forEach(([side, t, k], i) => {
    const px = side * 0.1 * s, py = hipY;
    put(i, px, py - Math.cos(t) * TL / 2, Math.sin(t) * TL / 2, t, 0.145 * s, TL, 0.16 * s);
    const kx = py - Math.cos(t) * TL, kz = Math.sin(t) * TL;
    const b = t - k;
    put(2 + i, px, kx - Math.cos(b) * SL / 2, kz + Math.sin(b) * SL / 2, b, 0.125 * s, SL, 0.14 * s);
  });
  // torso (+ lean for cyclists)
  const tz = Math.sin(lean) * TH / 2;
  put(4, 0, hipY + Math.cos(lean) * TH / 2, tz, -lean, 0.38 * s, TH, 0.22 * s);
  const topY = hipY + Math.cos(lean) * TH, topZ = Math.sin(lean) * TH;
  // head + hair
  const hy = topY + 0.045 * s + 0.12 * s;
  const hz = topZ + (a.kind === 'cycle' ? 0.05 : 0);
  const hq = a.head || 0;
  {
    const wx = a.x + cy * 0 + sy * hz, wz = a.z + cy * hz;
    _q.setFromAxisAngle(_Y, yaw + hq);
    _m.compose(_p.set(wx, rootY + hy, wz), _q, _s.set(0.21 * s, 0.24 * s, 0.22 * s));
    mesh.setMatrixAt(base + 5, _m);
    _m.compose(_p.set(wx - sy * 0.012 * s * 0, rootY + hy + 0.14 * s, wz - cy * 0.012 * s), _q, _s.set(0.23 * s, 0.07 * s, 0.24 * s));
    mesh.setMatrixAt(base + 6, _m);
  }
  // arms
  const sh = topY - 0.06 * s;
  [[-1, al], [1, ar]].forEach(([side, c], i) => {
    put(7 + i, side * 0.245 * s, sh - Math.cos(c) * AL / 2, topZ + Math.sin(c) * AL / 2, c, 0.1 * s, AL, 0.11 * s);
  });
  // accessory
  if (a.acc === 'backpack') put(9, 0, hipY + TH * 0.55, topZ * 0.5 - 0.17 * s, -lean, 0.3 * s, 0.36 * s, 0.14 * s);
  else if (a.acc === 'bag') put(9, 0.3 * s, hipY + 0.05 * s, 0.02, 0, 0.1 * s, 0.26 * s, 0.3 * s);
  else if (a.acc === 'camera' && a.state === 'photo') put(9, 0, hy - 0.02 * s, 0.2 * s, 0, 0.14 * s, 0.09 * s, 0.08 * s);
  else if (a.acc === 'box') put(9, 0, hipY + TH * 0.62, topZ - 0.26 * s, -lean, 0.44 * s, 0.44 * s, 0.4 * s);
  else { _m.makeScale(0, 0, 0); mesh.setMatrixAt(base + 9, _m); }
  // shoes (single box under the leading foot suggests footwear)
  _m.makeScale(0, 0, 0); mesh.setMatrixAt(base + 10, _m);
}

// ------------------------------------------------------------------ paths
function ringPath() {
  const zN = ROAD_RING.N.z0 + 3.5, zS = ROAD_RING.S.z1 - 3.5, xE = ROAD_RING.E.x1 - 3.5, xW = ROAD_RING.W.x0 + 3.5;
  return makePath([[xW, zN], [xE, zN], [xE, zS], [xW, zS], [xW, zN]], 4);
}

export function makePath(pts, round = 0) {
  // optional corner rounding
  let P = pts;
  if (round > 0) {
    P = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const d1 = Math.hypot(b[0] - a[0], b[1] - a[1]), d2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const r = Math.min(round, d1 / 2, d2 / 2);
      const p1 = [b[0] - ((b[0] - a[0]) / d1) * r, b[1] - ((b[1] - a[1]) / d1) * r];
      const p2 = [b[0] + ((c[0] - b[0]) / d2) * r, b[1] + ((c[1] - b[1]) / d2) * r];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const x = (1 - t) * (1 - t) * p1[0] + 2 * (1 - t) * t * b[0] + t * t * p2[0];
        const z = (1 - t) * (1 - t) * p1[1] + 2 * (1 - t) * t * b[1] + t * t * p2[1];
        P.push([x, z]);
      }
    }
    P.push(pts[pts.length - 1]);
  }
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  return { pts: P, cum, len: cum[cum.length - 1] };
}

// position at arc length u, laterally offset by `off` to the right of travel; returns [x, z, yaw]
export function samplePath(path, u, off = 0) {
  const { pts, cum } = path;
  let lo = 0, hi = cum.length - 1;
  u = Math.max(0, Math.min(path.len, u));
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= u) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi];
  const L = cum[hi] - cum[lo] || 1;
  const t = (u - cum[lo]) / L;
  const dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
  const x = a[0] + (b[0] - a[0]) * t - dz * off, z = a[1] + (b[1] - a[1]) * t + dx * off;
  return [x, z, Math.atan2(dx, dz)];
}

export function offsetPath(pts, off) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    out.push([pts[i][0] - (dz / L) * off, pts[i][1] + (dx / L) * off]);
  }
  return makePath(out);
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}
