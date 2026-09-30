// Material pools: one PBR material per pool, all sharing the procedural atlas
// and a common shader patch (voxel-space texturing, per-voxel variation, voxel
// edge grooves, baked AO, evening emissives, aerial-perspective fog).

import * as THREE from 'three';
import { POOL_NAMES, LAYER_NAMES } from '../core/mat.js';

export const U = {
  uAtlas: { value: null },
  uLayer: { value: [] },
  uTime: { value: 0 },
  uNight: { value: 0 },
  uWinLight: { value: new THREE.Color(1.0, 0.72, 0.42) },
  uLampColor: { value: new THREE.Color(1.0, 0.82, 0.58) },
  uFlood: { value: new THREE.Color(1.0, 0.74, 0.46) },
  uFogColor: { value: new THREE.Color(0.72, 0.8, 0.9) },
  uFogSun: { value: new THREE.Color(1.0, 0.9, 0.75) },
  uFogDensity: { value: 0.00018 },
  uFogHeight: { value: 0.0022 },
  uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3).normalize() },
  uCloudShadow: { value: 0.35 },
  uWind: { value: new THREE.Vector2(6, 2) },
  uEdgeFade: { value: 1.0 },
};

// env: whether the pool samples the prefiltered sky environment (glossy pools only;
// rough pools rely on the hemisphere skylight, which is much cheaper per pixel)
const POOL_PARAMS = {
  stone: { roughness: 0.86, metalness: 0.0, env: false },
  plaster: { roughness: 0.9, metalness: 0.0, env: false },
  terracotta: { roughness: 0.78, metalness: 0.0, env: false },
  metal: { roughness: 0.5, metalness: 0.55, env: true },
  bronze: { roughness: 0.5, metalness: 0.5, env: true },
  vegetation: { roughness: 0.92, metalness: 0.0, env: false },
  pavement: { roughness: 0.84, metalness: 0.0, env: false },
  glass: { roughness: 0.12, metalness: 0.4, envMapIntensity: 1.3, env: true },
  water: { roughness: 0.08, metalness: 0.2, env: true },
  fabric: { roughness: 0.95, metalness: 0.0, env: false },
  light: { roughness: 0.4, metalness: 0.0, env: false },
  paint: { roughness: 0.38, metalness: 0.25, env: true },
};

const VERT_PARS = /* glsl */`
attribute vec4 aMisc;
attribute vec4 aVox;
varying vec3 vVox;
varying float vVS;
varying float vAO;
varying float vLayer;
varying float vFlags;
varying vec3 vWPos;
varying vec3 vWNrm;
`;

const COLOR_VERTEX = /* glsl */`
#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
  vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR
  vColor.rgb *= pow( color.rgb, vec3( 2.2 ) );
#endif
#ifdef USE_INSTANCING_COLOR
  vColor.rgb *= instanceColor.rgb;
#endif
`;

const VERT_MAIN = /* glsl */`
  vVox = aVox.xyz;
  vVS = aVox.w * 0.001;
  vAO = aMisc.x / 255.0;
  vLayer = aMisc.y;
  vFlags = aMisc.z;
  {
    vec4 wp = vec4( transformed, 1.0 );
    vec3 wn = objectNormal;
    #ifdef USE_INSTANCING
      wp = instanceMatrix * wp;
      wn = mat3( instanceMatrix ) * wn;
    #endif
    wp = modelMatrix * wp;
    vWPos = wp.xyz;
    vWNrm = normalize( mat3( modelMatrix ) * wn );
  }
`;

