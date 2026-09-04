// Matthias Corvinus monumental ensemble (LOD 0, 0.125 m voxels) and the
// Roman Napoca archaeological window (0.25 m voxels).
import * as THREE from 'three';
import { Model } from './voxel.js';
import { MONUMENT, ARCH } from './layout.js';
import { hash3 } from './rng.js';
import { figure } from './church.js';

export function buildMonument(world) {
  const P = world.palette;
  const M = {
    stone: P.get('#cfc6b0', 'stone'),
    stoneDark: P.get('#b9af98', 'stone'),
    step: P.get('#c6bea9', 'stone'),
    bronze: P.get('#433d33', 'bronze'),
    bronzeB: P.get('#514a41', 'bronze'),
    patina: P.get('#4c5c4a', 'bronze'),
    patinaB: P.get('#3f4f43', 'bronze'),
    plaque: P.get('#2c2822', 'bronze'),
    gold: P.get('#b08a3c', 'metal'),
  };
  const cx = MONUMENT.cx, cz = MONUMENT.cz;
  const baseY = Math.round(world.groundHeightAt(cx, cz) / 0.25) * 0.25;
  world.flattenGround(cx - 9, cz - 11, cx + 9, cz + 11, baseY);
  world.markOccluder(cx - 6.5, cz - 8.5, cx + 6.5, cz + 8.5);

  const model = new Model(P);
  model.addGrid([cx - 8, -0.5, cz - 10], [cx + 8, 14.5, cz + 10], 0.125);

  // ---- stepped base and pedestal ----
  model.box(cx - 6.5, -0.5, cz - 8.5, cx + 6.5, 0.375, cz + 8.5, M.step);
  model.box(cx - 5.75, 0.375, cz - 7.75, cx + 5.75, 0.75, cz + 7.75, M.step);
  // lower plinth where the four figures stand
  model.box(cx - 4.5, 0.75, cz - 6.5, cx + 4.5, 1.9, cz + 6.5, M.stone);
  model.box(cx - 4.65, 1.75, cz - 6.65, cx + 4.65, 1.9, cz + 6.65, M.stoneDark);
  // main block with base and crown mouldings
  const pb = 1.9, pt = 6.4;
  model.box(cx - 3.2, pb, cz - 5.4, cx + 3.2, pb + 0.5, cz + 5.4, M.stoneDark);
  model.box(cx - 3.0, pb, cz - 5.2, cx + 3.0, pt, cz + 5.2, M.stone);
  model.box(cx - 3.3, pt - 0.6, cz - 5.5, cx + 3.3, pt, cz + 5.5, M.stoneDark);
  model.box(cx - 3.45, pt, cz - 5.65, cx + 3.45, pt + 0.375, cz + 5.65, M.stone);
  // shallow vertical grooves on the long sides (ashlar rhythm)
  for (let k = -2; k <= 2; k++) {
    const gz = cz + k * 2.0;
    model.box(cx - 3.05, pb + 0.9, gz - 0.06, cx - 2.95, pt - 0.9, gz + 0.06, M.stoneDark);
    model.box(cx + 2.95, pb + 0.9, gz - 0.06, cx + 3.05, pt - 0.9, gz + 0.06, M.stoneDark);
  }
  // inscription plaque on the south (front) face: MATHIAS REX
  model.box(cx - 1.9, pb + 1.7, cz + 5.15, cx + 1.9, pb + 2.9, cz + 5.3, M.plaque);
  for (let i = 0; i < 11; i++) {
    const lx = cx - 1.55 + i * 0.3;
    if (i === 7) continue; // word gap
    model.box(lx - 0.09, pb + 2.05, cz + 5.3, lx + 0.09, pb + 2.55, cz + 5.38, M.gold);
  }
  // coat of arms shield above the plaque
  model.shape(cx - 0.8, pb + 3.1, cz + 5.15, cx + 0.8, pb + 4.3, cz + 5.45, (x, y, z) => {
    const u = (x - cx) / 0.75, v = (y - (pb + 3.75)) / 0.55;
    return u * u + (v < 0 ? (v * v) * 1.6 : v * v) <= 1;
  }, M.bronzeB);

  // ---- equestrian statue: horse faces south (+z) ----
  const top = pt + 0.375;
  const hy = top + 2.75; // horse body centre height
  const bronzeAt = (x, y, z) => {
    const h = hash3(Math.floor(x * 8), Math.floor(y * 8), Math.floor(z * 8), 7);
    return h < 0.55 ? M.bronze : h < 0.8 ? M.bronzeB : h < 0.92 ? M.patina : M.patinaB;
  };
  const fill = (fn) => (x, y, z) => (fn(x, y, z) ? bronzeAt(x, y, z) : 0);
  const paintB = (x0, y0, z0, x1, y1, z1, fn) => model.paint(x0, y0, z0, x1, y1, z1, fill(fn));
  // low bronze base plate the horse stands on
  model.box(cx - 1.6, top, cz - 3.6, cx + 1.6, top + 0.25, cz + 3.6, M.bronze);
  // body: elongated ellipsoid with fuller rump
  paintB(cx - 1.1, hy - 1.2, cz - 2.5, cx + 1.1, hy + 1.2, cz + 2.4, (x, y, z) => {
    const dx = (x - cx) / 0.85, dy = (y - hy) / 0.92, dz = (z - cz) / 2.15;
    const bulge = z < cz ? 1.08 : 1.0;
    return dx * dx / bulge + dy * dy / bulge + dz * dz <= 1;
  });
  // chest
  paintB(cx - 0.9, hy - 1.0, cz + 1.1, cx + 0.9, hy + 1.1, cz + 2.8, (x, y, z) => {
    const dx = (x - cx) / 0.75, dy = (y - (hy + 0.05)) / 0.82, dz = (z - (cz + 1.9)) / 0.82;
    return dx * dx + dy * dy + dz * dz <= 1;
  });
  // neck: thick tapered segment rising forward
  const neckA = [cx, hy + 0.6, cz + 1.95], neckB = [cx, hy + 2.15, cz + 3.25];
  paintB(cx - 0.8, hy + 0.1, cz + 1.3, cx + 0.8, hy + 2.8, cz + 4.0, (x, y, z) => {
    const ax = neckA[0], ay = neckA[1], az = neckA[2];
    const dx = neckB[0] - ax, dy = neckB[1] - ay, dz = neckB[2] - az;
    const L2 = dx * dx + dy * dy + dz * dz;
    let t = ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / L2;
    t = Math.max(0, Math.min(1, t));
    const qx = x - (ax + dx * t), qy = y - (ay + dy * t), qz = z - (az + dz * t);
    const r = 0.58 - t * 0.16;
    return (qx * qx) / (r * r) + (qy * qy) / ((r * 1.35) * (r * 1.35)) + (qz * qz) / (r * r) <= 1;
  });
  // head: lowered, elongated forward
  const hx = cx, hhy = hy + 2.05, hz = cz + 3.75;
  paintB(hx - 0.5, hhy - 0.7, hz - 0.6, hx + 0.5, hhy + 0.6, hz + 1.05, (x, y, z) => {
    const dx = (x - hx) / 0.33, dy = (y - (hhy - 0.05)) / 0.5, dz = (z - (hz + 0.2)) / 0.76;
    return dx * dx + dy * dy + dz * dz <= 1;
  });
  // ears
  model.box(hx - 0.3, hhy + 0.4, hz - 0.35, hx - 0.12, hhy + 0.85, hz - 0.15, M.bronze);
  model.box(hx + 0.12, hhy + 0.4, hz - 0.35, hx + 0.3, hhy + 0.85, hz - 0.15, M.bronze);
  // mane ridge
  model.line(cx, hy + 1.3, cz + 1.7, cx, hhy + 0.5, hz - 0.4, 0.2, M.bronzeB);
  // legs: three planted, front-left raised and bent
  const legR = 0.24;
  const legs = [
    [cx - 0.55, cz - 1.6, cx - 0.65, cz - 1.9], // hind left
    [cx + 0.55, cz - 1.6, cx + 0.65, cz - 1.5], // hind right
    [cx + 0.5, cz + 1.45, cx + 0.58, cz + 1.75], // fore right (planted)
  ];
  for (const [x0, z0, x1, z1] of legs) {
    model.line(x0, hy - 0.7, z0, x1, top + 0.25, z1, legR, M.bronze);
    model.box(x1 - 0.3, top + 0.25, z1 - 0.36, x1 + 0.3, top + 0.6, z1 + 0.28, M.bronzeB); // hoof
  }
  // raised foreleg: upper segment forward, lower segment folded back-down
  model.line(cx - 0.5, hy - 0.6, cz + 1.45, cx - 0.6, hy - 1.45, cz + 2.4, legR, M.bronze);
  model.line(cx - 0.6, hy - 1.45, cz + 2.4, cx - 0.62, hy - 2.3, cz + 2.0, legR * 0.9, M.bronze);
  // tail
  model.line(cx, hy + 0.5, cz - 2.15, cx + 0.05, hy - 1.6, cz - 2.85, 0.22, M.bronzeB);
  paintB(cx - 0.4, hy - 1.8, cz - 3.2, cx + 0.4, hy + 0.7, cz - 2.05, (x, y, z) => {
    const dx = (x - cx) / 0.28, dy = (y - (hy - 0.55)) / 1.18, dz = (z - (cz - 2.55)) / 0.4;
    return dx * dx + dy * dy + dz * dz <= 1;
  });
  // saddle cloth
  model.box(cx - 1.0, hy + 0.5, cz - 0.8, cx + 1.0, hy + 1.0, cz + 0.8, M.patina);
  // ---- the king ----
  const ky = hy + 0.85; // seat height
  // legs on both flanks
  model.line(cx - 0.75, ky + 0.15, cz + 0.15, cx - 1.05, ky - 1.05, cz + 0.75, 0.18, M.bronze);
  model.line(cx + 0.75, ky + 0.15, cz + 0.15, cx + 1.05, ky - 1.05, cz + 0.75, 0.18, M.bronze);
  // torso with armour, cloak falling behind
  paintB(cx - 0.65, ky, cz - 0.55, cx + 0.65, ky + 1.6, cz + 0.55, (x, y, z) => {
    const dx = (x - cx) / 0.52, dz = (z - (cz - 0.02)) / 0.42;
    return dx * dx + dz * dz <= 1;
  });
  model.shape(cx - 0.85, ky - 0.4, cz - 1.3, cx + 0.85, ky + 1.55, cz - 0.2, (x, y, z) => {
    const t = (y - (ky - 0.4)) / 1.95;
    return Math.abs(x - cx) <= 0.85 - t * 0.35 && z < cz - 0.28 && z > cz - 1.3 + t * 0.7;
  }, M.patina);
  // shoulders / arms: right arm forward holding reins, left arm raised with sceptre
  model.line(cx + 0.62, ky + 1.4, cz, cx + 0.7, ky + 0.75, cz + 0.95, 0.18, M.bronze);
  model.line(cx - 0.62, ky + 1.4, cz, cx - 0.9, ky + 1.9, cz + 0.3, 0.18, M.bronze);
  model.box(cx - 0.98, ky + 1.8, cz + 0.2, cx - 0.82, ky + 3.3, cz + 0.4, M.gold); // sceptre
  // head and crown
  model.box(cx - 0.28, ky + 1.6, cz - 0.28, cx + 0.28, ky + 2.25, cz + 0.28, M.bronze);
  model.box(cx - 0.33, ky + 2.2, cz - 0.33, cx + 0.33, ky + 2.4, cz + 0.33, M.gold);
  for (const [ox, oz] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28], [0, -0.3], [0, 0.3], [-0.3, 0], [0.3, 0]]) {
    model.box(cx + ox - 0.07, ky + 2.4, cz + oz - 0.07, cx + ox + 0.07, ky + 2.68, cz + oz + 0.07, M.gold);
  }
  // reins
  model.line(cx + 0.7, ky + 0.7, cz + 1.0, hx + 0.25, hhy - 0.15, hz + 0.45, 0.07, M.bronzeB);

  // ---- four bronze captains around the pedestal ----
  const captains = [
    { x: cx - 3.7, z: cz + 5.6, facing: Math.PI, banner: true },  // SW, holding a banner
    { x: cx + 3.7, z: cz + 5.6, facing: Math.PI, banner: true },  // SE, banner
    { x: cx - 3.8, z: cz - 1.2, facing: -Math.PI / 2, shield: true }, // W
    { x: cx + 3.8, z: cz - 1.2, facing: Math.PI / 2, shield: true },  // E
  ];
  for (const c of captains) {
    const h = 3.1;
    const ys = 1.9;
    // plinth block
    model.box(c.x - 0.6, ys, c.z - 0.6, c.x + 0.6, ys + 0.25, c.z + 0.6, M.bronzeB);
    figure(model, M.bronze, c.x, ys + 0.25, c.z, h, c.facing, { head: M.bronzeB });
    // armour highlights / patina
    model.paint(c.x - 0.8, ys, c.z - 0.8, c.x + 0.8, ys + h + 0.3, c.z + 0.8, (x, y, z, cur) => {
      if (cur !== M.bronze) return 0;
      const hh = hash3(Math.floor(x * 8), Math.floor(y * 8), Math.floor(z * 8), 11);
      return hh < 0.18 ? M.patina : hh > 0.88 ? M.bronzeB : 0;
    });
    // helmet
    model.box(c.x - 0.26, ys + 0.25 + h * 0.98, c.z - 0.26, c.x + 0.26, ys + 0.25 + h * 1.06, c.z + 0.26, M.bronzeB);
    if (c.banner) {
      // pole with a heavy hanging banner
      const px = c.x + (c.x < cx ? -0.75 : 0.75);
      model.box(px - 0.08, ys + 0.25, c.z - 0.08, px + 0.08, ys + 0.25 + 5.4, c.z + 0.08, M.bronzeB);
      model.box(px - 0.3, ys + 0.25 + 5.3, c.z - 0.3, px + 0.3, ys + 0.25 + 5.6, c.z + 0.3, M.gold);
      const bx0 = c.x < cx ? px - 1.0 : px + 0.08, bx1 = c.x < cx ? px - 0.08 : px + 1.0;
      model.shape(bx0, ys + 0.25 + 2.6, c.z - 0.25, bx1, ys + 0.25 + 5.3, c.z + 0.25, (x, y, z) => {
        const fold = 0.12 * Math.sin(y * 6.0);
        return Math.abs(z - c.z - fold) < 0.12;
      }, M.patina);
    }
    if (c.shield) {
      const sx = c.x + (c.x < cx ? -0.5 : 0.5);
      model.shape(sx - 0.15, ys + 0.6, c.z - 0.6, sx + 0.15, ys + 1.9, c.z + 0.6, (x, y, z) => {
        const u = (z - c.z) / 0.5, v = (y - (ys + 1.3)) / 0.6;
        return u * u + v * v <= 1;
      }, M.bronzeB);
      // spear
      model.box(c.x - 0.05, ys + 0.25, c.z + 0.45, c.x + 0.05, ys + 0.25 + 4.6, c.z + 0.55, M.bronzeB);
      model.cone(c.x, c.z + 0.5, 0.14, 0.02, ys + 0.25 + 4.6, ys + 0.25 + 5.1, M.gold, 4, 0);
    }
  }
  world.addModel(model, { x: 0, y: baseY, z: 0, rot: 0 });
  world.landmarks.monument = { baseY, top: baseY + top };

  buildArchWindow(world);
}

