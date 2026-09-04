// Sky dome, voxel clouds, sun/sky lighting and the day <-> sunset transition.
import * as THREE from 'three';
import { makeRng } from './rng.js';

const MODES = {
  day: {
    sunAzimuth: 205, sunElevation: 52, sunColor: new THREE.Color(0xfff2dc), sunIntensity: 3.4,
    hemiSky: new THREE.Color(0x9fc4ff), hemiGround: new THREE.Color(0xb8a58c), hemiIntensity: 1.15,
    ambient: 0.28,
    skyTop: new THREE.Color(0x2f6fd6), skyHorizon: new THREE.Color(0xcfe3f7), skyGround: new THREE.Color(0x8d9aa8),
    fog: new THREE.Color(0xcfdceb), fogNear: 900, fogFar: 3600,
    sunDiscColor: new THREE.Color(0xfff6e0), sunSize: 1.0, glow: 0.35,
    lamps: 0.0, windows: 0.0, exposure: 1.0, cloudTint: new THREE.Color(0xffffff),
  },
  sunset: {
    sunAzimuth: 286, sunElevation: 7.5, sunColor: new THREE.Color(0xffa64d), sunIntensity: 3.0,
    hemiSky: new THREE.Color(0x6f7fb8), hemiGround: new THREE.Color(0x7a5a45), hemiIntensity: 0.62,
    ambient: 0.22,
    skyTop: new THREE.Color(0x27407a), skyHorizon: new THREE.Color(0xf0a45e), skyGround: new THREE.Color(0x4a3a3a),
    fog: new THREE.Color(0xd9a37a), fogNear: 700, fogFar: 3000,
    sunDiscColor: new THREE.Color(0xffc080), sunSize: 1.6, glow: 1.2,
    lamps: 1.0, windows: 1.0, exposure: 0.95, cloudTint: new THREE.Color(0xffd2b8),
  },
};

export function sunDirection(azimuthDeg, elevationDeg) {
  // azimuth measured clockwise from north (0 = north, 90 = east, 180 = south, 270 = west); +z = south, +x = east
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  const c = Math.cos(el);
  return new THREE.Vector3(Math.sin(az) * c, Math.sin(el), -Math.cos(az) * c).normalize();
}

export class Sky {
  constructor(scene, renderer, materials) {
    this.scene = scene;
    this.renderer = renderer;
    this.materials = materials;
    this.mode = 'day';
    this.blend = 0; // 0 = day, 1 = sunset
    this.target = 0;

    this.uniforms = {
      topColor: { value: new THREE.Color() },
      horizonColor: { value: new THREE.Color() },
      groundColor: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunSize: { value: 1 },
      glow: { value: 0.3 },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 groundColor; uniform vec3 sunColor; uniform vec3 sunDir;
        uniform float sunSize; uniform float glow;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos - cameraPosition);
          float h = dir.y;
          float t = pow(smoothstep(-0.01, 0.45, h), 0.55);
          vec3 col = mix(horizonColor, topColor, t);
          if (h < 0.0) col = mix(horizonColor, groundColor, smoothstep(0.0, -0.12, h));
          float sd = max(dot(dir, sunDir), 0.0);
          float disc = smoothstep(0.9993 - 0.0006 * sunSize, 0.9997, sd);
          col += sunColor * (disc * 3.0 + glow * pow(sd, 8.0) * 0.6 + glow * pow(sd, 2.0) * 0.12);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(5200, 48, 24), skyMat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    // lights
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 50;
    this.sun.shadow.camera.far = 1100;
    this.sun.shadow.camera.left = -210;
    this.sun.shadow.camera.right = 210;
    this.sun.shadow.camera.top = 210;
    this.sun.shadow.camera.bottom = -210;
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.5;
    this.sun.shadow.radius = 2;
    this.sun.target.position.set(-10, 0, 0);
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(this.ambient);

    scene.fog = new THREE.Fog(0xffffff, 900, 3500);

    // evening floodlights on the church (spot lights, no shadows)
    this.floods = [];
    const mkFlood = (pos, target, color, angle) => {
      const s = new THREE.SpotLight(color, 0, 260, angle, 0.5, 1.2);
      s.position.copy(pos);
      s.target.position.copy(target);
      s.visible = false;
      scene.add(s);
      scene.add(s.target);
      this.floods.push(s);
    };
    mkFlood(new THREE.Vector3(-10, 6, 44), new THREE.Vector3(-12, 24, -24), 0xffd2a0, 0.6);
    mkFlood(new THREE.Vector3(-96, 4, -4), new THREE.Vector3(-51, 55, -40), 0xffe0b8, 0.34);

    this.clouds = this.makeClouds();
    scene.add(this.clouds);

    this.apply(0);
  }

