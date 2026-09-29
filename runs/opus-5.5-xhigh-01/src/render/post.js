// Post-processing: HDR MSAA scene target -> bloom -> tilt-shift miniature blur,
// ACES tone mapping, gentle grading, vignette and dithering.

import * as THREE from 'three';

const FS_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;

const BRIGHT_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tSrc;
uniform float uThreshold;
uniform vec2 uTexel;
void main() {
  vec3 c = vec3( 0.0 );
  c += texture2D( tSrc, vUv + uTexel * vec2( -1.0, -1.0 ) ).rgb;
  c += texture2D( tSrc, vUv + uTexel * vec2( 1.0, -1.0 ) ).rgb;
  c += texture2D( tSrc, vUv + uTexel * vec2( -1.0, 1.0 ) ).rgb;
  c += texture2D( tSrc, vUv + uTexel * vec2( 1.0, 1.0 ) ).rgb;
  c *= 0.25;
  float l = max( max( c.r, c.g ), c.b );
  float k = max( l - uThreshold, 0.0 ) / max( l, 1e-4 );
  gl_FragColor = vec4( min( c * k, vec3( 40.0 ) ), 1.0 );
}`;

const BLUR_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uDir;
void main() {
  vec3 c = texture2D( tSrc, vUv ).rgb * 0.2270270270;
  c += texture2D( tSrc, vUv + uDir * 1.3846153846 ).rgb * 0.3162162162;
  c += texture2D( tSrc, vUv - uDir * 1.3846153846 ).rgb * 0.3162162162;
  c += texture2D( tSrc, vUv + uDir * 3.2307692308 ).rgb * 0.0702702703;
  c += texture2D( tSrc, vUv - uDir * 3.2307692308 ).rgb * 0.0702702703;
  gl_FragColor = vec4( c, 1.0 );
}`;