/** Roman Napoca archaeological window: glass-covered opening with lit foundations. */
function buildArchWindow(world) {
  const P = world.palette;
  const M = {
    roman: P.get('#8b7d69', 'stone'),
    romanB: P.get('#a3957f', 'stone'),
    mortar: P.get('#6d6252', 'stone'),
    frame: P.get('#2b2c2e', 'dark'),
    glass: P.get('#9fb4bf', 'glass'),
    glow: P.get('#ffb060', 'emissive'),
    bench: P.get('#c7bfab', 'stone'),
    benchTop: P.get('#7d5b3a', 'wood'),
  };
  const cx = ARCH.cx, cz = ARCH.cz, hw = ARCH.w / 2, hd = ARCH.d / 2;
  const baseY = Math.round(world.groundHeightAt(cx, cz + 4) / 0.25) * 0.25;
  const depth = 2.25;
  world.flattenGround(cx - hw - 2.5, cz - hd - 2.5, cx + hw + 2.5, cz + hd + 3.5, baseY);
  world.flattenGround(cx - hw, cz - hd, cx + hw, cz + hd, baseY - depth);
  const model = new Model(P);
  const g = model.addGrid([cx - hw - 3, baseY - depth - 0.25, cz - hd - 3], [cx + hw + 3, baseY + 1.5, cz + hd + 4], 0.25);
  g.solidBelow = true;
  const floorY = baseY - depth;
  // Roman masonry: wall stubs in an L / T layout, rubble course variation
  const walls = [
    [cx - 3.8, cz - 1.4, cx + 3.6, cz - 0.8, 1.1],
    [cx - 3.8, cz - 1.4, cx - 3.2, cz + 1.6, 0.9],
    [cx - 0.3, cz - 0.8, cx + 0.3, cz + 1.7, 0.7],
    [cx + 1.6, cz + 0.4, cx + 3.6, cz + 1.0, 0.55],
  ];
  for (const [x0, z0, x1, z1, h] of walls) {
    model.box(x0, floorY, z0, x1, floorY + h, z1, M.roman);
    model.paint(x0, floorY, z0, x1, floorY + h, z1, (x, y, z, cur) => {
      const hh = hash3(Math.floor(x * 4), Math.floor(y * 4), Math.floor(z * 4), 5);
      return hh < 0.3 ? M.romanB : hh > 0.85 ? M.mortar : 0;
    });
  }
  // scattered stones on the floor
  for (let i = 0; i < 14; i++) {
    const hx = hash3(i, 1, 0, 9), hz = hash3(i, 2, 0, 9);
    model.box(cx - hw + 0.5 + hx * (ARCH.w - 1), floorY, cz - hd + 0.4 + hz * (ARCH.d - 0.8), cx - hw + 0.75 + hx * (ARCH.w - 1), floorY + 0.25, cz - hd + 0.65 + hz * (ARCH.d - 0.8), M.romanB);
  }
  // warm light strips along the pit walls just under the glass
  model.box(cx - hw + 0.05, baseY - 0.5, cz - hd + 0.05, cx + hw - 0.05, baseY - 0.25, cz - hd + 0.3, M.glow);
  model.box(cx - hw + 0.05, baseY - 0.5, cz + hd - 0.3, cx + hw - 0.05, baseY - 0.25, cz + hd - 0.05, M.glow);
  // dark frame flush with the paving and the glass plate
  model.box(cx - hw - 0.4, baseY, cz - hd - 0.4, cx + hw + 0.4, baseY + 0.2, cz + hd + 0.4, M.frame);
  model.box(cx - hw + 0.05, baseY - 0.05, cz - hd + 0.05, cx + hw - 0.05, baseY + 0.2, cz + hd - 0.05, M.glass);
  // mullion bars across the glass
  for (let k = -1; k <= 1; k++) model.box(cx + k * 2.4 - 0.08, baseY + 0.15, cz - hd, cx + k * 2.4 + 0.08, baseY + 0.28, cz + hd, M.frame);
  // seating edge along the south side
  model.box(cx - hw - 0.4, baseY, cz + hd + 0.9, cx + hw + 0.4, baseY + 0.45, cz + hd + 1.6, M.bench);
  model.box(cx - hw - 0.4, baseY + 0.45, cz + hd + 0.9, cx + hw + 0.4, baseY + 0.55, cz + hd + 1.6, M.benchTop);
  world.addModel(model, { x: 0, y: 0, z: 0, rot: 0 });
  // small warm point light for the evening glow
  const light = new THREE.PointLight(0xffa050, 0, 14, 2);
  light.position.set(cx, baseY - 0.8, cz);
  light.visible = false;
  world.dynamic.add(light);
  world.nightLights.push({ light, intensity: 26 });
  world.landmarks.arch = { baseY };
}
