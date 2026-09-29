// Runtime scenery: GPU-instanced voxel templates (trees, street furniture,
// vehicles) with per-instance frustum + distance culling and LOD, water
// surfaces, fountain jets, lamp light pools, people and traffic.

import * as THREE from 'three';
import { POOL_NAMES, POOL } from '../core/mat.js';
import { hashStr, mixSeed, RNG } from '../core/rng.js';
import { geometryFromArrays, voxelBoxGeometry, U } from '../render/materials.js';
import { People } from './people.js';
import { Traffic } from './traffic.js';

const PROP_KINDS = ['bench', 'lamp', 'streetlamp', 'uplight', 'bollard', 'bin', 'bike', 'rack', 'cafe', 'umbrella', 'planter', 'board', 'sign'];
const VEHICLES = ['hatch', 'sedan', 'taxi', 'van', 'bus'];
const TINTABLE = new Set([POOL.fabric, POOL.paint]);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _sphere = new THREE.Sphere();
const _frustum = new THREE.Frustum();
const _pm = new THREE.Matrix4();
const _c = new THREE.Color();

// A set of static instances of one template, redistributed among LOD meshes
class InstancedTemplate {
  constructor(scene, tpl, pools, items, opts = {}) {
    this.items = items;
    this.tpl = tpl;
    this.vs = tpl.vs;
    this.radius = tpl.radius;
    this.maxDist = opts.maxDist ?? 3000;
    this.meshes = [];
    const n = items.length;
    tpl.lods.forEach((parts, l) => {
      const row = [];
      for (const part of parts) {
        const mesh = new THREE.InstancedMesh(part.geo, pools.list[part.pool], n);
        mesh.count = 0;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        mesh.userData.pool = part.pool;
        mesh.matrixAutoUpdate = false;
        // colours: tint only for tintable pools
        for (let i = 0; i < n; i++) {
          const it = items[i];
          if (it.tint && TINTABLE.has(part.pool)) _c.set(it.tint);
          else if (part.pool === POOL.vegetation && it.shade) _c.setRGB(it.shade[0], it.shade[1], it.shade[2]);
          else _c.setRGB(1, 1, 1);
          mesh.setColorAt(i, _c);
        }
        if (mesh.instanceColor) { mesh.instanceColor.needsUpdate = true; mesh.userData.base = mesh.instanceColor.array.slice(); }
        scene.add(mesh);
        row.push(mesh);
      }
      this.meshes.push(row);
    });
    // pre-compose matrices
    this.mats = items.map((it) => {
      _q.setFromAxisAngle(_up, it.rot || 0);
      _s.setScalar(it.s || 1);
      _p.set(it.x, it.y, it.z);
      return new THREE.Matrix4().compose(_p, _q, _s);
    });
    // shadow proxies: every instance, rendered only by the shadow camera (layer 1)
    this.proxies = [];
    if (opts.cast !== false) {
      const pl = Math.min(1, tpl.lods.length - 1);
      for (const part of tpl.lods[pl]) {
        const pm = new THREE.InstancedMesh(part.geo, pools.list[part.pool], n);
        for (let i = 0; i < n; i++) pm.setMatrixAt(i, this.mats[i]);
        pm.castShadow = true; pm.receiveShadow = false;
        pm.layers.set(1);
        pm.computeBoundingSphere();
        pm.matrixAutoUpdate = false;
        scene.add(pm);
        this.proxies.push(pm);
      }
    }
    this.centers = items.map((it) => new THREE.Vector3(it.x, it.y + (tpl.height || 2) * 0.5 * (it.s || 1), it.z));
    this.rad = Math.max(tpl.radius || 1, (tpl.height || 2) * 0.6);
  }
  refresh(frustum, cam, K, bias) {
    const nL = this.meshes.length;
    const counts = new Array(nL).fill(0);
    const T = (this.lodT || 1.25) * bias;
    for (let i = 0; i < this.items.length; i++) {
      const c = this.centers[i];
      const r = this.rad * (this.items[i].s || 1);
      _sphere.set(c, r);
      if (!frustum.intersectsSphere(_sphere)) continue;
      const d = Math.max(1, c.distanceTo(cam) - r);
      if (d > this.maxDist) continue;
      let l = 0;
      if (nL > 1) l = Math.max(0, Math.min(nL - 1, Math.floor(Math.log2(Math.max(1e-6, (T * d) / (this.vs * K))))));
      const k = counts[l]++;
      for (const mesh of this.meshes[l]) {
        mesh.setMatrixAt(k, this.mats[i]);
        if (mesh.instanceColor) {
          const b = mesh.userData.base, a = mesh.instanceColor.array;
          a[k * 3] = b[i * 3]; a[k * 3 + 1] = b[i * 3 + 1]; a[k * 3 + 2] = b[i * 3 + 2];
        }
      }
    }
    for (let l = 0; l < nL; l++) {
      for (const mesh of this.meshes[l]) {
        mesh.count = counts[l];
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  }
  dispose(scene) {
    for (const row of this.meshes) for (const m of row) { scene.remove(m); m.dispose(); }
    for (const m of this.proxies) { scene.remove(m); m.dispose(); }
  }
}

export class Scenery {
  constructor(app, plan) {
    this.app = app;
    this.plan = plan;
    this.scene = app.scene;
    this.pools = app.pools;
    this.templates = new Map();
    this.sets = [];
    this.objects = [];
    this.stats = { people: 0, cars: 0 };
    this.refreshTimer = 0;
    this.lastCam = new THREE.Vector3(1e9, 0, 0);
    this.lastQuat = new THREE.Quaternion();
  }

  templateJobs() {
    const jobs = [];
    const vs = this.plan.varSeed;
    for (const sp of ['linden', 'plane', 'ornamental']) {
      for (let v = 0; v < 3; v++) jobs.push({ type: 'tree', species: sp, seed: mixSeed(hashStr(sp + v), vs), local: true, lods: 3, key: `tree:${sp}:${v}`, label: 'trees', cost: 1.2 });
    }
    for (const k of PROP_KINDS) jobs.push({ type: 'prop', kind: k, local: true, lods: 1, key: `prop:${k}`, label: 'street furniture', cost: 0.2 });
    for (const k of VEHICLES) jobs.push({ type: 'vehicle', kind: k, local: true, lods: 1, key: `veh:${k}`, label: 'vehicles', cost: 0.3 });
    return jobs;
  }

  addTemplate(job, res) {
    const lods = res.lods.map((lod) => lod.geo.map((p) => {
      const geo = geometryFromArrays(p);
      geo.computeBoundingSphere();
      return { pool: p.pool, geo };
    }));
    const vs0 = job.type === 'tree' ? (job.species === 'ornamental' ? 0.22 : 0.3) : 0.1;
    this.templates.set(job.key, { lods, vs: vs0, radius: res.meta?.radius ?? 1, height: res.meta?.height ?? 2, length: res.meta?.length });
  }

  build() {
    const plan = this.plan;
    const vr = new RNG(mixSeed(plan.varSeed, 0x51ce));
    // trees by template
    const byKey = new Map();
    for (const t of plan.trees) {
      const key = `tree:${t.species}:${t.v}`;
      if (!byKey.has(key)) byKey.set(key, []);
      const k = vr.range(0.9, 1.08);
      byKey.get(key).push({ ...t, shade: [k * vr.range(0.97, 1.03), k, k * vr.range(0.94, 1.02)] });
    }
    for (const [key, items] of byKey) {
      const tpl = this.templates.get(key);
      if (!tpl) continue;
      const set = new InstancedTemplate(this.scene, tpl, this.pools, items, { maxDist: 2200 });
      set.lodT = 2.2;
      this.sets.push(set);
    }
    // props
    const props = new Map();
    for (const p of plan.props) {
      if (!props.has(p.kind)) props.set(p.kind, []);
      props.get(p.kind).push(p);
    }
    for (const [kind, items] of props) {
      const tpl = this.templates.get('prop:' + kind);
      if (!tpl) continue;
      const small = kind === 'uplight' || kind === 'bollard' || kind === 'bike' || kind === 'bin' || kind === 'sign';
      tpl.height = kind === 'lamp' ? 6 : kind === 'streetlamp' ? 8.5 : kind === 'umbrella' ? 2.8 : 1.2;
      tpl.radius = kind === 'umbrella' ? 1.6 : kind === 'rack' ? 1.5 : 1;
      this.sets.push(new InstancedTemplate(this.scene, tpl, this.pools, items, { maxDist: small ? 420 : 900, cast: kind !== 'uplight' }));
    }
    this.buildWater();
    this.buildLightPools();
    this.people = new People(this.app, plan, this.templates);
    this.traffic = new Traffic(this.app, plan, this.templates);
    this.stats.people = this.people.count;
    this.stats.cars = this.traffic.count;
  }

  buildWater() {
    const plan = this.plan;
    const s = this.app.surfaces;
    const mk = (x0, z0, x1, z1, y, mat) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1);
      g.rotateX(-Math.PI / 2);
      g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
      addVoxAttrs(g);
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      m.renderOrder = 2;
      this.scene.add(m);
      this.objects.push(m);
      return m;
    };
    for (const w of plan.water) mk(w.x0, w.z0, w.x1, w.z1, w.y, s.water);
    const gl = plan.glass;
    mk(gl.x0, gl.z0, gl.x1, gl.z1, gl.y, s.glass);
    // jets: instanced water voxels
    this.jets = plan.jets;
    const per = 9;
    const geo = voxelBoxGeometry(13, 16);
    this.jetMesh = new THREE.InstancedMesh(geo, this.pools.list[POOL.water], this.jets.length * per);
    this.jetMesh.frustumCulled = false;
    this.jetMesh.castShadow = false;
    this.jetMesh.receiveShadow = false;
    this.jetPer = per;
    for (let i = 0; i < this.jetMesh.count; i++) this.jetMesh.setColorAt(i, _c.setRGB(1.6, 1.75, 1.85));
    this.scene.add(this.jetMesh);
    this.objects.push(this.jetMesh);
  }

