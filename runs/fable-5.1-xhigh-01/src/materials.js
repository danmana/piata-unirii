// Procedural canvas textures and the material set shared by every voxel class.
import * as THREE from 'three';
import { makeRng } from './rng.js';

function canvasTexture(size, draw, { colorSpace = THREE.SRGBColorSpace, repeatMetres = 1 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = colorSpace;
  tex.anisotropy = 8;
  tex.repeat.set(1 / repeatMetres, 1 / repeatMetres);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function noiseFill(ctx, size, rng, base, amp, cell = 1) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const n = (rng() - 0.5) * 2 * amp;
      for (let yy = 0; yy < cell; yy++) {
        for (let xx = 0; xx < cell; xx++) {
          const i = ((y + yy) * size + (x + xx)) * 4;
          if (i >= d.length) continue;
          d[i] = Math.max(0, Math.min(255, base + n + d[i] - 255));
          d[i + 1] = Math.max(0, Math.min(255, base + n + d[i + 1] - 255));
          d[i + 2] = Math.max(0, Math.min(255, base + n + d[i + 2] - 255));
          d[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function fillWhite(ctx, size) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
}

/** Near-white detail maps multiplied with vertex colours. */
export function createTextures() {
  const rng = makeRng('textures');
  const T = {};

  T.plaster = canvasTexture(256, (ctx, s) => {
    fillWhite(ctx, s);
    noiseFill(ctx, s, rng, 244, 10, 2);
    noiseFill(ctx, s, rng, 255, 8, 7);
  }, { repeatMetres: 3 });

  T.stone = canvasTexture(512, (ctx, s) => {
    fillWhite(ctx, s);
    noiseFill(ctx, s, rng, 240, 10, 3);
    // ashlar courses: 4 rows per tile, staggered blocks
    const rows = 6;
    const rh = s / rows;
    ctx.strokeStyle = 'rgba(70,60,50,0.28)';
    ctx.lineWidth = 2;
    for (let r = 0; r < rows; r++) {
      const y = r * rh;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
      const bw = s / 3;
      const off = (r % 2) * bw * 0.5;
      for (let b = 0; b < 4; b++) {
        const x = (off + b * bw) % s;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + rh); ctx.stroke();
      }
      for (let b = 0; b < 3; b++) {
        const shade = 235 + Math.floor(rng() * 20);
        ctx.fillStyle = `rgba(${shade},${shade - 4},${shade - 10},0.35)`;
        const x = (off + b * bw) % s;
        ctx.fillRect(x + 1, y + 1, bw - 2, rh - 2);
      }
    }
  }, { repeatMetres: 4 });

  T.roof = canvasTexture(256, (ctx, s) => {
    fillWhite(ctx, s);
    noiseFill(ctx, s, rng, 236, 14, 4);
    const courses = 8;
    const ch = s / courses;
    for (let c = 0; c < courses; c++) {
      const y = c * ch;
      ctx.fillStyle = 'rgba(60,30,20,0.35)';
      ctx.fillRect(0, y, s, 2);
      const tw = s / 8;
      const off = (c % 2) * tw * 0.5;
      for (let t = 0; t < 9; t++) {
        const x = off + t * tw;
        ctx.fillStyle = 'rgba(60,30,20,0.18)';
        ctx.fillRect(x % s, y, 1.5, ch);
        const shade = rng();
        ctx.fillStyle = shade < 0.5 ? `rgba(255,255,255,${0.08 + shade * 0.1})` : `rgba(80,40,30,${(shade - 0.5) * 0.18})`;
        ctx.fillRect((x + 2) % s, y + 2, tw - 3, ch - 3);
      }
    }
  }, { repeatMetres: 2 });

  T.paving = canvasTexture(512, (ctx, s) => {
    fillWhite(ctx, s);
    noiseFill(ctx, s, rng, 246, 6, 2);
    // large smooth slabs 1.2m x 0.6m over a 4.8m tile: 4 x 8
    const cols = 4;
    const rows = 8;
    const cw = s / cols;
    const rh = s / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * cw * 0.5;
      for (let c = -1; c < cols; c++) {
        const x = c * cw + off;
        const y = r * rh;
        const v = rng();
        // pale grey / beige alternation
        const tint = v < 0.45 ? [232, 228, 220] : v < 0.8 ? [236, 230, 216] : [222, 220, 214];
        ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},0.55)`;
        ctx.fillRect(x + 1.5, y + 1.5, cw - 3, rh - 3);
        ctx.strokeStyle = 'rgba(90,85,80,0.35)';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1);
      }
    }
  }, { repeatMetres: 4.8 });

  T.road = canvasTexture(256, (ctx, s) => {
    fillWhite(ctx, s);
    noiseFill(ctx, s, rng, 232, 16, 3);
    // small stone setts
    const n = 16;
    const cw = s / n;
    for (let r = 0; r < n; r++) {
      const off = (r % 2) * cw * 0.5;
      for (let c = -1; c < n; c++) {
        const x = c * cw + off;
        const y = r * cw;
        ctx.strokeStyle = 'rgba(40,40,45,0.35)';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, cw - 1);
      }
    }
  }, { repeatMetres: 2 });

  T.grass = canvasTexture(256, (ctx, s) => {
    fillWhite(ctx, s);
    noiseFill(ctx, s, rng, 236, 22, 2);
    noiseFill(ctx, s, rng, 255, 14, 9);
  }, { repeatMetres: 3 });

  T.leaf = canvasTexture(128, (ctx, s) => {
    fillWhite(ctx, s);
    noiseFill(ctx, s, rng, 240, 26, 2);
  }, { repeatMetres: 1.5 });

  T.metal = canvasTexture(128, (ctx, s) => {
    fillWhite(ctx, s);
    noiseFill(ctx, s, rng, 248, 6, 2);
  }, { repeatMetres: 2 });

  T.water = canvasTexture(256, (ctx, s) => {
    fillWhite(ctx, s);
    noiseFill(ctx, s, rng, 244, 10, 3);
  }, { repeatMetres: 3 });

  return T;
}

/**
 * Material per voxel class. Each is a MeshStandardMaterial with vertex colours
 * (AO baked in) multiplied by a near-white detail texture.
 */
export function createMaterials(textures, env) {
  const std = (opts) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.92, metalness: 0.0 }, opts));
  const M = {};
  M.wall = std({ map: textures.plaster, roughness: 0.95 });
  M.stone = std({ map: textures.stone, roughness: 0.9 });
  M.roof = std({ map: textures.roof, roughness: 0.85 });
  M.pave = std({ map: textures.paving, roughness: 0.8 });
  M.road = std({ map: textures.road, roughness: 0.95 });
  M.grass = std({ map: textures.grass, roughness: 1.0 });
  M.leaf = std({ map: textures.leaf, roughness: 1.0 });
  M.wood = std({ roughness: 0.85 });
  M.dark = std({ roughness: 0.7, metalness: 0.15 });
  M.metal = std({ map: textures.metal, roughness: 0.45, metalness: 0.75, envMapIntensity: 0.7 });
  M.bronze = std({ roughness: 0.5, metalness: 0.85, envMapIntensity: 0.9 });
  M.paint = std({ roughness: 0.4, metalness: 0.3 }); // vehicles
  M.cloth = std({ roughness: 1.0 });
  M.emissive = std({ emissive: new THREE.Color(0xffc987), emissiveIntensity: 0.0, roughness: 0.6 });
  M.lamp = std({ emissive: new THREE.Color(0xffd9a0), emissiveIntensity: 0.0, roughness: 0.4 });
  M.glass = std({
    transparent: true, opacity: 0.62, roughness: 0.08, metalness: 0.55, envMapIntensity: 1.0, depthWrite: false,
  });
  M.glassDark = std({
    transparent: true, opacity: 0.85, roughness: 0.15, metalness: 0.4, envMapIntensity: 0.8, depthWrite: true,
  });
  M.glassLit = std({
    transparent: true, opacity: 0.7, roughness: 0.15, metalness: 0.4, emissive: new THREE.Color(0xffb864), emissiveIntensity: 0.0, depthWrite: false,
  });
  M.water = std({
    map: textures.water, transparent: true, opacity: 0.78, roughness: 0.05, metalness: 0.6, envMapIntensity: 1.2, depthWrite: false,
  });
  M.skin = std({ roughness: 0.9 });
  // Reflections only where they read (glass, water, metals, car paint); bulk materials stay cheap.
  const reflective = { metal: 0.7, bronze: 0.9, paint: 0.5, glass: 1.0, glassDark: 0.8, glassLit: 0.6, water: 1.2 };
  for (const k of Object.keys(M)) {
    M[k].name = k;
    if (env && reflective[k] !== undefined) { M[k].envMap = env; M[k].envMapIntensity = reflective[k]; }
  }
  return M;
}

/** Depth-sort order and shadow behaviour per class. */
export const CLASS_INFO = {
  wall: { shadow: true }, stone: { shadow: true }, roof: { shadow: true }, pave: { shadow: false },
  road: { shadow: false }, grass: { shadow: false }, leaf: { shadow: true }, wood: { shadow: true },
  dark: { shadow: true }, metal: { shadow: true }, bronze: { shadow: true }, paint: { shadow: true },
  cloth: { shadow: true }, emissive: { shadow: false }, lamp: { shadow: false }, glass: { shadow: false },
  glassDark: { shadow: false }, glassLit: { shadow: false }, water: { shadow: false }, skin: { shadow: true },
};
