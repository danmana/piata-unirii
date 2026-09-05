// God-mode orbit camera: left-drag rotates, right-drag pans, wheel zooms.
// Also owns tweening between named presets and the cinematic flyover path.

import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);

export class OrbitCam {
  constructor(camera, dom, opts = {}) {
    this.camera = camera;
    this.dom = dom;
    this.target = new THREE.Vector3(0, 16, -8);
    this.dist = 330;
    this.az = 0.56;         // 0 = due south of the target
    this.pol = 1.03;        // from +Y
    this.tAz = this.az; this.tPol = this.pol; this.tDist = this.dist;
    this.tTarget = this.target.clone();
    this.minDist = opts.minDist ?? 9;
    this.maxDist = opts.maxDist ?? 1500;
    this.minPol = 0.035;
    this.maxPol = 2.16;
    this.damping = 0.16;
    this.enabled = true;
    this.groundAt = opts.groundAt || (() => 0);
    this.tween = null;
    this.userActive = false;

    this._drag = null;
    this._pointers = new Map();
    this._pinch = 0;

    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', this._down = (e) => {
      if (!this.enabled) return;
      dom.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pointers.size === 1) {
        this._drag = { mode: e.button === 2 || e.shiftKey ? 'pan' : 'rot', x: e.clientX, y: e.clientY };
      } else if (this._pointers.size === 2) {
        const p = [...this._pointers.values()];
        this._pinch = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        this._drag = { mode: 'pan', x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
      }
      this.userActive = true;
    });
    dom.addEventListener('pointermove', this._move = (e) => {
      if (!this._pointers.has(e.pointerId)) return;
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pointers.size === 2) {
        const p = [...this._pointers.values()];
        const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (this._pinch) this.zoomBy(Math.pow(0.995, (d - this._pinch) * 2.2));
        this._pinch = d;
        const mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
        this.pan(mx - this._drag.x, my - this._drag.y);
        this._drag.x = mx; this._drag.y = my;
        return;
      }
      if (!this._drag) return;
      const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
      this._drag.x = e.clientX; this._drag.y = e.clientY;
      if (this._drag.mode === 'rot') {
        this.tAz -= dx * 0.0052;
        this.tPol = clamp(this.tPol - dy * 0.0044, this.minPol, this.maxPol);
      } else {
        this.pan(dx, dy);
      }
      this.cancelTween();
    });
    const up = (e) => {
      this._pointers.delete(e.pointerId);
      if (this._pointers.size === 0) { this._drag = null; this._pinch = 0; }
    };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    dom.addEventListener('lostpointercapture', up);
    dom.addEventListener('wheel', this._wheel = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.zoomBy(Math.pow(1.0016, e.deltaY));
      this.cancelTween();
    }, { passive: false });
  }

  zoomBy(f) { this.tDist = clamp(this.tDist * f, this.minDist, this.maxDist); }

  pan(dx, dy) {
    const scale = this.tDist * 0.0016;
    const s = Math.sin(this.tAz), c = Math.cos(this.tAz);
    // screen-right and screen-up projected onto the ground plane
    const rightX = c, rightZ = -s;
    const fwdX = -s, fwdZ = -c;
    this.tTarget.x += (-dx * rightX + dy * fwdX * 0.85) * scale;
    this.tTarget.z += (-dx * rightZ + dy * fwdZ * 0.85) * scale;
    this.tTarget.x = clamp(this.tTarget.x, -900, 900);
    this.tTarget.z = clamp(this.tTarget.z, -900, 900);
    this.cancelTween();
  }

  cancelTween() { if (this.tween && !this.tween.locked) this.tween = null; }

  /** Animate to an absolute framing. */
  flyTo(p, duration = 1.7, locked = false) {
    this.tween = {
      t: 0, duration, locked,
      from: { az: this.tAz, pol: this.tPol, dist: this.tDist, target: this.tTarget.clone() },
      to: { az: this._shortestAz(p.az), pol: p.pol, dist: p.dist, target: new THREE.Vector3().fromArray(p.target) },
      onDone: p.onDone,
    };
  }

  _shortestAz(target) {
    let a = target;
    while (a - this.tAz > Math.PI) a -= Math.PI * 2;
    while (a - this.tAz < -Math.PI) a += Math.PI * 2;
    return a;
  }

  /** Directly set the framing without animating (used by the flyover path). */
  setFraming(az, pol, dist, target) {
    this.tAz = az; this.az = az;
    this.tPol = clamp(pol, this.minPol, this.maxPol); this.pol = this.tPol;
    this.tDist = clamp(dist, this.minDist, this.maxDist); this.dist = this.tDist;
    this.tTarget.copy(target); this.target.copy(target);
  }

  update(dt) {
    if (this.tween) {
      this.tween.t += dt / this.tween.duration;
      const k = smooth(clamp(this.tween.t, 0, 1));
      const f = this.tween.from, t = this.tween.to;
      this.tAz = f.az + (t.az - f.az) * k;
      this.tPol = f.pol + (t.pol - f.pol) * k;
      this.tDist = f.dist + (t.dist - f.dist) * k;
      this.tTarget.lerpVectors(f.target, t.target, k);
      if (this.tween.t >= 1) { const cb = this.tween.onDone; this.tween = null; if (cb) cb(); }
    }
    const a = 1 - Math.pow(1 - this.damping, dt * 60);
    this.az += (this.tAz - this.az) * a;
    this.pol += (this.tPol - this.pol) * a;
    this.dist += (this.tDist - this.dist) * a;
    this.target.lerp(this.tTarget, a);

    const sp = Math.sin(this.pol), cp = Math.cos(this.pol);
    let x = this.target.x + this.dist * sp * Math.sin(this.az);
    let y = this.target.y + this.dist * cp;
    let z = this.target.z + this.dist * sp * Math.cos(this.az);
    const gy = this.groundAt(x, z) + 1.6;
    if (y < gy) y = gy;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this._down);
    this.dom.removeEventListener('pointermove', this._move);
    this.dom.removeEventListener('wheel', this._wheel);
  }
}

