// Procedural sky dome (gradient, sun, drifting scattered cumulus) and the
// time-of-day presets that drive sun, skylight, fog, emissives and exposure.

import * as THREE from 'three';
import { U } from './materials.js';

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunCol;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform float uCover;
uniform float uTime;
uniform float uSunSize;
float hash( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float noise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), u.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), u.x ), u.y );
}
float fbm( vec2 p ) {
  float s = 0.0, a = 0.5;
  for ( int i = 0; i < 5; i++ ) { s += noise( p ) * a; p = p * 2.03 + vec2( 1.7, 9.2 ); a *= 0.5; }
  return s;
}
void main() {
  vec3 d = normalize( vDir );
  float h = d.y;
  float sd = max( dot( d, uSunDir ), 0.0 );
  vec3 col = mix( uHorizon, uZenith, pow( clamp( h, 0.0, 1.0 ), 0.5 ) );
  col = mix( col, uHorizon * 1.08, pow( sd, 3.0 ) * ( 1.0 - clamp( h * 2.5, 0.0, 1.0 ) ) * 0.6 );
  if ( h < 0.0 ) col = mix( uHorizon, uGround, clamp( -h * 5.0, 0.0, 1.0 ) );
  // sun disc and glow
  col += uSunCol * ( pow( sd, 10.0 ) * 0.22 + pow( sd, 90.0 ) * 0.7 );
  col += uSunCol * smoothstep( 1.0 - uSunSize, 1.0 - uSunSize * 0.55, sd ) * 18.0;
  // clouds on a virtual layer
  if ( h > 0.0 ) {
    vec2 p = d.xz / ( h + 0.12 ) * 1.35 + vec2( uTime * 0.004, uTime * 0.0015 );
    float n = fbm( p * 1.3 );
    float n2 = fbm( p * 3.1 + 5.0 );
    float c = smoothstep( uCover, uCover + 0.22, n * 0.8 + n2 * 0.3 );
    c *= smoothstep( 0.0, 0.18, h );
    float lit = clamp( 0.5 + 0.5 * dot( normalize( vec3( d.x, 0.35, d.z ) ), uSunDir ) , 0.0, 1.0 );
    float thick = smoothstep( uCover + 0.1, uCover + 0.5, n * 0.8 + n2 * 0.3 );
    vec3 cc = mix( uCloudLit, uCloudShade, thick * 0.55 * ( 1.0 - lit * 0.5 ) );
    cc += uSunCol * pow( sd, 5.0 ) * 0.35 * ( 1.0 - thick );
    col = mix( col, cc, c * 0.92 );
  }
  gl_FragColor = vec4( col, 1.0 );
}`;

export function createSky() {
  const uniforms = {
    uSunDir: U.uSunDir,
    uTime: U.uTime,
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uGround: { value: new THREE.Color() },
    uSunCol: { value: new THREE.Color() },
    uCloudLit: { value: new THREE.Color() },
    uCloudShade: { value: new THREE.Color() },
    uCover: { value: 0.5 },
    uSunSize: { value: 0.00012 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms,
    side: THREE.BackSide, depthWrite: false, depthTest: true,
  });
  const geo = new THREE.SphereGeometry(20000, 48, 24);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000; // drawn after opaque geometry: only uncovered pixels run the cloud shader
  return { mesh, uniforms, material: mat };
}

// ---------------------------------------------------------------- time of day
const C = (r, g, b) => new THREE.Color(r, g, b);

export const TOD = {
  day: {
    sunAz: 212, sunEl: 47,
    sunColor: C(1.0, 0.95, 0.86), sunI: 3.1,
    hemiSky: C(0.62, 0.74, 0.95), hemiGround: C(0.5, 0.46, 0.4), hemiI: 1.25,
    envI: 0.75,
    zenith: C(0.16, 0.34, 0.72), horizon: C(0.64, 0.75, 0.88), ground: C(0.42, 0.44, 0.44),
    skySun: C(1.0, 0.92, 0.8),
    cloudLit: C(1.02, 1.02, 1.04), cloudShade: C(0.62, 0.67, 0.76), cover: 0.47,
    fog: C(0.68, 0.76, 0.87), fogSun: C(0.95, 0.9, 0.8), fogD: 0.00026, fogH: 0.0022,
    night: 0.0, exposure: 0.92, bloomT: 2.2, bloomI: 0.35,
    grade: { warm: 0.02, sat: 1.0, contrast: 1.04 },
    cloudShadow: 0.32,
  },
  sunset: {
    sunAz: 252, sunEl: 10.5,
    sunColor: C(1.0, 0.6, 0.3), sunI: 3.6,
    hemiSky: C(0.36, 0.44, 0.74), hemiGround: C(0.26, 0.21, 0.2), hemiI: 0.78,
    envI: 0.6,
    zenith: C(0.13, 0.19, 0.42), horizon: C(1.0, 0.6, 0.36), ground: C(0.26, 0.22, 0.24),
    skySun: C(1.0, 0.62, 0.3),
    cloudLit: C(1.12, 0.66, 0.44), cloudShade: C(0.44, 0.36, 0.48), cover: 0.5,
    fog: C(0.56, 0.52, 0.62), fogSun: C(1.1, 0.64, 0.38), fogD: 0.00024, fogH: 0.0026,
    night: 0.85, exposure: 1.12, bloomT: 1.4, bloomI: 0.55,
    grade: { warm: 0.025, sat: 1.04, contrast: 1.06 },
    cloudShadow: 0.1,
  },
};

export function sunDirection(azDeg, elDeg) {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

// Interpolate two presets (t in 0..1) into a flat state
export function mixTod(a, b, t) {
  const out = {};
  for (const k of Object.keys(a)) {
    const va = a[k], vb = b[k];
    if (va instanceof THREE.Color) out[k] = va.clone().lerp(vb, t);
    else if (typeof va === 'number') out[k] = va + (vb - va) * t;
    else if (typeof va === 'object') {
      out[k] = {};
      for (const kk of Object.keys(va)) out[k][kk] = va[kk] + (vb[kk] - va[kk]) * t;
    }
  }
  return out;
}