  buildLightPools() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffc98a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false });
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const lamps = this.plan.lamps;
    const mesh = new THREE.InstancedMesh(geo, mat, lamps.length);
    lamps.forEach((l, i) => {
      const r = l.kind === 'streetlamp' ? 11 : 8;
      _m.compose(_p.set(l.x, (l.kind === 'streetlamp' ? 0.03 : 0.28) + (this.plan.groundHeight(l.x, l.z) - 0.25), l.z), _q.identity(), _s.set(r, 1, r));
      mesh.setMatrixAt(i, _m);
    });
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    this.poolMat = mat;
    this.poolTex = tex;
    this.scene.add(mesh);
    this.objects.push(mesh);
    this.lightPools = mesh;
  }

  update(dt, time, camera) {
    // instanced static sets: refresh culling when the camera moves (throttled)
    this.refreshTimer -= dt;
    const moved = camera.position.distanceToSquared(this.lastCam) > 0.25 || camera.quaternion.angleTo(this.lastQuat) > 0.01;
    if ((moved && this.refreshTimer <= 0) || this.refreshTimer < -1) {
      camera.updateMatrixWorld();
      _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_pm);
      const K = this.app.viewH / (2 * Math.tan((camera.fov * Math.PI) / 360));
      for (const s of this.sets) s.refresh(_frustum, camera.position, K, this.app.batches.lodBias);
      this.lastCam.copy(camera.position);
      this.lastQuat.copy(camera.quaternion);
      this.refreshTimer = 0.12;
    }
    // light pools follow the evening factor
    const night = U.uNight.value;
    this.poolMat.opacity = night * 0.55;
    this.lightPools.visible = night > 0.02;
    this.updateJets(time);
    this.people.update(dt, time, camera);
    this.traffic.update(dt, time, camera);
  }

  updateJets(t) {
    const per = this.jetPer;
    let k = 0;
    for (const j of this.jets) {
      const wave = j.small ? 0.5 + 0.5 * Math.sin(t * 1.1 + j.i * 0.5) : Math.max(0, Math.sin(t * 0.9 - j.i * 0.55 + Math.sin(t * 0.21 + j.k) * 1.2));
      const h = j.small ? 0.25 + wave * 0.5 : wave * 2.4;
      for (let s = 0; s < per; s++) {
        const f = s / (per - 1);
        let y = j.y + f * h, x = j.x, z = j.z, sc = 0.13 - f * 0.04;
        if (h < 0.05) { sc = 0.0001; }
        if (s >= per - 3 && h > 0.4) {
          const a = t * 3 + s * 2.1 + j.i;
          x += Math.cos(a) * 0.18; z += Math.sin(a) * 0.18; y = j.y + h * (0.88 + 0.06 * (s - per + 3));
        }
        _m.compose(_p.set(x, y, z), _q.identity(), _s.setScalar(sc));
        this.jetMesh.setMatrixAt(k++, _m);
      }
    }
    this.jetMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const s of this.sets) s.dispose(this.scene);
    for (const o of this.objects) { this.scene.remove(o); if (o.geometry) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); }
    if (this.poolMat) { this.poolMat.dispose(); this.poolTex.dispose(); }
    for (const t of this.templates.values()) for (const lod of t.lods) for (const p of lod) p.geo.dispose();
    this.people.dispose();
    this.traffic.dispose();
    this.templates.clear();
  }
}

export function addVoxAttrs(g, layer = 28) {
  const n = g.attributes.position.count;
  const misc = new Uint8Array(n * 4), vox = new Int16Array(n * 4), col = new Uint8Array(n * 3).fill(255);
  for (let i = 0; i < n; i++) { misc[i * 4] = 255; misc[i * 4 + 1] = layer; vox[i * 4 + 3] = 1000; }
  g.setAttribute('aMisc', new THREE.BufferAttribute(misc, 4, false));
  g.setAttribute('aVox', new THREE.BufferAttribute(vox, 4, false));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
}