const FRAG_PARS = /* glsl */`
uniform highp sampler2DArray uAtlas;
uniform vec4 uLayer[${LAYER_NAMES.length}];
uniform float uTime;
uniform float uNight;
uniform vec3 uWinLight;
uniform vec3 uLampColor;
uniform vec3 uFlood;
uniform vec3 uFogColor;
uniform vec3 uFogSun;
uniform float uFogDensity;
uniform float uFogHeight;
uniform vec3 uSunDir;
uniform float uCloudShadow;
uniform vec2 uWind;
uniform float uEdgeFade;
varying vec3 vVox;
varying float vVS;
varying float vAO;
varying float vLayer;
varying float vFlags;
varying vec3 vWPos;
varying vec3 vWNrm;
float vxHash( vec3 p ) {
  p = fract( p * 0.1031 );
  p += dot( p, p.yzx + 33.33 );
  return fract( ( p.x + p.y ) * p.z );
}
float vnoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  float a = vxHash( vec3( i, 1.7 ) ), b = vxHash( vec3( i + vec2( 1.0, 0.0 ), 1.7 ) );
  float c = vxHash( vec3( i + vec2( 0.0, 1.0 ), 1.7 ) ), d = vxHash( vec3( i + vec2( 1.0, 1.0 ), 1.7 ) );
  return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}
float cloudShadowAt( vec3 wp ) {
  vec2 p = ( wp.xz + uSunDir.xz / max( uSunDir.y, 0.15 ) * 900.0 ) * 0.0021 + uWind * uTime * 0.0004;
  float n = vnoise( p ) * 0.68 + vnoise( p * 2.3 + 4.1 ) * 0.32;
  return mix( 1.0, 1.0 - uCloudShadow, smoothstep( 0.52, 0.68, n ) );
}
`;

const FRAG_MAP = /* glsl */`
  float vxL = floor( vLayer + 0.5 );
  vec4 lp = uLayer[ int( vxL ) ];
  vec2 st = vVox.xy;
  vec2 tuv = lp.y > 0.5 ? st / lp.x : st * vVS / lp.x;
  vec2 dx = dFdx( tuv ), dy = dFdy( tuv );
  vec3 texel = textureGrad( uAtlas, vec3( tuv, vxL ), dx, dy ).rgb * 2.0;
  vec3 cell = vec3( floor( st + 1e-3 ), vVox.z );
  float h = vxHash( cell + vxL * 17.0 );
  float jit = 1.0 + ( h - 0.5 ) * 2.0 * lp.z;
  vec2 f = fract( st + 1e-3 );
  vec2 fw = fwidth( st );
  float fwm = max( max( fw.x, fw.y ), 1e-4 );
  vec2 ed = min( f, 1.0 - f ) / max( fw, vec2( 1e-4 ) );
  float e = min( ed.x, ed.y );
  float edgeVis = ( 1.0 - smoothstep( 0.18, 0.5, fwm ) ) * uEdgeFade;
  float groove = 1.0 - lp.w * edgeVis * ( 1.0 - smoothstep( 0.4, 1.4, e ) );
  diffuseColor.rgb *= texel * jit * groove;
`;

const FRAG_EMISSIVE = /* glsl */`
  {
    int fl = int( vFlags + 0.5 );
    if ( fl > 0 ) {
      if ( ( fl & 1 ) != 0 ) {
        float hh = vxHash( floor( vWPos * 0.9 ) + 3.1 );
        totalEmissiveRadiance += uWinLight * uNight * ( 0.55 + 0.9 * hh ) * 1.3;
      }
      if ( ( fl & 2 ) != 0 ) {
        totalEmissiveRadiance += uLampColor * ( 0.08 + uNight * 5.0 );
      }
      if ( ( fl & 4 ) != 0 ) {
        float hgt = vWPos.y;
        float side = 1.0 - smoothstep( 0.55, 0.9, vWNrm.y );
        float fall = mix( 1.0, 0.45, smoothstep( 4.0, 70.0, hgt ) );
        totalEmissiveRadiance += diffuseColor.rgb * uFlood * uNight * 0.55 * side * fall;
      }
      if ( ( fl & 32 ) != 0 ) {
        vec3 gc = diffuseColor.rgb / max( max( diffuseColor.r, diffuseColor.g ), max( diffuseColor.b, 1e-3 ) );
        totalEmissiveRadiance += gc * gc * uNight * 1.1 * ( 0.6 + 0.8 * vxHash( floor( vWPos * 2.0 ) ) );
      }
      if ( ( fl & 8 ) != 0 ) {
        totalEmissiveRadiance += vec3( 1.0, 0.72, 0.4 ) * ( 0.9 + uNight * 3.5 );
      }
    }
  }
`;

