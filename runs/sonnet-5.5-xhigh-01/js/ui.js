/* Piata Unirii — HUD, key chips, toasts and floating landmark labels */
(function () {
  'use strict';
  const PU = window.PU;
  const M4 = PU.M4;

  /* Landmark labels. pos = world anchor (metres); kind 'poi' (plate) or 'street' (italic text on the ground) */
  const LABELS = [
    { id: 'church', text: "St. Michael's Church", sub: 'Biserica Sfântul Mihail', pos: [-34, 83, -12], prio: 100, maxDist: 1400, stem: 12 },
    { id: 'matthias', text: 'Matthias Corvinus Monument', sub: 'Statuia lui Matei Corvin', pos: [-6, 1.0, 21], prio: 95, maxDist: 700, stem: 14, below: true },
    { id: 'banffy', text: 'Bánffy Palace', sub: 'Palatul Bánffy', pos: [128, 27, -13], prio: 90, maxDist: 800, stem: 18 },
    { id: 'mirror', text: 'Mirror Buildings', sub: 'Palatele Statusului Romano-Catolic', pos: [121, 25, 52], prio: 88, maxDist: 800, stem: 18 },
    { id: 'continental', text: 'Former Hotel Continental', sub: 'Hotel New York', pos: [-121, 24, 68], prio: 86, maxDist: 800, stem: 18 },
    { id: 'roman', text: 'Roman Napoca window', sub: 'archaeological display', pos: [-6, 1.2, 35], prio: 70, maxDist: 300, stem: 14, below: true },
    { id: 'fountain', text: 'Southern fountain', sub: 'fântâna arteziană', pos: [28, 2.0, 55], prio: 72, maxDist: 380, stem: 14 },
    { id: 'townhall', text: 'Old Town Hall', sub: 'Casa Sfatului', pos: [-27, 19, 90], prio: 60, maxDist: 520, stem: 14 },
    { id: 'bank', text: 'National Bank', sub: 'Banca Națională', pos: [4, 22, 91], prio: 60, maxDist: 520, stem: 14 },
    { id: 'rhedey', text: 'Rhédey Palace', pos: [-121, 19, -9], prio: 50, maxDist: 420, stem: 12 },
    { id: 'josika', text: 'Jósika Palace', pos: [-121, 19, -34], prio: 48, maxDist: 420, stem: 12 },
    { id: 'wass', text: 'Wass House', pos: [-120, 16, -55], prio: 40, maxDist: 320, stem: 12 },
    { id: 'kemeny', text: 'Kemény Palace', pos: [-40, 20, -91], prio: 48, maxDist: 420, stem: 12 },
    { id: 'mauksch', text: 'Mauksch-Hintz House', pos: [-62, 17, -91], prio: 40, maxDist: 320, stem: 12 },
    { id: 'rucska', text: 'Rucska House', pos: [-1, 14, -90], prio: 40, maxDist: 320, stem: 12 },
    { id: 'eroilor', kind: 'street', text: 'Bulevardul Eroilor', pos: [70, 1, 128], prio: 30, maxDist: 650 },
    { id: 'maniu', kind: 'street', text: 'Str. Iuliu Maniu', pos: [176, 1, 52], prio: 30, maxDist: 650 },
    { id: 'ferdinand', kind: 'street', text: 'Regele Ferdinand · 21 Decembrie', pos: [82, 1, -132], prio: 30, maxDist: 650 },
    { id: 'memorandumului', kind: 'street', text: 'Str. Memorandumului', pos: [-86, 1, -132], prio: 30, maxDist: 650 },
    { id: 'napoca', kind: 'street', text: 'Str. Napoca', pos: [-175, 1, 52], prio: 28, maxDist: 650 },
    { id: 'universitatii', kind: 'street', text: 'Str. Universității', pos: [-74, 1, 128], prio: 28, maxDist: 650 },
  ];

  class UI {
    constructor() {
      this.layer = document.getElementById('labels');
      this.toastEl = document.getElementById('toast');
      this.keysEl = document.getElementById('keys');
      this.fpsEl = document.getElementById('fps');
      this.showLabels = false;
      this.handlers = {};
      this._makeKeys();
      this._makeLabels();
      this._toastT = 0;
      this.tmp = [0, 0, 0, 0];
    }
    _makeKeys() {
      const defs = [
        ['R', 'Recentre', 'recentre'],
        ['F', 'Flyover', 'flyover'],
        ['T', 'Time of day', 'time'],
        ['V', 'View', 'view'],
        ['L', 'Labels', 'labels'],
      ];
      this.keyEls = {};
      for (const [k, name, id] of defs) {
        const el = document.createElement('div');
        el.className = 'key';
        el.innerHTML = '<b>' + k + '</b><span>' + name + '</span><em></em>';
        el.addEventListener('click', () => this.handlers[id] && this.handlers[id]());
        this.keysEl.appendChild(el);
        this.keyEls[id] = el;
      }
      this.setState('time', 'Clear day', false);
      this.setState('view', 'Aerial', false);
      this.setState('flyover', 'Off', false);
      this.setState('labels', 'Off', false);
    }
    setState(id, text, on) {
      const el = this.keyEls[id];
      if (!el) return;
      el.querySelector('em').textContent = text ? '· ' + text : '';
      el.classList.toggle('on', !!on);
    }
    on(id, fn) {
      this.handlers[id] = fn;
    }
    toast(msg) {
      this.toastEl.textContent = msg;
      this.toastEl.classList.add('show');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => this.toastEl.classList.remove('show'), 1700);
    }
    /* coarse 2 m height map of buildings, used to hide labels whose anchor is hidden behind other buildings */
    _buildHeightMap() {
      const L = PU.L, res = 2, half = 620, n = (half * 2) / res;
      const hm = new Float32Array(n * n);
      const rect = (x0, z0, x1, z1, h) => {
        const i0 = Math.max(0, Math.floor((x0 + half) / res)), i1 = Math.min(n - 1, Math.floor((x1 + half) / res));
        const j0 = Math.max(0, Math.floor((z0 + half) / res)), j1 = Math.min(n - 1, Math.floor((z1 + half) / res));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (hm[j * n + i] < h) hm[j * n + i] = h;
      };
      rect(-28.6, -27.6, 16.6, 3.6, 39); rect(-40.5, -19.5, -27.5, -4.5, 80); rect(16, -19.6, 32.6, -4.4, 28);
      for (const lot of L.lots) { const r = L.lotRect(lot.side, lot.a, lot.b, lot.depth); rect(r.x0, r.z0, r.x1, r.z1, (lot.built ? lot.built.H : 16) + 6); }
      for (const k of ['banffy', 'mirrorN', 'mirrorS']) { const h = L.hero[k], r = L.lotRect(h.side, h.a, h.b, h.depth); rect(r.x0, r.z0, r.x1, r.z1, k === 'banffy' ? 22 : 24); }
      for (const k of ['west', 'south', 'corner']) { const r = L.hero.continental[k]; rect(r.x0, r.z0, r.x1, r.z1, 25); }
      rect(132, 25, 234, 46, 20); rect(132, 58, 234, 79, 20);
      for (const b of PU.cityBuildings || []) {
        const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
        const ex = Math.abs(c) * b.hw + Math.abs(s) * b.hd, ez = Math.abs(s) * b.hw + Math.abs(c) * b.hd;
        const h = b.floors * 3.2 + 5;
        const i0 = Math.max(0, Math.floor((b.cx - ex + half) / res)), i1 = Math.min(n - 1, Math.floor((b.cx + ex + half) / res));
        const j0 = Math.max(0, Math.floor((b.cz - ez + half) / res)), j1 = Math.min(n - 1, Math.floor((b.cz + ez + half) / res));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const x = i * res - half + 1 - b.cx, z = j * res - half + 1 - b.cz;
          if (Math.abs(x * c - z * s) <= b.hw && Math.abs(x * s + z * c) <= b.hd && hm[j * n + i] < h) hm[j * n + i] = h;
        }
      }
      this.hm = { data: hm, n, res, half };
    }
    _occluded(cp, a) {
      const H = this.hm;
      if (!H) return false;
      const dx = a[0] - cp[0], dy = a[1] - cp[1], dz = a[2] - cp[2];
      const dist = Math.hypot(dx, dy, dz);
      const steps = Math.min(160, Math.ceil(dist / 3));
      const tEnd = Math.max(0, 1 - 14 / dist), tStart = Math.min(0.5, 6 / dist);
      for (let k = 0; k <= steps; k++) {
        const t = tStart + ((tEnd - tStart) * k) / steps;
        const x = cp[0] + dx * t, z = cp[2] + dz * t;
        const i = Math.floor((x + H.half) / H.res), j = Math.floor((z + H.half) / H.res);
        if (i < 0 || j < 0 || i >= H.n || j >= H.n) continue;
        if (cp[1] + dy * t < H.data[j * H.n + i] - 0.8) return true;
      }
      return false;
    }
    _makeLabels() {
      this.labels = LABELS.map((d) => {
        const el = document.createElement('div');
        el.className = 'lbl' + (d.kind === 'street' ? ' street' : '') + (d.below ? ' below' : '');
        el.style.setProperty('--stem', (d.stem || 14) + 'px');
        el.innerHTML = d.text + (d.sub ? '<small>' + d.sub + '</small>' : '');
        el.style.opacity = '0';
        el.style.visibility = 'hidden';
        this.layer.appendChild(el);
        return { d, el, w: 0, h: 0, shown: false };
      });
      this.layer.style.display = 'none';
    }
    setLabels(on) {
      this.showLabels = on;
      this.layer.style.display = on ? '' : 'none';
      if (on) {
        if (!this.hm) this._buildHeightMap();
        for (const l of this.labels) { l.w = 0; }
      }
    }
    /* project + declutter; called every frame while labels are on */
    updateLabels(cam, W, H) {
      if (!this.showLabels) return;
      const vp = cam.vp, p = this.tmp, cp = cam.pos;
      const placed = [];
      const items = [];
      for (const l of this.labels) {
        const d = l.d;
        const dist = Math.hypot(d.pos[0] - cp[0], d.pos[1] - cp[1], d.pos[2] - cp[2]);
        M4.project(vp, d.pos[0], d.pos[1], d.pos[2], p);
        let ok = p[3] > 0.1 && dist < d.maxDist;
        let sx = 0, sy = 0;
        if (ok) {
          sx = (p[0] / p[3] * 0.5 + 0.5) * W;
          sy = (1 - (p[1] / p[3] * 0.5 + 0.5)) * H;
          if (sx < -20 || sx > W + 20 || sy < 20 || sy > H + 20) ok = false;
        }
        if (ok && d.kind === 'street' && cam.cur.pitch < 0.12) ok = false;
        if (ok && this._occluded(cp, d.pos)) ok = false;
        items.push({ l, ok, sx, sy, dist });
      }
      items.sort((a, b) => b.l.d.prio - a.l.d.prio);
      for (const it of items) {
        const l = it.l;
        let show = it.ok;
        if (show && !l.w) {
          l.el.style.visibility = 'hidden';
          l.w = l.el.offsetWidth || 120;
          l.h = l.el.offsetHeight || 24;
        }
        if (show) {
          const stem = l.d.kind === 'street' ? 0 : l.d.stem || 14;
          const x = it.sx - l.w / 2, y = l.d.below ? it.sy + stem : it.sy - l.h - stem;
          const pad = 6;
          const r = [x - pad, y - pad, x + l.w + pad, y + l.h + pad];
          for (const q of placed) {
            if (r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]) { show = false; break; }
          }
          if (show) {
            placed.push(r);
            l.el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
            const fade = Math.min(1, (l.d.maxDist - it.dist) / (l.d.maxDist * 0.25));
            l.el.style.opacity = String(Math.max(0.0, Math.min(1, fade)));
          }
        }
        if (show !== l.shown) {
          l.shown = show;
          l.el.style.visibility = show ? 'visible' : 'hidden';
          if (!show) l.el.style.opacity = '0';
        }
      }
    }
    setFps(f) {
      this.fpsEl.textContent = f + ' fps';
    }
  }
  PU.UI = UI;
})();
