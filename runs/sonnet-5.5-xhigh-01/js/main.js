/* Piata Unirii — application entry: staged world build, render loop, controls */
(function () {
  'use strict';
  const PU = window.PU;
  const $ = (id) => document.getElementById(id);

  function showError(e) {
    console.error(e);
    const box = $('error');
    if (box) {
      $('errtxt').textContent = (e && e.stack) || String(e);
      box.style.display = 'grid';
    }
  }
  window.addEventListener('error', (ev) => {
    if (!PU.app || !PU.app.ready) showError(ev.error || ev.message);
  });

  const tick = () =>
    new Promise((res) => {
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      requestAnimationFrame(fin);
      setTimeout(fin, 40);
    });

  async function main() {
    const canvas = $('view');
    const seed = Number(new URLSearchParams(location.search).get('seed')) || 20260929;
    PU.SEED = seed;
    const renderer = new PU.Renderer(canvas);
    const cam = new PU.CameraRig(canvas, (x, z) => PU.L.groundH(x, z));
    const ui = new PU.UI();
    const app = (PU.app = { renderer, cam, ui, ready: false, t: 0, tTarget: 0, time: 0, seed });
    const lbar = $('lbar'), lstep = $('lstep');
    const progress = (f, msg) => {
      lbar.style.width = Math.round(f * 100) + '%';
      if (msg) lstep.textContent = msg;
    };

    /* ---------- resize ---------- */
    app.scale = 1;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * app.scale;
      renderer.resize(canvas.clientWidth, canvas.clientHeight, dpr);
      cam.setAspect(canvas.clientWidth / Math.max(1, canvas.clientHeight));
    };
    window.addEventListener('resize', resize);
    resize();

    /* ---------- world build ---------- */
    const L = PU.L;
    const emitPlain = (cast) => (name, builder) => renderer.addChunk({ name, lods: [{ maxDist: Infinity, builder }], cast: !!cast });
    const addHero = (hero, d, ds) => {
      const lods = PU.B.makeLods(hero.items, hero.xf, { d: d || [280, 720], ds: ds || [2, 4] });
      renderer.addChunk({ name: hero.name, lods, cast: true });
    };
    app.addHero = addHero;
    app.emitPlain = emitPlain;
    const buildWorld = async () => {
    const t0 = performance.now();
    const steps = [];
    const step = (label, w, fn) => steps.push({ label, w, fn });

    step('Laying out streets and plots', 1, () => L.initGrid());
    step('Raising St. Michael’s Church', 4, () => addHero(PU.buildChurch(), [300, 760], [2, 4]));
    step('Casting the Matthias Corvinus ensemble', 2, () => PU.buildMonument && addHero(PU.buildMonument(), [220, 700], [2, 4]));
    step('Building the perimeter façades', 8, () => PU.buildPerimeter && PU.buildPerimeter(renderer, emitPlain(true), addHero));
    step('Bánffy Palace, Mirror Buildings, Hotel Continental', 6, () => PU.buildHeroes && PU.buildHeroes(renderer, emitPlain(true), addHero));
    step('Growing the old town', 8, () => PU.buildCity && PU.buildCity(renderer, emitPlain(true)));
    step('Paving the square', 3, () => PU.buildCityGround(emitPlain(false)));
    step('Raising the hills of the Transylvanian basin', 4, () => PU.buildHills(emitPlain(false)));
    step('Scattering neighbourhoods, apartment blocks and Cetățuia', 4, () => PU.buildSuburbs && PU.buildSuburbs(renderer));
    step('Planting trees, benches, lamps and terraces', 3, () => PU.buildProps && PU.buildProps(renderer));
    step('Bringing the square to life', 2, () => PU.Sim && PU.Sim.init(renderer));

    const totalW = steps.reduce((a, s) => a + s.w, 0);
    let done = 0;
    for (const s of steps) {
      progress(done / totalW, s.label + '…');
      await tick();
      const ts = performance.now();
      try {
        await s.fn();
      } catch (e) {
        console.error('Build step failed:', s.label, e);
        if (/Church|Paving|streets/.test(s.label)) throw e; // landmark geometry must never be skipped
      }
      console.log('[build] ' + s.label + ' ' + Math.round(performance.now() - ts) + ' ms');
      done += s.w;
    }
    progress(1, 'Done');
    console.log('[build] total ' + Math.round(performance.now() - t0) + ' ms, chunks ' + renderer.chunks.length);
    let tris = 0;
    for (const c of renderer.chunks) tris += c.tris[0];
    console.log('[build] LOD0 static triangles ' + tris);
    };
    renderer.onLost = () => showError(new Error('The graphics context was lost (GPU reset or too many WebGL contexts). Please reload the page.'));
    await buildWorld();

    /* Regenerate the whole miniature with a different seed. Landmarks never move; only the surrounding fabric, trees,
       café furniture, window lights, pedestrians and traffic vary. Old geometry, buffers and textures are disposed first. */
    app.regenerate = async (newSeed) => {
      $('loader').classList.remove('done');
      progress(0, 'Regenerating…');
      await tick();
      app.ready = false;
      renderer.disposeAll();
      PU.SEED = newSeed;
      app.seed = newSeed;
      const info = PU.plaza;
      for (const k in info) if (Array.isArray(info[k])) info[k].length = 0;
      PU.Sim.people = null;
      PU.Sim.pig = null;
      ui.hm = null;
      await buildWorld();
      app.ready = true;
      setTimeout(() => $('loader').classList.add('done'), 350);
    };

    /* ---------- controls ---------- */
    const setTime = () => {
      app.tTarget = app.tTarget ? 0 : 1;
      ui.setState('time', app.tTarget ? 'Golden hour' : 'Clear day', !!app.tTarget);
      ui.toast(app.tTarget ? 'Golden-hour sunset' : 'Clear day');
    };
    const setView = () => {
      const p = cam.togglePreset();
      ui.setState('view', p === 'aerial' ? 'Aerial' : 'Street level', p !== 'aerial');
      ui.setState('flyover', cam.flyover ? 'On' : 'Off', cam.flyover);
      ui.toast(p === 'aerial' ? 'Aerial overview' : 'Street level');
    };
    const setFly = () => {
      const on = cam.toggleFlyover();
      ui.setState('flyover', on ? 'On' : 'Off', on);
      ui.setState('view', 'Aerial', false);
      ui.toast(on ? 'Cinematic flyover' : 'Flyover off');
    };
    const setLabels = () => {
      ui.setLabels(!ui.showLabels);
      ui.setState('labels', ui.showLabels ? 'On' : 'Off', ui.showLabels);
      ui.toast(ui.showLabels ? 'Landmark labels on' : 'Landmark labels off');
    };
    const recentre = () => {
      cam.recentre();
      ui.setState('flyover', 'Off', false);
      ui.setState('view', 'Aerial', false);
      ui.toast('Recentred on St. Michael’s & the Matthias Corvinus monument');
    };
    ui.on('time', setTime);
    ui.on('view', setView);
    ui.on('flyover', setFly);
    ui.on('labels', setLabels);
    ui.on('recentre', recentre);
    cam.onChange = (k) => {
      if (k === 'flyover') ui.setState('flyover', 'Off', false);
    };
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case 'r': recentre(); break;
        case 'f': if (!e.repeat) setFly(); break;
        case 't': if (!e.repeat) setTime(); break;
        case 'v': if (!e.repeat) setView(); break;
        case 'l': if (!e.repeat) setLabels(); break;
        case 'g': if (e.shiftKey && !e.repeat) { ui.toast('Regenerating with a new seed…'); app.regenerate(app.seed + 1); } else return; break;
        default: return;
      }
      e.preventDefault();
    });

    /* ---------- render loop ---------- */
    let last = performance.now(), fpsAcc = 0, fpsN = 0, fpsT = 0, coolT = 0;
    const ease = (t) => t * t * (3 - 2 * t);
    let envCache = null, envT = -1;
    const frame = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      app.time += dt;
      if (app.t !== app.tTarget) {
        const dir = app.tTarget > app.t ? 1 : -1;
        app.t = PU.clamp(app.t + (dir * dt) / 2.8, 0, 1);
        if (Math.abs(app.t - app.tTarget) < 1e-4) app.t = app.tTarget;
      }
      if (envT !== app.t) {
        envCache = PU.Env.make(ease(app.t));
        envT = app.t;
      }
      cam.update(dt);
      if (PU.Sim) PU.Sim.update(dt, app.time, envCache, cam, renderer);
      renderer.render({
        vp: cam.vp, invVP: cam.invVP, planes: cam.planes, camPos: cam.pos, right: cam.right, up: cam.up,
        time: app.time, env: envCache,
      });
      ui.updateLabels(cam, canvas.clientWidth, canvas.clientHeight);
      // fps + adaptive resolution
      fpsAcc += dt; fpsN++; fpsT += dt; coolT -= dt;
      if (fpsT >= 1) {
        const fps = Math.round(fpsN / fpsAcc);
        ui.setFps(fps);
        PU.fps = fps;
        if (coolT <= 0) {
          if (fps < 48 && app.scale > 0.5) { app.scale = Math.max(0.5, app.scale * 0.86); resize(); coolT = 2.5; }
          else if (fps > 59 && app.scale < 1) { app.scale = Math.min(1, app.scale * 1.08); resize(); coolT = 4; }
        }
        fpsAcc = 0; fpsN = 0; fpsT = 0;
      }
      requestAnimationFrame(frame);
    };
    app.ready = true;
    requestAnimationFrame(frame);
    setTimeout(() => $('loader').classList.add('done'), 350);
  }

  main().catch(showError);
})();
