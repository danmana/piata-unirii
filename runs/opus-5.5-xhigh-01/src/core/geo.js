// Compact growable geometry / instance buffers produced by the voxel meshers.
// Vertex layout (per vertex):
//   pos  Float32 x3   world/local position (metres)
//   nrm  Int8    x3   face normal (normalised to +-127)
//   col  Uint8   x3   sRGB base colour of the voxel material
//   misc Uint8   x4   [ambient occlusion 0..255, atlas layer, shader flags, 0]
//   vox  Int16   x4   [s, t, w, voxelSize(mm)]  - voxel-space surface coordinates

export class GeoOut {
  constructor(cap = 256) {
    this.n = 0;
    this.cap = cap;
    this.pos = new Float32Array(cap * 12);
    this.nrm = new Int8Array(cap * 12);
    this.col = new Uint8Array(cap * 12);
    this.misc = new Uint8Array(cap * 16);
    this.vox = new Int16Array(cap * 16);
    this.flip = new Uint8Array(cap);
  }
  grow() {
    const cap = this.cap * 2;
    const re = (A, n) => { const B = new A.constructor(cap * n); B.set(A); return B; };
    this.pos = re(this.pos, 12);
    this.nrm = re(this.nrm, 12);
    this.col = re(this.col, 12);
    this.misc = re(this.misc, 16);
    this.vox = re(this.vox, 16);
    this.flip = re(this.flip, 1);
    this.cap = cap;
  }
  // p: 12 floats (4 corners), n: normal ints, rgb bytes, ao: 4 values 0..3, st: 8 ints
  quad(p, nx, ny, nz, r, g, b, ao, layer, flags, st, w, vsmm, flip) {
    if (this.n >= this.cap) this.grow();
    const q = this.n++;
    const P = this.pos, N = this.nrm, C = this.col, M = this.misc, V = this.vox;
    let o3 = q * 12, o4 = q * 16;
    for (let c = 0; c < 4; c++) {
      P[o3] = p[c * 3]; P[o3 + 1] = p[c * 3 + 1]; P[o3 + 2] = p[c * 3 + 2];
      N[o3] = nx; N[o3 + 1] = ny; N[o3 + 2] = nz;
      C[o3] = r; C[o3 + 1] = g; C[o3 + 2] = b;
      M[o4] = ao[c] * 85; M[o4 + 1] = layer; M[o4 + 2] = flags; M[o4 + 3] = 0;
      V[o4] = st[c * 2]; V[o4 + 1] = st[c * 2 + 1]; V[o4 + 2] = w; V[o4 + 3] = vsmm;
      o3 += 3; o4 += 4;
    }
    this.flip[q] = flip;
  }
  // Trimmed, transferable arrays + index buffer
  finish() {
    const n = this.n;
    const idx = new Uint32Array(n * 6);
    for (let q = 0; q < n; q++) {
      const b = q * 4, o = q * 6;
      if (this.flip[q]) {
        idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 3;
        idx[o + 3] = b + 1; idx[o + 4] = b + 2; idx[o + 5] = b + 3;
      } else {
        idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 2;
        idx[o + 3] = b; idx[o + 4] = b + 2; idx[o + 5] = b + 3;
      }
    }
    return {
      quads: n,
      pos: this.pos.slice(0, n * 12),
      nrm: this.nrm.slice(0, n * 12),
      col: this.col.slice(0, n * 12),
      misc: this.misc.slice(0, n * 16),
      vox: this.vox.slice(0, n * 16),
      idx,
    };
  }
}

// Individual detail voxels rendered through instanced cube pools.
export class InstOut {
  constructor(cap = 64) {
    this.n = 0;
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.col = new Uint8Array(cap * 3);
    this.misc = new Uint8Array(cap * 4);
  }
  push(x, y, z, r, g, b, layer, flags) {
    if (this.n >= this.cap) {
      const cap = this.cap * 2;
      const re = (A, k) => { const B = new A.constructor(cap * k); B.set(A); return B; };
      this.pos = re(this.pos, 3); this.col = re(this.col, 3); this.misc = re(this.misc, 4);
      this.cap = cap;
    }
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.misc[i * 4] = 255; this.misc[i * 4 + 1] = layer; this.misc[i * 4 + 2] = flags; this.misc[i * 4 + 3] = 0;
  }
  finish() {
    const n = this.n;
    return { count: n, pos: this.pos.slice(0, n * 3), col: this.col.slice(0, n * 3), misc: this.misc.slice(0, n * 4) };
  }
}

export function transferables(obj, list = []) {
  if (!obj) return list;
  if (ArrayBuffer.isView(obj)) { list.push(obj.buffer); return list; }
  if (Array.isArray(obj)) { for (const o of obj) transferables(o, list); return list; }
  if (typeof obj === 'object') { for (const k in obj) transferables(obj[k], list); }
  return list;
}
