// Floating landmark labels. Hidden by default, toggled with [L]. Anchored to world
// positions, always upright and facing the viewer, culled when off-screen or too
// distant, and thinned out greedily so they never pile on top of one another.

import * as THREE from 'three';

export class LabelLayer {
  constructor(container, landmarks) {
    this.root = document.createElement('div');
    this.root.className = 'labels';
    container.appendChild(this.root);
    this.items = landmarks.map((l) => {
      const el = document.createElement('div');
      el.className = 'lbl' + (l.street ? ' lbl-street' : '');
      const dot = document.createElement('span');
      dot.className = 'lbl-dot';
      const stem = document.createElement('span');
      stem.className = 'lbl-stem';
      const box = document.createElement('div');
      box.className = 'lbl-box';
      const t = document.createElement('b');
      t.textContent = l.text;
      box.appendChild(t);
      if (l.sub) {
        const s = document.createElement('i');
        s.textContent = l.sub;
        box.appendChild(s);
      }
      el.appendChild(box); el.appendChild(stem); el.appendChild(dot);
      this.rootAppend(el);
      return { def: l, el, box, pos: new THREE.Vector3().fromArray(l.pos), w: 0, h: 0 };
    });
    this.visible = false;
    this.root.style.display = 'none';
    this._v = new THREE.Vector3();
    this._measured = false;
    this.boxes = [];
    this.exclude = [];
  }

  /**
   * Building footprints used as cheap occluders: a label whose anchor is hidden
   * behind a roof is dropped instead of floating over it.
   */
  setOccluders(footprints) {
    this.boxes = footprints
      .filter((f) => (f.h || 0) > 3)
      .map((f) => ({ x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1, y0: (f.base || 0) - 2, y1: f.h }));
  }

  /** Screen rectangles labels must keep clear of (the HUD panels). */
  setExclusions(rects) { this.exclude = rects; }

  _occluded(cam, p) {
    const dx = p.x - cam.x, dy = p.y - cam.y, dz = p.z - cam.z;
    for (const b of this.boxes) {
      // never let a landmark be hidden by its own mass
      if (p.x > b.x0 - 2 && p.x < b.x1 + 2 && p.z > b.z0 - 2 && p.z < b.z1 + 2 && p.y < b.y1 + 2) continue;
      if (cam.x > b.x0 && cam.x < b.x1 && cam.z > b.z0 && cam.z < b.z1 && cam.y > b.y0 && cam.y < b.y1) continue;
      let tmin = 0, tmax = 1;
      let t0 = (b.x0 - cam.x) / (dx || 1e-9), t1 = (b.x1 - cam.x) / (dx || 1e-9);
      if (t0 > t1) { const t = t0; t0 = t1; t1 = t; }
      tmin = Math.max(tmin, t0); tmax = Math.min(tmax, t1);
      if (tmax < tmin) continue;
      t0 = (b.y0 - cam.y) / (dy || 1e-9); t1 = (b.y1 - cam.y) / (dy || 1e-9);
      if (t0 > t1) { const t = t0; t0 = t1; t1 = t; }
      tmin = Math.max(tmin, t0); tmax = Math.min(tmax, t1);
      if (tmax < tmin) continue;
      t0 = (b.z0 - cam.z) / (dz || 1e-9); t1 = (b.z1 - cam.z) / (dz || 1e-9);
      if (t0 > t1) { const t = t0; t0 = t1; t1 = t; }
      tmin = Math.max(tmin, t0); tmax = Math.min(tmax, t1);
      if (tmax < tmin) continue;
      if (tmin < 0.985) return true;
    }
    return false;
  }

  rootAppend(el) { this.root.appendChild(el); }

  setVisible(v) {
    this.visible = v;
    this.root.style.display = v ? '' : 'none';
    if (v && !this._measured) this.measure();
  }

  measure() {
    for (const it of this.items) {
      it.w = it.box.offsetWidth || 150;
      it.h = it.box.offsetHeight || 30;
    }
    this._measured = true;
  }

  update(camera, camPos, w, h) {
    if (!this.visible) return;
    if (!this._measured) this.measure();
    const v = this._v;
    const cands = [];
    for (const it of this.items) {
      const d = camPos.distanceTo(it.pos);
      const max = it.def.maxDist ?? 800;
      if (d > max) { it.el.style.display = 'none'; continue; }
      v.copy(it.pos).project(camera);
      if (v.z > 1) { it.el.style.display = 'none'; continue; }
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      if (sx < -60 || sx > w + 60 || sy < -50 || sy > h + 40) { it.el.style.display = 'none'; continue; }
      if (this._occluded(camPos, it.pos)) { it.el.style.display = 'none'; continue; }
      const fade = Math.min(1, (max - d) / (max * 0.22));
      const near = Math.min(1, d / 22);
      cands.push({ it, sx, sy, d, alpha: Math.min(fade, near), pri: it.def.priority ?? 5 });
    }
    cands.sort((a, b) => (b.pri - a.pri) || (a.d - b.d));
    const taken = [];
    for (const c of cands) {
      const bw = c.it.w, bh = c.it.h;
      const r = { x0: c.sx - bw / 2 - 3, x1: c.sx + bw / 2 + 3, y0: c.sy - 44 - bh, y1: c.sy - 40 };
      // keep whole labels on screen and clear of the HUD
      if (r.x0 < 6 || r.x1 > w - 6 || r.y0 < 6 || r.y1 > h - 6) { c.it.el.style.display = 'none'; continue; }
      let hit = false;
      for (const t of taken) {
        if (r.x0 < t.x1 && r.x1 > t.x0 && r.y0 < t.y1 && r.y1 > t.y0) { hit = true; break; }
      }
      if (!hit) {
        for (const e of this.exclude) {
          if (r.x0 < e.x1 && r.x1 > e.x0 && r.y0 < e.y1 && r.y1 > e.y0) { hit = true; break; }
        }
      }
      if (hit) { c.it.el.style.display = 'none'; continue; }
      taken.push(r);
      const el = c.it.el;
      el.style.display = '';
      el.style.transform = 'translate3d(' + Math.round(c.sx) + 'px,' + Math.round(c.sy) + 'px,0)';
      el.style.opacity = c.alpha.toFixed(3);
      el.style.zIndex = String(1000 - Math.round(c.d));
    }
  }

  dispose() { this.root.remove(); }
}
