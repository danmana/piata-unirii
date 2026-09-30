// Restrained traffic: compact European cars, taxis and delivery vans on the
// one-way ring road around the square and the radiating streets, buses on the
// outer boulevards. Vehicles follow lane polylines only (never the pedestrian
// plaza or pedestrian streets), keep their distance and stop at crossings.

import * as THREE from 'three';
import { POOL } from '../core/mat.js';
import { RNG, mixSeed } from '../core/rng.js';
import { ROAD_RING, STREET_BY_ID } from '../plan/site.js';
import { makePath, samplePath } from './people.js';

const CAR_COLS = ['#c9ccd0', '#f1f1ef', '#1e1f22', '#4a4e54', '#1f2d4a', '#6e1f1f', '#8c8f93', '#2f4d3a', '#b7a78c', '#3d5a80', '#ecebe6', '#5a1e2e'];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _Y = new THREE.Vector3(0, 1, 0);

const CROSSINGS = [
  ...[-62, -6, 52].flatMap((x) => [[x, ROAD_RING.N.z0, x + 4, ROAD_RING.N.z1], [x, ROAD_RING.S.z0, x + 4, ROAD_RING.S.z1]]),
  ...[-42, 30].flatMap((z) => [[ROAD_RING.W.x0, z, ROAD_RING.W.x1, z + 4], [ROAD_RING.E.x0, z, ROAD_RING.E.x1, z + 4]]),
];