const FINAL_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tBloom2;
uniform vec2 uTexel;
uniform float uExposure;
uniform float uBloom;
uniform float uTilt;
uniform float uFocus;
uniform float uWarm;
uniform float uSat;
uniform float uContrast;
uniform float uTime;
vec3 RRTAndODTFit( vec3 v ) {
  vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
  vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
  return a / b;
}
vec3 aces( vec3 c ) {
  const mat3 IN = mat3( 0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777 );
  const mat3 OUT = mat3( 1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602 );
  c = IN * c; c = RRTAndODTFit( c ); c = OUT * c;
  return clamp( c, 0.0, 1.0 );
}
vec3 toSRGB( vec3 c ) {
  return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) );
}
float rand( vec2 co ) { return fract( sin( dot( co, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
void main() {
  vec3 col = texture2D( tScene, vUv ).rgb;
  // tilt-shift: blur grows away from the focus band (miniature look)
  float dy = abs( vUv.y - uFocus );
  float blur = uTilt * smoothstep( 0.13, 0.56, dy ) * 6.5 * ( uTexel.y * 1080.0 < 1.0 ? 1.0 / ( uTexel.y * 1080.0 ) : 1.0 );
  if ( blur > 0.3 ) {
    vec3 acc = col; float wsum = 1.0;
    for ( int i = 0; i < 12; i++ ) {
      float fi = float( i );
      float ang = fi * 2.39996;
      float r = sqrt( ( fi + 0.5 ) / 12.0 ) * blur;
      vec2 o = vec2( cos( ang ), sin( ang ) ) * r * uTexel;
      acc += texture2D( tScene, vUv + o ).rgb;
      wsum += 1.0;
    }
    col = acc / wsum;
  }
  vec3 bloom = texture2D( tBloom, vUv ).rgb * 0.6 + texture2D( tBloom2, vUv ).rgb * 0.4;
  col += bloom * uBloom;
  col *= uExposure;
  col = aces( col );
  // grading
  float l = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
  col = mix( vec3( l ), col, uSat );
  col = ( col - 0.5 ) * uContrast + 0.5;
  col += vec3( uWarm, uWarm * 0.35, -uWarm * 0.6 ) * ( 1.0 - l ) * 0.5;
  // vignette
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot( q, q ) * 0.42;
  col = clamp( col, 0.0, 1.0 );
  col = toSRGB( col );
  col += ( rand( vUv * 997.0 + uTime ) - 0.5 ) / 255.0;
  gl_FragColor = vec4( col, 1.0 );
}`;

export class Post {
  constructor(renderer) {
    this.r = renderer;
    const gl = renderer.getContext();
    const hasFloat = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    this.type = hasFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const maxSamples = gl.getParameter(gl.MAX_SAMPLES) || 0;
    this.samples = Math.min(2, maxSamples);
    this.scene = new THREE.WebGLRenderTarget(4, 4, { type: this.type, samples: this.samples, depthBuffer: true });
    const opt = { type: this.type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.b1 = new THREE.WebGLRenderTarget(4, 4, opt);
    this.b2 = new THREE.WebGLRenderTarget(4, 4, opt);
    this.b3 = new THREE.WebGLRenderTarget(4, 4, opt);
    this.b4 = new THREE.WebGLRenderTarget(4, 4, opt);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(tri, null);
    this.quad.frustumCulled = false;
    this.qscene = new THREE.Scene();
    this.qscene.add(this.quad);
    this.bright = new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: BRIGHT_FRAG, uniforms: { tSrc: { value: null }, uThreshold: { value: 2 }, uTexel: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
    this.blur = new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: BLUR_FRAG, uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
    this.final = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: FINAL_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: null }, tBloom: { value: null }, tBloom2: { value: null }, uTexel: { value: new THREE.Vector2() },
        uExposure: { value: 1 }, uBloom: { value: 0.35 }, uTilt: { value: 0 }, uFocus: { value: 0.45 },
        uWarm: { value: 0.02 }, uSat: { value: 1 }, uContrast: { value: 1.04 }, uTime: { value: 0 },
      },
    });
    this.params = this.final.uniforms;
  }
  setSize(w, h) {
    this.w = w; this.h = h;
    this.scene.setSize(w, h);
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
    const qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
    const ew = Math.max(1, w >> 3), eh = Math.max(1, h >> 3);
    this.b1.setSize(qw, qh); this.b2.setSize(qw, qh);
    this.b3.setSize(ew, eh); this.b4.setSize(ew, eh);
    this.hw = hw; this.hh = hh; this.qw = qw; this.qh = qh; this.ew = ew; this.eh = eh;
    this.final.uniforms.uTexel.value.set(1 / w, 1 / h);
  }
  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.qscene, this.camera);
  }
  render(scene, camera) {
    const r = this.r;
    r.setRenderTarget(this.scene);
    r.render(scene, camera);
    // bloom chain
    this.bright.uniforms.tSrc.value = this.scene.texture;
    this.bright.uniforms.uTexel.value.set(1 / this.w, 1 / this.h);
    this.pass(this.bright, this.b1);
    this.blur.uniforms.tSrc.value = this.b1.texture; this.blur.uniforms.uDir.value.set(1 / this.qw, 0); this.pass(this.blur, this.b2);
    this.blur.uniforms.tSrc.value = this.b2.texture; this.blur.uniforms.uDir.value.set(0, 1 / this.qh); this.pass(this.blur, this.b1);
    this.blur.uniforms.tSrc.value = this.b1.texture; this.blur.uniforms.uDir.value.set(1 / this.ew, 0); this.pass(this.blur, this.b3);
    this.blur.uniforms.tSrc.value = this.b3.texture; this.blur.uniforms.uDir.value.set(0, 1 / this.eh); this.pass(this.blur, this.b4);
    this.final.uniforms.tScene.value = this.scene.texture;
    this.final.uniforms.tBloom.value = this.b1.texture;
    this.final.uniforms.tBloom2.value = this.b4.texture;
    this.pass(this.final, null);
  }
  dispose() {
    for (const t of [this.scene, this.b1, this.b2, this.b3, this.b4]) t.dispose();
    this.bright.dispose(); this.blur.dispose(); this.final.dispose();
    this.quad.geometry.dispose();
  }
}
