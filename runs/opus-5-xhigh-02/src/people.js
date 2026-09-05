// Population: articulated voxel pedestrians, cafe patrons, tourists photographing
// the church, children by the water, cyclists and a few pigeons. Every body part is
// its own instanced pool, so limbs animate without adding draw calls.

import * as THREE from 'three';
import { P } from './palette.js';
import { Rng } from './rng.js';
import { bakeModel, Pool } from './instances.js';
import { PLAZA, CHURCH, MONUMENT, FOUNTAIN, ROMAN_WINDOW } from './layout.js';
import { walkable, heightAt } from './ground.js';
import { makeRadialSprite } from './textures.js';

const SKIN = ['#e8c4a2', '#d9a97f', '#c08e63', '#8d5f3e', '#f0d3b4', '#a97147'];
const SHIRT = ['#4a6c8f', '#8f4a4a', '#3f5f4a', '#6b5b8f', '#c9b48a', '#8a8f96', '#2f4858', '#b06a4a', '#5d7a5d', '#d8d3c4', '#7a4a63', '#2f6b6b'];
const TROUSER = ['#3a3f4a', '#4a4038', '#5a5a5a', '#2f3a4a', '#6b5f4a', '#3d3d3d', '#54607a'];

// The model is baked pale so that per-instance colour carries the hue; darker
// voxels (shoes, hair, straps) stay proportionally darker after tinting.
const PALE = P.ivory;
const MID = P.softGrey;
const DARK = P.ironDark;

const parts = {
  torso: (b) => {
    b.box(-0.175, 0.00, -0.105, 0.175, 0.30, 0.105, PALE);
    b.box(-0.185, 0.28, -0.110, 0.185, 0.56, 0.110, PALE);
    b.box(-0.215, 0.46, -0.105, 0.215, 0.58, 0.105, PALE);
    b.box(-0.06, 0.10, -0.115, 0.06, 0.40, -0.105, MID);   // placket
    b.box(-0.19, 0.00, -0.11, 0.19, 0.06, 0.11, MID);      // waist
  },
  head: (b) => {
    b.box(-0.095, 0.00, -0.09, 0.095, 0.075, 0.09, PALE);  // neck/jaw
    b.box(-0.105, 0.05, -0.10, 0.105, 0.235, 0.10, PALE);
    b.box(-0.115, 0.185, -0.11, 0.115, 0.275, 0.11, DARK); // hair
    b.box(-0.115, 0.12, -0.115, 0.115, 0.20, -0.095, DARK);
    b.box(-0.115, 0.12, 0.095, 0.115, 0.21, 0.115, DARK);
  },
  arm: (b) => {
    b.box(-0.062, -0.34, -0.062, 0.062, 0.00, 0.062, PALE);
    b.box(-0.058, -0.58, -0.058, 0.058, -0.32, 0.058, PALE);
    b.box(-0.062, -0.66, -0.062, 0.062, -0.56, 0.062, MID); // hand
  },
  leg: (b) => {
    b.box(-0.078, -0.44, -0.078, 0.078, 0.00, 0.078, MID);
    b.box(-0.072, -0.80, -0.072, 0.072, -0.42, 0.072, MID);
    b.box(-0.080, -0.86, -0.095, 0.080, -0.78, 0.075, DARK); // shoe
  },
};

const PART_ORDER = ['torso', 'head', 'armL', 'armR', 'legL', 'legR'];