export class Traffic {
  constructor(app, plan, templates) {
    this.app = app;
    this.scene = app.scene;
    const rng = this.rng = new RNG(mixSeed(plan.varSeed, 0xca75));
    // ---- lane network
    const zN = (ROAD_RING.N.z0 + ROAD_RING.N.z1) / 2, zS = (ROAD_RING.S.z0 + ROAD_RING.S.z1) / 2;
    const xE = (ROAD_RING.E.x0 + ROAD_RING.E.x1) / 2, xW = (ROAD_RING.W.x0 + ROAD_RING.W.x1) / 2;
    const loopPts = [[xW, zN], [xE, zN], [xE, zS], [xW, zS], [xW, zN]];
    const loop = makePath(loopPts, 6);
    this.loop = loop;
    const project = (x, z) => { // arc length of nearest loop point
      let best = 1e9, bu = 0;
      for (let u = 0; u < loop.len; u += 1) { const p = samplePath(loop, u); const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < best) { best = d; bu = u; } }
      return bu;
    };
    const streets = ['dec21', 'ferdinand', 'maniu', 'eroilor', 'memo', 'napoca'];
    const lanes = {};
    for (const id of streets) {
      const st = STREET_BY_ID[id];
      const off = st.kind === 'boulevard' ? 6.2 : 1.7;
      const out = offsetPts(st.pts, off);
      const inn = offsetPts([...st.pts].reverse(), off);
      lanes[id] = { out, inn, uJoin: project(st.pts[0][0], st.pts[0][1]) };
    }
    const loopSlice = (u0, u1) => {
      const pts = [];
      let u = u0;
      const L = loop.len;
      let span = u1 - u0; if (span <= 4) span += L;
      for (let k = 0; k <= span; k += 3) { const p = samplePath(loop, (u0 + k) % L, -0.6); pts.push([p[0], p[1]]); }
      return pts;
    };
    this.routes = [];
    for (const a of streets) for (const b of streets) {
      if (a === b) continue;
      const A = lanes[a], B = lanes[b];
      const pts = [...A.inn.slice(0, -1), ...loopSlice(A.uJoin + 5, B.uJoin - 5), ...B.out.slice(1)];
      this.routes.push({ path: makePath(pts, 3), kind: 'car', from: a, to: b });
    }
    // outer streets: independent through-lanes (and buses)
    this.outerRoutes = [];
    for (const id of ['o1', 'o2', 'o3', 'o4', 'n1', 's1', 'e1', 'w1']) {
      const st = STREET_BY_ID[id];
      this.outerRoutes.push({ path: makePath(offsetPts(st.pts, 1.8), 2), bus: id.startsWith('o') });
      this.outerRoutes.push({ path: makePath(offsetPts([...st.pts].reverse(), 1.8), 2), bus: id.startsWith('o') });
    }
    // ---- vehicles
    this.cars = [];
    const kinds = ['hatch', 'sedan', 'taxi', 'van'];
    const add = (route, u, kind) => {
      const col = kind === 'taxi' ? '#e8b52c' : kind === 'van' ? rng.pick(['#f1f1ef', '#e9e9e6', '#c9ccd0']) : kind === 'bus' ? '#dfe7ea' : rng.pick(CAR_COLS);
      this.cars.push({ route, u, kind, speed: 0, vmax: kind === 'bus' ? 8 : rng.range(7.5, 10.5), col, len: kind === 'bus' ? 12 : kind === 'van' ? 5.2 : 4.4, wait: 0 });
    };
    for (let i = 0; i < 26; i++) {
      const r = rng.pick(this.routes);
      add(r, rng.range(0, r.path.len * 0.8), rng.weighted(kinds, [5, 3, 1.4, 1.2]));
    }
    for (let i = 0; i < 26; i++) {
      const r = rng.pick(this.outerRoutes);
      add(r, rng.range(0, r.path.len), rng.weighted(kinds, [5, 3, 1.2, 1.2]));
    }
    for (let i = 0; i < 5; i++) {
      const r = rng.pick(this.outerRoutes.filter((q) => q.bus));
      add(r, rng.range(0, r.path.len), 'bus');
    }
    this.count = this.cars.length;
    // ---- rendering: dynamic instanced meshes per vehicle template and pool
    this.meshes = {};
    const byKind = {};
    for (const c of this.cars) (byKind[c.kind] = byKind[c.kind] || []).push(c);
    for (const kind of Object.keys(byKind)) {
      const tpl = templates.get('veh:' + kind);
      if (!tpl) continue;
      const list = byKind[kind];
      const parts = tpl.lods[0].map((part) => {
        const m = new THREE.InstancedMesh(part.geo, app.pools.list[part.pool], list.length);
        m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true;
        list.forEach((car, i) => m.setColorAt(i, _c.set(part.pool === POOL.paint ? car.col : '#ffffff')));
        this.scene.add(m);
        return m;
      });
      this.meshes[kind] = { list, parts };
    }
    // contact shadows
    const bt = blob();
    this.blobTex = bt;
    const bg = new THREE.PlaneGeometry(1, 1); bg.rotateX(-Math.PI / 2);
    this.blobs = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ map: bt, color: 0, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, fog: false }), this.cars.length);
    this.blobs.frustumCulled = false;
    this.scene.add(this.blobs);
    this.people = null;
    this.frame = 0;
  }

  update(dt, time) {
    const cars = this.cars;
    this.frame++;
    const people = this.app.scenery && this.app.scenery.people ? this.app.scenery.people.agents : [];
    for (const c of cars) {
      const p = samplePath(c.route.path, c.u);
      c.x = p[0]; c.z = p[1]; c.yaw = p[2];
    }
    for (const c of cars) {
      // look ahead for other vehicles
      let limit = c.vmax;
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      for (const o of cars) {
        if (o === c) continue;
        const dx = o.x - c.x, dz = o.z - c.z;
        const fwd = dx * fx + dz * fz;
        if (fwd <= 0 || fwd > 18) continue;
        const lat = Math.abs(dx * fz - dz * fx);
        if (lat > 2.0) continue;
        const gap = fwd - (c.len + o.len) / 2 - 2.5;
        limit = Math.min(limit, Math.max(0, gap * 0.9));
      }
      // stop for pedestrians on crossings ahead
      if ((this.frame + (c.u | 0)) % 4 === 0) {
        c.ped = false;
        const ax = c.x + fx * 7, az = c.z + fz * 7;
        for (const cr of CROSSINGS) {
          if (ax < cr[0] - 1 || ax > cr[2] + 1 || az < cr[1] - 1 || az > cr[3] + 1) continue;
          for (const a of people) {
            if (a.x > cr[0] - 0.5 && a.x < cr[2] + 0.5 && a.z > cr[1] - 1 && a.z < cr[3] + 1) { c.ped = true; break; }
          }
        }
      }
      if (c.ped) limit = 0;
      // slow in tight corners
      const ahead = samplePath(c.route.path, c.u + 8);
      let dy = ahead[2] - c.yaw; dy = Math.abs(Math.atan2(Math.sin(dy), Math.cos(dy)));
      limit = Math.min(limit, c.vmax * (1 - Math.min(0.65, dy * 0.9)));
      const acc = limit > c.speed ? 2.2 : 6.0;
      c.speed += Math.sign(limit - c.speed) * Math.min(Math.abs(limit - c.speed), acc * dt);
      c.u += c.speed * dt;
      if (c.u >= c.route.path.len - 0.5) this.respawn(c);
    }
    this.render();
  }

  respawn(c) {
    const rng = this.rng;
    const pool = c.kind === 'bus' ? this.outerRoutes.filter((r) => r.bus) : (this.routes.includes(c.route) ? this.routes : this.outerRoutes);
    for (let k = 0; k < 6; k++) {
      const r = rng.pick(pool);
      const p0 = samplePath(r.path, 0);
      let clear = true;
      for (const o of this.cars) if (o !== c && (o.x - p0[0]) ** 2 + (o.z - p0[1]) ** 2 < 15 * 15) { clear = false; break; }
      if (clear) { c.route = r; c.u = 0; c.speed = c.vmax * 0.6; return; }
    }
    c.u = c.route.path.len - 0.6; c.speed = 0;
  }

  render() {
    for (const kind of Object.keys(this.meshes)) {
      const { list, parts } = this.meshes[kind];
      list.forEach((c, i) => {
        _q.setFromAxisAngle(_Y, c.yaw - Math.PI / 2);
        _m.compose(_p.set(c.x, 0.02, c.z), _q, _s.set(1, 1, 1));
        for (const m of parts) m.setMatrixAt(i, _m);
      });
      for (const m of parts) m.instanceMatrix.needsUpdate = true;
    }
    this.cars.forEach((c, i) => {
      _q.setFromAxisAngle(_Y, c.yaw);
      _m.compose(_p.set(c.x, 0.03, c.z), _q, _s.set(c.kind === 'bus' ? 3.4 : 2.4, 1, c.len * 1.15));
      this.blobs.setMatrixAt(i, _m);
    });
    this.blobs.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const k of Object.keys(this.meshes)) for (const m of this.meshes[k].parts) { this.scene.remove(m); m.dispose(); }
    this.scene.remove(this.blobs); this.blobs.dispose(); this.blobs.geometry.dispose(); this.blobs.material.dispose(); this.blobTex.dispose();
  }
}

function offsetPts(pts, off) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    out.push([pts[i][0] - (dz / L) * off, pts[i][1] + (dx / L) * off]);
  }
  return out;
}

function blob() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
