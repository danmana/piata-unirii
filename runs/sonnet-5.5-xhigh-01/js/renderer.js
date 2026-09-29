/* Piata Unirii — WebGL2 renderer: merged static chunks per material pool, GPU-instanced models, cascaded static shadow maps,
   procedural sky, blob shadows and glow sprites. */
(function () {
  'use strict';
  const PU = window.PU;
  const M4 = PU.M4;

  /* ===================================================================== */
  /*  GLSL                                                                 */
  /* ===================================================================== */
  const VS = `
precision highp float;
precision highp int;
layout(location=0) in vec3 a_pos;
layout(location=1) in vec4 a_nrm;
layout(location=2) in vec4 a_col;
layout(location=3) in vec4 a_misc;
#if defined(INST) || defined(ACTOR) || defined(JET)
layout(location=4) in vec4 a_i0;
layout(location=5) in vec4 a_i1;
layout(location=6) in vec4 a_i2;
#endif
uniform mat4 u_vp;
uniform float u_time;
uniform int u_pool;
uniform float u_sway;
#ifdef ACTOR
uniform vec3 u_pal[64];
uniform int u_rig;
#endif
#ifndef SHADOW
out vec3 v_wpos;
out vec3 v_nrm;
out vec4 v_col;
out vec4 v_misc;
#endif

vec3 rotZ(vec3 p, vec3 pv, float a) {
  float c = cos(a), s = sin(a);
  vec2 d = p.xy - pv.xy;
  return vec3(pv.x + c*d.x - s*d.y, pv.y + s*d.x + c*d.y, p.z);
}
vec3 rotX(vec3 p, vec3 pv, float a) {
  float c = cos(a), s = sin(a);
  vec2 d = p.yz - pv.yz;
  return vec3(p.x, pv.y + c*d.x - s*d.y, pv.z + s*d.x + c*d.y);
}

void main() {
  vec3 p = a_pos;
  vec3 n = a_nrm.xyz;
  vec4 col = a_col;
  vec4 misc = a_misc;
#ifdef JET
  float t = fract(u_time * a_i1.y + a_i0.w);
  float hgt = a_i1.x * 4.0 * t * (1.0 - t);
  vec2 drift = vec2(sin(a_i1.w * 13.0), cos(a_i1.w * 7.0)) * 0.3 * t;
  p = a_pos * a_i1.z + a_i0.xyz + vec3(drift.x, hgt, drift.y);
  n = vec3(0.0, 1.0, 0.0);
#endif
#ifdef ACTOR
  {
    int slot = int(col.r * 255.0 + 0.5);
    vec3 c = vec3(0.5);
    if (slot == 1) c = u_pal[int(a_i2.x + 0.5)];
    else if (slot == 2) c = u_pal[int(a_i2.y + 0.5)];
    else if (slot == 3) c = u_pal[int(a_i2.z + 0.5)];
    else if (slot == 4) c = u_pal[int(a_i2.w + 0.5)];
    else if (slot == 6) c = u_pal[16 + (int(a_i2.x + 0.5) * 7 + 3) % 24];
    else c = u_pal[slot];
    col.rgb = c;
    int part = int(misc.w + 0.5);
    float ph = a_i1.y, walk = a_i1.z, pose = a_i1.w;
    if (u_rig == 0) {
      float sw = sin(ph) * 0.62 * walk;
      vec3 hip = vec3(0.0, 0.92, 0.0);
      if (part == 1 || part == 2 || part == 5 || part == 6) {
        float side = (part == 1 || part == 5) ? 1.0 : -1.0;
        float ang = side * sw;
        float knee = -(0.12 + 0.6 * max(0.0, -side * sin(ph))) * walk;
        if (pose > 0.5 && pose < 1.5) { ang = 1.5; knee = -1.5; }
        if (part == 5 || part == 6) p = rotZ(p, vec3(0.0, 0.50, 0.0), knee);
        p = rotZ(p, hip, ang);
      } else if (part == 3 || part == 4) {
        float side = part == 3 ? 1.0 : -1.0;
        float ang = -side * sw * 0.9;
        if (pose > 0.5 && pose < 1.5) ang = 0.5;
        if (pose > 1.5 && pose < 2.5 && part == 4) ang = 1.75;
        p = rotZ(p, vec3(0.0, 1.46, 0.0), ang);
      }
      if (pose > 0.5 && pose < 1.5) p.y -= 0.44;
      p.y += abs(sin(ph)) * 0.025 * walk;
    } else if (u_rig == 1) {
      float wa = -ph;
      if (part == 7) p = rotZ(p, vec3(-0.44, 0.34, 0.0), wa);
      else if (part == 8) p = rotZ(p, vec3(0.44, 0.34, 0.0), wa);
      else if (part == 1 || part == 2 || part == 5 || part == 6) {
        float side = (part == 1 || part == 5) ? 1.0 : -1.0;
        float pd = ph * 0.9 + (side < 0.0 ? 3.14159 : 0.0);
        float ang = 1.0 + 0.5 * sin(pd);
        float knee = -(0.95 + 0.65 * sin(pd + 1.9));
        if (part == 5 || part == 6) p = rotZ(p, vec3(0.16, 0.50, 0.0), knee);
        p = rotZ(p, vec3(0.16, 0.96, 0.0), ang);
      }
    } else {
      // pigeon: pose 0 pecking on ground, pose 2 flying
      float fly = pose > 1.5 ? 1.0 : 0.0;
      if (part == 1) p = rotZ(p, vec3(0.07, 0.12, 0.0), -0.95 * max(0.0, sin(ph * 0.7)) * (1.0 - fly));
      else if (part == 3 || part == 4) {
        float side = part == 3 ? 1.0 : -1.0;
        float flap = fly * side * (0.35 + 0.85 * sin(ph * 3.4));
        p = rotX(p, vec3(0.0, 0.10, side * 0.04), flap);
      } else if ((part == 5 || part == 6) && fly > 0.5) p.y += 0.035;
    }
  }
#endif
#if defined(INST) || defined(ACTOR)
  float sc = a_i1.x;
  float cy = cos(a_i0.w), sy = sin(a_i0.w);
  #ifdef INST
  if (u_sway > 0.5 && u_pool == 4) {
    p.x += sin(u_time * 1.4 + a_i0.x * 0.37 + a_i0.z * 0.21 + p.y * 0.25) * 0.011 * p.y;
    p.z += cos(u_time * 1.1 + a_i0.z * 0.29 + p.y * 0.2) * 0.009 * p.y;
  }
  if (misc.w > 0.5) col.rgb *= a_i1.yzw;
  sc = a_i1.x;
  #endif
  p *= sc;
  p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z) + a_i0.xyz;
  n = vec3(cy * n.x + sy * n.z, n.y, -sy * n.x + cy * n.z);
#endif
  gl_Position = u_vp * vec4(p, 1.0);
#ifndef SHADOW
  v_wpos = p;
  v_nrm = n;
  v_col = col;
  v_misc = misc;
#endif
}
`;

  const FS_SHADOW = `
precision highp float;
void main() {}
`;

  const GLSL_COMMON = `
uniform vec3 u_camPos;
uniform vec3 u_sunDir;
uniform vec3 u_sunCol;
uniform vec3 u_skyAmb;
uniform vec3 u_grdAmb;
uniform vec3 u_fogCol;
uniform vec3 u_skyZen;
uniform vec3 u_skyHor;
uniform vec3 u_sunGlow;
uniform float u_fogDen;
uniform float u_exposure;
uniform float u_night;
uniform float u_time;
uniform vec2 u_res;
vec3 skyCol(vec3 d) {
  float h = clamp(d.y, -0.3, 1.0);
  float t = pow(max(h, 0.0), 0.5);
  vec3 c = mix(u_skyHor, u_skyZen, t);
  c = mix(c, u_skyHor * 0.85, smoothstep(0.0, -0.3, d.y));
  float sd = max(dot(d, u_sunDir), 0.0);
  c += u_sunGlow * (pow(sd, 6.0) * 0.32 + pow(sd, 48.0) * 0.5 + pow(sd, 900.0) * 6.0);
  return c;
}
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 finish(vec3 c) {
  c *= u_exposure;
  c = aces(c);
  c = pow(c, vec3(1.0 / 2.2));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.06);
  vec2 q = gl_FragCoord.xy / u_res - 0.5;
  float vig = 1.0 - 0.28 * smoothstep(0.30, 0.85, length(q * vec2(1.0, 0.9)) * 1.25);
  c *= vig;
  c += (hash12(gl_FragCoord.xy + u_time) - 0.5) / 255.0;
  return c;
}
`;

  const FS = `
precision highp float;
precision highp int;
precision highp sampler2DArray;
precision highp sampler2DShadow;
in vec3 v_wpos;
in vec3 v_nrm;
in vec4 v_col;
in vec4 v_misc;
out vec4 o_color;
uniform sampler2DArray u_tex;
uniform sampler2DShadow u_sh0;
uniform sampler2DShadow u_sh1;
uniform mat4 u_lvp0;
uniform mat4 u_lvp1;
uniform vec4 u_shp0;
uniform vec4 u_shp1;
uniform int u_pool;
uniform vec4 u_pp;
${GLSL_COMMON}
const float VSZ[12] = float[12](0.05, 0.1, 0.125, 0.25, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0, 32.0, 64.0);
const float TVS[4] = float[4](1.0, 0.5, 0.25, 2.0);
const vec2 POIS[12] = vec2[12](vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696, 0.457), vec2(-0.203, 0.621), vec2(0.962, -0.195), vec2(0.473, -0.480), vec2(0.519, 0.767), vec2(0.185, -0.893), vec2(0.507, 0.064), vec2(0.896, 0.412), vec2(-0.322, -0.933), vec2(-0.792, -0.598));

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float pcf0(vec3 c, mat2 r) {
  float s = 0.0;
  for (int i = 0; i < 12; i++) s += texture(u_sh0, vec3(c.xy + r * POIS[i] * u_shp0.x * 1.7, c.z));
  return s / 12.0;
}
float pcf1(vec3 c, mat2 r) {
  float s = 0.0;
  for (int i = 0; i < 8; i++) s += texture(u_sh1, vec3(c.xy + r * POIS[i] * u_shp1.x * 1.5, c.z));
  return s / 8.0;
}
float shadowFactor(vec3 p, vec3 N, float ndl) {
  float rot = 6.2831853 * hash12(gl_FragCoord.xy);
  mat2 r = mat2(cos(rot), sin(rot), -sin(rot), cos(rot));
  float slope = clamp(1.0 - ndl, 0.0, 1.0);
  vec3 p0 = p + N * u_shp0.y * (1.2 + 2.5 * slope);
  vec3 c0 = (u_lvp0 * vec4(p0, 1.0)).xyz * 0.5 + 0.5;
  float m0 = min(min(c0.x, 1.0 - c0.x), min(c0.y, 1.0 - c0.y));
  float w0 = smoothstep(0.0, 0.05, m0);
  float s0 = 1.0;
  if (w0 > 0.0) s0 = pcf0(vec3(c0.xy, c0.z - u_shp0.z), r);
  if (w0 >= 1.0) return s0;
  vec3 p1 = p + N * u_shp1.y * (1.2 + 2.5 * slope);
  vec3 c1 = (u_lvp1 * vec4(p1, 1.0)).xyz * 0.5 + 0.5;
  float m1 = min(min(c1.x, 1.0 - c1.x), min(c1.y, 1.0 - c1.y));
  float w1 = smoothstep(0.0, 0.08, m1);
  float s1 = 1.0;
  if (w1 > 0.0) s1 = mix(1.0, pcf1(vec3(c1.xy, c1.z - u_shp1.z), r), w1);
  return mix(s1, s0, w0);
}

void main() {
  vec3 N = normalize(v_nrm);
  vec3 toCam = u_camPos - v_wpos;
  float dist = length(toCam);
  vec3 V = toCam / max(dist, 1e-4);
  vec3 alb = pow(v_col.rgb, vec3(2.2));
  float ao = v_col.a;
  int ek = int(v_misc.z + 0.5);
  int tv = int(v_misc.x + 0.5);
  float vsz = VSZ[int(v_misc.y + 0.5)];
  bool isGlass = u_pool == 6;
  bool isWater = u_pool == 7;
  // ek 7: stippled glass (archaeological window) — lets the Roman ruins below show through
  if (ek == 7 && mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 0.5) discard;

  vec3 an = abs(N);
  vec2 uv = an.y > 0.5 ? v_wpos.xz : (an.x > 0.5 ? v_wpos.zy : v_wpos.xy);
  float tscale = u_pp.x * TVS[tv];
  vec4 tx = texture(u_tex, vec3(uv / tscale, float(u_pool)));
  float tstr = u_pp.y * (1.0 - 0.75 * smoothstep(90.0, 600.0, dist));

  vec3 Nw = N;
  if (isWater) {
    vec4 t1 = texture(u_tex, vec3(v_wpos.xz / 5.0 + vec2(u_time * 0.018, u_time * 0.011), 7.0));
    vec4 t2 = texture(u_tex, vec3(v_wpos.xz / 3.1 - vec2(u_time * 0.013, -u_time * 0.02), 7.0));
    vec2 g = (t1.rg + t2.rg - 1.0);
    Nw = normalize(N + vec3(g.x, 0.0, g.y) * 0.12);
  } else {
    alb *= mix(vec3(1.0), tx.rgb * 2.0, tstr);
    float jit = (hash13(floor((v_wpos - N * vsz * 0.5) / vsz)) - 0.5) * 0.07;
    alb *= 1.0 + jit;
  }
  if (isGlass && ek == 1) alb = vec3(0.028, 0.055, 0.085);

  float ndl = dot(Nw, u_sunDir);
  float sh = 1.0;
  if (dot(N, u_sunDir) > -0.05) sh = shadowFactor(v_wpos, N, max(dot(N, u_sunDir), 0.0));
  float lit = max(ndl, 0.0) * sh;
  vec3 direct = u_sunCol * lit * (0.7 + 0.3 * ao);
  vec3 amb = mix(u_grdAmb, u_skyAmb, Nw.y * 0.5 + 0.5) * ao;
  amb += u_sunCol * 0.045 * clamp(-N.y * 0.5 + 0.5, 0.0, 1.0) * ao;
  vec3 col = alb * (direct + amb);

  vec3 R = reflect(-V, Nw);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(Nw, V), 0.0), 5.0);
  vec3 H = normalize(u_sunDir + V);
  if (isGlass) {
    vec3 refl = skyCol(R);
    col = mix(col, refl * 0.9, clamp(0.22 + 0.7 * fres, 0.0, 0.92));
    col += u_sunCol * pow(max(dot(Nw, H), 0.0), 90.0) * sh * 0.8;
  } else if (isWater) {
    vec3 refl = skyCol(R);
    col = mix(col, refl, clamp(0.28 + 0.65 * fres, 0.0, 0.95));
    col += u_sunCol * pow(max(dot(Nw, H), 0.0), 220.0) * sh * 2.2;
  } else if (u_pp.z > 0.01) {
    float sp = pow(max(dot(Nw, H), 0.0), u_pp.w) * u_pp.z;
    col += u_sunCol * sp * sh;
    col += skyCol(R) * 0.12 * u_pp.z * fres;
  }

  // emissive kinds: 1 window, 2 lamp, 3 warm under-glass, 4 clock face, 5 flood, 6 accent
  if (ek == 1) col += vec3(1.0, 0.70, 0.36) * 2.2 * u_night;
  else if (ek == 2) col = mix(col, vec3(1.0, 0.86, 0.55) * 3.0, 0.3 + 0.7 * u_night);
  else if (ek == 3) col += vec3(1.0, 0.55, 0.22) * (0.5 + 1.6 * u_night);
  else if (ek == 4) col += vec3(1.0, 0.85, 0.55) * 0.6 * u_night;
  else if (ek == 5) col += vec3(1.0, 0.86, 0.6) * 2.6 * u_night;
  else if (ek == 6) col += alb * 1.0 * u_night;
  else if (ek == 7) col += vec3(1.0, 0.62, 0.3) * (0.35 + 0.9 * u_night);

  // aerial perspective
  float fog = 1.0 - exp(-dist * u_fogDen);
  fog *= exp(-max(v_wpos.y, 0.0) * 0.0009);
  float sunAmt = pow(max(dot(-V, u_sunDir), 0.0), 5.0);
  vec3 fc = mix(u_fogCol, u_fogCol * 1.5 + u_sunGlow * 0.35, sunAmt * 0.6);
  col = mix(col, fc, clamp(fog, 0.0, 1.0));
  o_color = vec4(finish(col), 1.0);
}
`;

  const SKY_VS = `
precision highp float;
out vec2 v_ndc;
void main() {
  vec2 q = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_ndc = q * 2.0 - 1.0;
  gl_Position = vec4(v_ndc, 1.0, 1.0);
}
`;
  const SKY_FS = `
precision highp float;
in vec2 v_ndc;
out vec4 o_color;
uniform mat4 u_invVP;
uniform vec3 u_cloudLit;
uniform vec3 u_cloudShade;
uniform float u_cover;
${GLSL_COMMON}
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0)), c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; }
  return s;
}
void main() {
  vec4 wp = u_invVP * vec4(v_ndc, 1.0, 1.0);
  vec3 dir = normalize(wp.xyz / wp.w - u_camPos);
  vec3 col = skyCol(dir);
  if (dir.y > 0.0) {
    float t = (1600.0 - u_camPos.y) / max(dir.y, 0.012);
    vec2 pp = (u_camPos.xz + dir.xz * t) * 0.00042 + vec2(u_time * 0.0007, u_time * 0.0003);
    float n = fbm(pp);
    float cov = smoothstep(u_cover - 0.07, u_cover + 0.10, n);
    float ns = fbm(pp + u_sunDir.xz * 0.045);
    float light = clamp(0.62 + (n - ns) * 5.0, 0.0, 1.0);
    vec3 cc = mix(u_cloudShade, u_cloudLit, light);
    cc = mix(cc, u_cloudLit * 1.08, smoothstep(0.55, 0.0, cov) * 0.5);
    float fade = smoothstep(0.015, 0.16, dir.y);
    col = mix(col, cc, cov * fade * 0.96);
  }
  o_color = vec4(finish(col), 1.0);
}
`;

  const BLOB_VS = `
precision highp float;
layout(location=4) in vec4 a_i0;
layout(location=5) in vec4 a_i1;
uniform mat4 u_vp;
out vec2 v_uv;
out float v_a;
void main() {
  vec2 q = vec2((gl_VertexID & 1) == 0 ? -1.0 : 1.0, (gl_VertexID & 2) == 0 ? -1.0 : 1.0);
  float c = cos(a_i0.w), s = sin(a_i0.w);
  vec2 l = vec2(q.x * a_i1.x, q.y * a_i1.y);
  vec3 p = a_i0.xyz + vec3(c * l.x + s * l.y, 0.025, -s * l.x + c * l.y);
  v_uv = q;
  v_a = a_i1.z;
  gl_Position = u_vp * vec4(p, 1.0);
}
`;
  const BLOB_FS = `
precision highp float;
in vec2 v_uv;
in float v_a;
out vec4 o_color;
void main() {
  float r = length(v_uv);
  float a = v_a * smoothstep(1.0, 0.1, r);
  o_color = vec4(0.03, 0.035, 0.06, a);
}
`;
  const GLOW_VS = `
precision highp float;
layout(location=4) in vec4 a_i0;
layout(location=5) in vec4 a_i1;
uniform mat4 u_vp;
uniform vec3 u_right;
uniform vec3 u_up;
out vec2 v_uv;
out vec4 v_c;
void main() {
  vec2 q = vec2((gl_VertexID & 1) == 0 ? -1.0 : 1.0, (gl_VertexID & 2) == 0 ? -1.0 : 1.0);
  vec3 p = a_i0.xyz + (u_right * q.x + u_up * q.y) * a_i0.w;
  v_uv = q;
  v_c = a_i1;
  gl_Position = u_vp * vec4(p, 1.0);
}
`;
  const GLOW_FS = `
precision highp float;
in vec2 v_uv;
in vec4 v_c;
out vec4 o_color;
uniform float u_glow;
void main() {
  float r = length(v_uv);
  float f = exp(-r * r * 4.0) * smoothstep(1.0, 0.6, r);
  o_color = vec4(v_c.rgb * v_c.a * f * u_glow, 1.0);
}
`;

  /* ===================================================================== */
  class Program {
    constructor(gl, vs, fs, defs) {
      this.gl = gl;
      const pre = '#version 300 es\n' + (defs || []).map((d) => '#define ' + d + '\n').join('');
      const mk = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, pre + src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          const log = gl.getShaderInfoLog(s);
          const lines = (pre + src).split('\n').map((l, i) => i + 1 + ': ' + l).join('\n');
          throw new Error('Shader compile error: ' + log + '\n' + lines.slice(0, 6000));
        }
        return s;
      };
      const v = mk(gl.VERTEX_SHADER, vs), f = mk(gl.FRAGMENT_SHADER, fs);
      this.prog = gl.createProgram();
      gl.attachShader(this.prog, v);
      gl.attachShader(this.prog, f);
      gl.linkProgram(this.prog);
      if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) throw new Error('Program link error: ' + gl.getProgramInfoLog(this.prog));
      gl.deleteShader(v);
      gl.deleteShader(f);
      this.loc = {};
    }
    u(name) {
      if (!(name in this.loc)) this.loc[name] = this.gl.getUniformLocation(this.prog, name);
      return this.loc[name];
    }
    use() {
      this.gl.useProgram(this.prog);
      return this;
    }
  }

  /* pool material params: texWorldSize, texStrength, specular, shininess */
  const POOL_PARAMS = [
    [4.0, 0.95, 0.0, 8], // stone
    [3.0, 0.9, 0.0, 8], // plaster
    [2.0, 1.0, 0.05, 12], // terracotta
    [1.0, 0.85, 0.55, 26], // bronze / metal
    [1.0, 0.9, 0.0, 8], // vegetation
    [4.0, 1.0, 0.04, 16], // pavement
    [1.0, 0.25, 1.0, 60], // glass
    [6.0, 0.0, 1.0, 60], // water
    [1.0, 0.7, 0.14, 14], // misc
  ];

  /* ===================================================================== */
  class InstModel {
    /* lods: [{builder, maxDist}], max instances, opts {sway, rig, cast, radius, dynamic, shadowLod} */
    constructor(r, name, lods, max, opts) {
      opts = opts || {};
      this.r = r;
      this.name = name;
      this.max = max;
      this.sway = !!opts.sway;
      this.rig = opts.rig === undefined ? -1 : opts.rig;
      this.cast = !!opts.cast;
      this.radius = opts.radius || 6;
      this.dynamic = !!opts.dynamic;
      this.shadowLod = opts.shadowLod === undefined ? Math.min(1, lods.length - 1) : opts.shadowLod;
      this.lods = lods.map((l) => {
        const parts = r.uploadParts(l.builder);
        const buf = r.gl.createBuffer();
        r.gl.bindBuffer(r.gl.ARRAY_BUFFER, buf);
        r.gl.bufferData(r.gl.ARRAY_BUFFER, max * 48, r.gl.DYNAMIC_DRAW);
        for (const p of parts) if (p) p.ivao = r.instVAO(p, buf);
        return { maxDist: l.maxDist, parts, buf, count: 0 };
      });
      this.data = new Float32Array(max * 12);
      this.n = 0;
      this.stage = this.lods.map(() => new Float32Array(max * 12));
      this.shBuf = null;
    }
    /* full static list: Float32Array n*12 */
    setAll(f32, n) {
      this.n = Math.min(n, this.max);
      this.data.set(f32.subarray(0, this.n * 12));
      const r = this.r, gl = r.gl;
      if (this.cast) {
        if (!this.shBuf) {
          this.shBuf = gl.createBuffer();
          const lod = this.lods[this.shadowLod];
          this.shVaos = lod.parts.map((p) => (p ? r.instVAO(p, this.shBuf) : null));
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.shBuf);
        gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, this.n * 12), gl.STATIC_DRAW);
      }
      if (this.dynamic) {
        const l0 = this.lods[0];
        gl.bindBuffer(gl.ARRAY_BUFFER, l0.buf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.n * 12));
        l0.count = this.n;
      }
    }
    /* per-frame cull + LOD bucketing (static models) */
    update(frame) {
      if (this.dynamic) return;
      const gl = this.r.gl, cam = frame.camPos, planes = frame.planes;
      const nl = this.lods.length;
      const counts = new Array(nl).fill(0);
      const d = this.data;
      const rad = this.radius;
      for (let i = 0; i < this.n; i++) {
        const o = i * 12;
        const sc = d[o + 4];
        const rr = rad * sc;
        const x = d[o], y = d[o + 1] + rr * 0.5, z = d[o + 2];
        if (!M4.sphereVisible(planes, x, y, z, rr)) continue;
        const dist = Math.hypot(x - cam[0], y - cam[1], z - cam[2]);
        let lod = nl - 1;
        for (let k = 0; k < nl; k++) if (dist <= this.lods[k].maxDist) { lod = k; break; }
        const st = this.stage[lod];
        st.set(d.subarray(o, o + 12), counts[lod] * 12);
        counts[lod]++;
      }
      for (let k = 0; k < nl; k++) {
        const L = this.lods[k];
        L.count = counts[k];
        if (counts[k]) {
          gl.bindBuffer(gl.ARRAY_BUFFER, L.buf);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.stage[k].subarray(0, counts[k] * 12));
        }
      }
    }
  }
  PU.InstModel = InstModel;

  /* ===================================================================== */
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
      if (!gl) throw new Error('WebGL2 is not available in this browser.');
      this.gl = gl;
      this.chunks = [];
      this.insts = [];
      this.stats = { calls: 0, tris: 0, chunks: 0, visible: 0 };
      this.atlas = PU.makeAtlas(gl);
      this.blobData = new Float32Array(8 * 1024);
      this.glowData = new Float32Array(8 * 1024);
      this.blobN = 0;
      this.glowN = 0;
      this.lastSun = [9, 9, 9];
      this.shadowDirty = true;
      this._initPrograms();
      this._initShadows();
      this._initBuffers();
      this.vp = M4.create();
      this.tmp = M4.create();
      this.palData = new Float32Array(64 * 3);
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        this.lost = true;
        if (this.onLost) this.onLost();
      });
    }

    _initPrograms() {
      const gl = this.gl;
      this.pStatic = new Program(gl, VS, FS, []);
      this.pInst = new Program(gl, VS, FS, ['INST']);
      this.pActor = new Program(gl, VS, FS, ['ACTOR']);
      this.pJet = new Program(gl, VS, FS, ['JET']);
      this.pShStatic = new Program(gl, VS, FS_SHADOW, ['SHADOW']);
      this.pShInst = new Program(gl, VS, FS_SHADOW, ['SHADOW', 'INST']);
      this.pSky = new Program(gl, SKY_VS, SKY_FS, []);
      this.pBlob = new Program(gl, BLOB_VS, BLOB_FS, []);
      this.pGlow = new Program(gl, GLOW_VS, GLOW_FS, []);
      for (const p of [this.pStatic, this.pInst, this.pActor, this.pJet]) {
        p.use();
        gl.uniform1i(p.u('u_tex'), 0);
        gl.uniform1i(p.u('u_sh0'), 1);
        gl.uniform1i(p.u('u_sh1'), 2);
      }
    }

    _makeShadow(size) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Shadow framebuffer incomplete: ' + st);
      return { tex, fb, size, vp: M4.create(), texel: 0, bias: 0, R: 100, center: [0, 0, 0] };
    }

    _initShadows() {
      const maxTex = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
      const s0 = Math.min(4096, maxTex), s1 = Math.min(3072, maxTex);
      this.sh = [this._makeShadow(s0), this._makeShadow(s1)];
      this.sh[0].R = 138;
      this.sh[0].center = [-4, 10, 4];
      this.sh[1].R = 430;
      this.sh[1].center = [0, 16, 0];
    }

    _initBuffers() {
      const gl = this.gl;
      this.blobBuf = gl.createBuffer();
      this.glowBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.blobBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.blobData.byteLength, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.glowData.byteLength, gl.DYNAMIC_DRAW);
      const mk = (buf) => {
        const v = gl.createVertexArray();
        gl.bindVertexArray(v);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(4);
        gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 32, 0);
        gl.vertexAttribDivisor(4, 1);
        gl.enableVertexAttribArray(5);
        gl.vertexAttribPointer(5, 4, gl.FLOAT, false, 32, 16);
        gl.vertexAttribDivisor(5, 1);
        gl.bindVertexArray(null);
        return v;
      };
      this.blobVAO = mk(this.blobBuf);
      this.glowVAO = mk(this.glowBuf);
      this.emptyVAO = gl.createVertexArray();
    }

    resize(w, h, dpr) {
      const c = this.canvas;
      const W = Math.max(2, Math.floor(w * dpr)), H = Math.max(2, Math.floor(h * dpr));
      if (c.width !== W || c.height !== H) {
        c.width = W;
        c.height = H;
      }
      this.width = W;
      this.height = H;
    }

    /* ---------- geometry upload ---------- */
    uploadParts(builder) {
      const gl = this.gl;
      const parts = new Array(9).fill(null);
      for (let p = 0; p < 9; p++) {
        const b = builder.pools[p];
        if (!b || !b.vn) continue;
        const vbo = gl.createBuffer(), ibo = gl.createBuffer(), vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(b.buf, 0, b.vn * 24), gl.STATIC_DRAW);
        this._vertexFormat();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, b.idx.subarray(0, b.in), gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        parts[p] = { pool: p, vbo, ibo, vao, count: b.in, verts: b.vn };
      }
      return parts;
    }
    _vertexFormat() {
      const gl = this.gl;
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.BYTE, true, 24, 12);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 24, 16);
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, false, 24, 20);
    }
    instVAO(part, instBuf) {
      const gl = this.gl;
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, part.vbo);
      this._vertexFormat();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, part.ibo);
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
      for (let k = 0; k < 3; k++) {
        gl.enableVertexAttribArray(4 + k);
        gl.vertexAttribPointer(4 + k, 4, gl.FLOAT, false, 48, k * 16);
        gl.vertexAttribDivisor(4 + k, 1);
      }
      gl.bindVertexArray(null);
      return vao;
    }

    /* chunk = { name, lods:[{maxDist, builder}], cast, min, max } — builds GPU parts */
    addChunk(spec) {
      const lods = spec.lods.map((l) => ({ maxDist: l.maxDist, parts: this.uploadParts(l.builder) }));
      const b0 = spec.lods[0].builder;
      const min = spec.min || b0.min.slice(), max = spec.max || b0.max.slice();
      const chunk = {
        name: spec.name,
        lods,
        cast: spec.cast !== false,
        min,
        max,
        cx: (min[0] + max[0]) / 2,
        cy: (min[1] + max[1]) / 2,
        cz: (min[2] + max[2]) / 2,
        tris: spec.lods.map((l) => l.builder.triangleCount()),
        alwaysShadowLod: spec.alwaysShadowLod,
      };
      this.chunks.push(chunk);
      return chunk;
    }
    disposeParts(parts) {
      const gl = this.gl;
      for (const p of parts) {
        if (!p) continue;
        gl.deleteBuffer(p.vbo);
        gl.deleteBuffer(p.ibo);
        gl.deleteVertexArray(p.vao);
        if (p.ivao) gl.deleteVertexArray(p.ivao);
      }
    }
    disposeAll() {
      for (const c of this.chunks) for (const l of c.lods) this.disposeParts(l.parts);
      this.chunks.length = 0;
      for (const m of this.insts) {
        for (const l of m.lods) {
          this.disposeParts(l.parts);
          this.gl.deleteBuffer(l.buf);
        }
        if (m.shBuf) this.gl.deleteBuffer(m.shBuf);
      }
      this.insts.length = 0;
      this.shadowDirty = true;
    }
    addInst(model) {
      this.insts.push(model);
      return model;
    }

    /* ---------- shadow fitting ---------- */
    _fitShadows(env) {
      const sd = env.sunDir;
      for (const c of this.sh) {
        const R = c.R;
        const dist = R * 2 + 260;
        const eye = [c.center[0] + sd[0] * dist, c.center[1] + sd[1] * dist, c.center[2] + sd[2] * dist];
        const up = Math.abs(sd[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
        M4.lookAt(this.tmp, eye[0], eye[1], eye[2], c.center[0], c.center[1], c.center[2], up[0], up[1], up[2]);
        const proj = M4.create();
        const far = dist + R + 140;
        M4.ortho(proj, -R, R, -R, R, 1, far);
        M4.multiply(c.vp, proj, this.tmp);
        c.texel = 1 / c.size;
        c.worldTexel = (2 * R) / c.size;
        c.bias = 0.05 / (far - 1);
        c.planes = M4.frustum(c.vp, new Float32Array(24));
      }
    }

    _setPool(prog, p) {
      const gl = this.gl;
      const pp = POOL_PARAMS[p];
      gl.uniform1i(prog.u('u_pool'), p);
      gl.uniform4f(prog.u('u_pp'), pp[0], pp[1], pp[2], pp[3]);
    }

    _lodFor(chunk, dist) {
      const L = chunk.lods;
      for (let i = 0; i < L.length; i++) if (dist <= L[i].maxDist) return L[i];
      return L[L.length - 1];
    }

    renderShadows(env) {
      const gl = this.gl;
      this._fitShadows(env);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.colorMask(false, false, false, false);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1.5, 3.0);
      gl.disable(gl.CULL_FACE);
      for (let ci = 0; ci < 2; ci++) {
        const c = this.sh[ci];
        gl.bindFramebuffer(gl.FRAMEBUFFER, c.fb);
        gl.viewport(0, 0, c.size, c.size);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        const p = this.pShStatic.use();
        gl.uniformMatrix4fv(p.u('u_vp'), false, c.vp);
        for (const ch of this.chunks) {
          if (!ch.cast) continue;
          if (!M4.aabbVisible(c.planes, ch.min[0], ch.min[1], ch.min[2], ch.max[0], ch.max[1], ch.max[2])) continue;
          const dx = Math.max(ch.min[0] - c.center[0], 0, c.center[0] - ch.max[0]);
          const dz = Math.max(ch.min[2] - c.center[2], 0, c.center[2] - ch.max[2]);
          const lod = ci === 0 ? this._lodFor(ch, Math.hypot(dx, dz)) : ch.lods[Math.min(ch.lods.length - 1, 1)];
          for (let pi = 0; pi < 9; pi++) {
            if (pi === 7) continue;
            const part = lod.parts[pi];
            if (!part) continue;
            gl.bindVertexArray(part.vao);
            gl.drawElements(gl.TRIANGLES, part.count, gl.UNSIGNED_INT, 0);
          }
        }
        const pi2 = this.pShInst.use();
        gl.uniformMatrix4fv(pi2.u('u_vp'), false, c.vp);
        gl.uniform1f(pi2.u('u_sway'), 0);
        gl.uniform1i(pi2.u('u_pool'), 0);
        for (const m of this.insts) {
          if (!m.cast || !m.n || !m.shVaos) continue;
          const lod = m.lods[m.shadowLod];
          for (let pi = 0; pi < 9; pi++) {
            const part = lod.parts[pi];
            if (!part) continue;
            gl.bindVertexArray(m.shVaos[pi]);
            gl.drawElementsInstanced(gl.TRIANGLES, part.count, gl.UNSIGNED_INT, 0, m.n);
          }
        }
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.colorMask(true, true, true, true);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.lastSun = env.sunDir.slice();
      this.shadowDirty = false;
    }

    _commonUniforms(prog, frame) {
      const gl = this.gl, e = frame.env;
      gl.uniformMatrix4fv(prog.u('u_vp'), false, frame.vp);
      gl.uniform3fv(prog.u('u_camPos'), frame.camPos);
      gl.uniform3fv(prog.u('u_sunDir'), e.sunDir);
      gl.uniform3fv(prog.u('u_sunCol'), e.sunCol);
      gl.uniform3fv(prog.u('u_skyAmb'), e.skyAmb);
      gl.uniform3fv(prog.u('u_grdAmb'), e.grdAmb);
      gl.uniform3fv(prog.u('u_fogCol'), e.fogCol);
      gl.uniform3fv(prog.u('u_skyZen'), e.skyZen);
      gl.uniform3fv(prog.u('u_skyHor'), e.skyHor);
      gl.uniform3fv(prog.u('u_sunGlow'), e.sunGlow);
      gl.uniform1f(prog.u('u_fogDen'), e.fogDen);
      gl.uniform1f(prog.u('u_exposure'), e.exposure);
      gl.uniform1f(prog.u('u_night'), e.night);
      gl.uniform1f(prog.u('u_time'), frame.time);
      gl.uniform2f(prog.u('u_res'), this.width, this.height);
    }
    _shadowUniforms(prog) {
      const gl = this.gl, s0 = this.sh[0], s1 = this.sh[1];
      gl.uniformMatrix4fv(prog.u('u_lvp0'), false, s0.vp);
      gl.uniformMatrix4fv(prog.u('u_lvp1'), false, s1.vp);
      gl.uniform4f(prog.u('u_shp0'), s0.texel, s0.worldTexel, s0.bias, 0);
      gl.uniform4f(prog.u('u_shp1'), s1.texel, s1.worldTexel, s1.bias, 0);
    }

    setPalette(arr) {
      this.palData.set(arr);
    }

    render(frame) {
      const gl = this.gl;
      if (this.lost) return;
      const env = frame.env;
      const sd = env.sunDir;
      if (this.shadowDirty || Math.abs(sd[0] - this.lastSun[0]) + Math.abs(sd[1] - this.lastSun[1]) + Math.abs(sd[2] - this.lastSun[2]) > 1e-4) {
        this.renderShadows(env);
      }
      const st = this.stats;
      st.calls = 0;
      st.tris = 0;
      st.visible = 0;

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.width, this.height);
      gl.clearColor(env.fogCol[0], env.fogCol[1], env.fogCol[2], 1);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);

      // sky
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      const sp = this.pSky.use();
      gl.uniformMatrix4fv(sp.u('u_invVP'), false, frame.invVP);
      gl.uniform3fv(sp.u('u_camPos'), frame.camPos);
      gl.uniform3fv(sp.u('u_sunDir'), env.sunDir);
      gl.uniform3fv(sp.u('u_sunCol'), env.sunCol);
      gl.uniform3fv(sp.u('u_skyZen'), env.skyZen);
      gl.uniform3fv(sp.u('u_skyHor'), env.skyHor);
      gl.uniform3fv(sp.u('u_sunGlow'), env.sunGlow);
      gl.uniform3fv(sp.u('u_cloudLit'), env.cloudLit);
      gl.uniform3fv(sp.u('u_cloudShade'), env.cloudShade);
      gl.uniform1f(sp.u('u_cover'), env.cover);
      gl.uniform1f(sp.u('u_exposure'), env.exposure);
      gl.uniform1f(sp.u('u_time'), frame.time);
      gl.uniform2f(sp.u('u_res'), this.width, this.height);
      gl.bindVertexArray(this.emptyVAO);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);

      // textures
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlas);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.sh[0].tex);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.sh[1].tex);
      gl.activeTexture(gl.TEXTURE0);

      // static chunks — cull + LOD, then draw grouped by pool
      const cam = frame.camPos, planes = frame.planes;
      const vis = this._vis || (this._vis = []);
      vis.length = 0;
      for (const ch of this.chunks) {
        if (!M4.aabbVisible(planes, ch.min[0], ch.min[1], ch.min[2], ch.max[0], ch.max[1], ch.max[2])) continue;
        const dx = Math.max(ch.min[0] - cam[0], 0, cam[0] - ch.max[0]);
        const dy = Math.max(ch.min[1] - cam[1], 0, cam[1] - ch.max[1]);
        const dz = Math.max(ch.min[2] - cam[2], 0, cam[2] - ch.max[2]);
        vis.push(this._lodFor(ch, Math.hypot(dx, dy, dz)));
      }
      st.visible = vis.length;
      const ps = this.pStatic.use();
      this._commonUniforms(ps, frame);
      this._shadowUniforms(ps);
      gl.uniform1f(ps.u('u_sway'), 0);
      for (let pi = 0; pi < 9; pi++) {
        this._setPool(ps, pi);
        for (let i = 0; i < vis.length; i++) {
          const part = vis[i].parts[pi];
          if (!part) continue;
          gl.bindVertexArray(part.vao);
          gl.drawElements(gl.TRIANGLES, part.count, gl.UNSIGNED_INT, 0);
          st.calls++;
          st.tris += part.count / 3;
        }
      }

      // instanced models
      const pin = this.pInst.use();
      this._commonUniforms(pin, frame);
      this._shadowUniforms(pin);
      for (const m of this.insts) {
        if (m.rig >= 0 || m.jet) continue;
        m.update(frame);
        gl.uniform1f(pin.u('u_sway'), m.sway ? 1 : 0);
        for (const L of m.lods) {
          if (!L.count) continue;
          for (let pi = 0; pi < 9; pi++) {
            const part = L.parts[pi];
            if (!part) continue;
            this._setPool(pin, pi);
            gl.bindVertexArray(part.ivao);
            gl.drawElementsInstanced(gl.TRIANGLES, part.count, gl.UNSIGNED_INT, 0, L.count);
            st.calls++;
            st.tris += (part.count / 3) * L.count;
          }
        }
      }
      // actors (rigged)
      const pa = this.pActor.use();
      this._commonUniforms(pa, frame);
      this._shadowUniforms(pa);
      gl.uniform3fv(pa.u('u_pal'), this.palData);
      gl.uniform1f(pa.u('u_sway'), 0);
      for (const m of this.insts) {
        if (m.rig < 0) continue;
        const L = m.lods[0];
        if (!L.count) continue;
        gl.uniform1i(pa.u('u_rig'), m.rig);
        for (let pi = 0; pi < 9; pi++) {
          const part = L.parts[pi];
          if (!part) continue;
          this._setPool(pa, pi);
          gl.bindVertexArray(part.ivao);
          gl.drawElementsInstanced(gl.TRIANGLES, part.count, gl.UNSIGNED_INT, 0, L.count);
          st.calls++;
          st.tris += (part.count / 3) * L.count;
        }
      }
      // fountain jets
      const pj = this.pJet.use();
      this._commonUniforms(pj, frame);
      this._shadowUniforms(pj);
      gl.uniform1f(pj.u('u_sway'), 0);
      for (const m of this.insts) {
        if (!m.jet) continue;
        const L = m.lods[0];
        if (!L.count) continue;
        for (let pi = 0; pi < 9; pi++) {
          const part = L.parts[pi];
          if (!part) continue;
          this._setPool(pj, pi);
          gl.bindVertexArray(part.ivao);
          gl.drawElementsInstanced(gl.TRIANGLES, part.count, gl.UNSIGNED_INT, 0, L.count);
          st.calls++;
        }
      }

      // blob shadows
      if (this.blobN) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
        const pb = this.pBlob.use();
        gl.uniformMatrix4fv(pb.u('u_vp'), false, frame.vp);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.blobBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.blobData.subarray(0, this.blobN * 8));
        gl.bindVertexArray(this.blobVAO);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.blobN);
        st.calls++;
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.enable(gl.CULL_FACE);
      }
      // glow sprites (additive)
      if (this.glowN && env.night > 0.02) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
        const pg = this.pGlow.use();
        gl.uniformMatrix4fv(pg.u('u_vp'), false, frame.vp);
        gl.uniform3fv(pg.u('u_right'), frame.right);
        gl.uniform3fv(pg.u('u_up'), frame.up);
        gl.uniform1f(pg.u('u_glow'), env.night);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.glowData.subarray(0, this.glowN * 8));
        gl.bindVertexArray(this.glowVAO);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.glowN);
        st.calls++;
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.enable(gl.CULL_FACE);
      }
      gl.bindVertexArray(null);
    }
  }
  PU.Renderer = Renderer;
})();