const FRAG_AO = /* glsl */`
  {
    float aoc = mix( 0.42, 1.0, vAO );
    aoc = aoc * aoc * ( 3.0 - 2.0 * aoc ) * 0.35 + aoc * 0.65;
    reflectedLight.indirectDiffuse *= aoc;
    reflectedLight.indirectSpecular *= aoc;
    reflectedLight.directDiffuse *= mix( 1.0, aoc, 0.45 );
    reflectedLight.directSpecular *= aoc;
  }
`;

const FRAG_FOG = /* glsl */`
  {
    vec3 toP = vWPos - cameraPosition;
    float dist = length( toP );
    vec3 vd = toP / max( dist, 1e-3 );
    float hf = exp( -max( vWPos.y, 0.0 ) * uFogHeight );
    float fogF = 1.0 - exp( -max( dist - 320.0, 0.0 ) * uFogDensity * ( 0.35 + 0.65 * hf ) );
    fogF = clamp( fogF, 0.0, 1.0 );
    float sunAmt = pow( max( dot( vd, uSunDir ), 0.0 ), 6.0 );
    vec3 fcol = mix( uFogColor, uFogSun, sunAmt );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fcol, fogF );
  }
`;

// Directional shadow term gets multiplied by drifting cloud shadows
function patchLights(src) {
  return src.replace(
    'getDirectionalLightInfo( directionalLight, directLight );',
    'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= cloudShadowAt( vWPos );'
  );
}

export function patchShader(shader, opts = {}) {
  Object.assign(shader.uniforms, U);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + VERT_PARS)
    .replace('#include <color_vertex>', COLOR_VERTEX)
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + VERT_MAIN + (opts.vertex || ''));
  let fs = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + FRAG_PARS + (opts.fragPars || ''))
    .replace('#include <map_fragment>', FRAG_MAP + (opts.map || ''))
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FRAG_EMISSIVE)
    .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + FRAG_AO)
    .replace('#include <fog_fragment>', FRAG_FOG + (opts.post || ''));
  fs = fs.replace('#include <lights_fragment_begin>', patchLights(THREE.ShaderChunk.lights_fragment_begin));
  shader.fragmentShader = fs;
}

export function createPools(atlas, envMap) {
  U.uAtlas.value = atlas.texture;
  U.uLayer.value = atlas.params;
  const pools = {};
  for (const name of POOL_NAMES) {
    const p = POOL_PARAMS[name];
    const m = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: p.roughness,
      metalness: p.metalness,
      envMap: p.env ? envMap : null,
      envMapIntensity: p.envMapIntensity ?? 0.9,
      fog: false,
      vertexColors: true,
    });
    m.onBeforeCompile = (shader) => {
      if (name === 'water') {
        patchShader(shader, { map: WATER_MAP });
      } else {
        patchShader(shader);
      }
    };
    m.customProgramCacheKey = () => 'vox-' + (name === 'water' ? 'water' : 'std') + (p.env ? '-env' : '');
    m.userData.env = p.env;
    m.name = 'pool-' + name;
    pools[name] = m;
  }
  pools.list = POOL_NAMES.map((n) => pools[n]);
  return pools;
}

// Animated ripples for the water pool (river, basins)
const WATER_MAP = /* glsl */`
  {
    float t = uTime;
    float r = vnoise( vWPos.xz * 0.9 + vec2( t * 0.35, t * 0.2 ) ) * 0.5 + vnoise( vWPos.xz * 2.3 - vec2( t * 0.5, -t * 0.3 ) ) * 0.5;
    diffuseColor.rgb *= 0.85 + r * 0.3;
  }
`;

