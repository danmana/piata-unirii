// Optional floating landmark labels: DOM tags pinned to world anchors, always camera-facing,
// hidden by default (toggle with L), culled when off-screen or distant, de-overlapped greedily.
import * as THREE from 'three';
import { SQ, CHURCH, CHURCH_CENTER, MONUMENT, ARCH, FOUNTAIN, STREETS, polylineSample } from './layout.js';

const STREET_NAMES = {
  Eroilor: 'Bulevardul Eroilor',
  'Iuliu Maniu': 'Strada Iuliu Maniu',
  'Regele Ferdinand': 'Strada Regele Ferdinand',
  '21 Decembrie': 'Bulevardul 21 Decembrie 1989',
  Memorandumului: 'Strada Memorandumului',
  Napoca: 'Strada Napoca',
  Universitatii: 'Strada Universității',
  'Matei Corvin': 'Strada Matei Corvin',
};

const _v = new THREE.Vector3();

// Church volume used as the one big occluder inside the square (labels behind it hide at low angles).
const OCCLUDERS = [
  { x0: CHURCH.x0 - 3, x1: CHURCH.x1 + CHURCH.apseLen + 3, y0: 0, y1: CHURCH.ridgeH, z0: CHURCH.z0 - 3, z1: CHURCH.z1 + 3 },
  { x0: CHURCH.towerX0 - 1, x1: CHURCH.towerX1 + 1, y0: 0, y1: CHURCH.towerH - 15, z0: CHURCH.towerZ0 - 1, z1: CHURCH.towerZ1 + 1 },
];
function segmentHitsBox(a, b, box) {
  // slab test for the segment a->b against an axis-aligned box
  let tmin = 0, tmax = 1;
  const axes = [['x', box.x0, box.x1], ['y', box.y0, box.y1], ['z', box.z0, box.z1]];
  for (const [k, lo, hi] of axes) {
    const d = b[k] - a[k];
    if (Math.abs(d) < 1e-9) { if (a[k] < lo || a[k] > hi) return false; continue; }
    let t1 = (lo - a[k]) / d, t2 = (hi - a[k]) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

export class Labels {
  constructor(container, camera) {
    this.container = container;
    this.camera = camera;
    this.items = [];
    this.visible = false;
    this.container.hidden = true;
    this.container.setAttribute('aria-hidden', 'true');
  }

  /** items: [{ text, sub, x, y, z, kind: 'landmark'|'street'|'minor', priority, maxDist }] */
  setItems(items) {
    this.container.textContent = '';
    this.items = items.map((it) => {
      const el = document.createElement('div');
      el.className = `lbl lbl-${it.kind}`;
      const stem = document.createElement('i');
      stem.className = 'lbl-stem';
      const card = document.createElement('div');
      card.className = 'lbl-card';
      const name = document.createElement('span');
      name.className = 'lbl-name';
      name.textContent = it.text;
      card.appendChild(name);
      if (it.sub) {
        const sub = document.createElement('span');
        sub.className = 'lbl-sub';
        sub.textContent = it.sub;
        card.appendChild(sub);
      }
      el.appendChild(stem);
      el.appendChild(card);
      this.container.appendChild(el);
      return { ...it, el, stem, card, pos: new THREE.Vector3(it.x, it.y, it.z), w: 0, h: 0, shown: false };
    });
    this.measured = false;
  }

  measure() {
    // one layout pass to learn card sizes (container is briefly shown off-screen)
    const wasHidden = this.container.hidden;
    this.container.hidden = false;
    for (const it of this.items) {
      const r = it.card.getBoundingClientRect();
      it.w = r.width || 80;
      it.h = r.height || 22;
    }
    this.container.hidden = wasHidden;
    this.measured = true;
  }

  toggle() {
    this.visible = !this.visible;
    this.container.hidden = !this.visible;
    this.container.setAttribute('aria-hidden', String(!this.visible));
    if (!this.visible) for (const it of this.items) { it.el.classList.remove('on'); it.el.style.opacity = '0'; it.shown = false; }
    return this.visible;
  }

  update() {
    if (!this.visible || !this.items.length) return;
    if (!this.measured) this.measure();
    const cam = this.camera;
    const W = window.innerWidth, H = window.innerHeight;
    const camPos = cam.position;
    const candidates = [];
    for (const it of this.items) {
      const dist = camPos.distanceTo(it.pos);
      _v.copy(it.pos).project(cam);
      const onScreen = _v.z < 1 && _v.x > -0.97 && _v.x < 0.97 && _v.y > -0.97 && _v.y < 0.97;
      if (!onScreen || dist > it.maxDist || dist < it.minDist) { it.want = false; continue; }
      if (it.occludable && OCCLUDERS.some((box) => segmentHitsBox(camPos, it.pos, box))) { it.want = false; continue; }
      it.want = true;
      it.sx = (_v.x * 0.5 + 0.5) * W;
      it.sy = (-_v.y * 0.5 + 0.5) * H;
      it.dist = dist;
      // fade out toward the distance limit, then drop entirely
      it.alpha = Math.min(1, (it.maxDist - dist) / (it.maxDist * 0.2));
      if (it.alpha < 0.3) { it.want = false; continue; }
      candidates.push(it);
    }
    candidates.sort((a, b) => (b.priority - a.priority) || (a.dist - b.dist));
    const placed = [];
    for (const it of candidates) {
      let lift = it.kind === 'street' ? 18 : 30;
      // keep the card inside the viewport: shift it sideways while the pin stays on the anchor
      let dx = 0;
      const margin = 10;
      if (it.sx - it.w / 2 < margin) dx = margin - (it.sx - it.w / 2);
      else if (it.sx + it.w / 2 > W - margin) dx = (W - margin) - (it.sx + it.w / 2);
      dx = Math.max(-it.w * 0.5, Math.min(it.w * 0.5, dx));
      it.dx = dx;
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        const rect = { x0: it.sx + dx - it.w / 2, x1: it.sx + dx + it.w / 2, y0: it.sy - lift - it.h, y1: it.sy - lift };
        ok = rect.y0 > 4 && !placed.some((p) => rect.x0 < p.x1 + 6 && rect.x1 > p.x0 - 6 && rect.y0 < p.y1 + 4 && rect.y1 > p.y0 - 4);
        if (ok) { placed.push(rect); it.lift = lift; }
        else lift += it.h + 10;
      }
      it.want = ok;
    }
    for (const it of this.items) {
      if (!it.want) {
        if (it.shown) { it.el.classList.remove('on'); it.el.style.opacity = '0'; it.shown = false; }
        continue;
      }
      it.el.style.transform = `translate(${it.sx.toFixed(1)}px, ${it.sy.toFixed(1)}px)`;
      it.el.style.opacity = it.alpha.toFixed(2);
      it.stem.style.height = `${it.lift}px`;
      it.card.style.bottom = `${it.lift}px`;
      it.card.style.transform = `translateX(calc(-50% + ${it.dx.toFixed(1)}px))`;
      if (!it.shown) { it.el.classList.add('on'); it.shown = true; }
    }
  }
}

/** Build the label list from a built world (landmark positions are fixed; heights come from the build). */
export function buildLabelItems(world) {
  const gy = (x, z) => world.groundHeightAt(x, z);
  const items = [];
  const L = world.landmarks;
  const churchBase = L.church ? L.church.baseY : 0;
  items.push({ text: 'St. Michael’s Church', sub: 'Biserica Sfântul Mihail · 14th–15th c.', x: CHURCH_CENTER.x + 4, y: churchBase + CHURCH.ridgeH + 3, z: CHURCH_CENTER.z, kind: 'landmark', priority: 10, maxDist: 1400, minDist: 0 });
  items.push({ text: 'Matthias Corvinus Monument', sub: 'Statuia lui Matei Corvin · 1902', x: MONUMENT.cx, y: (L.monument ? L.monument.top : gy(MONUMENT.cx, MONUMENT.cz) + 7) + 8.5, z: MONUMENT.cz, kind: 'landmark', priority: 9, maxDist: 900, minDist: 0 });
  items.push({ text: 'Roman Napoca archaeological window', sub: 'Fereastră arheologică', x: ARCH.cx, y: gy(ARCH.cx, ARCH.cz + 4) + 1.2, z: ARCH.cz, kind: 'minor', priority: 5, maxDist: 320, minDist: 0, occludable: true });
  items.push({ text: 'Fountain', sub: 'Southern water tables & jets', x: FOUNTAIN.cx, y: gy(FOUNTAIN.cx, FOUNTAIN.cz) + 1.5, z: FOUNTAIN.cz, kind: 'minor', priority: 5, maxDist: 420, minDist: 0, occludable: true });
  items.push({ text: 'Piața Unirii', sub: 'Cluj-Napoca', x: MONUMENT.cx + 30, y: gy(MONUMENT.cx + 30, 40) + 1.5, z: 40, kind: 'street', priority: 3, maxDist: 1600, minDist: 300 });

  // perimeter buildings from the placed specs
  const roofAnchor = (b, along = 0.5, depth = 0.35) => {
    const cr = Math.cos(b.rot), sr = Math.sin(b.rot);
    const lx = b.w * along, lz = b.d * depth;
    return { x: b.x + lx * cr + lz * sr, z: b.z - lx * sr + lz * cr, y: b.baseY + b.roofTop + 2.5 };
  };
  const find = (name) => (world.perimeter || []).find((b) => b.name === name);
  const named = [
    ['Bánffy Palace', 'Palatul Bánffy · Baroque, 1774–1785', 'landmark', 8, 1000],
    ['Hotel Continental', 'former Hotel Continental / New York', 'landmark', 7, 900],
    ['National Bank', 'Banca Națională', 'minor', 4, 320],
    ['Old Town Hall', 'Primăria Veche', 'minor', 4, 320],
    ['Mauksch-Hintz House', 'Pharmacy museum', 'minor', 3, 260],
    ['Kemény Palace', 'Palatul Kemény', 'minor', 3, 260],
    ['Rucska House', 'Casa Rucska', 'minor', 3, 260],
    ['Rhédey Palace', 'Palatul Rhédey', 'minor', 3, 260],
    ['Jósika Palace', 'Palatul Jósika', 'minor', 3, 260],
    ['Wass House', 'Casa Wass', 'minor', 3, 260],
    ['Roman Catholic parish house', 'Casa parohială', 'minor', 3, 260],
  ];
  for (const [name, sub, kind, priority, maxDist] of named) {
    const b = find(name);
    if (!b) continue;
    const a = roofAnchor(b);
    items.push({ text: name, sub, x: a.x, y: a.y, z: a.z, kind, priority, maxDist, minDist: 0, occludable: true });
  }
  const ms = find('Mirror Building (south)'), mn = find('Mirror Building (north)');
  if (ms && mn) {
    const a = roofAnchor(ms, 1.0, 0.3), b = roofAnchor(mn, 0.0, 0.3);
    items.push({ text: 'Mirror Buildings', sub: 'Palatele Statusului Romano-Catolic · 1898–1899', x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + 4, z: (a.z + b.z) / 2, kind: 'landmark', priority: 8, maxDist: 900, minDist: 0, occludable: true });
  }
  // major named streets, tagged a little way into each street from the square
  for (const st of STREETS) {
    const label = STREET_NAMES[st.name];
    if (!label) continue;
    const p = polylineSample(st.pts, 48);
    items.push({ text: label, sub: null, x: p.x, y: gy(p.x, p.z) + 1.2, z: p.z, kind: 'street', priority: 2, maxDist: 520, minDist: 0, occludable: true });
  }
  return items;
}
