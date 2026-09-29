/* Piata Unirii — programmatically generated shared texture atlas (Canvas ImageData -> WebGL2 texture array).
   One layer per render pool. RGB = multiplicative detail around 0.5 (shader scales x2). Water layer stores a normal map. */
(function () {
  'use strict';
  const PU = window.PU;
  const SIZE = 256;

  function makeLayers() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = SIZE;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const img = ctx.createImageData(SIZE, SIZE);
    const layers = [];
    const hash2 = PU.hash2, pf = PU.pfbm2;

    function bake(fn) {
      const d = img.data;
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
          const c = fn(x, y);
          const o = (y * SIZE + x) * 4;
          d[o] = Math.max(0, Math.min(255, c[0] * 255));
          d[o + 1] = Math.max(0, Math.min(255, c[1] * 255));
          d[o + 2] = Math.max(0, Math.min(255, c[2] * 255));
          d[o + 3] = 255;
        }
      ctx.putImageData(img, 0, 0);
      layers.push(new Uint8Array(ctx.getImageData(0, 0, SIZE, SIZE).data));
    }

    // 0 STONE — ashlar courses, running bond
    bake((x, y) => {
      const row = y >> 5, ry = y & 31;
      const off = (row * 37) % 64;
      const bx = Math.floor((x + off) / 64), rx = (x + off) % 64;
      let v = 0.5 + (hash2(bx, row, 3) - 0.5) * 0.1 + (pf(x / 32, y / 32, 8, 4, 5) - 0.5) * 0.16 + (hash2(x, y, 9) - 0.5) * 0.035;
      if (ry < 1 || rx < 1) v -= 0.11;
      else if (ry === 1 || rx === 1) v += 0.03;
      return [v, v * 0.995, v * 0.98];
    });
    // 1 PLASTER — fine render grain and soft staining
    bake((x, y) => {
      const v = 0.5 + (pf(x / 16, y / 16, 16, 4, 11) - 0.5) * 0.09 + (pf(x / 64, y / 64, 4, 2, 13) - 0.5) * 0.08 + (hash2(x, y, 4) - 0.5) * 0.045;
      return [v, v, v];
    });
    // 2 TERRACOTTA — pan tile courses
    bake((x, y) => {
      const row = y >> 5, ry = y & 31;
      const off = (row & 1) * 16;
      const tx = (x + off) & 31;
      const tileId = ((x + off) >> 5) + row * 8;
      const tone = (hash2(tileId & 255, row, 21) - 0.5) * 0.2;
      let v = 0.56 - 0.22 * (ry / 31) + (pf(x / 24, y / 24, 10, 3, 17) - 0.5) * 0.1;
      if (ry >= 29) v -= 0.14;
      if (tx < 1 || tx === 16) v -= 0.05;
      const fine = (hash2(x, y, 6) - 0.5) * 0.05;
      v += fine;
      return [v * (1 + tone * 0.6), v, v * (1 - tone * 0.7)];
    });
    // 3 BRONZE — streaked patina
    bake((x, y) => {
      const s = pf(x / 4, y / 32, 64, 3, 31) - 0.5;
      const n = pf(x / 12, y / 12, 21, 3, 33) - 0.5;
      const v = 0.5 + s * 0.25 + n * 0.18 + (hash2(x, y, 5) - 0.5) * 0.05;
      return [v, v, v];
    });
    // 4 VEGETATION — leaf clumps
    bake((x, y) => {
      const a = pf(x / 8, y / 8, 32, 3, 41) - 0.5;
      const b = pf(x / 3, y / 3, 85, 2, 43) - 0.5;
      const v = 0.5 + a * 0.32 + b * 0.16 + (hash2(x, y, 8) - 0.5) * 0.08;
      return [v, v * 1.02, v * 0.96];
    });
    // 5 PAVEMENT — 1 m slabs with joints
    bake((x, y) => {
      const sx = x & 63, sy = y & 63;
      const id = (x >> 6) + (y >> 6) * 4;
      let v = 0.5 + (hash2(id, 1, 51) - 0.5) * 0.09 + (pf(x / 24, y / 24, 10, 3, 53) - 0.5) * 0.09 + (hash2(x, y, 12) - 0.5) * 0.05;
      if (sx < 1 || sy < 1) v -= 0.16;
      else if (sx === 1 || sy === 1) v += 0.025;
      return [v, v, v * 0.985];
    });
    // 6 GLASS — faint streaks
    bake((x, y) => {
      const v = 0.5 + (pf(x / 6, y / 40, 42, 2, 61) - 0.5) * 0.1;
      return [v, v, v];
    });
    // 7 WATER — tileable ripple normal map
    bake((x, y) => {
      let gx = 0, gz = 0;
      const waves = [[3, 1, 0.3, 1.0], [-2, 4, 1.7, 0.8], [5, -3, 2.9, 0.6], [1, 6, 0.9, 0.5], [-6, -5, 2.2, 0.4]];
      for (const w of waves) {
        const ph = (PU.TAU * (w[0] * x + w[1] * y)) / SIZE + w[2];
        const c = Math.cos(ph) * w[3];
        gx += c * w[0];
        gz += c * w[1];
      }
      const l = Math.hypot(gx, gz) || 1;
      const m = Math.min(1, l / 12);
      return [0.5 + (gx / l) * 0.5 * m, 0.5 + (gz / l) * 0.5 * m, 0.5];
    });
    // 8 MISC — wood grain / paint
    bake((x, y) => {
      const g = pf(x / 2, y / 24, 128, 2, 71) - 0.5;
      const v = 0.5 + g * 0.09 + (pf(x / 24, y / 24, 10, 2, 73) - 0.5) * 0.05 + (hash2(x, y, 3) - 0.5) * 0.03;
      return [v, v, v];
    });
    return layers;
  }

  PU.makeAtlas = function (gl) {
    const layers = makeLayers();
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    const levels = Math.floor(Math.log2(SIZE)) + 1;
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGBA8, SIZE, SIZE, layers.length);
    for (let i = 0; i < layers.length; i++) {
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, SIZE, SIZE, 1, gl.RGBA, gl.UNSIGNED_BYTE, layers[i]);
    }
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D_ARRAY, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return tex;
  };
})();
