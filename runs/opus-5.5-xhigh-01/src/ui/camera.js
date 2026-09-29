// God-mode orbit camera: left-drag rotate, right-drag pan, wheel zoom (towards
// the cursor), damping, presets with eased transitions and a cinematic flyover.

import * as THREE from 'three';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class GodCamera {
  constructor(camera, dom, opts = {}) {
    this.cam = camera;
    this.dom = dom;
    this.target = new THREE.Vector3();
    this.goal = { target: new THREE.Vector3(), dist: 300, theta: 0, phi: 1 };
    this.cur = { target: new THREE.Vector3(), dist: 300, theta: 0, phi: 1 };
    this.minDist = 3; this.maxDist = 4200;
    this.minPhi = 0.04; this.maxPhi = 1.555;
    this.groundAt = opts.groundAt || (() => 0);
    this.onInteract = opts.onInteract || (() => {});
    this.tween = null;
    this.fly = null;
    this.enabled = true;
    this._drag = null;
    this._ray = new THREE.Raycaster();
    this._bind();
  }
  _bind() {
    const d = this.dom;
    d.addEventListener('contextmenu', (e) => e.preventDefault());
    d.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      d.setPointerCapture(e.pointerId);
      const mode = e.button === 2 || e.shiftKey || e.ctrlKey ? 'pan' : (e.button === 1 ? 'pan' : 'rotate');
      this._drag = { x: e.clientX, y: e.clientY, mode, id: e.pointerId };
      this._interrupt();
    });
    d.addEventListener('pointermove', (e) => {
      if (!this._drag || this._drag.id !== e.pointerId) return;
      const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
      this._drag.x = e.clientX; this._drag.y = e.clientY;
      if (this._drag.mode === 'rotate') {
        this.goal.theta -= dx * 0.0052;
        this.goal.phi = THREE.MathUtils.clamp(this.goal.phi - dy * 0.0042, this.minPhi, this.maxPhi);
      } else {
        this._pan(dx, dy);
      }
    });
    const end = (e) => { if (this._drag && this._drag.id === e.pointerId) this._drag = null; };
    d.addEventListener('pointerup', end);
    d.addEventListener('pointercancel', end);
    d.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this._interrupt();
      const k = Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0016);
      const nd = THREE.MathUtils.clamp(this.goal.dist * k, this.minDist, this.maxDist);
      // zoom towards the point under the cursor
      const hit = this._pick(e.clientX, e.clientY);
      if (hit && k < 1) {
        const f = 1 - nd / this.goal.dist;
        this.goal.target.lerp(hit, f * 0.9);
        this.goal.target.y = THREE.MathUtils.clamp(this.goal.target.y, 0, 60);
      }
      this.goal.dist = nd;
    }, { passive: false });
  }
  _interrupt() {
    this.tween = null;
    if (this.fly) { this.fly = null; this._syncFromCamera(); }
    this.onInteract();
  }
  _pick(cx, cy) {
    const r = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this._ray.setFromCamera(ndc, this.cam);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -Math.min(8, this.goal.target.y));
    const p = new THREE.Vector3();
    return this._ray.ray.intersectPlane(plane, p) ? p : null;
  }
  _pan(dx, dy) {
    const s = (this.cur.dist * 2 * Math.tan((this.cam.fov * Math.PI) / 360)) / this.dom.clientHeight;
    const th = this.cur.theta;
    const right = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th));
    const fwd = new THREE.Vector3(-Math.sin(th), 0, -Math.cos(th));
    const lift = Math.max(0.35, Math.cos(this.cur.phi));
    this.goal.target.addScaledVector(right, -dx * s);
    this.goal.target.addScaledVector(fwd, (dy * s) / lift);
    this.goal.target.x = THREE.MathUtils.clamp(this.goal.target.x, -2500, 2500);
    this.goal.target.z = THREE.MathUtils.clamp(this.goal.target.z, -2500, 2500);
  }
  // spherical: theta = azimuth (0 => camera on +z side looking -z), phi = polar from +y
  set(target, dist, theta, phi, instant = false) {
    this.goal.target.copy(target); this.goal.dist = dist; this.goal.theta = theta; this.goal.phi = phi;
    if (instant) {
      this.cur.target.copy(target); this.cur.dist = dist; this.cur.theta = theta; this.cur.phi = phi;
      this._apply();
    }
  }
  transition(target, dist, theta, phi, dur = 2.6) {
    this.fly = null;
    // shortest azimuth path
    let dth = theta - this.cur.theta;
    dth = Math.atan2(Math.sin(dth), Math.cos(dth));
    this.tween = {
      t: 0, dur,
      from: { target: this.cur.target.clone(), dist: this.cur.dist, theta: this.cur.theta, phi: this.cur.phi },
      to: { target: target.clone(), dist, theta: this.cur.theta + dth, phi },
    };
  }
  lookFrom(position, target, dur = 2.6) {
    const off = position.clone().sub(target);
    const dist = off.length();
    const phi = Math.acos(THREE.MathUtils.clamp(off.y / dist, -1, 1));
    const theta = Math.atan2(off.x, off.z);
    if (dur <= 0) this.set(target, dist, theta, phi, true);
    else this.transition(target, dist, theta, phi, dur);
  }
  startFlyover(center) {
    this.tween = null;
    this.fly = { t: 0, center: center.clone(), theta0: this.cur.theta };
  }
  stopFlyover() {
    if (this.fly) { this.fly = null; this._syncFromCamera(); }
  }
  _syncFromCamera() {
    const dir = new THREE.Vector3();
    this.cam.getWorldDirection(dir);
    const p = this.cam.position;
    // place target where the view ray meets y = 10 (or 150 m ahead)
    let t = dir.y < -0.05 ? (10 - p.y) / dir.y : 150;
    t = THREE.MathUtils.clamp(t, 20, 1500);
    const target = p.clone().addScaledVector(dir, t);
    const off = p.clone().sub(target);
    const dist = off.length();
    this.goal.target.copy(target); this.cur.target.copy(target);
    this.goal.dist = this.cur.dist = dist;
    this.goal.phi = this.cur.phi = Math.acos(THREE.MathUtils.clamp(off.y / dist, -1, 1));
    this.goal.theta = this.cur.theta = Math.atan2(off.x, off.z);
  }
  update(dt) {
    if (this.fly) return this._updateFly(dt);
    if (this.tween) {
      const tw = this.tween;
      tw.t += dt / tw.dur;
      const k = ease(Math.min(1, tw.t));
      this.goal.target.lerpVectors(tw.from.target, tw.to.target, k);
      // distance in log space for smooth zooms
      this.goal.dist = Math.exp(Math.log(tw.from.dist) + (Math.log(tw.to.dist) - Math.log(tw.from.dist)) * k);
      this.goal.theta = tw.from.theta + (tw.to.theta - tw.from.theta) * k;
      this.goal.phi = tw.from.phi + (tw.to.phi - tw.from.phi) * k;
      this.cur.target.copy(this.goal.target); this.cur.dist = this.goal.dist; this.cur.theta = this.goal.theta; this.cur.phi = this.goal.phi;
      if (tw.t >= 1) this.tween = null;
    } else {
      const a = 1 - Math.exp(-dt * 9);
      this.cur.target.lerp(this.goal.target, a);
      this.cur.dist += (this.goal.dist - this.cur.dist) * a;
      this.cur.theta += (this.goal.theta - this.cur.theta) * a;
      this.cur.phi += (this.goal.phi - this.cur.phi) * a;
    }
    this._apply();
  }
  _apply() {
    const { target, dist, theta, phi } = this.cur;
    const sp = Math.sin(phi);
    const p = this.cam.position;
    p.set(target.x + dist * sp * Math.sin(theta), target.y + dist * Math.cos(phi), target.z + dist * sp * Math.cos(theta));
    const gmin = this.groundAt(p.x, p.z) + 1.4;
    if (p.y < gmin) p.y = gmin;
    this.cam.lookAt(target);
  }
  // Cinematic flyover: rooftop-height orbit, then rise into an aerial view.
  _updateFly(dt) {
    const f = this.fly;
    f.t += dt;
    const c = f.center;
    const T1 = 64, T2 = 22;
    let radius, height, lookY, ang;
    if (f.t < T1) {
      const k = f.t / T1;
      ang = f.theta0 + k * Math.PI * 2;
      radius = 142 + 14 * Math.sin(k * Math.PI * 2);
      height = 40 + 5 * Math.sin(k * Math.PI * 4);
      lookY = 22;
    } else {
      const k = Math.min(1, (f.t - T1) / T2);
      const e = ease(k);
      ang = f.theta0 + Math.PI * 2 + (f.t - T1) * 0.035;
      radius = 142 + e * 330;
      height = 40 + e * 320;
      lookY = 22 - e * 12;
    }
    const p = this.cam.position;
    p.set(c.x + Math.sin(ang) * radius, height, c.z + Math.cos(ang) * radius);
    const gmin = this.groundAt(p.x, p.z) + 2;
    if (p.y < gmin) p.y = gmin;
    this.cam.lookAt(c.x, lookY, c.z);
  }
}