// Transparent reflective water surface (fountain tables) and archaeological glass
export function createSurfaceMaterials(envMap) {
  const water = new THREE.MeshPhysicalMaterial({
    color: 0x4f656d, roughness: 0.1, metalness: 0.0, transmission: 0, transparent: true, opacity: 0.86,
    envMap, envMapIntensity: 0.85, fog: false, depthWrite: false,
  });
  water.onBeforeCompile = (shader) => {
    patchShader(shader, {
      vertex: '',
      map: '',
      fragPars: '',
    });
    // animated normal perturbation for ripples
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        float t = uTime;
        vec2 p = vWPos.xz;
        float e = 0.15;
        float h0 = vnoise( p * 1.7 + vec2( t * 0.7, t * 0.4 ) ) + 0.5 * vnoise( p * 4.3 - vec2( t * 1.1, -t * 0.6 ) );
        float hx = vnoise( ( p + vec2( e, 0.0 ) ) * 1.7 + vec2( t * 0.7, t * 0.4 ) ) + 0.5 * vnoise( ( p + vec2( e, 0.0 ) ) * 4.3 - vec2( t * 1.1, -t * 0.6 ) );
        float hz = vnoise( ( p + vec2( 0.0, e ) ) * 1.7 + vec2( t * 0.7, t * 0.4 ) ) + 0.5 * vnoise( ( p + vec2( 0.0, e ) ) * 4.3 - vec2( t * 1.1, -t * 0.6 ) );
        vec3 wn = normalize( vec3( ( h0 - hx ) * 0.9, 1.0, ( h0 - hz ) * 0.9 ) );
        normal = normalize( ( viewMatrix * vec4( wn, 0.0 ) ).xyz );
      }`);
    shader.fragmentShader = shader.fragmentShader.replace(FRAG_MAP, '');
  };
  water.customProgramCacheKey = () => 'surf-water';
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x5d6e75, roughness: 0.03, metalness: 0.0, transparent: true, opacity: 0.26,
    envMap, envMapIntensity: 0.8, fog: false, depthWrite: false,
  });
  glass.onBeforeCompile = (shader) => {
    patchShader(shader);
    shader.fragmentShader = shader.fragmentShader.replace(FRAG_MAP, '');
  };
  glass.customProgramCacheKey = () => 'surf-glass';
  return { water, glass };
}

// Geometry attribute helpers ---------------------------------------------------
export function geometryFromArrays(a) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(a.nrm, 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(a.col, 3, true));
  g.setAttribute('aMisc', new THREE.BufferAttribute(a.misc, 4, false));
  g.setAttribute('aVox', new THREE.BufferAttribute(a.vox, 4, false));
  g.setIndex(new THREE.BufferAttribute(a.idx, 1));
  return g;
}

// Unit box with voxel attributes (for instanced detail voxels & characters)
export function voxelBoxGeometry(layer = 28, flags = 0) {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const n = g.attributes.position.count;
  const misc = new Uint8Array(n * 4);
  const vox = new Int16Array(n * 4);
  const uv = g.attributes.uv;
  for (let i = 0; i < n; i++) {
    misc[i * 4] = 255; misc[i * 4 + 1] = layer; misc[i * 4 + 2] = flags;
    vox[i * 4] = Math.round(uv.getX(i)); vox[i * 4 + 1] = Math.round(uv.getY(i)); vox[i * 4 + 2] = 0; vox[i * 4 + 3] = 1000;
  }
  g.setAttribute('aMisc', new THREE.BufferAttribute(misc, 4, false));
  g.setAttribute('aVox', new THREE.BufferAttribute(vox, 4, false));
  const col = new Uint8Array(n * 3).fill(255);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
  return g;
}
