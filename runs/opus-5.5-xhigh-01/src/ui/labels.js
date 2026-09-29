// Floating landmark labels: HTML overlays anchored to world positions, always
// facing the camera, priority-sorted with overlap rejection, hidden when
// off-screen, occluded behind the camera or beyond their maximum distance.

import * as THREE from 'three';

const _v = new THREE.Vector3();

export class Labels {
  constructor(root, items, camera) {
    this.root = root;
    this.camera = camera;
    this.visible = false;
    this.fading = false;
    this.setItems(items);
  }
  setItems(items) {
    this.root.innerHTML = '';
    this.items = items.map((it) => {
      const el = document.createElement('div');
      el.className = 'lbl' + (it.kind === 'street' ? ' street' : '') + (it.minor ? ' minor' : '');
      el.innerHTML = `${it.name}${it.sub ? `<span class="sub">${it.sub}</span>` : ''}`;
      this.root.appendChild(el);
      return { ...it, el, w: 0, h: 0, on: false, pos: new THREE.Vector3(...it.pos) };
    });
    this.measured = false;
  }
  setVisible(v) {
    this.visible = v;
    this.fading = true;
    if (!v) for (const it of this.items) { it.el.classList.remove('on'); it.on = false; }
    setTimeout(() => { this.fading = false; }, 400);
  }
  update(W, H) {
    if (!this.measured) {
      for (const it of this.items) { const r = it.el.getBoundingClientRect(); it.w = r.width || 80; it.h = r.height || 18; }
      this.measured = true;
    }
    if (!this.visible) return;
    const cam = this.camera;
    const placed = [];
    const cand = [];
    for (const it of this.items) {
      const d = cam.position.distanceTo(it.pos);
      _v.copy(it.pos).project(cam);
      const onScreen = _v.z < 1 && _v.z > -1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05;
      if (!onScreen || d > it.maxDist || d < (it.minDist || 0)) { this.hide(it); continue; }
      const sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * H;
      cand.push({ it, sx, sy, d });
    }
    cand.sort((a, b) => (a.it.prio - b.it.prio) || (a.d - b.d));
    for (const c of cand) {
      const it = c.it;
      const base = it.kind === 'street' ? 0 : Math.round(12 + 14 * Math.min(1, 400 / (c.d + 50)));
      let ok = false;
      // try the natural position, then lift the label on a longer stem
      for (let k = 0; k < (it.kind === 'street' ? 1 : 3); k++) {
        const stem = base + k * (it.h + 8);
        const x = c.sx - it.w / 2, y = c.sy - it.h - stem - 2;
        const rect = [x - 3, y - 3, x + it.w + 3, y + it.h + 3];
        if (rect[0] < 4 || rect[2] > W - 4 || rect[1] < 4 || rect[3] > H - 4) break;
        let clash = false;
        for (const p of placed) if (!(rect[2] < p[0] || rect[0] > p[2] || rect[3] < p[1] || rect[1] > p[3])) { clash = true; break; }
        if (clash) continue;
        placed.push(rect, [c.sx - 2, y + it.h, c.sx + 2, c.sy]);
        it.el.style.setProperty('--stem', stem + 'px');
        it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        if (!it.on) { it.el.classList.add('on'); it.on = true; }
        ok = true;
        break;
      }
      if (!ok) this.hide(it);
    }
  }
  hide(it) { if (it.on) { it.el.classList.remove('on'); it.on = false; } }
}
