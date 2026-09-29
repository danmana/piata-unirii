// Piața Unirii, Cluj-Napoca — voxel miniature. Application bootstrap.

import * as THREE from 'three';
import { createAtlas } from './render/atlas.js';
import { createPools, createSurfaceMaterials, U } from './render/materials.js';
import { createSky, TOD, sunDirection, mixTod } from './render/sky.js';
import { Post } from './render/post.js';
import { WorldBatches } from './render/batches.js';
import { JobRunner } from './core/jobs-runner.js';
import { GodCamera } from './ui/camera.js';
import { makePlan } from './plan/layout.js';
import { Scenery } from './sim/scenery.js';
import { Labels } from './ui/labels.js';
import { VIEWS } from './plan/views.js';

const $ = (id) => document.getElementById(id);

function fail(msg, err) {
  console.error(msg, err);
  const el = $('error');
  el.hidden = false;
  el.textContent = msg + (err ? '\n\n' + (err.stack || err.message || String(err)) : '');
  const ld = $('loader');
  if (ld) ld.classList.add('done');
}

window.addEventListener('error', (e) => { if (!window.__appReady) fail('Unexpected error while starting.', e.error || e.message); });
window.addEventListener('unhandledrejection', (e) => { if (!window.__appReady) fail('Unexpected error while starting.', e.reason); });

class App {
  constructor() {
    this.canvas = $('view');
    const params = new URLSearchParams(location.search);
    this.seed = parseInt(params.get('seed') || '1', 10) || 1;
    this.quality = params.get('q') || 'auto';
    this.timer = new THREE.Timer();
    this.todT = 0; this.todTarget = 0;
    this.view = 'default';
    this.labelsOn = false;
    this.frame = 0;
    this.fps = 60; this.fpsAcc = 0; this.fpsN = 0;
    this.pixelRatio = 1;
  }

