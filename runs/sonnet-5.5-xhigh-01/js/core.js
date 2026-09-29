/* Piata Unirii — core utilities: math, seeded RNG, noise */
(function () {
  'use strict';
  const PU = (window.PU = window.PU || {});

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  PU.clamp = clamp;
  PU.lerp = lerp;
  PU.smoothstep = smoothstep;
  PU.TAU = Math.PI * 2;
  PU.DEG = Math.PI / 180;

  /* ---------- seeded RNG ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  class RNG {
    constructor(seed) {
      this.next = mulberry32(seed | 0);
    }
    f() {
      return this.next();
    }
    range(a, b) {
      return a + (b - a) * this.next();
    }
    int(a, b) {
      return a + Math.floor(this.next() * (b - a + 1));
    }
    chance(p) {
      return this.next() < p;
    }
    pick(arr) {
      return arr[Math.floor(this.next() * arr.length) % arr.length];
    }
    sign() {
      return this.next() < 0.5 ? -1 : 1;
    }
    gauss() {
      return (this.next() + this.next() + this.next() - 1.5) / 1.5;
    }
  }
  PU.RNG = RNG;
  PU.mulberry32 = mulberry32;

  function hash2(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function hash3(x, y, z, s) {
    let h =
      (Math.imul(x | 0, 374761393) +
        Math.imul(y | 0, 668265263) +
        Math.imul(z | 0, 2246822519) +
        Math.imul((s | 0) + 1, 1274126177)) |
      0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  PU.hash2 = hash2;
  PU.hash3 = hash3;

  /* smooth value noise (non-periodic) */
  function noise2(x, y, s) {
    const xi = Math.floor(x),
      yi = Math.floor(y);
    const xf = x - xi,
      yf = y - yi;
    const u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s),
      b = hash2(xi + 1, yi, s),
      c = hash2(xi, yi + 1, s),
      d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm2(x, y, oct, s) {
    let a = 0.5,
      f = 1,
      sum = 0,
      norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += a * noise2(x * f, y * f, (s | 0) + i * 17);
      norm += a;
      a *= 0.5;
      f *= 2;
    }
    return sum / norm;
  }
  /* periodic value noise, period px/py integer lattice cells */
  function pnoise2(x, y, px, py, s) {
    const xi = Math.floor(x),
      yi = Math.floor(y);
    const xf = x - xi,
      yf = y - yi;
    const u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % px) + px) % px,
      x1 = (x0 + 1) % px;
    const y0 = ((yi % py) + py) % py,
      y1 = (y0 + 1) % py;
    const a = hash2(x0, y0, s),
      b = hash2(x1, y0, s),
      c = hash2(x0, y1, s),
      d = hash2(x1, y1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function pfbm2(x, y, per, oct, s) {
    let a = 0.5,
      f = 1,
      sum = 0,
      norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += a * pnoise2(x * f, y * f, per * f, per * f, (s | 0) + i * 31);
      norm += a;
      a *= 0.5;
      f *= 2;
    }
    return sum / norm;
  }
  PU.noise2 = noise2;
  PU.fbm2 = fbm2;
  PU.pnoise2 = pnoise2;
  PU.pfbm2 = pfbm2;

  /* ---------- mat4 (column major) ---------- */
  const M4 = {
    create() {
      const m = new Float32Array(16);
      m[0] = m[5] = m[10] = m[15] = 1;
      return m;
    },
    identity(o) {
      o.fill(0);
      o[0] = o[5] = o[10] = o[15] = 1;
      return o;
    },
    perspective(o, fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2),
        nf = 1 / (near - far);
      o.fill(0);
      o[0] = f / aspect;
      o[5] = f;
      o[10] = (far + near) * nf;
      o[11] = -1;
      o[14] = 2 * far * near * nf;
      return o;
    },
    ortho(o, l, r, b, t, n, f) {
      o.fill(0);
      o[0] = 2 / (r - l);
      o[5] = 2 / (t - b);
      o[10] = -2 / (f - n);
      o[12] = -(r + l) / (r - l);
      o[13] = -(t + b) / (t - b);
      o[14] = -(f + n) / (f - n);
      o[15] = 1;
      return o;
    },
    lookAt(o, ex, ey, ez, tx, ty, tz, ux, uy, uz) {
      let zx = ex - tx,
        zy = ey - ty,
        zz = ez - tz;
      let l = Math.hypot(zx, zy, zz) || 1;
      zx /= l;
      zy /= l;
      zz /= l;
      let xx = uy * zz - uz * zy,
        xy = uz * zx - ux * zz,
        xz = ux * zy - uy * zx;
      l = Math.hypot(xx, xy, xz) || 1;
      xx /= l;
      xy /= l;
      xz /= l;
      const yx = zy * xz - zz * xy,
        yy = zz * xx - zx * xz,
        yz = zx * xy - zy * xx;
      o[0] = xx;
      o[1] = yx;
      o[2] = zx;
      o[3] = 0;
      o[4] = xy;
      o[5] = yy;
      o[6] = zy;
      o[7] = 0;
      o[8] = xz;
      o[9] = yz;
      o[10] = zz;
      o[11] = 0;
      o[12] = -(xx * ex + xy * ey + xz * ez);
      o[13] = -(yx * ex + yy * ey + yz * ez);
      o[14] = -(zx * ex + zy * ey + zz * ez);
      o[15] = 1;
      return o;
    },
    multiply(o, a, b) {
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
      const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
      o[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
      b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
      o[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
      b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
      o[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
      b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
      o[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
      return o;
    },
    invert(o, a) {
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
      const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
      const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
      const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
      const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
      const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
      const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return null;
      det = 1 / det;
      o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
      o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
      o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
      o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
      o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
      o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
      o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
      o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
      o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
      o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
      o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
      o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
      o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
      o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
      o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
      o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
      return o;
    },
    /* transform point, returns [x,y,z,w] into out array */
    project(m, x, y, z, out) {
      out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
      out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      out[3] = m[3] * x + m[7] * y + m[11] * z + m[15];
      return out;
    },
    /* extract 6 frustum planes (normalised) from a view-projection matrix */
    frustum(m, planes) {
      const p = planes || new Float32Array(24);
      for (let i = 0; i < 6; i++) {
        const row = i >> 1,
          sgn = i & 1 ? -1 : 1;
        let a = m[3] + sgn * m[row],
          b = m[7] + sgn * m[4 + row],
          c = m[11] + sgn * m[8 + row],
          d = m[15] + sgn * m[12 + row];
        const l = Math.hypot(a, b, c) || 1;
        p[i * 4] = a / l;
        p[i * 4 + 1] = b / l;
        p[i * 4 + 2] = c / l;
        p[i * 4 + 3] = d / l;
      }
      return p;
    },
    aabbVisible(planes, x0, y0, z0, x1, y1, z1) {
      for (let i = 0; i < 6; i++) {
        const a = planes[i * 4], b = planes[i * 4 + 1], c = planes[i * 4 + 2], d = planes[i * 4 + 3];
        const px = a > 0 ? x1 : x0,
          py = b > 0 ? y1 : y0,
          pz = c > 0 ? z1 : z0;
        if (a * px + b * py + c * pz + d < 0) return false;
      }
      return true;
    },
    sphereVisible(planes, x, y, z, r) {
      for (let i = 0; i < 6; i++) {
        if (planes[i * 4] * x + planes[i * 4 + 1] * y + planes[i * 4 + 2] * z + planes[i * 4 + 3] < -r) return false;
      }
      return true;
    },
  };
  PU.M4 = M4;

  /* colour helpers */
  PU.hex = function (h) {
    if (typeof h === 'string') h = parseInt(h.replace('#', ''), 16);
    return [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  };
  PU.now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
})();
