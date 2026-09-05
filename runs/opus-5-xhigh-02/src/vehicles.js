// Restrained traffic on the surrounding streets. Compact European cars, a taxi or
// two, delivery vans and buses further out. Vehicles follow the street polylines and
// never touch the pedestrian plaza.

import * as THREE from 'three';
import { P } from './palette.js';
import { Rng } from './rng.js';
import { bakeModel, Pool } from './instances.js';
import { STREETS, RING, polylineLength, polylineAt } from './layout.js';
import { heightAt } from './ground.js';
import { makeRadialSprite } from './textures.js';

const BODY = P.ivory;      // baked pale; per-instance colour supplies the paint
const GLASS = P.windowGlassDark;
const TYRE = P.ironDark;
const TRIM = P.steel;

function wheels(b, positions, r) {
  for (const [wx, wz] of positions) {
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      const y = r + Math.sin(a) * r * 0.92, x = wx + Math.cos(a) * r * 0.92;
      b.box(x - r * 0.3, y - r * 0.3, wz - 0.13, x + r * 0.3, y + r * 0.3, wz + 0.13, TYRE);
    }
    b.box(wx - r * 0.34, r - r * 0.34, wz - 0.16, wx + r * 0.34, r + r * 0.34, wz + 0.16, TRIM);
  }
}

function car(b, L, W, roofL, roofOff, h1, h2, roofMat) {
  const hw = W / 2;
  b.box(-L / 2, 0.30, -hw, L / 2, h1, hw, BODY);
  b.box(-L / 2 + 0.22, 0.20, -hw + 0.05, L / 2 - 0.22, 0.34, hw - 0.05, TYRE);
  b.box(roofOff - roofL / 2, h1, -hw + 0.08, roofOff + roofL / 2, h2, hw - 0.08, roofMat || BODY);
  // glazing
  b.box(roofOff - roofL / 2 + 0.06, h1 + 0.06, -hw + 0.02, roofOff + roofL / 2 - 0.06, h2 - 0.14, -hw + 0.10, GLASS);
  b.box(roofOff - roofL / 2 + 0.06, h1 + 0.06, hw - 0.10, roofOff + roofL / 2 - 0.06, h2 - 0.14, hw - 0.02, GLASS);
  b.box(roofOff + roofL / 2 - 0.10, h1 + 0.06, -hw + 0.08, roofOff + roofL / 2 - 0.02, h2 - 0.12, hw - 0.08, GLASS);
  b.box(roofOff - roofL / 2 + 0.02, h1 + 0.06, -hw + 0.08, roofOff - roofL / 2 + 0.10, h2 - 0.12, hw - 0.08, GLASS);
  // lamps and bumpers
  b.box(L / 2 - 0.10, 0.58, -hw + 0.12, L / 2, 0.78, -hw + 0.44, P.lampGlowCool);
  b.box(L / 2 - 0.10, 0.58, hw - 0.44, L / 2, 0.78, hw - 0.12, P.lampGlowCool);
  b.box(-L / 2, 0.58, -hw + 0.12, -L / 2 + 0.09, 0.78, -hw + 0.42, P.awningRed);
  b.box(-L / 2, 0.58, hw - 0.42, -L / 2 + 0.09, 0.78, hw - 0.12, P.awningRed);
  b.box(-L / 2 - 0.05, 0.34, -hw, -L / 2, 0.60, hw, TRIM);
  b.box(L / 2, 0.34, -hw, L / 2 + 0.05, 0.60, hw, TRIM);
}

