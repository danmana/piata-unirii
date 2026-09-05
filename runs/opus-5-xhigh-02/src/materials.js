// One three.js material per voxel group. Each material is a separate draw pool;
// per-voxel colour arrives through vertex colours, per-square-metre grain through
// the shared procedural atlas.

import * as THREE from 'three';
import { buildAtlas } from './textures.js';

// metres covered by one repeat of the group's atlas tile
const TILE_METRES = {
  stone: 2.4,
  plaster: 1.8,
  terracotta: 2.2,
  bronze: 1.2,
  vegetation: 1.4,
  pavement: 4.0,
  glass: 1.6,
  glasslit: 1.6,
  water: 3.0,
  metal: 1.6,
  wood: 1.2,
  lamp: 1.0,
};

export class MaterialLibrary {
  constructor() {
    const { textures } = buildAtlas();
    this.textures = textures;
    this.mats = {};
    this.shadowCasters = new Set(['stone', 'plaster', 'terracotta', 'bronze', 'vegetation', 'metal', 'wood', 'pavement']);

    const tex = (name) => {
      const t = textures[name].clone();
      t.needsUpdate = true;
      const k = 1 / TILE_METRES[name];
      t.repeat.set(k, k);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.NoColorSpace;
      return t;
    };

    const phong = (name, opts = {}) => new THREE.MeshPhongMaterial(Object.assign({
      vertexColors: true, map: tex(name), shininess: 2, specular: 0x0a0a0a, flatShading: false,
    }, opts));

    this.mats.stone = phong('stone', { shininess: 3, specular: 0x111110 });
    this.mats.plaster = phong('plaster', { shininess: 1, specular: 0x080808 });
    this.mats.terracotta = phong('terracotta', { shininess: 5, specular: 0x141010 });
    this.mats.pavement = phong('pavement', { shininess: 6, specular: 0x141414 });
    this.mats.vegetation = phong('vegetation', { shininess: 0, specular: 0x000000 });
    this.mats.wood = phong('wood', { shininess: 4, specular: 0x0e0c0a });

    this.mats.bronze = new THREE.MeshStandardMaterial({
      vertexColors: true, map: tex('bronze'), metalness: 0.22, roughness: 0.48,
    });
    this.mats.metal = new THREE.MeshStandardMaterial({
      vertexColors: true, map: tex('metal'), metalness: 0.30, roughness: 0.42,
    });
    this.mats.glass = new THREE.MeshStandardMaterial({
      vertexColors: true, map: tex('glass'), metalness: 0.20, roughness: 0.14,
    });
    this.mats.glasslit = new THREE.MeshStandardMaterial({
      vertexColors: true, map: tex('glasslit'), metalness: 0.10, roughness: 0.30,
      emissive: new THREE.Color(0xffc772), emissiveIntensity: 0.0,
    });
    this.mats.water = new THREE.MeshStandardMaterial({
      vertexColors: true, map: tex('water'), metalness: 0.35, roughness: 0.06,
      transparent: true, opacity: 0.78, depthWrite: true,
    });
    this.mats.lamp = new THREE.MeshPhongMaterial({
      vertexColors: true, shininess: 0, emissive: new THREE.Color(0xffd9a0), emissiveIntensity: 0.15,
    });

    for (const k of Object.keys(this.mats)) this.mats[k].name = 'vox-' + k;
  }

  get(group) { return this.mats[group] || this.mats.stone; }
  casts(group) { return this.shadowCasters.has(group); }

  /** t: 0 = clear day, 1 = golden hour. */
  setTimeOfDay(t) {
    this.mats.glasslit.emissiveIntensity = 0.02 + 1.25 * t * t;
    this.mats.lamp.emissiveIntensity = 0.1 + 1.5 * t;
    this.mats.glass.roughness = 0.12 + 0.06 * t;
    this.mats.water.opacity = 0.78 - 0.08 * t;
    this.mats.water.roughness = 0.06 + 0.04 * t;
  }

  dispose() {
    for (const m of Object.values(this.mats)) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
  }
}