export function buildPeopleModels() {
  return {
    torso: bakeModel(0.055, parts.torso),
    head: bakeModel(0.048, parts.head),
    arm: bakeModel(0.05, parts.arm),
    leg: bakeModel(0.05, parts.leg),
    pigeon: bakeModel(0.045, (b) => {
      b.ellipsoid(0, 0.13, 0, 0.105, 0.085, 0.08, P.greyStone);
      b.box(-0.03, 0.19, -0.05, 0.03, 0.27, 0.05, P.greyStone);
      b.box(-0.03, 0.225, -0.08, 0.03, 0.275, -0.04, P.paleBlueGrey);
      b.box(-0.018, 0.235, -0.11, 0.018, 0.26, -0.07, P.ochreDeep);
      b.box(-0.05, 0.105, 0.045, 0.05, 0.165, 0.165, P.greyStoneDark);
      b.box(-0.02, 0.0, -0.03, 0.02, 0.065, 0.03, P.ochreDeep);
      b.box(0.045, 0.105, -0.065, 0.08, 0.18, 0.06, P.softGrey);
      b.box(-0.08, 0.105, -0.065, -0.045, 0.18, 0.06, P.softGrey);
    }),
    cyclist: bakeModel(0.06, (b) => {
      // bicycle
      const wheel = (cx) => {
        for (let a = 0; a < Math.PI * 2; a += 0.13) {
          const x = cx + Math.cos(a) * 0.33, y = 0.35 + Math.sin(a) * 0.33;
          b.box(x - 0.05, y - 0.05, -0.035, x + 0.05, y + 0.05, 0.035, P.ironDark);
        }
      };
      wheel(-0.52); wheel(0.52);
      b.box(-0.50, 0.36, -0.035, 0.24, 0.44, 0.035, P.iron);
      b.box(-0.10, 0.44, -0.035, 0.26, 0.80, 0.035, P.iron);
      b.box(0.44, 0.62, -0.03, 0.56, 0.94, 0.03, P.iron);
      b.box(0.44, 0.92, -0.24, 0.58, 0.99, 0.24, P.ironDark);
      // rider
      b.box(-0.20, 0.82, -0.16, 0.16, 1.32, 0.16, P.awningGreen);
      b.box(-0.18, 1.28, -0.13, 0.14, 1.52, 0.13, P.ochre);
      b.box(-0.10, 1.50, -0.10, 0.12, 1.70, 0.10, P.dustyPink);
      b.box(-0.12, 1.66, -0.12, 0.14, 1.76, 0.12, P.ironDark);
      b.box(0.10, 1.06, -0.20, 0.50, 1.20, -0.09, P.ochre);
      b.box(0.10, 1.06, 0.09, 0.50, 1.20, 0.20, P.ochre);
      b.box(-0.14, 0.52, -0.20, 0.20, 0.88, -0.07, P.ironDark);
      b.box(-0.14, 0.52, 0.07, 0.20, 0.88, 0.20, P.ironDark);
    }),
  };
}

const ATTRACTORS = [
  [-20, 26], [-20, 2], [-2, 14], [-40, 14], [10, -4], [30, -4], [-8, -4],
  [-60, 30], [-60, -20], [-60, 50], [60, 20], [60, -40], [70, 50],
  [20, 30], [26, 62], [-30, 62], [40, -50], [-40, -50], [0, -50],
  [-44, 34], [-88, 0], [88, 0], [0, -58], [0, 58], [-50, -8], [46, 40],
];

function spotFree(x, z) {
  if (x < PLAZA.x0 - 6 || x > PLAZA.x1 + 6 || z < PLAZA.z0 - 6 || z > PLAZA.z1 + 6) return false;
  const C = CHURCH.nave, A = CHURCH.apse, T = CHURCH.tower;
  if (x > C.x0 - 3.6 && x < C.x1 + 3.6 && z > C.z0 - 3.6 && z < C.z1 + 3.6) return false;
  if (x > A.x0 - 3 && x < A.x1 + 3 && z > A.z0 - 3 && z < A.z1 + 3) return false;
  if (x > T.x0 - 3 && x < T.x1 + 3 && z > T.z0 - 3 && z < T.z1 + 3) return false;
  const M = MONUMENT.pedestal;
  if (x > M.x0 - 4.5 && x < M.x1 + 4.5 && z > M.z0 - 4.5 && z < M.z1 + 4.5) return false;
  if (x > FOUNTAIN.x0 - 1.6 && x < FOUNTAIN.x1 + 1.6 && z > FOUNTAIN.z0 - 1.6 && z < FOUNTAIN.z1 + 1.6) return false;
  if (x > ROMAN_WINDOW.x0 - 2 && x < ROMAN_WINDOW.x1 + 2 && z > ROMAN_WINDOW.z0 - 2 && z < ROMAN_WINDOW.z1 + 2) return false;
  return walkable(x, z);
}