  makeClouds() {
    const rng = makeRng('clouds');
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, emissive: 0x222222, fog: true });
    const puffs = [];
    for (let c = 0; c < 26; c++) {
      const cx = rng.range(-2400, 2400);
      const cz = rng.range(-2400, 2400);
      const cy = rng.range(330, 520);
      const n = rng.int(6, 16);
      const scale = rng.range(0.8, 1.9);
      for (let i = 0; i < n; i++) {
        const w = rng.range(28, 90) * scale;
        const h = rng.range(9, 24) * scale;
        const d = rng.range(24, 70) * scale;
        puffs.push({ x: cx + rng.gauss() * 70 * scale, y: cy + rng.gauss() * 6, z: cz + rng.gauss() * 45 * scale, w, h, d });
      }
    }
    const mesh = new THREE.InstancedMesh(geo, mat, puffs.length);
    const m = new THREE.Matrix4();
    puffs.forEach((p, i) => {
      m.compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion(), new THREE.Vector3(p.w, p.h, p.d));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.userData.puffs = puffs;
    mesh.userData.material = mat;
    return mesh;
  }

  toggle() {
    this.target = this.target > 0.5 ? 0 : 1;
    this.mode = this.target > 0.5 ? 'sunset' : 'day';
  }

  update(dt, elapsed) {
    const speed = 0.55;
    if (this.blend !== this.target) {
      this.blend += Math.sign(this.target - this.blend) * Math.min(Math.abs(this.target - this.blend), dt * speed);
      this.apply(this.blend);
    }
    // drift clouds
    const puffs = this.clouds.userData.puffs;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    const drift = elapsed * 2.2;
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i];
      let x = p.x + drift;
      x = ((x + 2600) % 5200 + 5200) % 5200 - 2600;
      v.set(x, p.y, p.z);
      s.set(p.w, p.h, p.d);
      m.compose(v, q, s);
      this.clouds.setMatrixAt(i, m);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
  }

  apply(b) {
    const A = MODES.day, B = MODES.sunset;
    const lerp = (a, c) => a + (c - a) * b;
    const col = (a, c) => a.clone().lerp(c, b);
    const dir = sunDirection(lerp(A.sunAzimuth, B.sunAzimuth), lerp(A.sunElevation, B.sunElevation));
    this.sunDir = dir;
    this.sun.position.copy(this.sun.target.position).addScaledVector(dir, 520);
    this.sun.color.copy(col(A.sunColor, B.sunColor));
    this.sun.intensity = lerp(A.sunIntensity, B.sunIntensity);
    this.hemi.color.copy(col(A.hemiSky, B.hemiSky));
    this.hemi.groundColor.copy(col(A.hemiGround, B.hemiGround));
    this.hemi.intensity = lerp(A.hemiIntensity, B.hemiIntensity);
    this.ambient.intensity = lerp(A.ambient, B.ambient);
    this.uniforms.topColor.value.copy(col(A.skyTop, B.skyTop));
    this.uniforms.horizonColor.value.copy(col(A.skyHorizon, B.skyHorizon));
    this.uniforms.groundColor.value.copy(col(A.skyGround, B.skyGround));
    this.uniforms.sunColor.value.copy(col(A.sunDiscColor, B.sunDiscColor));
    this.uniforms.sunDir.value.copy(dir);
    this.uniforms.sunSize.value = lerp(A.sunSize, B.sunSize);
    this.uniforms.glow.value = lerp(A.glow, B.glow);
    this.scene.fog.color.copy(col(A.fog, B.fog));
    this.scene.fog.near = lerp(A.fogNear, B.fogNear);
    this.scene.fog.far = lerp(A.fogFar, B.fogFar);
    this.renderer.toneMappingExposure = lerp(A.exposure, B.exposure);
    const lamps = lerp(A.lamps, B.lamps);
    const windows = lerp(A.windows, B.windows);
    const M = this.materials;
    if (M) {
      M.lamp.emissiveIntensity = lamps * 2.6;
      M.emissive.emissiveIntensity = lamps * 1.6;
      M.glassLit.emissiveIntensity = windows * 1.4;
      M.glassLit.opacity = 0.7 + windows * 0.25;
    }
    for (const f of this.floods) { f.intensity = lamps * 2600; f.visible = lamps > 0.02; }
    this.clouds.userData.material.color.copy(col(A.cloudTint, B.cloudTint));
    this.clouds.userData.material.emissive.copy(col(new THREE.Color(0x202020), new THREE.Color(0x9a4e3a)));
  }
}