export function buildVehicleModels() {
  return [
    // 0 compact hatchback
    bakeModel(0.09, (b) => { car(b, 3.85, 1.70, 1.85, -0.15, 0.86, 1.44); wheels(b, [[1.24, -0.86], [1.24, 0.86], [-1.20, -0.86], [-1.20, 0.86]], 0.31); }),
    // 1 saloon
    bakeModel(0.09, (b) => { car(b, 4.55, 1.76, 1.95, -0.25, 0.84, 1.42); wheels(b, [[1.48, -0.89], [1.48, 0.89], [-1.44, -0.89], [-1.44, 0.89]], 0.32); }),
    // 2 taxi (roof sign)
    bakeModel(0.09, (b) => {
      car(b, 4.45, 1.76, 1.95, -0.22, 0.84, 1.42);
      wheels(b, [[1.44, -0.89], [1.44, 0.89], [-1.40, -0.89], [-1.40, 0.89]], 0.32);
      b.box(-0.55, 1.42, -0.28, 0.35, 1.66, 0.28, P.lampGlow);
      b.box(-0.60, 0.86, -0.90, 0.60, 1.02, -0.86, P.lampGlowCool);
    }),
    // 3 delivery van
    bakeModel(0.10, (b) => {
      b.box(-2.60, 0.34, -0.94, 2.60, 1.02, 0.94, BODY);
      b.box(-2.60, 1.02, -0.94, 1.05, 2.44, 0.94, BODY);
      b.box(1.05, 1.02, -0.90, 2.30, 1.92, 0.90, BODY);
      b.box(2.24, 1.16, -0.84, 2.38, 1.80, 0.84, GLASS);
      b.box(1.10, 1.16, -0.96, 2.20, 1.78, -0.86, GLASS);
      b.box(1.10, 1.16, 0.86, 2.20, 1.78, 0.96, GLASS);
      b.box(2.44, 0.62, -0.80, 2.60, 0.90, -0.40, P.lampGlowCool);
      b.box(2.44, 0.62, 0.40, 2.60, 0.90, 0.80, P.lampGlowCool);
      b.box(-2.66, 0.70, -0.86, -2.56, 1.30, -0.44, P.awningRed);
      b.box(-2.66, 0.70, 0.44, -2.56, 1.30, 0.86, P.awningRed);
      wheels(b, [[1.65, -0.96], [1.65, 0.96], [-1.70, -0.96], [-1.70, 0.96]], 0.38);
    }),
    // 4 city bus
    bakeModel(0.12, (b) => {
      b.box(-5.6, 0.40, -1.26, 5.6, 3.10, 1.26, BODY);
      b.box(-5.6, 1.55, -1.32, 5.6, 2.45, -1.20, GLASS);
      b.box(-5.6, 1.55, 1.20, 5.6, 2.45, 1.32, GLASS);
      b.box(5.52, 1.45, -1.16, 5.66, 2.60, 1.16, GLASS);
      b.box(-5.66, 1.55, -1.16, -5.52, 2.45, 1.16, GLASS);
      b.box(-5.7, 3.10, -1.30, 5.7, 3.30, 1.30, TRIM);
      b.box(5.5, 2.62, -0.9, 5.68, 2.98, 0.9, P.lampGlow);
      b.box(5.6, 0.70, -1.10, 5.72, 1.06, -0.60, P.lampGlowCool);
      b.box(5.6, 0.70, 0.60, 5.72, 1.06, 1.10, P.lampGlowCool);
      wheels(b, [[3.9, -1.28], [3.9, 1.28], [-3.2, -1.28], [-3.2, 1.28]], 0.50);
    }),
  ];
}

const CAR_COLOURS = ['#c9ccd0', '#8e959c', '#3f4a58', '#7d4a44', '#4b6350', '#b6b1a4', '#2f3338', '#5a6f8c', '#a89a86', '#6c4f6b'];
const TAXI_COLOUR = '#d8bf52';
const VAN_COLOURS = ['#e2e0da', '#c8d2d8', '#d9cdb8', '#b8c4bc'];
const BUS_COLOURS = ['#5b7fa6', '#8a5b4a', '#68806a'];

