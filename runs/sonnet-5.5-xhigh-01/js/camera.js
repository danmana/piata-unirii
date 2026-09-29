/* Piata Unirii — "god-mode" orbit camera with presets and cinematic flyover */
(function () {
  'use strict';
  const PU = window.PU;
  const M4 = PU.M4;
  const clamp = PU.clamp, lerp = PU.lerp;
  const D2R = Math.PI / 180;

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };
  const angDiff = (a, b) => {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  /* named framings */
  const VIEWS = {
    hero: { tx: -3, ty: 9, tz: 6, dist: 318, yaw: 20 * D2R, pitch: 16 * D2R, fov: 48 * D2R },
    street: { tx: -6, ty: 21, tz: 4, dist: 46.2, yaw: -0.314, pitch: -0.424, fov: 64 * D2R },
  };

  class CameraRig {
    constructor(canvas, groundFn) {
      this.canvas = canvas;
      this.groundFn = groundFn || (() => 0);
      this.cur = Object.assign({}, VIEWS.hero);
      this.goal = Object.assign({}, VIEWS.hero);
      this.anim = null;
      this.flyover = false;
      this.flyT = 0;
      this.flyBlend = 0;
      this.preset = 'aerial';
      this.onChange = null; // callback(kind)
      this.vp = M4.create();
      this.view = M4.create();
      this.proj = M4.create();
      this.invVP = M4.create();
      this.planes = new Float32Array(24);
      this.pos = [0, 0, 0];
      this.right = [1, 0, 0];
      this.up = [0, 1, 0];
      this.fwd = [0, 0, -1];
      this.aspect = 1;
      this.near = 0.5;
      this.far = 40000;
      this.drag = null;
      this._bind();
      this._compute();
    }

    _bind() {
      const c = this.canvas;
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      c.addEventListener('pointerdown', (e) => {
        if (e.button > 2) return;
        c.setPointerCapture(e.pointerId);
        this.drag = { id: e.pointerId, mode: e.button === 0 && !e.ctrlKey ? 'rot' : 'pan', x: e.clientX, y: e.clientY };
        c.style.cursor = this.drag.mode === 'rot' ? 'grabbing' : 'move';
        this.userTouched();
      });
      const end = (e) => {
        if (this.drag && this.drag.id === e.pointerId) {
          this.drag = null;
          c.style.cursor = 'grab';
        }
      };
      c.addEventListener('pointerup', end);
      c.addEventListener('pointercancel', end);
      c.addEventListener('pointermove', (e) => {
        this.mouse = [e.clientX, e.clientY];
        if (!this.drag || this.drag.id !== e.pointerId) return;
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        this.drag.x = e.clientX;
        this.drag.y = e.clientY;
        const g = this.goal;
        if (this.drag.mode === 'rot') {
          g.yaw -= dx * 0.0052;
          g.pitch += dy * 0.0042;
          g.pitch = clamp(g.pitch, -0.8, 1.5);
        } else {
          const k = (g.dist * Math.tan(g.fov / 2) * 2) / this.canvas.clientHeight;
          const sy = Math.sin(g.yaw), cy = Math.cos(g.yaw);
          // screen-right = (cos, 0, -sin); screen-forward on ground = (-sin, 0, -cos)
          const fx = -sy, fz = -cy, rx = cy, rz = -sy;
          const pf = 1 / Math.max(0.35, Math.cos(g.pitch));
          g.tx += (-dx * rx + dy * fx * pf) * k;
          g.tz += (-dx * rz + dy * fz * pf) * k;
        }
        this.userTouched();
        this._limit(this.goal);
      });
      c.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          this.userTouched();
          const g = this.goal;
          let dy = e.deltaY;
          if (e.deltaMode === 1) dy *= 33;
          const f = Math.exp(clamp(dy, -400, 400) * 0.0013);
          const nd = clamp(g.dist * f, 4, 1500);
          const fr = nd / g.dist;
          // zoom towards cursor: keep the ground point under the pointer fixed
          const P = this._pickGround(e.clientX, e.clientY);
          if (P) {
            g.tx = P[0] + (g.tx - P[0]) * fr;
            g.tz = P[2] + (g.tz - P[2]) * fr;
            g.ty = P[1] + (g.ty - P[1]) * fr;
          }
          g.dist = nd;
          this._limit(g);
        },
        { passive: false }
      );
      c.style.cursor = 'grab';
    }

    userTouched() {
      this.anim = null;
      if (this.flyover) {
        this.flyover = false;
        this.goal = Object.assign({}, this.cur);
        if (this.onChange) this.onChange('flyover');
      }
    }

    _pickGround(px, py) {
      const r = this.canvas.getBoundingClientRect();
      const nx = ((px - r.left) / r.width) * 2 - 1, ny = -(((py - r.top) / r.height) * 2 - 1);
      const p = [0, 0, 0, 0];
      M4.project(this.invVP, nx, ny, 1, p);
      const w = p[3] || 1;
      const dx = p[0] / w - this.pos[0], dy = p[1] / w - this.pos[1], dz = p[2] / w - this.pos[2];
      if (dy > -1e-4) return null;
      const t = (0.5 - this.pos[1]) / dy;
      if (t < 0 || t > 6000) return null;
      return [this.pos[0] + dx * t, 0.5, this.pos[2] + dz * t];
    }

    _limit(s) {
      s.tx = clamp(s.tx, -900, 900);
      s.tz = clamp(s.tz, -900, 900);
      s.ty = clamp(s.ty, 0, 160);
      s.dist = clamp(s.dist, 4, 1500);
      s.pitch = clamp(s.pitch, -0.8, 1.52);
      // keep the camera above the ground
      const cp = Math.cos(s.pitch);
      const x = s.tx + s.dist * Math.sin(s.yaw) * cp, z = s.tz + s.dist * Math.cos(s.yaw) * cp;
      const minY = this.groundFn(x, z) + 1.6;
      const y = s.ty + s.dist * Math.sin(s.pitch);
      if (y < minY) {
        const sp = clamp((minY - s.ty) / s.dist, -1, 0.999);
        s.pitch = Math.asin(sp);
      }
    }

    goTo(name, dur) {
      const v = VIEWS[name];
      this.flyover = false;
      this.animateTo(v, dur || 1.9);
    }
    animateTo(v, dur) {
      const from = Object.assign({}, this.cur);
      const to = Object.assign({}, v);
      to.yaw = from.yaw + angDiff(from.yaw, v.yaw);
      this.anim = { t: 0, dur, from, to };
    }
    togglePreset() {
      if (this.flyover) {
        this.flyover = false;
        this.onChange && this.onChange('flyover');
      }
      this.preset = this.preset === 'aerial' ? 'street' : 'aerial';
      this.goTo(this.preset === 'aerial' ? 'hero' : 'street', 2.2);
      return this.preset;
    }
    recentre() {
      if (this.flyover) {
        this.flyover = false;
        this.onChange && this.onChange('flyover');
      }
      this.preset = 'aerial';
      this.goTo('hero', 1.9);
    }
    toggleFlyover() {
      this.flyover = !this.flyover;
      this.anim = null;
      if (this.flyover) {
        this.flyT = 0;
        this.flyBlend = 0;
        this.flyFrom = Object.assign({}, this.cur);
        this.flyYaw0 = this.cur.yaw;
        this.preset = 'aerial';
      } else {
        this.goal = Object.assign({}, this.cur);
      }
      return this.flyover;
    }

    _flyTarget(t) {
      // 130 s loop: rooftop orbit, rise into aerial, aerial hold, descend
      const T0 = 56, T1 = 26, T2 = 22, T3 = 26, TT = T0 + T1 + T2 + T3;
      const tt = ((t % TT) + TT) % TT;
      let s = 0;
      if (tt < T0) s = 0;
      else if (tt < T0 + T1) s = smooth((tt - T0) / T1);
      else if (tt < T0 + T1 + T2) s = 1;
      else s = 1 - smooth((tt - T0 - T1 - T2) / T3);
      const omega = (Math.PI * 2) / TT;
      const bob = Math.sin(tt * 0.35) * 0.008;
      const yaw = this.flyYaw0 + omega * t;
      // rooftop orbit is an ellipse that stays inside the open square (semi-axes 86 m x 56 m), widening into a circle for the aerial pass
      const rEll = 1 / Math.sqrt((Math.sin(yaw) * Math.sin(yaw)) / (86 * 86) + (Math.cos(yaw) * Math.cos(yaw)) / (56 * 56));
      return {
        tx: lerp(-6, -4, s),
        ty: lerp(24, 9, s),
        tz: lerp(-6, 2, s),
        dist: lerp(rEll, 285, s),
        yaw,
        pitch: lerp(-0.055, 0.44, s) + bob,
        fov: lerp(60 * D2R, 48 * D2R, s),
      };
    }

    update(dt) {
      dt = Math.min(dt, 0.1);
      const c = this.cur, g = this.goal;
      if (this.flyover) {
        this.flyT += dt;
        const ft = this._flyTarget(this.flyT);
        this.flyBlend = Math.min(1, this.flyBlend + dt / 3.2);
        const b = ease(this.flyBlend);
        const f = this.flyFrom;
        c.tx = lerp(f.tx, ft.tx, b);
        c.ty = lerp(f.ty, ft.ty, b);
        c.tz = lerp(f.tz, ft.tz, b);
        c.dist = lerp(f.dist, ft.dist, b);
        c.pitch = lerp(f.pitch, ft.pitch, b);
        c.fov = lerp(f.fov, ft.fov, b);
        c.yaw = f.yaw + angDiff(f.yaw, ft.yaw) * b + (b >= 1 ? 0 : 0);
        if (b >= 1) c.yaw = ft.yaw;
        Object.assign(g, c);
        this._limit(c);
      } else if (this.anim) {
        const a = this.anim;
        a.t += dt;
        const k = ease(clamp(a.t / a.dur, 0, 1));
        for (const key of ['tx', 'ty', 'tz', 'dist', 'yaw', 'pitch', 'fov']) c[key] = lerp(a.from[key], a.to[key], k);
        Object.assign(g, c);
        if (a.t >= a.dur) this.anim = null;
      } else {
        const k = 1 - Math.exp(-dt * 12);
        for (const key of ['tx', 'ty', 'tz', 'dist', 'yaw', 'pitch', 'fov']) c[key] += (g[key] - c[key]) * k;
      }
      this._compute();
    }

    _compute() {
      const c = this.cur;
      const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
      const px = c.tx + c.dist * Math.sin(c.yaw) * cp;
      const py = c.ty + c.dist * sp;
      const pz = c.tz + c.dist * Math.cos(c.yaw) * cp;
      this.pos[0] = px;
      this.pos[1] = py;
      this.pos[2] = pz;
      this.near = clamp(c.dist * 0.012, 0.25, 6);
      M4.lookAt(this.view, px, py, pz, c.tx, c.ty, c.tz, 0, 1, 0);
      M4.perspective(this.proj, c.fov, this.aspect, this.near, this.far);
      M4.multiply(this.vp, this.proj, this.view);
      M4.invert(this.invVP, this.vp);
      M4.frustum(this.vp, this.planes);
      this.right = [this.view[0], this.view[4], this.view[8]];
      this.up = [this.view[1], this.view[5], this.view[9]];
      this.fwd = [-this.view[2], -this.view[6], -this.view[10]];
    }
    setAspect(a) {
      this.aspect = a;
      this._compute();
    }
  }

  PU.CameraRig = CameraRig;
  PU.VIEWS = VIEWS;
})();
