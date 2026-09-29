/* Piata Unirii — time-of-day environments (Clear Day / Golden-Hour Sunset) and smooth blending */
(function () {
  'use strict';
  const PU = window.PU;
  const D2R = Math.PI / 180;

  const DAY = {
    az: 212, el: 47,
    sunCol: [3.5, 3.05, 2.45],
    skyAmb: [0.58, 0.76, 1.1],
    grdAmb: [0.46, 0.41, 0.33],
    skyZen: [0.13, 0.31, 0.78],
    skyHor: [0.66, 0.80, 0.98],
    sunGlow: [0.9, 0.75, 0.5],
    fogCol: [0.68, 0.79, 0.93],
    fogDen: 0.00030,
    exposure: 0.43,
    night: 0,
    cloudLit: [1.55, 1.55, 1.55],
    cloudShade: [0.62, 0.70, 0.88],
    cover: 0.555,
  };
  const SUNSET = {
    az: 236, el: 9.5,
    sunCol: [4.6, 2.25, 0.85],
    skyAmb: [0.34, 0.42, 0.68],
    grdAmb: [0.36, 0.23, 0.16],
    skyZen: [0.075, 0.13, 0.36],
    skyHor: [1.15, 0.56, 0.32],
    sunGlow: [1.7, 0.72, 0.26],
    fogCol: [0.98, 0.60, 0.44],
    fogDen: 0.00036,
    exposure: 0.56,
    night: 0.9,
    cloudLit: [2.3, 1.05, 0.55],
    cloudShade: [0.48, 0.33, 0.52],
    cover: 0.50,
  };

  function dirFrom(az, el) {
    const a = az * D2R, e = el * D2R;
    // az clockwise from north; north = -z, east = +x
    return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
  }
  const lerpArr = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  function make(t) {
    // t: 0 = day, 1 = sunset
    const A = DAY, B = SUNSET;
    const az = A.az + (B.az - A.az) * t, el = A.el + (B.el - A.el) * t;
    const e = { sunDir: dirFrom(az, el), t };
    for (const k of ['sunCol', 'skyAmb', 'grdAmb', 'skyZen', 'skyHor', 'sunGlow', 'fogCol', 'cloudLit', 'cloudShade']) e[k] = lerpArr(A[k], B[k], t);
    for (const k of ['fogDen', 'exposure', 'night', 'cover']) e[k] = A[k] + (B[k] - A[k]) * t;
    return e;
  }
  PU.Env = { DAY, SUNSET, make, dirFrom };
})();