export class Crowd {
  constructor(models, matLib, parent, count = 165) {
    const rng = new Rng('crowd');
    this.rng = rng;
    this.figMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 2, specular: 0x080808 });
    this.pools = {
      torso: new Pool({ parts: models.torso, capacity: count, matLib, material: this.figMat, dynamic: true, frustumCulled: false, name: 'ped-torso' }),
      head: new Pool({ parts: models.head, capacity: count, matLib, material: this.figMat, dynamic: true, frustumCulled: false, name: 'ped-head' }),
      armL: new Pool({ parts: models.arm, capacity: count, matLib, material: this.figMat, dynamic: true, frustumCulled: false, name: 'ped-armL' }),
      armR: new Pool({ parts: models.arm, capacity: count, matLib, material: this.figMat, dynamic: true, frustumCulled: false, name: 'ped-armR' }),
      legL: new Pool({ parts: models.leg, capacity: count, matLib, material: this.figMat, dynamic: true, frustumCulled: false, name: 'ped-legL' }),
      legR: new Pool({ parts: models.leg, capacity: count, matLib, material: this.figMat, dynamic: true, frustumCulled: false, name: 'ped-legR' }),
    };
    for (const k of PART_ORDER) this.pools[k].addTo(parent);

    // contact shadows
    const shTex = makeRadialSprite([0, 0, 0], [0, 0, 0], 64, 2.0);
    this.shadowMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.30, color: 0x000000, fog: true });
    const q = new THREE.PlaneGeometry(1, 1);
    q.rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(q, this.shadowMat, count + 40);
    this.shadows.frustumCulled = false;
    this.shadows.renderOrder = 2;
    parent.add(this.shadows);

    this.agents = [];
    const seats = [];
    // cafe chairs and benches: attach sitters to plausible spots
    for (const [sx, sz] of [[-88, -20], [-88, 14], [-88, 44], [-46, 58], [54, 58], [-50, -58], [40, -58], [88, 8]]) {
      for (let i = 0; i < 5; i++) seats.push([sx + rng.range(-2.5, 8), sz + rng.range(-2.5, 8)]);
    }
    for (const [sx, sz] of [[-28, -44.5], [-14, -44.5], [0, -44.5], [16, -44.5], [4, 64], [18, 64], [32, 64], [-70, 30], [76, 30]]) {
      seats.push([sx + rng.range(-0.6, 0.6), sz + 0.05]);
    }
    rng.shuffle(seats);

    for (let i = 0; i < count; i++) {
      const kind = i < 34 ? 'sit' : (i < 46 ? 'photo' : (i < 54 ? 'child' : 'walk'));
      let x, z, tries = 0;
      if (kind === 'sit' && seats.length) {
        [x, z] = seats.pop();
      } else if (kind === 'photo') {
        const a = rng.range(0, Math.PI * 2), r = rng.range(16, 34);
        x = MONUMENT.centre[0] + Math.cos(a) * r; z = MONUMENT.centre[1] + Math.sin(a) * r;
        if (!spotFree(x, z)) { x = -20 + rng.range(-16, 16); z = 30 + rng.range(-6, 6); }
      } else if (kind === 'child') {
        x = (FOUNTAIN.x0 + FOUNTAIN.x1) / 2 + rng.range(-16, 16);
        z = (FOUNTAIN.z0 + FOUNTAIN.z1) / 2 + rng.range(-13, 13);
        if (!spotFree(x, z)) { x = 30; z = 30; }
      } else {
        do {
          x = rng.range(PLAZA.x0 + 3, PLAZA.x1 - 3);
          z = rng.range(PLAZA.z0 + 3, PLAZA.z1 - 3);
          tries++;
        } while (!spotFree(x, z) && tries < 40);
      }
      const a = this.agents[i] = {
        kind, x, z, heading: rng.range(0, Math.PI * 2),
        speed: kind === 'child' ? rng.range(1.3, 2.0) : rng.range(0.85, 1.55),
        phase: rng.range(0, Math.PI * 2),
        scale: kind === 'child' ? rng.range(0.62, 0.76) : rng.range(0.94, 1.06),
        tx: x, tz: z, wait: rng.range(0, 5),
        skin: new THREE.Color(rng.pick(SKIN)),
        shirt: new THREE.Color(rng.pick(SHIRT)),
        trouser: new THREE.Color(rng.pick(TROUSER)),
        group: rng.chance(0.3) ? rng.int(0, 20) : -1,
      };
      if (kind === 'walk' || kind === 'child') this.pickTarget(a);
      this.pools.torso.setColor(i, a.shirt);
      this.pools.head.setColor(i, a.skin);
      this.pools.armL.setColor(i, a.shirt);
      this.pools.armR.setColor(i, a.shirt);
      this.pools.legL.setColor(i, a.trouser);
      this.pools.legR.setColor(i, a.trouser);
    }
    for (const k of PART_ORDER) { this.pools[k].setCount(count); this.pools[k].commit(true); }

    // pigeons
    const pn = 34;
    this.pigeonPool = new Pool({ parts: models.pigeon, capacity: pn, matLib, dynamic: true, frustumCulled: false, name: 'pigeon' });
    this.pigeonPool.addTo(parent);
    this.pigeons = [];
    for (let i = 0; i < pn; i++) {
      let x, z, t = 0;
      do { x = rng.range(-70, 70); z = rng.range(-52, 60); t++; } while (!spotFree(x, z) && t < 30);
      this.pigeons.push({ x, z, heading: rng.range(0, 6.28), phase: rng.range(0, 6.28), hop: rng.range(0.6, 1.4), fly: 0 });
    }
    this.pigeonPool.setCount(pn);

    // cyclists on the perimeter carriageway
    const cn = 9;
    this.cyclePool = new Pool({ parts: models.cyclist, capacity: cn, matLib, dynamic: true, frustumCulled: false, name: 'cyclist' });
    this.cyclePool.addTo(parent);
    this.cyclists = [];
    for (let i = 0; i < cn; i++) {
      this.cyclists.push({ t: rng.f(), speed: rng.range(0.010, 0.019), lane: rng.range(-1.4, 1.4) });
    }
    this.cyclePool.setCount(cn);

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._base = new THREE.Matrix4();
    this._tmp = new THREE.Matrix4();
    this.count = count;
    this.visibleCount = count;
  }

  pickTarget(a) {
    const r = this.rng;
    for (let i = 0; i < 12; i++) {
      let tx, tz;
      if (r.chance(0.55)) {
        const at = ATTRACTORS[r.int(0, ATTRACTORS.length - 1)];
        tx = at[0] + r.range(-7, 7); tz = at[1] + r.range(-7, 7);
      } else {
        tx = r.range(PLAZA.x0 + 3, PLAZA.x1 - 3);
        tz = r.range(PLAZA.z0 + 3, PLAZA.z1 - 3);
      }
      if (spotFree(tx, tz)) { a.tx = tx; a.tz = tz; return; }
    }
    a.tx = a.x; a.tz = a.z;
  }

  update(dt, time, camPos) {
    const m = this._m, q = this._q, v = this._v, s = this._s, base = this._base, tmp = this._tmp;
    const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3(1, 0, 0);
    const shadowM = new THREE.Matrix4();
    let shadowN = 0;

    for (let i = 0; i < this.count; i++) {
      const a = this.agents[i];
      const dCam = Math.hypot(a.x - camPos.x, a.z - camPos.z);
      const sc = a.scale;
      let moving = 0;

      if (a.kind === 'walk' || a.kind === 'child') {
        const dx = a.tx - a.x, dz = a.tz - a.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.0) {
          a.wait -= dt;
          if (a.wait <= 0) { this.pickTarget(a); a.wait = this.rng.range(0.5, 6); }
        } else {
          const step = a.speed * dt;
          const nx = a.x + (dx / d) * step, nz = a.z + (dz / d) * step;
          if (spotFree(nx, nz)) { a.x = nx; a.z = nz; moving = 1; }
          else this.pickTarget(a);
          const want = Math.atan2(dx, dz);
          let diff = want - a.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          a.heading += diff * Math.min(1, dt * 5);
        }
      } else if (a.kind === 'photo') {
        const want = Math.atan2(CHURCH.centre[0] - a.x, CHURCH.centre[1] - a.z);
        a.heading += (want - a.heading) * Math.min(1, dt * 2);
      }

      const y = heightAt(a.x, a.z);
      const sit = a.kind === 'sit';
      const bob = moving ? Math.sin(time * 8 * a.speed + a.phase) * 0.022 : 0;
      const hipY = y + (sit ? 0.52 : 0.86 * sc) + bob;

      q.setFromAxisAngle(up, a.heading);
      v.set(a.x, hipY, a.z);
      s.set(sc, sc, sc);
      base.compose(v, q, s);

      // torso
      this.pools.torso.setMatrix(i, base);
      // head
      tmp.makeTranslation(0, 0.58, 0);
      m.multiplyMatrices(base, tmp);
      if (a.kind === 'photo') {
        tmp.makeRotationX(0.16);
        m.multiply(tmp);
      }
      this.pools.head.setMatrix(i, m);

      const swing = moving ? Math.sin(time * 5.4 * a.speed + a.phase) * 0.52 : Math.sin(time * 0.8 + a.phase) * 0.05;
      // arms
      for (const [k, side, sgn] of [['armL', -0.235, -1], ['armR', 0.235, 1]]) {
        tmp.makeTranslation(side, 0.52, 0);
        m.multiplyMatrices(base, tmp);
        let ang = swing * sgn;
        // arms forward and up, hands together at eye level - taking a picture
        if (a.kind === 'photo') ang = sgn > 0 ? 1.42 : 1.34;
        if (sit) ang = 0.62 + swing * 0.12 * sgn;
        tmp.makeRotationX(ang);
        m.multiply(tmp);
        this.pools[k].setMatrix(i, m);
      }
      // legs
      for (const [k, side, sgn] of [['legL', -0.10, 1], ['legR', 0.10, -1]]) {
        tmp.makeTranslation(side, 0.0, 0);
        m.multiplyMatrices(base, tmp);
        tmp.makeRotationX(sit ? 1.42 : swing * sgn);
        m.multiply(tmp);
        this.pools[k].setMatrix(i, m);
      }

      if (dCam < 190 && shadowN < this.shadows.count + 40) {
        shadowM.makeScale(1.25 * sc, 1, 1.25 * sc);
        shadowM.setPosition(a.x, y + 0.035, a.z);
        this.shadows.setMatrixAt(shadowN++, shadowM);
      }
    }

    // pigeons
    for (let i = 0; i < this.pigeons.length; i++) {
      const p = this.pigeons[i];
      p.phase += dt * p.hop;
      if (p.fly > 0) {
        p.fly -= dt;
        p.x += Math.sin(p.heading) * dt * 6;
        p.z += Math.cos(p.heading) * dt * 6;
        if (!spotFree(p.x, p.z)) { p.heading += 2.4; }
      } else if (Math.sin(p.phase) > 0.985) {
        p.heading += this.rng.range(-1.2, 1.2);
        const nx = p.x + Math.sin(p.heading) * 0.5, nz = p.z + Math.cos(p.heading) * 0.5;
        if (spotFree(nx, nz)) { p.x = nx; p.z = nz; }
        if (this.rng.chance(0.012)) p.fly = 1.2;
      }
      const hop = p.fly > 0 ? 1.4 + Math.sin(time * 14) * 0.3 : Math.max(0, Math.sin(p.phase * 3) * 0.09);
      q.setFromAxisAngle(up, p.heading);
      v.set(p.x, heightAt(p.x, p.z) + hop, p.z);
      s.set(1, 1, 1);
      m.compose(v, q, s);
      this.pigeonPool.setMatrix(i, m);
    }
    this.pigeonPool.commit();

    // cyclists loop the perimeter carriageway
    for (let i = 0; i < this.cyclists.length; i++) {
      const c = this.cyclists[i];
      c.t = (c.t + c.speed * dt) % 1;
      const rx = 103 - 0.2, rz = 73 - 0.2;
      const per = 2 * (2 * rx + 2 * rz);
      let d = c.t * per;
      let x, z, hd;
      const w1 = 2 * rx, w2 = w1 + 2 * rz, w3 = w2 + 2 * rx;
      if (d < w1) { x = -rx + d; z = -rz + c.lane; hd = Math.PI / 2; }
      else if (d < w2) { x = rx - c.lane; z = -rz + (d - w1); hd = 0; }
      else if (d < w3) { x = rx - (d - w2); z = rz - c.lane; hd = -Math.PI / 2; }
      else { x = -rx + c.lane; z = rz - (d - w3); hd = Math.PI; }
      q.setFromAxisAngle(up, hd);
      v.set(x, heightAt(x, z), z);
      s.set(1, 1, 1);
      m.compose(v, q, s);
      this.cyclePool.setMatrix(i, m);
      if (shadowN < this.shadows.instanceMatrix.count) {
        shadowM.makeScale(2.2, 1, 1.1);
        shadowM.setPosition(x, heightAt(x, z) + 0.035, z);
        this.shadows.setMatrixAt(shadowN++, shadowM);
      }
    }
    this.cyclePool.commit();

    for (const k of PART_ORDER) this.pools[k].commit();
    this.shadows.count = shadowN;
    this.shadows.instanceMatrix.needsUpdate = true;
  }

  setVisible(v) {
    for (const k of PART_ORDER) this.pools[k].visible = v;
    this.pigeonPool.visible = v;
    this.cyclePool.visible = v;
    this.shadows.visible = v;
  }

  setShadowOpacity(o) { this.shadowMat.opacity = o; }

  dispose(parent) {
    for (const k of PART_ORDER) this.pools[k].dispose(parent);
    this.pigeonPool.dispose(parent);
    this.cyclePool.dispose(parent);
    parent.remove(this.shadows);
    this.shadows.geometry.dispose();
    this.shadowMat.map.dispose();
    this.shadowMat.dispose();
    this.figMat.dispose();
  }
}