  async init() {
    const gl = this.canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
    if (!gl) throw new Error('WebGL2 is required to view this scene.');
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, context: gl, antialias: false });
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = false;
    r.info.autoReset = false;
    this.maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    this.pixelRatio = this.quality === 'high' ? this.maxDpr : Math.min(this.maxDpr, 1.25);
    const forced = parseFloat(new URLSearchParams(location.search).get('dpr'));
    if (forced > 0) { this.pixelRatio = forced; this.quality = 'fixed'; }

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 1.0, 30000);
    this.post = new Post(r);

    this.setStage('Painting material atlas…', 0.02);
    await tick();
    this.atlas = createAtlas();
    this.atlas.texture.anisotropy = Math.min(8, r.capabilities.getMaxAnisotropy());

    // lights
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const sh = this.sun.shadow;
    sh.mapSize.set(4096, 4096);
    sh.bias = -0.00025;
    sh.normalBias = 0.06;
    sh.radius = 2.2;
    const sc = sh.camera;
    sc.left = -290; sc.right = 290; sc.top = 290; sc.bottom = -290; sc.near = 10; sc.far = 1400;
    sc.layers.enable(1); // shadow-only proxies live on layer 1
    this.sunTarget = new THREE.Object3D();
    this.sunTarget.position.set(0, 0, 0);
    this.scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xa0b8e0, 0x6b6153, 0.9);
    this.scene.add(this.hemi);

    // sky + environment maps for both times of day
    this.sky = createSky();
    this.scene.add(this.sky.mesh);
    this.pmrem = new THREE.PMREMGenerator(r);
    this.env = {};
    for (const k of ['day', 'sunset']) {
      this.applyTod(TOD[k]);
      const envScene = new THREE.Scene();
      const skyClone = new THREE.Mesh(this.sky.mesh.geometry, this.sky.material.clone());
      skyClone.material.uniforms = THREE.UniformsUtils.clone(this.sky.uniforms);
      skyClone.material.uniforms.uSunDir.value.copy(U.uSunDir.value);
      skyClone.scale.setScalar(0.02);
      envScene.add(skyClone);
      this.env[k] = this.pmrem.fromScene(envScene, 0.02, 1, 1000).texture;
      skyClone.material.dispose();
    }
    this.pools = createPools(this.atlas, this.env.day);
    this.surfaces = createSurfaceMaterials(this.env.day);

    // plan + generation
    this.setStage('Laying out the square…', 0.05);
    await tick();
    this.plan = makePlan(this.seed);
    await this.generate();

    // camera
    this.controls = new GodCamera(this.camera, this.canvas, {
      groundAt: (x, z) => this.plan.groundHeight(x, z),
      onInteract: () => {},
    });
    const v = VIEWS.default;
    this.controls.lookFrom(new THREE.Vector3(...v.pos), new THREE.Vector3(...v.target), 0);

    this.labels = new Labels($('labels'), this.plan.labels, this.camera);

    this.bindKeys();
    window.addEventListener('resize', () => this.resize());
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail('The WebGL context was lost (GPU reset). Reload the page to continue.'); });
    this.resize();
    this.applyTod(TOD.day, 0);
    this.renderer.shadowMap.needsUpdate = true;
    $('loader').classList.add('done');
    window.__appReady = true;
    this.renderer.setAnimationLoop(() => this.loop());
    window.__app = this;
  }

  setStage(text, p) {
    $('load-stage').textContent = text;
    $('load-fill').style.width = Math.round(p * 100) + '%';
  }

  async generate() {
    const plan = this.plan;
    this.batches = new WorldBatches(this.scene, this.pools);
    this.scenery = new Scenery(this, plan);
    const runner = new JobRunner((navigator.hardwareConcurrency || 4) - 1);
    const t0 = performance.now();
    const jobs = [...plan.jobs, ...this.scenery.templateJobs()];
    let failed = 0;
    await runner.run(jobs, (res, job) => {
      if (!res) { failed++; return; }
      if (job.local) this.scenery.addTemplate(job, res);
      else this.batches.add(res, job.meta);
    }, (done, total, job) => {
      this.setStage(`Building ${job.label || job.type} (${done}/${total})`, 0.06 + 0.84 * (done / total));
    });
    runner.dispose();
    this.genMs = performance.now() - t0;
    this.setStage('Assembling the city…', 0.93);
    await tick();
    this.batches.build();
    this.scenery.build();
    console.info(`Generated ${jobs.length} jobs in ${(this.genMs / 1000).toFixed(1)} s (${failed} failed).`, plan.stats);
    if (failed) console.warn(failed + ' generation jobs failed');
  }

  async regenerate() {
    // new variation seed: people, vehicles, café furniture, vegetation, window lights, rooftop details
    if (this.busy) return;
    this.busy = true;
    this.seed = (this.seed * 7919 + 13) % 100000;
    $('loader').classList.remove('done');
    this.setStage('Regenerating variations…', 0.02);
    await tick();
    this.batches.dispose();
    this.scenery.dispose();
    this.plan = makePlan(this.seed);
    await this.generate();
    this.labels.setItems(this.plan.labels);
    this.labels.setVisible(this.labelsOn);
    this.renderer.shadowMap.needsUpdate = true;
    $('loader').classList.add('done');
    this.busy = false;
  }

  bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'r') this.recenter();
      else if (k === 'f') this.toggleFlyover();
      else if (k === 't') this.toggleTod();
      else if (k === 'v') this.toggleView();
      else if (k === 'l') { this.labelsOn = !this.labelsOn; this.labels.setVisible(this.labelsOn); }
      else if (k === 'h' || k === '?') $('help').hidden = !$('help').hidden;
      else if (k === 'p') $('stats').hidden = !$('stats').hidden;
      else if (k === 'n') this.regenerate();
      else if (k === 'escape') $('help').hidden = true;
    });
  }

  recenter() {
    const v = VIEWS.recenter;
    this.controls.lookFrom(new THREE.Vector3(...v.pos), new THREE.Vector3(...v.target), 2.4);
    this.flying = false;
  }
  toggleFlyover() {
    if (this.controls.fly) { this.controls.stopFlyover(); return; }
    this.controls.startFlyover(new THREE.Vector3(-10, 0, -8));
  }
  toggleView() {
    this.view = this.view === 'street' ? 'aerial' : 'street';
    const v = VIEWS[this.view];
    this.controls.lookFrom(new THREE.Vector3(...v.pos), new THREE.Vector3(...v.target), 3.0);
    $('view-name').textContent = this.view === 'street' ? 'street level' : 'aerial';
  }
  toggleTod() {
    this.todTarget = this.todTarget > 0.5 ? 0 : 1;
    $('tod-name').textContent = this.todTarget ? 'sunset' : 'day';
  }

  applyTod(s, t = null) {
    const sd = sunDirection(s.sunAz, s.sunEl);
    U.uSunDir.value.copy(sd);
    if (this.sun) {
      this.sun.color.copy(s.sunColor);
      this.sun.intensity = s.sunI;
      this.sun.position.copy(sd).multiplyScalar(700);
      this.hemi.color.copy(s.hemiSky);
      this.hemi.groundColor.copy(s.hemiGround);
      this.hemi.intensity = s.hemiI;
    }
    const su = this.sky.uniforms;
    su.uZenith.value.copy(s.zenith); su.uHorizon.value.copy(s.horizon); su.uGround.value.copy(s.ground);
    su.uSunCol.value.copy(s.skySun); su.uCloudLit.value.copy(s.cloudLit); su.uCloudShade.value.copy(s.cloudShade);
    su.uCover.value = s.cover;
    U.uFogColor.value.copy(s.fog); U.uFogSun.value.copy(s.fogSun);
    U.uFogDensity.value = s.fogD; U.uFogHeight.value = s.fogH;
    U.uNight.value = s.night;
    U.uCloudShadow.value = s.cloudShadow;
    if (this.post) {
      const p = this.post.params;
      p.uExposure.value = s.exposure; p.uBloom.value = s.bloomI;
      p.uWarm.value = s.grade.warm; p.uSat.value = s.grade.sat; p.uContrast.value = s.grade.contrast;
      this.post.bright.uniforms.uThreshold.value = s.bloomT;
    }
    if (this.pools && t !== null) {
      const env = t > 0.5 ? this.env.sunset : this.env.day;
      for (const m of this.pools.list) { if (!m.userData.env) continue; if (m.envMap !== env) { m.envMap = env; m.needsUpdate = true; } m.envMapIntensity = (m.name === 'pool-glass' ? 1.3 : 0.9) * s.envI; }
      for (const m of [this.surfaces.water, this.surfaces.glass]) { if (m.envMap !== env) { m.envMap = env; m.needsUpdate = true; } }
    }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pw = Math.round(w * this.pixelRatio), ph = Math.round(h * this.pixelRatio);
    this.post.setSize(pw, ph);
    this.viewH = ph;
    this.cssW = w; this.cssH = h;
  }

  adaptQuality(dt) {
    if (this.quality !== 'auto') return;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc < 1.5) return;
    const fps = this.fpsN / this.fpsAcc;
    this.fps = fps;
    this.fpsAcc = 0; this.fpsN = 0;
    if (document.hidden) return;
    let pr = this.pixelRatio;
    if (fps < 52 && pr > 0.6) pr = Math.max(0.6, pr - (fps < 40 ? 0.2 : 0.1));
    else if (fps > 64 && pr < this.maxDpr) pr = Math.min(this.maxDpr, pr + 0.1);
    this.batches.lodBias = pr <= 0.8 && fps < 45 ? 1.8 : pr <= 0.9 && fps < 52 ? 1.35 : 1.0;
    if (Math.abs(pr - this.pixelRatio) > 0.01) { this.pixelRatio = pr; this.resize(); }
  }

  loop() {
    if (this.busy) return;
    this.renderer.info.reset();
    this.timer.update();
    const dt = Math.min(0.1, this.timer.getDelta());
    const time = this.timer.getElapsed();
    this.frame++;
    U.uTime.value = time;
    this.post.params.uTime.value = time % 100;
    // time-of-day blend
    if (Math.abs(this.todT - this.todTarget) > 1e-4) {
      this.todT += Math.sign(this.todTarget - this.todT) * Math.min(Math.abs(this.todTarget - this.todT), dt / 3.2);
      const k = this.todT * this.todT * (3 - 2 * this.todT);
      this.applyTod(mixTod(TOD.day, TOD.sunset, k), this.todT);
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.controls.update(dt);
    this.scenery.update(dt, time, this.camera);
    if (this.batches.update(this.camera, this.viewH)) this.renderer.shadowMap.needsUpdate = true;
    // tilt-shift strength with altitude
    const alt = this.camera.position.y;
    this.post.params.uTilt.value = THREE.MathUtils.smoothstep(alt, 35, 220) * 0.95;
    // shadows: the shadow map holds only static geometry and is re-rendered when the sun moves;
    // moving people / vehicles use soft contact shadows instead
    this.post.render(this.scene, this.camera);
    if (this.labelsOn || this.labels.fading) this.labels.update(this.cssW, this.cssH);
    // compass
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const ang = Math.atan2(dir.x, -dir.z);
    this.compassEl = this.compassEl || document.querySelector('#compass .needle');
    this.compassEl.style.transform = `rotate(${-ang}rad)`;
    this.adaptQuality(dt);
    if (!$('stats').hidden && this.frame % 15 === 0) {
      const info = this.renderer.info;
      $('stats').textContent = `fps ${this.fps.toFixed(0)}  dpr ${this.pixelRatio.toFixed(2)}\ncalls ${info.render.calls}  tris ${(info.render.triangles / 1e6).toFixed(2)}M\nbatches ${this.batches.stats.draw}  lodBias ${this.batches.lodBias}\npeople ${this.scenery.stats.people}  cars ${this.scenery.stats.cars}\ngen ${(this.genMs / 1000).toFixed(1)} s  seed ${this.seed}`;
    }
  }
}

function tick() { return new Promise((r) => requestAnimationFrame(() => r())); }

const app = new App();
app.init().catch((e) => fail('The scene could not be started.', e));
