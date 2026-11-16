/* GNSS // Tracker: the Net Works globe, turning, drawn live (copied from GitHub // Deanonymizer, public/js/globe.js).
 *
 * The globe of the Net Works site and of the Net Works live wallpaper (Lively-Wallpapers,
 * wallpapers/networks-globe + nwlive.js), brought into the app: the same hand-drawn continents,
 * the differenced 15-degree graticule, the two orbit rings and their travelling nodes, the same
 * tilt and the site's pace, one turn in 14 seconds. The body is raycast in a WebGL2 fragment
 * shader with 2x2 supersampling (the wallpaper's shader); the limb, rings and nodes are canvas 2D
 * on top.
 *
 * It draws at most 30 frames a second, on the wall clock, so a late frame never slows the turn.
 * It draws nothing while the window is hidden or the globe is off screen (display:none included),
 * and holds one still frame when the system asks for reduced motion. Every globe on the page turns
 * on the same clock. A globe whose element leaves the page gives its GPU context back at once.
 * Without WebGL2 the element keeps the still image it was given.
 *
 *   NWGlobe.mount(box)                  box: a position:relative element holding the still image
 *   NWGlobe.mount(box, { mark: true })  the logo: one ring, like the still mark, with strokes
 *                                       that stay legible at 40 pixels
 */