// ---------------------------------------------------------------------------
// Cinematic flyover: a slow rooftop-height orbit of the square that climbs into
// an aerial view, then holds and repeats.
// ---------------------------------------------------------------------------
export class Flyover {
  constructor() {
    this.active = false;
    this.t = 0;
    this.duration = 58;
    this.startAz = 0.56;
    this._v = new THREE.Vector3();
  }
  start(fromAz) { this.active = true; this.t = 0; this.startAz = fromAz; }
  stop() { this.active = false; }
  update(dt, cam) {
    if (!this.active) return;
    this.t += dt;
    const u = (this.t % this.duration) / this.duration;
    // 0.00-0.55 rooftop orbit, 0.55-0.85 rise, 0.85-1.00 high aerial hold
    const az = this.startAz + u * Math.PI * 2.0;
    let pol, dist, ty;
    if (u < 0.55) {
      const k = u / 0.55;
      pol = 1.44 - 0.06 * Math.sin(k * Math.PI * 2);
      dist = 168 + 14 * Math.sin(k * Math.PI * 3);
      ty = 22 + 3 * Math.sin(k * Math.PI * 2);
    } else if (u < 0.85) {
      const k = smooth((u - 0.55) / 0.30);
      pol = 1.44 + (0.72 - 1.44) * k;
      dist = 168 + (430 - 168) * k;
      ty = 22 + (34 - 22) * k;
    } else {
      const k = (u - 0.85) / 0.15;
      pol = 0.72 + 0.05 * Math.sin(k * Math.PI);
      dist = 430 + 26 * Math.sin(k * Math.PI);
      ty = 34;
    }
    this._v.set(2 + Math.sin(u * Math.PI * 2) * 6, ty, -10 + Math.cos(u * Math.PI * 2) * 6);
    cam.setFraming(az, pol, dist, this._v);
  }
}