export class Traffic {
  constructor(models, matLib, parent, count = 30) {
    const rng = new Rng('traffic');
    this.pools = models.map((m, i) => {
      const p = new Pool({ parts: m, capacity: count, matLib, dynamic: true, frustumCulled: false, name: 'veh' + i, castShadow: false });
      p.addTo(parent);
      return p;
    });

    const ringLoop = {
      name: 'ring', width: RING.width,
      pts: [[-RING.x, -RING.z], [RING.x, -RING.z], [RING.x, RING.z], [-RING.x, RING.z], [-RING.x, -RING.z]],
    };
    const routes = [ringLoop, ...STREETS.filter((s) => !s.ring && !s.ped)];
    this.routes = routes.map((r) => ({ r, len: polylineLength(r.pts), loop: r.name === 'ring' }));

    this.vehicles = [];
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const ri = rng.int(0, this.routes.length - 1);
      const route = this.routes[ri];
      let type;
      if (route.loop) type = rng.chance(0.14) ? 2 : rng.int(0, 1);
      else if (route.r.width >= 13 && rng.chance(0.22)) type = 4;
      else if (rng.chance(0.16)) type = 3;
      else type = rng.chance(0.16) ? 2 : rng.int(0, 1);
      const tint = type === 2 ? TAXI_COLOUR : type === 3 ? rng.pick(VAN_COLOURS) : type === 4 ? rng.pick(BUS_COLOURS) : rng.pick(CAR_COLOURS);
      this.vehicles.push({
        route, type, s: rng.f() * route.len,
        dir: route.loop ? 1 : (rng.chance(0.5) ? 1 : -1),
        lane: route.r.width * 0.24,
        speed: type === 4 ? rng.range(5.5, 7.5) : rng.range(6.5, 12),
        tint,
      });
    }
    // assign per-type slots
    this.slots = models.map(() => []);
    this.vehicles.forEach((v) => this.slots[v.type].push(v));
    this.slots.forEach((list, t) => {
      list.forEach((v, i) => {
        col.set(v.tint);
        this.pools[t].setColor(i, col);
      });
      this.pools[t].setCount(list.length);
      this.pools[t].commit(true);
    });

    const shTex = makeRadialSprite([0, 0, 0], [0, 0, 0], 64, 1.7);
    this.shadowMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.28, color: 0x000000 });
    const q = new THREE.PlaneGeometry(1, 1);
    q.rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(q, this.shadowMat, count);
    this.shadows.frustumCulled = false;
    this.shadows.renderOrder = 2;
    parent.add(this.shadows);

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
  }

  update(dt) {
    const m = this._m, q = this._q, v = this._v;
    const up = new THREE.Vector3(0, 1, 0);
    const sm = new THREE.Matrix4();
    let sn = 0;
    this.slots.forEach((list, t) => {
      list.forEach((veh, i) => {
        const L = veh.route.len;
        veh.s += veh.dir * veh.speed * dt;
        if (veh.s > L) {
          if (veh.route.loop) veh.s -= L; else { veh.s = L - 0.01; veh.dir = -1; }
        } else if (veh.s < 0) {
          if (veh.route.loop) veh.s += L; else { veh.s = 0.01; veh.dir = 1; }
        }
        const p = polylineAt(veh.route.r.pts, veh.s);
        const dx = p.dx * veh.dir, dz = p.dz * veh.dir;
        // keep to the right of the direction of travel
        const x = p.x - dz * veh.lane;
        const z = p.z + dx * veh.lane;
        const y = heightAt(x, z);
        q.setFromAxisAngle(up, Math.atan2(-dz, dx));
        v.set(x, y, z);
        m.compose(v, q, this._s);
        this.pools[t].setMatrix(i, m);
        const len = t === 4 ? 12 : t === 3 ? 6 : 4.6;
        sm.makeScale(len, 1, 2.6);
        sm.setPosition(x, y + 0.04, z);
        if (sn < this.shadows.instanceMatrix.count) this.shadows.setMatrixAt(sn++, sm);
      });
      this.pools[t].commit();
    });
    this.shadows.count = sn;
    this.shadows.instanceMatrix.needsUpdate = true;
  }

  setVisible(v) {
    for (const p of this.pools) p.visible = v;
    this.shadows.visible = v;
  }
  setShadowOpacity(o) { this.shadowMat.opacity = o; }

  dispose(parent) {
    for (const p of this.pools) p.dispose(parent);
    parent.remove(this.shadows);
    this.shadows.geometry.dispose();
    this.shadowMat.map.dispose();
    this.shadowMat.dispose();
  }
}