(function (global) {
  'use strict';
  var D = Math.PI / 180, TAU = 2 * Math.PI;
  var SPIN = 0.45, TILT = -0.30, PHI0 = 25 * D, FPS = 30;   /* the site globe's numbers */
  var RINGS = [
    { f: 1.28, incl: 0.30,  base: 0.0, spd: 0.34,  nodes: 6, noff: 0.0 },
    { f: 1.44, incl: -0.24, base: 1.1, spd: -0.27, nodes: 5, noff: 0.4 }
  ];
  /* Stroke widths and node sizes in device px for a globe of radius R device px. SITE scales them
     all with the globe, the way the README loops look (filmed large, shown small). MARK is the still
     logo's globe: one ring, a lighter graticule, and a floor under each stroke so a 40 px logo keeps
     its outline, ring and nodes. */
  var SITE = function (R) { return { grid: R * 0.0068, limb: R * 0.0074, ring: R * 0.0074, node: R * 0.022, halo: R * 0.008 }; };
  var MARK = function (R) { return { grid: R * 0.009, limb: Math.max(0.9, R * 0.03), ring: Math.max(0.9, R * 0.03), node: Math.max(1.2, R * 0.07), halo: Math.max(0.6, R * 0.025) }; };

  /* ---- land mask: the continents of the site and the wallpaper, as a 0/255 bitmap ---- */
  var MASK = null;
  function mask() {
    if (MASK) return MASK;
    var w = 2048, h = 1024, cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var mc = cv.getContext('2d', { willReadFrequently: true });
    var X = function (lon) { return (lon + 180) / 360 * w; }, Y = function (lat) { return (90 - lat) / 180 * h; };
    mc.fillStyle = '#000'; mc.fillRect(0, 0, w, h); mc.fillStyle = '#fff';
    mc.fillRect(0, Y(-70), w, h);   /* Antarctica */
    var NA=[[-156,71],[-166,68.5],[-165,66],[-168,65.5],[-162,60],[-152,58],[-148,60],[-136,58],[-130,54],[-124,48],[-124,40],[-121,35],[-117,33],[-112,29],[-112,26],[-106,23],[-105,20],[-101,17],[-94,16],[-92,15],[-88,16],[-84,10],[-83,9],[-78,8],[-77,9],[-83,15],[-88,21],[-90,21],[-95,19],[-97,22],[-97,26],[-94,29],[-89,29],[-85,30],[-82,28],[-81,25],[-80,27],[-81,31],[-76,35],[-75,38],[-71,41],[-70,43],[-67,45],[-60,47],[-64,49],[-66,52],[-78,53],[-79,58],[-72,60],[-64,60],[-78,63],[-95,62],[-90,68],[-105,68],[-115,70],[-125,70],[-133,69],[-141,70]];
    var GR=[[-43,60],[-50,64],[-53,68],[-56,72],[-58,76],[-45,80],[-30,83],[-18,80],[-22,76],[-30,70],[-38,66],[-42,61]];
    var SA=[[-78,8],[-72,11],[-64,11],[-60,8],[-50,4],[-51,0],[-48,-1],[-44,-2],[-38,-5],[-35,-8],[-39,-13],[-39,-18],[-41,-22],[-48,-25],[-48,-28],[-54,-34],[-57,-38],[-62,-40],[-65,-43],[-65,-48],[-69,-52],[-66,-55],[-71,-54],[-73,-50],[-74,-44],[-73,-37],[-71,-30],[-70,-23],[-71,-18],[-77,-12],[-81,-5],[-80,-2],[-81,2]];
    var AF=[[-6,36],[-10,30],[-13,28],[-17,21],[-17,15],[-16,12],[-11,7],[-8,5],[-2,5],[3,6],[8,4],[9,2],[10,-1],[13,-6],[12,-12],[13,-17],[15,-23],[17,-29],[20,-35],[26,-34],[31,-30],[33,-26],[35,-22],[40,-16],[41,-11],[40,-5],[41,-2],[43,2],[46,5],[48,8],[51,12],[49,11],[44,10],[43,11],[44,12],[41,15],[40,12],[38,16],[37,19],[35,23],[34,28],[32,31],[28,31],[22,32],[18,30],[12,33],[10,37],[5,37],[0,36],[-2,36]];
    var ARAB=[[34,28],[36,29],[39,21],[43,13],[48,14],[52,16],[57,22],[60,25],[57,25],[50,28],[48,30],[42,30],[40,28],[36,28]];
    var EU=[[-9,43],[-9,37],[-6,36],[-1,36],[0,40],[3,42],[3,44],[-2,44],[-2,48],[1,51],[7,53],[8,57],[6,58],[10,59],[6,61],[8,64],[14,67],[20,70],[26,71],[30,69],[27,65],[22,63],[20,60],[26,60],[30,60],[28,56],[22,56],[20,54],[14,54],[12,52],[16,50],[24,50],[30,52],[35,48],[40,44],[28,41],[20,42],[13,44],[8,44],[3,43],[-2,40],[-6,38]];
    var ITALY=[[7,44],[10,44],[12,42],[15,40],[18,40],[16,41],[14,42],[12,44],[10,46]];
    var ASIA=[[48,30],[50,37],[53,37],[54,30],[57,25],[61,25],[67,24],[68,23],[70,21],[73,16],[74,12],[77,8],[80,10],[80,13],[83,16],[87,21],[89,22],[92,21],[94,18],[97,16],[98,10],[99,6],[100,3],[104,1],[103,8],[106,10],[109,11],[108,16],[106,18],[108,21],[110,21],[113,22],[117,23],[120,25],[121,30],[121,34],[120,37],[122,40],[125,40],[126,38],[129,35],[129,38],[128,41],[130,43],[135,44],[140,46],[142,46],[143,49],[140,53],[143,59],[155,59],[160,60],[164,60],[170,62],[177,64],[180,66],[180,68],[172,66],[168,70],[160,70],[152,72],[140,73],[130,74],[113,74],[105,77],[95,76],[90,75],[80,73],[73,72],[68,68],[60,68],[55,68],[58,60],[55,55],[52,50],[50,45],[48,42],[48,37]];
    var AU=[[114,-22],[113,-26],[115,-31],[118,-35],[123,-34],[129,-32],[135,-35],[138,-35],[140,-38],[147,-38],[150,-37],[153,-32],[153,-28],[153,-25],[146,-19],[145,-15],[142,-11],[140,-17],[137,-12],[136,-15],[133,-12],[130,-12],[127,-14],[122,-18]];
    var TAS=[[145,-41],[148,-41],[148,-43],[146,-43]];
    var NZN=[[173,-35],[176,-38],[178,-38],[175,-41],[174,-41],[173,-37]];
    var NZS=[[167,-44],[171,-43],[174,-42],[173,-46],[168,-47],[166,-45]];
    var JP=[[130,31],[132,33],[135,34],[137,35],[140,36],[141,38],[142,40],[140,42],[141,43],[144,44],[143,42],[140,40],[138,37],[136,35],[133,34],[131,33],[129,32]];
    var PHIL=[[120,18],[122,17],[124,13],[126,10],[126,7],[124,6],[122,9],[120,13]];
    var SUMA=[[95,5],[98,2],[100,0],[102,-2],[104,-4],[106,-6],[105,-6],[101,-2],[98,1]];
    var JAVA=[[105,-6],[108,-7],[112,-8],[114,-8],[112,-8],[108,-8]];
    var BORN=[[109,2],[113,3],[117,4],[119,1],[117,-3],[114,-4],[110,-3],[109,0]];
    var SULA=[[120,1],[123,1],[125,-2],[122,-5],[120,-2],[119,0]];
    var PNG=[[131,-1],[135,-2],[140,-3],[144,-4],[147,-6],[150,-9],[146,-8],[141,-8],[137,-7],[133,-4]];
    var MAD=[[49,-12],[50,-16],[48,-22],[45,-25],[44,-22],[46,-16],[48,-13]];
    var LKA=[[80,9],[82,8],[82,6],[80,6],[79,8]];
    var ICE=[[-22,64],[-18,66],[-14,65],[-15,64],[-19,63]];
    var GB=[[-5,50],[-3,51],[0,51],[1,53],[-1,54],[-2,56],[-5,58],[-6,57],[-5,55],[-5,53]];
    var IRE=[[-10,52],[-6,52],[-6,55],[-8,55],[-10,54]];
    [NA,GR,SA,AF,ARAB,EU,ITALY,ASIA,AU,TAS,NZN,NZS,JP,PHIL,SUMA,JAVA,BORN,SULA,PNG,MAD,LKA,ICE,GB,IRE].forEach(function (pts) {
      mc.beginPath();
      for (var i = 0; i < pts.length; i++) { if (i) mc.lineTo(X(pts[i][0]), Y(pts[i][1])); else mc.moveTo(X(pts[i][0]), Y(pts[i][1])); }
      mc.closePath(); mc.fill();
    });
    var d = mc.getImageData(0, 0, w, h).data, bits = new Uint8Array(w * h);
    for (var i = 0; i < bits.length; i++) bits[i] = d[i * 4] > 127 ? 255 : 0;
    return (MASK = { w: w, h: h, bits: bits });
  }

  /* ---- the body and its graticule, per pixel on the GPU ---- */
  var VERT = '#version 300 es\nvoid main(){gl_Position=vec4(float((gl_VertexID<<1)&2)*2.0-1.0,float(gl_VertexID&2)*2.0-1.0,0.0,1.0);}';
  var FRAG = [
    '#version 300 es',
    'precision highp float;',
    'uniform vec2 u_c;',        /* centre, px, y up */
    'uniform float u_R;',
    'uniform float u_phi;',
    'uniform vec2 u_tilt;',     /* cos, sin */
    'uniform sampler2D u_mask;',
    'uniform vec3 u_ink;',
    'uniform vec3 u_sea;',
    'uniform float u_lw;',      /* graticule stroke, px */
    'out vec4 o;',
    'const float PI=3.141592653589793;',
    'vec2 lonLat(vec2 P){',
    '  float Z=sqrt(max(0.0,1.0-dot(P,P)));',
    '  float wy=P.y*u_tilt.x+Z*u_tilt.y, wz=-P.y*u_tilt.y+Z*u_tilt.x;',
    '  return vec2(atan(P.x,wz)-u_phi,asin(clamp(wy,-1.0,1.0)));',
    '}',
    'float land(vec2 ll){',
    '  ivec2 s=textureSize(u_mask,0);',
    '  int mx=min(int(fract(ll.x/(2.0*PI)+0.5)*float(s.x)),s.x-1);',
    '  int my=clamp(int((0.5-ll.y/PI)*float(s.y)),0,s.y-1);',
    '  return texelFetch(u_mask,ivec2(mx,my),0).r;',
    '}',
    /* Stroke coverage of the 15-degree graticule: x the parallels (75S to 75N), y the meridians
       (to 82 degrees, round cap), one width all over the sphere. A line under a pixel wide keeps one
       pixel and fades instead, as a wide line does when the picture is shrunk. */
    'vec2 grid(vec2 p,float lw){',
    '  vec2 g=p; float d2=dot(g,g);',
    '  if(d2>0.9995)g*=sqrt(0.9995/d2);',
    '  float Z=sqrt(1.0-dot(g,g));',
    '  float ct=u_tilt.x, st=u_tilt.y;',
    '  float wy=g.y*ct+Z*st, wz=-g.y*st+Z*ct;',
    '  vec2 dZ=-g/Z;',
    '  vec2 dwy=vec2(st*dZ.x,ct+st*dZ.y);',
    '  vec2 dwz=vec2(ct*dZ.x,-st+ct*dZ.y);',
    '  float h2=max(1e-6,1.0-wy*wy);',
    '  float latDeg=degrees(asin(clamp(wy,-1.0,1.0)));',
    '  float lonDeg=degrees(atan(g.x,wz)-u_phi);',
    '  float gLat=max(1e-6,length(degrees(dwy/sqrt(h2))/u_R));',
    '  float gLon=max(1e-6,length(degrees(vec2(wz-g.x*dwz.x,-g.x*dwz.y)/h2)/u_R));',
    '  float nearPar=clamp(floor(latDeg/15.0+0.5)*15.0,-75.0,75.0);',
    '  float dPar=abs(latDeg-nearPar)/gLat;',
    '  float dMer=abs(lonDeg-15.0*floor(lonDeg/15.0+0.5))/gLon;',
    '  dMer=length(vec2(dMer,max(0.0,abs(latDeg)-82.0)/gLat));',
    '  float hw=0.5*max(lw,1.0)+0.5;',
    '  return vec2(clamp(hw-dPar,0.0,1.0),clamp(hw-dMer,0.0,1.0))*min(lw,1.0);',
    '}',
    'void main(){',
    '  vec2 p=(gl_FragCoord.xy-u_c)/u_R;',
    '  float inside=0.0,onLand=0.0;',
    '  for(int sy=0;sy<2;sy++)for(int sx=0;sx<2;sx++){',
    '    vec2 P=p+(vec2(float(sx),float(sy))-0.5)*0.5/u_R;',
    '    if(dot(P,P)>1.0)continue;',
    '    inside+=1.0; onLand+=land(lonLat(P));',
    '  }',
    '  if(inside==0.0){o=vec4(0.0);return;}',
    '  vec3 c=mix(u_sea,u_ink,onLand/inside);',
    '  vec2 g=grid(p,u_lw);',
    '  c=mix(c,1.0-c,g.x);',   /* the difference stroke: crossings invert twice, as on the site */
    '  c=mix(c,1.0-c,g.y);',
    '  float a=inside/4.0;',
    '  o=vec4(c*a,a);',
    '}'
  ].join('\n');

  function startGL(g) {
    var gl = g.body.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return false;
    function shader(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
      return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog); gl.bindVertexArray(gl.createVertexArray());
    gl.disable(gl.BLEND); gl.clearColor(0, 0, 0, 0); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    var m = mask();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, m.w, m.h, 0, gl.RED, gl.UNSIGNED_BYTE, m.bits);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var u = {};
    ['c', 'R', 'phi', 'tilt', 'mask', 'ink', 'sea', 'lw'].forEach(function (n) { u[n] = gl.getUniformLocation(prog, 'u_' + n); });
    gl.uniform1i(u.mask, 0);
    gl.uniform2f(u.tilt, Math.cos(TILT), Math.sin(TILT));
    g.gl = gl; g.u = u; g.live = true;
    return true;
  }

  /* ---- colours: the page's own ink and paper, so the sea is the background ---- */
  function rgb(v, fallback) {
    v = (v || '').trim();
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
    if (m) {
      var x = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1], n = parseInt(x, 16);
      return [n >> 16 & 255, n >> 8 & 255, n & 255];
    }
    m = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(v);
    return m ? [+m[1], +m[2], +m[3]] : fallback;
  }
  function colours(g) {
    var cs = getComputedStyle(g.box), dark = document.documentElement.getAttribute('data-theme') === 'dark';
    g.ink = rgb(cs.getPropertyValue('--text'), dark ? [255, 255, 255] : [0, 0, 0]);
    g.sea = rgb(cs.getPropertyValue('--bg'), dark ? [0, 0, 0] : [255, 255, 255]);
    g.inkCss = 'rgb(' + g.ink.join(',') + ')'; g.seaCss = 'rgb(' + g.sea.join(',') + ')';
  }

  /* ---- layout: both canvases cover the box one-to-one in device pixels ---- */
  function layout(g) {
    var r = g.box.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;   /* display:none, or not laid out yet */
    var dpr = global.devicePixelRatio || 1, w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (w === g.w && h === g.h && dpr === g.dpr) return true;
    g.w = w; g.h = h; g.dpr = dpr;
    [g.body, g.over].forEach(function (c) { c.width = w; c.height = h; c.style.width = w / dpr + 'px'; c.style.height = h / dpr + 'px'; });
    /* the widest the outer ring and its nodes reach sideways, the limb up and down */
    var f = Math.max.apply(null, g.rings.map(function (rg) { return rg.f; })), R = Math.min(w / 2 / (f + 0.06), h / 2);
    for (var i = 0; i < 3; i++) { var s = g.prof(R); R = Math.min((w / 2 - s.node * 1.14 - s.halo - s.ring / 2 - 1) / f, h / 2 - s.limb / 2 - 1); }
    g.R = Math.max(2, R);
    return true;
  }

  function draw(g, t) {
    if (!g.live || !g.w) return;
    var gl = g.gl, R = g.R, cx = g.w / 2, cy = g.h / 2, s = g.prof(R);
    gl.viewport(0, 0, g.w, g.h); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(g.u.c, cx, g.h - cy);
    gl.uniform1f(g.u.R, R);
    gl.uniform1f(g.u.phi, (PHI0 + SPIN * t) % TAU);
    gl.uniform3f(g.u.ink, g.ink[0] / 255, g.ink[1] / 255, g.ink[2] / 255);
    gl.uniform3f(g.u.sea, g.sea[0] / 255, g.sea[1] / 255, g.sea[2] / 255);
    gl.uniform1f(g.u.lw, s.grid);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    var ctx = g.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, g.w, g.h);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = g.inkCss;
    ctx.lineWidth = s.limb;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    for (var k = 0; k < g.rings.length; k++) {
      var rg = g.rings[k], Ro = rg.f * R, si = Math.sin(rg.incl), spin = rg.base + t * rg.spd;
      ctx.lineWidth = s.ring;
      ctx.beginPath(); ctx.ellipse(cx, cy, Ro, Math.abs(Ro * si), 0, 0, TAU); ctx.stroke();
      for (var n = 0; n < rg.nodes; n++) {
        var a = rg.noff + n * TAU / rg.nodes + spin, nx = cx + Ro * Math.cos(a), ny = cy + Ro * Math.sin(a) * si;
        var nr = s.node * (1 + 0.14 * Math.sin(t * 2.2 + n * 1.7));   /* the nodes breathe */
        ctx.beginPath(); ctx.arc(nx, ny, nr + s.halo, 0, TAU); ctx.fillStyle = g.seaCss; ctx.fill();
        ctx.beginPath(); ctx.arc(nx, ny, nr, 0, TAU); ctx.fillStyle = g.inkCss; ctx.fill();
      }
    }
  }

  /* ---- one loop for every globe on the page ---- */
  var list = [], running = false, last = -1e9, STEP = 1000 / FPS;
  var calm = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var clock = function () { return calm.matches ? 0 : performance.now() / 1000; };
  function sweep() {
    for (var i = list.length - 1; i >= 0; i--) {
      var g = list[i];
      if (g.box.isConnected) continue;
      g.dead = true; g.live = false; list.splice(i, 1);
      if (io) io.unobserve(g.box);
      if (ro) ro.unobserve(g.box);
      try { var lose = g.gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); } catch (e) { /* already gone */ }
    }
  }
  function wake() {
    sweep();
    if (calm.matches) { list.forEach(function (g) { if (g.seen && layout(g)) draw(g, 0); }); return; }
    if (running || !list.some(function (g) { return g.seen && g.live; })) return;
    running = true; requestAnimationFrame(tick);
  }
  function tick(now) {
    sweep();
    var on = calm.matches ? [] : list.filter(function (g) { return g.seen && g.live; });
    if (!on.length) { running = false; return; }
    requestAnimationFrame(tick);
    if (now - last < STEP - 2) return;                   /* 30 a second; 2 ms of slack for vsync jitter */
    last = now - last > 2 * STEP ? now : last + STEP;   /* keep an even cadence */
    var t = now / 1000;
    on.forEach(function (g) { if (layout(g)) draw(g, t); });
  }
  var io = 'IntersectionObserver' in global ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { var g = e.target._scGlobe; if (g) g.seen = e.isIntersecting; });
    wake();
  }) : null;
  var ro = 'ResizeObserver' in global ? new ResizeObserver(function (entries) {
    entries.forEach(function (e) { var g = e.target._scGlobe; if (g && layout(g)) draw(g, clock()); });
    wake();
  }) : null;
  new MutationObserver(function () { list.forEach(colours); list.forEach(function (g) { draw(g, clock()); }); wake(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-skin'] });
  if (calm.addEventListener) calm.addEventListener('change', wake);

  function mount(box, opts) {
    if (!box) return null;
    if (box._scGlobe && !box._scGlobe.dead) return box._scGlobe;
    var mark = !!(opts && opts.mark);
    var g = { box: box, prof: mark ? MARK : SITE, rings: mark ? RINGS.slice(0, 1) : RINGS, body: document.createElement('canvas'), over: document.createElement('canvas'),
              seen: true, live: false, dead: false, w: 0, h: 0, dpr: 0, R: 0 };
    try { if (!startGL(g)) return null; } catch (e) { console.error('globe:', e); return null; }
    g.body.addEventListener('webglcontextlost', function (e) { e.preventDefault(); g.live = false; });
    g.body.addEventListener('webglcontextrestored', function () { if (g.dead) return; try { startGL(g); wake(); } catch (e) { console.error('globe:', e); } });
    [g.body, g.over].forEach(function (c) {
      c.setAttribute('aria-hidden', 'true');
      c.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none';
      box.appendChild(c);
    });
    g.ctx = g.over.getContext('2d');
    box._scGlobe = g; box.classList.add('drawn');
    list.push(g);
    colours(g);
    if (layout(g)) draw(g, clock());   /* the first frame now, so the still image never flashes away to nothing */
    if (io) io.observe(box);
    if (ro) ro.observe(box);
    wake();
    return g;
  }

  global.NWGlobe = { mount: mount };
})(window);
