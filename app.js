/* ==========================================================================
   CISCO ZABALA (@datasith) - datasith.com Static Runtime
   Includes:
     1. Two-Pass <4 MB WebGL2 Engine:
        - Pass 1: Bufferless gl_VertexID Phase-Portrait Vector Lattice
        - Pass 2: 180 GPU-Instanced Advected Streamline Comet Particles (4.3 KB Float32Array,
          0 textures, DPR<=1.25, 28 FPS power cap, auto-pause on hidden tab, WEBGL_lose_context release)
        - Automatic 2D Canvas Streamline Fallback for software-rendered VMs
     2. Linear / Rauno Cursor-Tracked Radial Spotlight (--mx, --my on [data-spotlight])
     3. 4-Tab View Router (Home / Projects / Publications / Bio)
     4. CSS Subgrid Project Ledger + Multi-Cloud Credly Credential Matrix Filter
     5. Cmd+K / '/' Keyboard Command Palette & Lightbox
   ========================================================================== */

(function () {
  'use strict';

  var BOOTSTRAP = {
    projects: [],
    publications: [],
    openStudies: [],
    career: [],
    certifications: [],
  };

  try {
    var rawBootstrap = document.getElementById('portfolio-bootstrap');
    if (rawBootstrap && rawBootstrap.textContent) {
      BOOTSTRAP = Object.assign(BOOTSTRAP, JSON.parse(rawBootstrap.textContent));
    }
  } catch (err) {
    console.error('Failed to parse bootstrap payload:', err);
  }

  var VALID_VIEWS = ['overview', 'projects', 'publications', 'bio'];
  var currentView = 'overview';
  var activeProjectCategory = 'All';
  var activeProjectSearch = '';
  var activeCertGroup = 'All';
  var cmdkItems = [];
  var cmdkActiveIdx = 0;
  var toastTimer = null;
  var FULL_CMDK_CATALOG = [];

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ========================================================================
     1. TWO-PASS <4 MB WEBGL2 ENGINE + 2D CANVAS STREAMLINE FALLBACK
     ======================================================================== */
  var PARTICLE_COUNT = 180;
  var webglCtrl = {
    enabled: true,
    gl: null,
    ctx2d: null,
    fieldProg: null,
    fieldVao: null,
    fieldUni: {},
    partProg: null,
    partVao: null,
    partBuf: null,
    partUni: {},
    gpuData: new Float32Array(PARTICLE_COUNT * 6),
    particles: [],
    dpr: 1,
    rafId: 0,
    lastFrameMs: 0,
    phase: 0.42,
    energy: 0.0,
    ptrX: -9999,
    ptrY: -9999,
    lastPtrX: null,
    lastPtrY: null,
    velX: 0,
    velY: 0,
  };

  function streamFnJs(qx, qy, phi) {
    var a = Math.sin(qx + 0.42 * Math.sin(qy + phi)) * Math.cos(qy - 0.42 * Math.cos(qx - 0.75 * phi));
    var b = 0.34 * Math.sin(0.66 * qx - 0.54 * qy + 0.52 * phi);
    return a + b;
  }

  function evalVelocityField(wx, wy, scrollOffset) {
    var phi = webglCtrl.phase;
    var qx = wx * 0.0042;
    var qy = wy * 0.0042;
    var eps = 0.02;
    var psi0 = streamFnJs(qx, qy, phi);
    var dPsiDx = (streamFnJs(qx + eps, qy, phi) - psi0) / eps;
    var dPsiDy = (streamFnJs(qx, qy + eps, phi) - psi0) / eps;
    var vx = dPsiDy;
    var vy = -dPsiDx;

    if (webglCtrl.energy > 0.01) {
      var screenY = wy - scrollOffset;
      var dx = wx - webglCtrl.ptrX;
      var dy = screenY - webglCtrl.ptrY;
      var d2 = dx * dx + dy * dy;
      if (d2 < 85000) {
        var dist = Math.max(Math.sqrt(d2), 1.0);
        var falloff = Math.exp(-d2 / (215.0 * 215.0)) * webglCtrl.energy;
        var tx = -dy / dist;
        var ty = dx / dist;
        var vMag = Math.hypot(webglCtrl.velX, webglCtrl.velY);
        var ux = vMag > 0.05 ? webglCtrl.velX / vMag : tx;
        var uy = vMag > 0.05 ? webglCtrl.velY / vMag : ty;
        vx += (tx * 0.8 + ux * 1.35) * falloff * 1.85;
        vy += (ty * 0.8 + uy * 1.35) * falloff * 1.85;
      }
    }
    return [vx, vy];
  }

  function seedParticles() {
    var w = Math.max(window.innerWidth || 1440, 320);
    var h = Math.max(window.innerHeight || 900, 320);
    var scrollOff = (window.scrollY || 0) * 0.22;
    webglCtrl.particles = [];
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var maxLife = 4.2 + Math.random() * 5.8;
      webglCtrl.particles.push({
        wx: Math.random() * w,
        wy: scrollOff + Math.random() * h,
        age: Math.random() * maxLife,
        maxLife: maxLife,
        speedMul: 28.0 + Math.random() * 26.0,
        kind: i % 6 === 0 ? 1.0 : 0.0,
      });
    }
  }

  function stepParticles(dt) {
    var w = Math.max(window.innerWidth || 1440, 320);
    var h = Math.max(window.innerHeight || 900, 320);
    var scrollOff = (window.scrollY || 0) * 0.22;
    var out = webglCtrl.gpuData;
    var list = webglCtrl.particles;
    if (!list.length) seedParticles();

    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var p = list[i];
      p.age += dt;
      var screenY = p.wy - scrollOff;
      if (p.age >= p.maxLife || p.wx < -60 || p.wx > w + 60 || screenY < -80 || screenY > h + 80) {
        p.wx = Math.random() * w;
        p.wy = scrollOff + Math.random() * h;
        p.age = 0.0;
        p.maxLife = 4.2 + Math.random() * 5.8;
      }
      var vel = evalVelocityField(p.wx, p.wy, scrollOff);
      var vx = vel[0];
      var vy = vel[1];
      p.wx += vx * p.speedMul * dt;
      p.wy += vy * p.speedMul * dt;

      var lifeNorm = Math.max(0.0, Math.min(1.0, p.age / p.maxLife));
      var alpha = Math.sin(Math.PI * lifeNorm);

      var base = i * 6;
      out[base] = p.wx;
      out[base + 1] = p.wy - scrollOff;
      out[base + 2] = vx;
      out[base + 3] = vy;
      out[base + 4] = alpha;
      out[base + 5] = p.kind;
    }
  }

  var FIELD_VERT_SRC = [
    '#version 300 es',
    'void main() {',
    '  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);',
    '  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);',
    '}',
  ].join('\n');

  var FIELD_FRAG_SRC = [
    '#version 300 es',
    'precision highp float;',
    'out vec4 fragColor;',
    'uniform vec2 u_res;',
    'uniform float u_dpr;',
    'uniform float u_scroll;',
    'uniform float u_phase;',
    'uniform vec2 u_pointer;',
    'uniform vec2 u_vel;',
    'uniform float u_energy;',
    'uniform float u_light;',
    'float streamFn(vec2 q, float phi) {',
    '  float a = sin(q.x + 0.42 * sin(q.y + phi)) * cos(q.y - 0.42 * cos(q.x - 0.75 * phi));',
    '  float b = 0.34 * sin(0.66 * q.x - 0.54 * q.y + 0.52 * phi);',
    '  return a + b;',
    '}',
    'void main() {',
    '  vec2 css = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_dpr;',
    '  vec2 world = css + vec2(0.0, u_scroll * 0.22);',
    '  float psiPx = streamFn(world * 0.0042, u_phase);',
    '  float fw = max(fwidth(psiPx * 1.35), 1e-4);',
    '  float isoDist = abs(fract(psiPx * 1.35 + 0.5) - 0.5) / fw;',
    '  float contourAlpha = 1.0 - smoothstep(0.35, 1.40, isoDist);',
    '  const float CELL = 28.0;',
    '  vec2 cellId = floor(world / CELL);',
    '  vec2 cellCenterWorld = (cellId + 0.5) * CELL;',
    '  vec2 local = world - cellCenterWorld;',
    '  vec2 cellCenterCss = cellCenterWorld - vec2(0.0, u_scroll * 0.22);',
    '  vec2 q = cellCenterWorld * 0.0042;',
    '  const float eps = 0.02;',
    '  float psi0 = streamFn(q, u_phase);',
    '  float dPsiDx = (streamFn(q + vec2(eps, 0.0), u_phase) - psi0) / eps;',
    '  float dPsiDy = (streamFn(q + vec2(0.0, eps), u_phase) - psi0) / eps;',
    '  vec2 fieldVec = vec2(dPsiDy, -dPsiDx);',
    '  vec2 toPtr = cellCenterCss - u_pointer;',
    '  float dist = length(toPtr);',
    '  float falloff = exp(-(dist * dist) / (215.0 * 215.0)) * u_energy;',
    '  vec2 tangent = vec2(-toPtr.y, toPtr.x) / max(dist, 1.0);',
    '  float vMag = length(u_vel);',
    '  vec2 velDir = vMag > 0.05 ? (u_vel / vMag) : tangent;',
    '  vec2 vecTotal = fieldVec + (tangent * 0.80 + velDir * 1.35) * (falloff * 1.85);',
    '  float speed = clamp(length(vecTotal), 0.15, 2.25);',
    '  vec2 dir = normalize(vecTotal + vec2(1e-5, 0.0));',
    '  vec2 perp = vec2(-dir.y, dir.x);',
    '  float halfLen = mix(3.8, 6.8, clamp(speed * 0.45, 0.0, 1.0)) + falloff * 2.4;',
    '  float halfW = 0.54;',
    '  float along = dot(local, dir);',
    '  float across = abs(dot(local, perp));',
    '  float boxDist = max(abs(along) - halfLen, across - halfW);',
    '  float aa = 0.80 / u_dpr;',
    '  float tickAlpha = 1.0 - smoothstep(-aa, aa, boxDist);',
    '  vec2 mod4 = mod(cellId, 4.0);',
    '  float isMajor = step(abs(mod4.x), 0.1) * step(abs(mod4.y), 0.1);',
    '  float crossArm = min(max(abs(local.x) - 2.6, abs(local.y) - 0.5), max(abs(local.y) - 2.6, abs(local.x) - 0.5));',
    '  float nodeAlpha = isMajor * (1.0 - smoothstep(-aa, aa, crossArm));',
    '  vec3 darkBg = vec3(0.0275, 0.0314, 0.0431);',
    '  vec3 lightBg = vec3(0.9647, 0.9686, 0.9765);',
    '  vec3 col = mix(darkBg, lightBg, u_light);',
    '  vec3 darkIso = vec3(0.115, 0.140, 0.205);',
    '  vec3 lightIso = vec3(0.835, 0.855, 0.895);',
    '  col = mix(col, mix(darkIso, lightIso, u_light), contourAlpha * mix(0.22, 0.34, u_light));',
    '  vec3 darkTick = vec3(0.185, 0.215, 0.290);',
    '  vec3 lightTick = vec3(0.735, 0.768, 0.820);',
    '  vec3 sigDark = vec3(0.961, 0.620, 0.043);',
    '  vec3 sigLight = vec3(0.851, 0.467, 0.024);',
    '  vec3 tickCol = mix(mix(darkTick, lightTick, u_light), mix(sigDark, sigLight, u_light), clamp(falloff * 0.9, 0.0, 1.0));',
    '  col = mix(col, tickCol, tickAlpha * clamp(0.28 + falloff * 0.48, 0.0, 1.0));',
    '  col = mix(col, mix(sigDark, sigLight, u_light), nodeAlpha * 0.28);',
    '  fragColor = vec4(col, 1.0);',
    '}',
  ].join('\n');

  var PARTICLE_VERT_SRC = [
    '#version 300 es',
    'precision highp float;',
    'layout(location = 0) in vec4 a_posVel;',
    'layout(location = 1) in vec2 a_meta;',
    'uniform vec2 u_res;',
    'uniform float u_dpr;',
    'out float v_u;',
    'out float v_side;',
    'out float v_alpha;',
    'out float v_kind;',
    'void main() {',
    '  float u = float(gl_VertexID >> 1);',
    '  float side = float(gl_VertexID & 1) * 2.0 - 1.0;',
    '  vec2 vel = a_posVel.zw;',
    '  float spd = max(length(vel), 0.12);',
    '  vec2 dir = vel / spd;',
    '  vec2 perp = vec2(-dir.y, dir.x);',
    '  float tailLen = clamp(spd * 22.0, 11.0, 34.0);',
    '  float halfW = 1.2;',
    '  vec2 pCss = a_posVel.xy - dir * (u * tailLen) + perp * (side * halfW);',
    '  vec2 ndc = vec2((pCss.x * u_dpr / u_res.x) * 2.0 - 1.0, 1.0 - (pCss.y * u_dpr / u_res.y) * 2.0);',
    '  gl_Position = vec4(ndc, 0.0, 1.0);',
    '  v_u = u;',
    '  v_side = side;',
    '  v_alpha = a_meta.x;',
    '  v_kind = a_meta.y;',
    '}',
  ].join('\n');

  var PARTICLE_FRAG_SRC = [
    '#version 300 es',
    'precision highp float;',
    'in float v_u;',
    'in float v_side;',
    'in float v_alpha;',
    'in float v_kind;',
    'uniform float u_light;',
    'out vec4 fragColor;',
    'void main() {',
    '  float tailFade = pow(1.0 - v_u, 2.2);',
    '  float headCore = smoothstep(0.24, 0.0, v_u) * 0.70;',
    '  float edge = 1.0 - smoothstep(0.45, 1.0, abs(v_side));',
    '  float a = clamp((tailFade * 0.65 + headCore) * edge * v_alpha, 0.0, 1.0);',
    '  vec3 darkIce = mix(vec3(0.58, 0.72, 0.96), vec3(0.95, 0.97, 1.0), headCore);',
    '  vec3 darkSig = mix(vec3(0.96, 0.62, 0.05), vec3(1.0, 0.88, 0.55), headCore);',
    '  vec3 lightInk = vec3(0.18, 0.30, 0.52);',
    '  vec3 lightSig = vec3(0.82, 0.44, 0.02);',
    '  vec3 cDark = mix(darkIce, darkSig, v_kind);',
    '  vec3 cLight = mix(lightInk, lightSig, v_kind);',
    '  vec3 col = mix(cDark, cLight, u_light);',
    '  fragColor = vec4(col, a * mix(0.78, 0.58, u_light));',
    '}',
  ].join('\n');

  function compileShader(gl, type, source) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function linkProgram(gl, vsSrc, fsSrc) {
    var vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    var fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.deleteProgram(prog);
      return null;
    }
    return prog;
  }

  function updateWebglBadge(stateLabel, dotMode) {
    var txt = document.getElementById('webgl-status-text');
    var dot = document.getElementById('webgl-status-dot');
    if (txt) txt.textContent = stateLabel;
    if (dot) dot.className = 'webgl-dot' + (dotMode ? ' ' + dotMode : '');
  }

  function resizeWebglCanvas() {
    var gl = webglCtrl.gl;
    if (!gl) return;
    var canvas = gl.canvas;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    webglCtrl.dpr = dpr;
    var w = Math.max(1, Math.floor(window.innerWidth * dpr));
    var h = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  function drawWebglScene() {
    var gl = webglCtrl.gl;
    if (!gl || !webglCtrl.fieldProg || !webglCtrl.partProg || !webglCtrl.enabled) return;
    resizeWebglCanvas();
    var isLight = document.documentElement.getAttribute('data-theme') === 'light' ? 1.0 : 0.0;

    gl.disable(gl.BLEND);
    gl.useProgram(webglCtrl.fieldProg);
    gl.bindVertexArray(webglCtrl.fieldVao);
    var fu = webglCtrl.fieldUni;
    gl.uniform2f(fu.res, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(fu.dpr, webglCtrl.dpr);
    gl.uniform1f(fu.scroll, window.scrollY || window.pageYOffset || 0);
    gl.uniform1f(fu.phase, webglCtrl.phase);
    gl.uniform2f(fu.pointer, webglCtrl.ptrX, webglCtrl.ptrY);
    gl.uniform2f(fu.vel, webglCtrl.velX, webglCtrl.velY);
    gl.uniform1f(fu.energy, webglCtrl.energy);
    gl.uniform1f(fu.light, isLight);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    if (isLight > 0.5) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    else gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.useProgram(webglCtrl.partProg);
    gl.bindVertexArray(webglCtrl.partVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, webglCtrl.partBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, webglCtrl.gpuData);

    var pu = webglCtrl.partUni;
    gl.uniform2f(pu.res, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(pu.dpr, webglCtrl.dpr);
    gl.uniform1f(pu.light, isLight);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, PARTICLE_COUNT);
    gl.disable(gl.BLEND);
  }

  function drawCanvas2dFallback() {
    var ctx = webglCtrl.ctx2d;
    if (!ctx || !webglCtrl.enabled) return;
    var canvas = ctx.canvas;
    var w = Math.max(1, window.innerWidth || 1440);
    var h = Math.max(1, window.innerHeight || 900);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    ctx.fillStyle = isLight ? '#f6f7f9' : '#07080b';
    ctx.fillRect(0, 0, w, h);

    var scrollOff = (window.scrollY || 0) * 0.22;
    var cell = 36;
    ctx.lineWidth = 1;
    ctx.strokeStyle = isLight ? 'rgba(148, 163, 184, 0.34)' : 'rgba(100, 116, 139, 0.24)';
    ctx.beginPath();
    for (var gy = (-(scrollOff % cell) + cell) % cell; gy < h; gy += cell) {
      for (var gx = cell * 0.5; gx < w; gx += cell) {
        var vel = evalVelocityField(gx, gy + scrollOff, scrollOff);
        var mag = Math.hypot(vel[0], vel[1]) || 1;
        var dx = (vel[0] / mag) * 4.5;
        var dy = (vel[1] / mag) * 4.5;
        ctx.moveTo(gx - dx, gy - dy);
        ctx.lineTo(gx + dx, gy + dy);
      }
    }
    ctx.stroke();

    var data = webglCtrl.gpuData;
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var b = i * 6;
      var px = data[b];
      var py = data[b + 1];
      var vx = data[b + 2];
      var vy = data[b + 3];
      var alpha = data[b + 4];
      var isSignal = data[b + 5] > 0.5;
      if (alpha < 0.04) continue;
      var vLen = Math.hypot(vx, vy) || 1;
      var nx = vx / vLen;
      var ny = vy / vLen;
      var tail = Math.min(26, Math.max(10, vLen * 13));
      var grad = ctx.createLinearGradient(px - nx * tail, py - ny * tail, px, py);
      if (isSignal) {
        grad.addColorStop(0, 'rgba(245, 158, 11, 0)');
        grad.addColorStop(1, 'rgba(245, 158, 11, ' + (alpha * 0.85).toFixed(3) + ')');
      } else if (isLight) {
        grad.addColorStop(0, 'rgba(30, 41, 59, 0)');
        grad.addColorStop(1, 'rgba(30, 41, 59, ' + (alpha * 0.42).toFixed(3) + ')');
      } else {
        grad.addColorStop(0, 'rgba(226, 232, 240, 0)');
        grad.addColorStop(1, 'rgba(226, 232, 240, ' + (alpha * 0.62).toFixed(3) + ')');
      }
      ctx.strokeStyle = grad;
      ctx.lineWidth = isSignal ? 1.6 : 1.25;
      ctx.beginPath();
      ctx.moveTo(px - nx * tail, py - ny * tail);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
  }

  function stepWebglLoop(nowMs) {
    webglCtrl.rafId = 0;
    if (!webglCtrl.enabled || (!webglCtrl.gl && !webglCtrl.ctx2d) || document.hidden) {
      updateWebglBadge('WebGL2: PAUSED [0 FPS]', '');
      return;
    }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stepParticles(0.016);
      if (webglCtrl.gl) drawWebglScene();
      else drawCanvas2dFallback();
      updateWebglBadge('WebGL2: STATIC [REDUCED MOTION]', '');
      return;
    }
    var elapsed = nowMs - webglCtrl.lastFrameMs;
    if (elapsed < 34) {
      webglCtrl.rafId = window.requestAnimationFrame(stepWebglLoop);
      return;
    }
    var dt = Math.min(0.05, Math.max(0.016, elapsed * 0.001));
    webglCtrl.lastFrameMs = nowMs;
    webglCtrl.phase += dt * 0.075;
    webglCtrl.velX *= 0.86;
    webglCtrl.velY *= 0.86;
    webglCtrl.energy *= 0.92;
    if (webglCtrl.energy < 0.005) webglCtrl.energy = 0.0;

    stepParticles(dt);
    if (webglCtrl.gl) {
      drawWebglScene();
      updateWebglBadge(
        webglCtrl.energy > 0.08 ? 'WebGL2: STREAMLINES [DEFLECTING]' : 'WebGL2: STREAMLINES [28 FPS · <4 MB]',
        webglCtrl.energy > 0.08 ? 'active' : ''
      );
    } else {
      drawCanvas2dFallback();
      updateWebglBadge(
        webglCtrl.energy > 0.08 ? 'STREAMLINES: DEFLECTING [28 FPS]' : 'STREAMLINES: ACTIVE [28 FPS]',
        webglCtrl.energy > 0.08 ? 'active' : ''
      );
    }
    webglCtrl.rafId = window.requestAnimationFrame(stepWebglLoop);
  }

  function startWebglLoop() {
    if (!webglCtrl.enabled || (!webglCtrl.gl && !webglCtrl.ctx2d) || document.hidden) return;
    if (!webglCtrl.rafId) {
      webglCtrl.lastFrameMs = performance.now();
      webglCtrl.rafId = window.requestAnimationFrame(stepWebglLoop);
    }
  }

  function mountWebglContext() {
    var canvas = document.getElementById('webgl-bg');
    if (!canvas) return false;
    var gl = null;
    try {
      gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'low-power',
        desynchronized: true,
      });
    } catch (e) {
      gl = null;
    }

    if (!gl) {
      var fallbackCanvas = canvas;
      var ctx2d = null;
      try {
        ctx2d = fallbackCanvas.getContext('2d', { alpha: false });
      } catch (e2) {
        ctx2d = null;
      }
      if (!ctx2d && fallbackCanvas.parentNode) {
        var fresh2d = document.createElement('canvas');
        fresh2d.id = 'webgl-bg';
        fresh2d.className = 'webgl-bg';
        fresh2d.setAttribute('aria-hidden', 'true');
        fallbackCanvas.parentNode.replaceChild(fresh2d, fallbackCanvas);
        fallbackCanvas = fresh2d;
        ctx2d = fallbackCanvas.getContext('2d', { alpha: false });
      }
      if (ctx2d) {
        webglCtrl.ctx2d = ctx2d;
        fallbackCanvas.style.display = 'block';
        if (!webglCtrl.particles.length) seedParticles();
        stepParticles(0.016);
        drawCanvas2dFallback();
        startWebglLoop();
        return true;
      }
      fallbackCanvas.style.display = 'none';
      updateWebglBadge('WebGL2: FALLBACK [CSS]', 'off');
      return false;
    }

    var fieldProg = linkProgram(gl, FIELD_VERT_SRC, FIELD_FRAG_SRC);
    var partProg = linkProgram(gl, PARTICLE_VERT_SRC, PARTICLE_FRAG_SRC);
    if (!fieldProg || !partProg) {
      canvas.style.display = 'none';
      updateWebglBadge('WebGL2: FALLBACK [CSS]', 'off');
      return false;
    }

    var fieldVao = gl.createVertexArray();
    var partVao = gl.createVertexArray();
    var partBuf = gl.createBuffer();
    gl.bindVertexArray(partVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
    gl.bufferData(gl.ARRAY_BUFFER, webglCtrl.gpuData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0);
    gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 16);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);

    webglCtrl.gl = gl;
    webglCtrl.fieldProg = fieldProg;
    webglCtrl.fieldVao = fieldVao;
    webglCtrl.fieldUni = {
      res: gl.getUniformLocation(fieldProg, 'u_res'),
      dpr: gl.getUniformLocation(fieldProg, 'u_dpr'),
      scroll: gl.getUniformLocation(fieldProg, 'u_scroll'),
      phase: gl.getUniformLocation(fieldProg, 'u_phase'),
      pointer: gl.getUniformLocation(fieldProg, 'u_pointer'),
      vel: gl.getUniformLocation(fieldProg, 'u_vel'),
      energy: gl.getUniformLocation(fieldProg, 'u_energy'),
      light: gl.getUniformLocation(fieldProg, 'u_light'),
    };
    webglCtrl.partProg = partProg;
    webglCtrl.partVao = partVao;
    webglCtrl.partBuf = partBuf;
    webglCtrl.partUni = {
      res: gl.getUniformLocation(partProg, 'u_res'),
      dpr: gl.getUniformLocation(partProg, 'u_dpr'),
      light: gl.getUniformLocation(partProg, 'u_light'),
    };

    canvas.style.display = 'block';
    if (!webglCtrl.particles.length) seedParticles();
    stepParticles(0.016);
    drawWebglScene();
    startWebglLoop();
    return true;
  }

  function releaseWebglContext() {
    if (webglCtrl.rafId) {
      window.cancelAnimationFrame(webglCtrl.rafId);
      webglCtrl.rafId = 0;
    }
    var gl = webglCtrl.gl;
    if (gl) {
      if (webglCtrl.fieldProg) gl.deleteProgram(webglCtrl.fieldProg);
      if (webglCtrl.partProg) gl.deleteProgram(webglCtrl.partProg);
      if (webglCtrl.fieldVao) gl.deleteVertexArray(webglCtrl.fieldVao);
      if (webglCtrl.partVao) gl.deleteVertexArray(webglCtrl.partVao);
      if (webglCtrl.partBuf) gl.deleteBuffer(webglCtrl.partBuf);
      var loseExt = gl.getExtension('WEBGL_lose_context');
      if (loseExt) loseExt.loseContext();
    }
    webglCtrl.gl = null;
    webglCtrl.ctx2d = null;
    var oldCanvas = document.getElementById('webgl-bg');
    if (oldCanvas) oldCanvas.style.display = 'none';
    updateWebglBadge('WebGL2: OFF [0 MB VRAM]', 'off');
  }

  window.toggleWebglBackground = function () {
    webglCtrl.enabled = !webglCtrl.enabled;
    try {
      localStorage.setItem('datasith_com_webgl', webglCtrl.enabled ? 'on' : 'off');
    } catch (e) {}
    if (!webglCtrl.enabled) {
      releaseWebglContext();
      showToast('WebGL2 background disabled: GPU backbuffer released');
    } else {
      var existing = document.getElementById('webgl-bg');
      if (existing && existing.parentNode) {
        var fresh = document.createElement('canvas');
        fresh.id = 'webgl-bg';
        fresh.className = 'webgl-bg';
        fresh.setAttribute('aria-hidden', 'true');
        existing.parentNode.replaceChild(fresh, existing);
      }
      if (mountWebglContext()) {
        webglCtrl.energy = 0.65;
        showToast('WebGL2 Vector Field + Streamline Particles enabled');
      }
    }
  };

  /* ========================================================================
     2. CURSOR SPOTLIGHT & THEME CONTROLLER
     ======================================================================== */
  var spotlightPending = false;
  var latestMouseX = -9999;
  var latestMouseY = -9999;

  function flushSpotlightCoords() {
    spotlightPending = false;
    var activeSection = document.getElementById('view-' + currentView);
    if (!activeSection) return;
    var nodes = activeSection.querySelectorAll('[data-spotlight]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var r = el.getBoundingClientRect();
      if (r.bottom < -120 || r.top > window.innerHeight + 120) continue;
      el.style.setProperty('--mx', latestMouseX - r.left + 'px');
      el.style.setProperty('--my', latestMouseY - r.top + 'px');
    }
  }

  function initInteractiveLifecycle() {
    var savedPref = null;
    try {
      savedPref = localStorage.getItem('datasith_com_webgl');
    } catch (e) {}
    if (savedPref === 'off') {
      webglCtrl.enabled = false;
      var c = document.getElementById('webgl-bg');
      if (c) c.style.display = 'none';
      updateWebglBadge('WebGL2: OFF [0 MB VRAM]', 'off');
    } else {
      mountWebglContext();
    }

    window.addEventListener(
      'pointermove',
      function (ev) {
        latestMouseX = ev.clientX;
        latestMouseY = ev.clientY;
        if (!spotlightPending) {
          spotlightPending = true;
          window.requestAnimationFrame(flushSpotlightCoords);
        }
        if (!webglCtrl.enabled || (!webglCtrl.gl && !webglCtrl.ctx2d)) return;
        if (webglCtrl.lastPtrX !== null) {
          var dx = ev.clientX - webglCtrl.lastPtrX;
          var dy = ev.clientY - webglCtrl.lastPtrY;
          webglCtrl.velX = webglCtrl.velX * 0.65 + dx * 0.35;
          webglCtrl.velY = webglCtrl.velY * 0.65 + dy * 0.35;
          var speed = Math.min(1.0, Math.hypot(dx, dy) / 26.0);
          if (speed > 0.03) {
            webglCtrl.ptrX = ev.clientX;
            webglCtrl.ptrY = ev.clientY;
            webglCtrl.energy = Math.min(1.0, Math.max(webglCtrl.energy, Math.max(0.32, speed)));
          }
        } else {
          webglCtrl.ptrX = ev.clientX;
          webglCtrl.ptrY = ev.clientY;
        }
        webglCtrl.lastPtrX = ev.clientX;
        webglCtrl.lastPtrY = ev.clientY;
      },
      { passive: true }
    );

    window.addEventListener(
      'resize',
      function () {
        if (!webglCtrl.enabled || (!webglCtrl.gl && !webglCtrl.ctx2d)) return;
        resizeWebglCanvas();
        if (webglCtrl.gl) drawWebglScene();
        else if (webglCtrl.ctx2d) drawCanvas2dFallback();
      },
      { passive: true }
    );

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && webglCtrl.rafId) {
        window.cancelAnimationFrame(webglCtrl.rafId);
        webglCtrl.rafId = 0;
        updateWebglBadge('WebGL2: PAUSED [0 FPS]', '');
      } else if (!document.hidden && webglCtrl.enabled && (webglCtrl.gl || webglCtrl.ctx2d)) {
        startWebglLoop();
      }
    });
  }

  function applyTheme(theme) {
    var normalized = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', normalized);
    var sun = document.getElementById('icon-sun');
    var moon = document.getElementById('icon-moon');
    if (sun && moon) {
      sun.style.display = normalized === 'dark' ? 'block' : 'none';
      moon.style.display = normalized === 'light' ? 'block' : 'none';
    }
    if (webglCtrl.enabled) {
      if (webglCtrl.gl) drawWebglScene();
      else if (webglCtrl.ctx2d) drawCanvas2dFallback();
    }
  }

  window.toggleTheme = function () {
    var cur = document.documentElement.getAttribute('data-theme') || 'dark';
    var next = cur === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('datasith_com_theme', next);
    } catch (e) {}
    applyTheme(next);
  };

  /* ========================================================================
     3. 4-TAB VIEW ROUTER (Home / Projects / Publications / Bio)
     ======================================================================== */
  function resolveInitialView() {
    var hash = (window.location.hash || '').replace(/^#\/?/, '').trim().toLowerCase();
    if (VALID_VIEWS.indexOf(hash) !== -1) return hash;
    var path = (window.location.pathname || '').replace(/^\/+|\/+$/g, '').toLowerCase();
    if (VALID_VIEWS.indexOf(path) !== -1) return path;
    return 'overview';
  }

  window.switchView = function (viewName, pushStateFlag) {
    var target = VALID_VIEWS.indexOf(viewName) !== -1 ? viewName : 'overview';
    currentView = target;

    VALID_VIEWS.forEach(function (v) {
      var el = document.getElementById('view-' + v);
      if (el) el.style.display = v === target ? 'block' : 'none';
    });

    document.querySelectorAll('.nav-tab-btn').forEach(function (btn) {
      if (btn.getAttribute('data-view') === target) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    if (pushStateFlag !== false) {
      try {
        var nextHash = target === 'overview' ? '#overview' : '#' + target;
        if (window.location.hash !== nextHash) {
          window.history.pushState({ view: target }, '', nextHash);
        }
      } catch (e) {}
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
    webglCtrl.energy = Math.min(1.0, Math.max(webglCtrl.energy, 0.45));
  };

  /* ========================================================================
     4. PROJECTS LEDGER (CSS SUBGRID) & CERTIFICATIONS FILTER
     ======================================================================== */
  function renderProjectsGrid() {
    var container = document.getElementById('projects-grid-container');
    if (!container) return;

    var q = activeProjectSearch.trim().toLowerCase();
    var filtered = (BOOTSTRAP.projects || []).filter(function (p) {
      var catOk = activeProjectCategory === 'All' || p.category === activeProjectCategory;
      if (!catOk) return false;
      if (!q) return true;
      var hay = [p.title, p.author, p.note, p.category, (p.tags || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });

    if (filtered.length === 0) {
      container.innerHTML =
        '<div class="fctoo-card arch-frame" style="grid-column:1 / -1;text-align:center;padding:38px;">' +
        '<div class="spec-kicker" style="justify-content:center;margin-bottom:8px;">ZERO MATCHES</div>' +
        '<p class="card-note" style="margin-bottom:0;">No projects matched "' +
        escapeHtml(activeProjectSearch) +
        '".</p></div>';
      return;
    }

    container.innerHTML = filtered
      .map(function (p) {
        var tagsHtml = (p.tags || [])
          .map(function (t) {
            return '<span class="tag-chip">' + escapeHtml(t) + '</span>';
          })
          .join('');

        var pa = p.primaryAction || {};
        var primaryBtnHtml = '';
        if (pa.action === 'view') {
          primaryBtnHtml =
            '<button type="button" class="btn-primary-spec" onclick="switchView(\'' +
            escapeHtml(pa.target) +
            '\')">' +
            '<span>' +
            escapeHtml(pa.label) +
            '</span>' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>' +
            '</button>';
        } else {
          primaryBtnHtml =
            '<a class="btn-primary-spec" href="' +
            escapeHtml(pa.url || '#') +
            '" target="_blank" rel="noopener">' +
            '<span>' +
            escapeHtml(pa.label || 'Open') +
            '</span>' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>' +
            '</a>';
        }

        var secLinksHtml = (p.secondaryLinks || [])
          .map(function (lnk) {
            return (
              '<a class="ext-link" href="' +
              escapeHtml(lnk.url) +
              '" target="_blank" rel="noopener">' +
              '<span>' +
              escapeHtml(lnk.label) +
              '</span>' +
              '<span>-&gt;</span>' +
              '</a>'
            );
          })
          .join('');

        var thumbSrc = p.thumbnail || '';
        var thumbHtml = thumbSrc
          ? '<div class="card-thumb-tile" title="Inspect schematic emblem" data-src="' +
            escapeHtml(thumbSrc) +
            '" data-caption="' +
            escapeHtml(p.title) +
            '" onclick="openLightbox(this.getAttribute(\'data-src\'), this.getAttribute(\'data-caption\'))">' +
            '<img src="' +
            escapeHtml(thumbSrc) +
            '" alt="' +
            escapeHtml(p.title) +
            ' schematic emblem" loading="lazy" />' +
            '</div>'
          : '';

        // Strictly two direct child divs inside .fctoo-card so CSS Subgrid locks horizontal divider alignment per row
        return (
          '<article class="fctoo-card arch-frame" data-spotlight>' +
          '<div class="card-top-body">' +
          '<div class="card-meta-top">' +
          '<div style="display:inline-flex;align-items:center;gap:10px;">' +
          '<span class="index-num">PROJ_' +
          escapeHtml(p.index || '00') +
          '</span>' +
          '<span class="meta-date">// ' +
          escapeHtml(p.date) +
          '</span>' +
          '</div>' +
          '<span class="spec-tag-mono' +
          (p.signalBadge ? ' spec-tag-signal' : '') +
          '">' +
          escapeHtml(p.badge || p.category) +
          '</span>' +
          '</div>' +
          '<div class="card-header-row">' +
          thumbHtml +
          '<div class="card-title-stack">' +
          '<h2 class="card-h3">' +
          escapeHtml(p.title) +
          '</h2>' +
          '<div class="card-author">' +
          escapeHtml(p.author) +
          '</div>' +
          '</div>' +
          '</div>' +
          '<p class="card-note">' +
          escapeHtml(p.note) +
          '</p>' +
          '<div class="card-tags">' +
          tagsHtml +
          '</div>' +
          '</div>' +
          '<div class="card-actions-bar">' +
          '<div class="btn-group">' +
          primaryBtnHtml +
          '</div>' +
          (secLinksHtml
            ? '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">' + secLinksHtml + '</div>'
            : '') +
          '</div>' +
          '</article>'
        );
      })
      .join('');
  }

  window.filterProjects = function (category, btnEl) {
    activeProjectCategory = category || 'All';
    document.querySelectorAll('#view-projects .filter-pill').forEach(function (b) {
      b.classList.remove('active');
    });
    if (btnEl) btnEl.classList.add('active');
    renderProjectsGrid();
  };

  window.searchProjectsLedger = function (query) {
    activeProjectSearch = query || '';
    renderProjectsGrid();
  };

  function renderCertificationsGrid() {
    var container = document.getElementById('certs-grid-container');
    if (!container) return;
    var filtered = (BOOTSTRAP.certifications || []).filter(function (c) {
      return activeCertGroup === 'All' || c.group === activeCertGroup;
    });
    container.innerHTML = filtered
      .map(function (c) {
        return (
          '<a class="cert-badge-link" data-spotlight href="' +
          escapeHtml(c.url) +
          '" target="_blank" rel="noopener" title="' +
          escapeHtml(c.name) +
          ' · Verify on Credly">' +
          '<img src="' +
          escapeHtml(c.image) +
          '" alt="' +
          escapeHtml(c.name) +
          '" loading="lazy" />' +
          '<span class="cert-caption">' +
          escapeHtml(c.name) +
          '</span>' +
          '<span class="cert-vendor-chip">' +
          escapeHtml(c.vendor) +
          '</span>' +
          '</a>'
        );
      })
      .join('');
  }

  window.filterCerts = function (groupName, btnEl) {
    activeCertGroup = groupName || 'All';
    document.querySelectorAll('.cert-pill').forEach(function (b) {
      b.classList.remove('active');
    });
    if (btnEl) btnEl.classList.add('active');
    renderCertificationsGrid();
  };

  /* ========================================================================
     5. CMD+K COMMAND PALETTE, CLIPBOARD & LIGHTBOX
     ======================================================================== */
  function buildCommandCatalog() {
    var items = [
      {
        kind: 'View',
        title: 'Home / Overview',
        sub: 'Featured open-source architectures, closed-loop perception research & stack',
        run: function () {
          window.switchView('overview');
        },
      },
      {
        kind: 'View',
        title: 'Projects & Architectures',
        sub: '08 open-source & production systems across Agentic AI, Vision ML, and Robotics',
        run: function () {
          window.switchView('projects');
        },
      },
      {
        kind: 'View',
        title: 'Publications & Research',
        sub: 'Peer-reviewed journal articles, pre-registered studies & experimental rigs',
        run: function () {
          window.switchView('publications');
        },
      },
      {
        kind: 'View',
        title: 'Bio & Active Certifications',
        sub: 'Engineering trajectory & 22 verified Credly badges across GCP, AWS, NVIDIA & Security+',
        run: function () {
          window.switchView('bio');
        },
      },
      {
        kind: 'Action',
        title: 'Toggle Light / Dark Architectural Theme',
        sub: 'Switch between Aerospace Dark and Drafting-Paper Light mode',
        run: function () {
          window.toggleTheme();
        },
      },
      {
        kind: 'Action',
        title: 'Toggle WebGL2 Vector + Streamline Particle Background',
        sub: 'Enable streamline particle field or release GPU backbuffer (0 MB VRAM)',
        run: function () {
          window.toggleWebglBackground();
        },
      },
    ];

    (BOOTSTRAP.projects || []).forEach(function (p) {
      items.push({
        kind: 'Project',
        title: p.title,
        sub: p.category + ' · ' + (p.tags || []).slice(0, 3).join(', '),
        run: function () {
          if (p.primaryAction && p.primaryAction.action === 'external') {
            window.open(p.primaryAction.url, '_blank', 'noopener');
          } else {
            window.switchView('projects');
          }
        },
      });
    });

    (BOOTSTRAP.publications || []).concat(BOOTSTRAP.openStudies || []).forEach(function (pub) {
      items.push({
        kind: 'Research (' + pub.year + ')',
        title: pub.title,
        sub: pub.venue,
        run: function () {
          window.open(pub.url, '_blank', 'noopener');
        },
      });
    });

    (BOOTSTRAP.certifications || []).forEach(function (c) {
      items.push({
        kind: c.vendor + ' Cert',
        title: c.name,
        sub: 'Active through ' + c.expires + ' · Verify on Credly',
        run: function () {
          window.open(c.url, '_blank', 'noopener');
        },
      });
    });

    return items;
  }

  window.openCommandPalette = function () {
    var bd = document.getElementById('cmdk-backdrop');
    var inp = document.getElementById('cmdk-input');
    if (!bd || !inp) return;
    bd.classList.add('open');
    inp.value = '';
    window.renderCommandItems('');
    window.setTimeout(function () {
      inp.focus();
    }, 20);
  };

  window.closeCommandPalette = function () {
    var bd = document.getElementById('cmdk-backdrop');
    if (bd) bd.classList.remove('open');
  };

  function highlightCmdkRow() {
    var rows = document.querySelectorAll('#cmdk-list .cmdk-item');
    rows.forEach(function (r, idx) {
      if (idx === cmdkActiveIdx) {
        r.classList.add('active');
        r.scrollIntoView({ block: 'nearest' });
      } else {
        r.classList.remove('active');
      }
    });
  }

  window.renderCommandItems = function (query) {
    var listEl = document.getElementById('cmdk-list');
    if (!listEl) return;
    var q = (query || '').trim().toLowerCase();
    cmdkItems = FULL_CMDK_CATALOG.filter(function (it) {
      if (!q) return true;
      return (it.title + ' ' + it.sub + ' ' + it.kind).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 24);
    cmdkActiveIdx = 0;

    if (!cmdkItems.length) {
      listEl.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-family:JetBrains Mono,monospace;font-size:12px;">No matching items.</div>';
      return;
    }

    listEl.innerHTML = cmdkItems
      .map(function (it, idx) {
        return (
          '<button type="button" class="cmdk-item' +
          (idx === 0 ? ' active' : '') +
          '" data-idx="' +
          idx +
          '">' +
          '<div style="text-align:left;min-width:0;">' +
          '<div class="cmdk-item-title">' +
          escapeHtml(it.title) +
          '</div>' +
          '<div class="cmdk-item-sub">' +
          escapeHtml(it.sub) +
          '</div>' +
          '</div>' +
          '<span class="cmdk-item-kind">' +
          escapeHtml(it.kind) +
          '</span>' +
          '</button>'
        );
      })
      .join('');

    listEl.querySelectorAll('.cmdk-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = parseInt(btn.getAttribute('data-idx') || '0', 10);
        var chosen = cmdkItems[i];
        if (chosen) {
          window.closeCommandPalette();
          chosen.run();
        }
      });
    });
  };

  function showToast(msg) {
    var el = document.getElementById('toast-msg');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.classList.remove('show');
    }, 2600);
  }

  window.copyShortlink = function () {
    var target = 'https://datasith.com';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(target).then(function () {
        showToast('Copied: ' + target);
      });
    }
  };

  window.openLightbox = function (src, caption) {
    var box = document.getElementById('photo-lightbox');
    var img = document.getElementById('lightbox-img');
    var cap = document.getElementById('lightbox-caption');
    if (!box || !img) return;
    img.src = src;
    if (cap) cap.textContent = caption || '';
    box.classList.add('open');
  };

  window.closeLightbox = function () {
    var box = document.getElementById('photo-lightbox');
    if (box) box.classList.remove('open');
  };

  document.addEventListener('keydown', function (ev) {
    var cmdkOpen = document.getElementById('cmdk-backdrop')?.classList.contains('open');
    var lightboxOpen = document.getElementById('photo-lightbox')?.classList.contains('open');

    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      if (cmdkOpen) window.closeCommandPalette();
      else window.openCommandPalette();
      return;
    }

    var tag = (ev.target && ev.target.tagName ? ev.target.tagName : '').toLowerCase();
    var isTyping = tag === 'input' || tag === 'textarea' || (ev.target && ev.target.isContentEditable);
    if (!cmdkOpen && !lightboxOpen && !isTyping && ev.key === '/') {
      ev.preventDefault();
      window.openCommandPalette();
      return;
    }

    if (ev.key === 'Escape') {
      if (cmdkOpen) window.closeCommandPalette();
      if (lightboxOpen) window.closeLightbox();
      return;
    }

    if (cmdkOpen && cmdkItems.length > 0) {
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        cmdkActiveIdx = (cmdkActiveIdx + 1) % cmdkItems.length;
        highlightCmdkRow();
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        cmdkActiveIdx = (cmdkActiveIdx - 1 + cmdkItems.length) % cmdkItems.length;
        highlightCmdkRow();
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        var chosen = cmdkItems[cmdkActiveIdx];
        if (chosen) {
          window.closeCommandPalette();
          chosen.run();
        }
      }
    }
  });

  window.addEventListener('popstate', function () {
    window.switchView(resolveInitialView(), false);
  });

  window.addEventListener('hashchange', function () {
    window.switchView(resolveInitialView(), false);
  });

  document.addEventListener('DOMContentLoaded', function () {
    var savedTheme = 'dark';
    try {
      savedTheme = localStorage.getItem('datasith_com_theme') || 'dark';
    } catch (e) {}
    applyTheme(savedTheme);

    FULL_CMDK_CATALOG = buildCommandCatalog();
    renderProjectsGrid();
    renderCertificationsGrid();
    initInteractiveLifecycle();
    window.switchView(resolveInitialView(), false);
  });
})();
