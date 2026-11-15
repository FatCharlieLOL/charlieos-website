/* SMT 产品 3D —— 静态写实版
   · 固定在首屏右侧，不随滚动/鼠标移动
   · 只渲染有限帧（进入稳定后停），性能开销趋近于零
   · 程序化棚拍环境 + 结构光反射 + 接触阴影 + 压盖纹理 + 粉末噪声
   依赖：three.min.js（本地）
*/
(function () {
  'use strict';

  var canvas = document.getElementById('gl');
  if (!canvas || !window.THREE) return;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
  } catch (e) { return; }

  var mobile = window.matchMedia('(max-width: 960px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2.5));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  if ('useLegacyLights' in renderer) renderer.useLegacyLights = false;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(26, 1, 0.1, 60);
  camera.position.set(0, 0.05, 8.4);

  /* ---------------- 结构化棚拍环境（有明暗结构，玻璃才像玻璃） ---------------- */
  function buildEnv() {
    var W = mobile ? 512 : 1024, H = mobile ? 256 : 512;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');

    // 背景：上亮下暗的影棚
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0.00, '#ffffff');
    g.addColorStop(0.36, '#f2efe8');
    g.addColorStop(0.55, '#b9b3a8');
    g.addColorStop(0.58, '#6f6a62');
    g.addColorStop(0.80, '#3f3b36');
    g.addColorStop(1.00, '#26231f');
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    // 顶部大柔光箱
    var s1 = c.createLinearGradient(0, 0, 0, 190);
    s1.addColorStop(0, 'rgba(255,255,255,1)');
    s1.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = s1; c.fillRect(W * 0.18, 0, W * 0.64, 190);

    // 左侧条灯
    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.fillRect(W * 0.04, H * 0.18, W * 0.06, H * 0.55);
    // 右侧条灯（暖）
    var s2 = c.createLinearGradient(W * 0.86, 0, W, 0);
    s2.addColorStop(0, 'rgba(255,236,200,0)');
    s2.addColorStop(0.5, 'rgba(255,236,200,0.9)');
    s2.addColorStop(1, 'rgba(255,236,200,0)');
    c.fillStyle = s2; c.fillRect(W * 0.84, H * 0.12, W * 0.16, H * 0.66);

    // 一条深色竖影：让玻璃边缘出现暗线，立体感来源
    c.fillStyle = 'rgba(20,18,16,0.55)';
    c.fillRect(W * 0.70, H * 0.10, W * 0.035, H * 0.72);
    c.fillStyle = 'rgba(20,18,16,0.42)';
    c.fillRect(W * 0.28, H * 0.12, W * 0.022, H * 0.70);

    var tex = new THREE.CanvasTexture(cv);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.encoding = THREE.sRGBEncoding;

    var pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    var env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    return env;
  }

  scene.environment = buildEnv();


  /* ---- 拉丝金属（金盖用） ---- */
  function brushedMetal() {
    var s = 512;
    var cv = document.createElement('canvas');
    cv.width = cv.height = s;
    var c = cv.getContext('2d');
    c.fillStyle = '#808080'; c.fillRect(0, 0, s, s);
    for (var i = 0; i < 2600; i++) {
      var y = Math.random() * s;
      var v = 110 + Math.random() * 90;
      c.strokeStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.05 + Math.random() * 0.16) + ')';
      c.lineWidth = 0.6 + Math.random() * 1.4;
      c.beginPath(); c.moveTo(0, y); c.lineTo(s, y + (Math.random() - 0.5) * 2); c.stroke();
    }
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 3);
    return t;
  }

  /* ---- 玻璃微表面（指纹/水痕，极淡） ---- */
  function smudgeMap() {
    var s = 512;
    var cv = document.createElement('canvas');
    cv.width = cv.height = s;
    var c = cv.getContext('2d');
    c.fillStyle = '#2b2b2b'; c.fillRect(0, 0, s, s);
    for (var i = 0; i < 90; i++) {
      var x = Math.random() * s, y = Math.random() * s, r = 8 + Math.random() * 46;
      var g = c.createRadialGradient(x, y, 0, x, y, r);
      var a = 0.05 + Math.random() * 0.12;
      g.addColorStop(0, 'rgba(150,150,150,' + a + ')');
      g.addColorStop(1, 'rgba(150,150,150,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    return t;
  }
  var brushTex = brushedMetal();
  var smudgeTex = smudgeMap();

  /* ---------------- 瓶型 ---------------- */
  var H2 = 2.0, R = 0.5;
  var profile = [
    [0.00, 0.00], [R * 0.80, 0.00], [R * 0.96, 0.035], [R * 1.00, 0.09],
    [R * 1.00, 1.28], [R * 0.985, 1.33], [R * 0.90, 1.40], [R * 0.74, 1.465],
    [R * 0.56, 1.535], [R * 0.455, 1.59], [R * 0.445, 1.70], [R * 0.47, 1.745]
  ];
  var pts = profile.map(function (p) { return new THREE.Vector2(p[0], p[1]); });

  var glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.028,
    transmission: 1.0,
    thickness: 0.52,
    ior: 1.52,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.25,
    attenuationColor: new THREE.Color(0xf6f7f2),
    attenuationDistance: 3.2,
    roughnessMap: smudgeTex,
    side: THREE.DoubleSide,
    transparent: true
  });


  /* 金色微尘：让画面有"空气" */
  var dustPoints = (function () {
    var N = 140;
    var pos = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      var a = Math.random() * Math.PI * 2;
      var r = 0.75 + Math.random() * 0.75;
      pos[i * 3]     = Math.cos(a) * r;
      pos[i * 3 + 1] = -1.05 + Math.random() * 2.1;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    var cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    var c = cv.getContext('2d');
    var g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,240,205,1)');
    g.addColorStop(0.4, 'rgba(235,200,140,0.55)');
    g.addColorStop(1, 'rgba(235,200,140,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    var sprite = new THREE.CanvasTexture(cv);

    var mat = new THREE.PointsMaterial({
      size: 0.062, map: sprite, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xF0D3A0, opacity: 0.85, sizeAttenuation: true
    });
    var p = new THREE.Points(geo, mat);
    p.position.y = 0.02;
    return p;
  })();



  var bottle = new THREE.Group();
  var glass = new THREE.Mesh(new THREE.LatheGeometry(pts, mobile ? 96 : 160), glassMat);
  glass.position.y = -H2 * 0.5 + 0.15;
  bottle.add(glass);


  /* 菲涅尔边缘光：广告片里玻璃最"贵"的那一圈 */
  var fresnelGlow = (function () {
    var mat = new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.FrontSide,
      uniforms: {
        uColor: { value: new THREE.Color(0xF3D9A4) },
        uPower: { value: 3.4 },
        uIntensity: { value: 1.15 }
      },
      vertexShader: [
        'varying vec3 vN; varying vec3 vV;',
        'void main(){',
        '  vec4 mv = modelViewMatrix * vec4(position,1.0);',
        '  vN = normalize(normalMatrix * normal);',
        '  vV = normalize(-mv.xyz);',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform float uPower; uniform float uIntensity;',
        'varying vec3 vN; varying vec3 vV;',
        'void main(){',
        '  float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), uPower);',
        '  gl_FragColor = vec4(uColor * f * uIntensity, f * uIntensity);',
        '}'
      ].join('\n')
    });
    var geo = new THREE.LatheGeometry(
      pts.map(function (p) { return new THREE.Vector2(p.x * 1.012, p.y * 1.012); }), mobile ? 64 : 96
    );
    var m = new THREE.Mesh(geo, mat);
    m.position.y = -H2 * 0.5 + 0.15;
    return m;
  })();

  // 瓶底（厚玻璃感）
  var baseMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2f4ef, roughness: 0.16, metalness: 0, transmission: 0.78,
    thickness: 0.55, ior: 1.5, side: THREE.DoubleSide, envMapIntensity: 1.1
  });
  var base = new THREE.Mesh(new THREE.CircleGeometry(R * 0.83, 96), baseMat);
  base.rotation.x = -Math.PI / 2;
  base.position.y = -H2 * 0.5 + 0.155;
  bottle.add(base);
  bottle.add(fresnelGlow);

  // 瓶内粉末（带噪声的粗糙面）
  function powderTexture() {
    var s = 512;
    var cv = document.createElement('canvas');
    cv.width = cv.height = s;
    var c = cv.getContext('2d');
    c.fillStyle = '#fbf7ee'; c.fillRect(0, 0, s, s);
    for (var i = 0; i < 14000; i++) {
      var x = Math.random() * s, y = Math.random() * s;
      var v = 235 + Math.random() * 20;
      c.fillStyle = 'rgba(' + v + ',' + (v - 4) + ',' + (v - 16) + ',' + (0.25 + Math.random() * 0.5) + ')';
      c.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 1.6);
    return t;
  }
  var ptex = powderTexture();
  var powderMat = new THREE.MeshStandardMaterial({
    color: 0xf1e6cf, roughness: 0.95, metalness: 0.0,
    map: ptex, bumpMap: ptex, bumpScale: 0.012, envMapIntensity: 0.5
  });
  var powder = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.56, R * 0.56, 0.72, 72), powderMat);
  powder.position.y = -H2 * 0.5 + 0.55;
  bottle.add(powder);

  /* ---------------- 压盖：金盖 + 压纹 + 盖沿 ---------------- */
  var gold = new THREE.MeshPhysicalMaterial({
    color: 0xB08234, metalness: 1.0, roughness: 0.34,
    roughnessMap: brushTex,
    clearcoat: 0.75, clearcoatRoughness: 0.16, envMapIntensity: 1.25
  });

  var capBody = new THREE.Mesh(new THREE.CylinderGeometry(0.415, 0.418, 0.285, 120, 1), gold);
  capBody.position.y = -H2 * 0.5 + 1.785;
  bottle.add(capBody);

  // 压纹（24 条竖棱）
  var crimpGeo = new THREE.BoxGeometry(0.012, 0.255, 0.014);
  for (var i = 0; i < 24; i++) {
    var a = (i / 24) * Math.PI * 2;
    var m = new THREE.Mesh(crimpGeo, gold);
    m.position.set(Math.cos(a) * 0.418, -H2 * 0.5 + 1.785, Math.sin(a) * 0.418);
    m.rotation.y = -a;
    bottle.add(m);
  }

  // 盖沿（压紧处）
  var lip = new THREE.Mesh(new THREE.TorusGeometry(0.404, 0.026, 16, 96), gold);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -H2 * 0.5 + 1.652;
  bottle.add(lip);

  // 盖顶凹陷
  var capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.02, 96), gold);
  capTop.position.y = -H2 * 0.5 + 1.925;
  bottle.add(capTop);
  var capHole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.255, 0.255, 0.025, 96),
    new THREE.MeshPhysicalMaterial({ color: 0x7C5A22, metalness: 1, roughness: 0.45, envMapIntensity: 0.7 })
  );
  capHole.position.y = -H2 * 0.5 + 1.932;
  bottle.add(capHole);

  /* ---------------- 标签（带纸纹与轻微起伏） ---------------- */
  function labelTexture() {
    var w = 1600, h = 700;
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var c = cv.getContext('2d');

    c.fillStyle = '#FCFAF3'; c.fillRect(0, 0, w, h);

    // 柱面明暗：左右两侧压暗，中间提亮（模拟圆柱受光）
    var cyl = c.createLinearGradient(0, 0, w, 0);
    cyl.addColorStop(0.00, 'rgba(70,60,45,0.16)');
    cyl.addColorStop(0.22, 'rgba(70,60,45,0.02)');
    cyl.addColorStop(0.50, 'rgba(255,252,240,0.18)');
    cyl.addColorStop(0.78, 'rgba(70,60,45,0.02)');
    cyl.addColorStop(1.00, 'rgba(70,60,45,0.18)');
    c.fillStyle = cyl; c.fillRect(0, 0, w, h);

    // 纸纹
    for (var i = 0; i < 9000; i++) {
      c.fillStyle = 'rgba(180,170,150,' + (0.02 + Math.random() * 0.05) + ')';
      c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }

    // 上下金线
    c.strokeStyle = '#C9A96E'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(70, 62); c.lineTo(w - 70, 62); c.stroke();
    c.beginPath(); c.moveTo(70, h - 62); c.lineTo(w - 70, h - 62); c.stroke();

    // 主标
    c.fillStyle = '#B98F52';
    c.font = '700 330px "Cormorant Garamond", Georgia, serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('SMT', w / 2, h / 2 - 46);

    c.fillStyle = '#6E5B36';
    c.font = '500 54px "Cormorant Garamond", Georgia, serif';
    c.fillText('100% Nanoscale', w / 2, h / 2 + 130);
    c.fillText('Active Peptides', w / 2, h / 2 + 190);

    // 左侧圆章
    c.strokeStyle = '#B9A279'; c.lineWidth = 4;
    c.beginPath(); c.arc(210, h / 2 - 44, 78, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#8A7548';
    c.font = '600 78px "Noto Serif SC", serif';
    c.fillText('肽', 210, h / 2 - 40);

    var t = new THREE.CanvasTexture(cv);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  var LAB_W = Math.PI * 0.95;
  var labelMat = new THREE.MeshPhysicalMaterial({
    map: labelTexture(),
    roughness: 0.68, metalness: 0.0, envMapIntensity: 0.55,
    clearcoat: 0.08, clearcoatRoughness: 0.6,
    side: THREE.DoubleSide
  });
  var label = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 1.004, R * 1.004, 0.88, 128, 1, true, -LAB_W / 2, LAB_W),
    labelMat
  );
  label.position.y = -H2 * 0.5 + 0.715;
  bottle.add(label);

  /* ---------------- 两条金色基因链 ---------------- */
  function makeRibbon(phase, turns, height, radius, width) {
    var segs = 260, positions = [], indices = [];
    for (var i = 0; i <= segs; i++) {
      var t = i / segs;
      var a = phase + t * Math.PI * 2 * turns;
      var px = Math.cos(a) * radius, pz = Math.sin(a) * radius;
      var py = -height / 2 + t * height;

      var da = (Math.PI * 2 * turns) / segs;
      var tx = -Math.sin(a) * radius * da, tz = Math.cos(a) * radius * da, ty = height / segs;
      var rx = Math.cos(a), rz = Math.sin(a);
      var sx = ty * rz, sy = tz * rx - tx * rz, sz = -ty * rx;
      var sl = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
      sx /= sl; sy /= sl; sz /= sl;

      var hw = width / 2;
      positions.push(px + sx * hw, py + sy * hw, pz + sz * hw);
      positions.push(px - sx * hw, py - sy * hw, pz - sz * hw);
    }
    for (var k = 0; k < segs; k++) {
      indices.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  var ribbonMat = new THREE.MeshPhysicalMaterial({
    color: 0xC08F3C, metalness: 1.0, roughness: 0.26, roughnessMap: brushTex,
    clearcoat: 1.0, clearcoatRoughness: 0.12,
    envMapIntensity: 1.05, emissive: 0x2E1D08, emissiveIntensity: 0.22,
    side: THREE.DoubleSide
  });

  var ribbons = new THREE.Group();
  ribbons.add(new THREE.Mesh(makeRibbon(0, 1.58, 1.94, 0.70, 0.085), ribbonMat));
  ribbons.add(new THREE.Mesh(makeRibbon(Math.PI * 0.98, 1.58, 1.94, 0.70, 0.085), ribbonMat));
  ribbons.position.y = 0.05;
  ribbons.rotation.y = 0.22;
  bottle.add(ribbons);
  bottle.add(dustPoints);

  /* ---------------- 光晕 ---------------- */
  function makeHalo() {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    var c = cv.getContext('2d');
    var g = c.createRadialGradient(256, 256, 0, 256, 256, 256);
    g.addColorStop(0.00, 'rgba(255,236,198,0.85)');
    g.addColorStop(0.30, 'rgba(228,193,131,0.42)');
    g.addColorStop(0.62, 'rgba(201,169,110,0.13)');
    g.addColorStop(1.00, 'rgba(201,169,110,0)');
    c.fillStyle = g; c.fillRect(0, 0, 512, 512);
    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    var m = new THREE.Mesh(
      new THREE.PlaneGeometry(3.9, 3.9),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 })
    );
    m.position.z = -0.6;
    return m;
  }
  var halo = makeHalo();
  bottle.add(halo);

  /* ---------------- 接触阴影（让它"落"在台面上） ---------------- */
  function makeShadow() {
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    var c = cv.getContext('2d');
    var g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(48,40,30,0.75)');
    g.addColorStop(0.45, 'rgba(48,40,30,0.3)');
    g.addColorStop(1, 'rgba(60,52,40,0)');
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    var tex = new THREE.CanvasTexture(cv);
    var m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.72),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.55 })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(0.02, -0.9, 0.16);
    return m;
  }
  bottle.add(makeShadow());

  // 台面反光：让"放"在桌面上的感觉更真实
  var tableReflect = (function () {
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    var c = cv.getContext('2d');
    var g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.35, 'rgba(255,250,238,0.22)');
    g.addColorStop(1, 'rgba(255,250,238,0)');
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    var tex = new THREE.CanvasTexture(cv);
    var m = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 1.1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.5 })
    );
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.PI;
    m.position.set(0, -0.895, 0.1);
    return m;
  })();
  // tableReflect 已停用（会出现白色亮斑）
  void tableReflect;

  /* ---------------- 静态姿态与摆放（位置固定，持续自转） ---------------- */
  var BASE_YAW = -0.52;      // 基准角度（侧身 30°）
  var BASE_TILT_X = 0.045;   // 微微后仰
  var BASE_TILT_Z = 0.065;   // 轻微侧倾
  var SPIN = 0.19;           // 自转角速度：约 33 秒一圈
  var RIB_SPIN = -0.07;      // 金链反向慢转，让交叉点不断变化

  bottle.rotation.set(BASE_TILT_X, BASE_YAW, BASE_TILT_Z);
  scene.add(bottle);

  var key = new THREE.DirectionalLight(0xfff6e8, 2.8); key.position.set(-3.2, 4.2, 4.4); scene.add(key);
  var rim = new THREE.DirectionalLight(0xffd9a3, 2.0); rim.position.set(4.2, 2.2, -2.4); scene.add(rim);
  var fill = new THREE.DirectionalLight(0xdce6f0, 0.55); fill.position.set(0, -3.2, 3.2); scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  /* ---------------- 尺寸（固定右侧） ---------------- */
  var heroBox = document.querySelector('.hero');
  var isM = window.matchMedia('(max-width:960px)').matches;
  var lastW = 0, lastH = 0;

  function layout(force) {
    var w, h;
    if (isM && heroBox) {
      // 手机上以首屏盒子为准：100svh 不随地址栏变化，尺寸稳定，不会忽大忽小
      var r = heroBox.getBoundingClientRect();
      w = Math.round(r.width); h = Math.round(r.height);
    } else {
      w = window.innerWidth; h = window.innerHeight;
    }
    // 安卓地址栏伸缩只改高度：宽度没变就跳过，避免反复重设相机导致画面抖动
    if (!force && w === lastW && Math.abs(h - lastH) < 80) return;
    lastW = w; lastH = h;

    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    var m = w < 700;
    var s = m ? 0.62 : Math.min(1.06, Math.max(0.9, w / 1440));
    bottle.scale.setScalar(s);
    bottle.position.set(m ? 0 : 1.18, m ? -0.40 : -0.04, 0);
  }
  layout(true);
  window.addEventListener('resize', function () {
    isM = window.matchMedia('(max-width:960px)').matches;
    layout(false);
    renderer.render(scene, camera);
  });
  window.addEventListener('orientationchange', function () { setTimeout(function () { layout(true); }, 250); });

  /* ---------------- 持续自转（时间驱动，与滚动无关） ---------------- */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.__pool = (function () {
    var free = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    return {
      get: function () { return free.pop() || new THREE.Vector3(); },
      release: function (v) { free.push(v); }
    };
  })();
  var t0 = performance.now();
  var last = 0;

  function frame(now) {
    requestAnimationFrame(frame);

    // 30fps 足够顺滑：玻璃透射要两遍渲染，节流能明显降功耗
    if (now - last < 33) return;
    last = now;

    // 滚出首屏（已淡出）或页面不可见时，停止渲染省电
    if (document.hidden || !onScreen) return;

    var t = reduce ? 0 : (performance.now() - t0) / 1000;
    bottle.rotation.y = BASE_YAW + t * SPIN;
    window.__smtYaw = bottle.rotation.y;
    window.__smtYawT = now;
    if (window.__pool) {
      var v = window.__pool.get();
      bottle.getWorldPosition(v);
      v.project(camera);
      var ax = (v.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
      var ay = (-v.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
      var v2 = window.__pool.get();
      bottle.getWorldPosition(v2);
      v2.x += 1.0;                       /* 世界坐标里 1 个单位 */
      v2.project(camera);
      var ax2 = (v2.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
      window.__smtAnchor = { x: ax, y: ay, unit: Math.abs(ax2 - ax) };
      window.__pool.release(v); window.__pool.release(v2);
    }
    window.__smtYawT = now;
    ribbons.rotation.y = 0.22 + t * RIB_SPIN;
    if (window.__dust) {
      window.__dust.rotation.y = -t * 0.05;
      window.__dust.position.y = Math.sin(t * 0.8) * 0.05;
      window.__dust.material.opacity = 0.72 + Math.sin(t * 1.6) * 0.12;
    }

    renderer.render(scene, camera);
  }

  // 随页上移（0.95 倍速，轻微纵深），并提前淡出，避免与下方白底"硬切"
  var heroEl = document.querySelector('.hero');
  var onScreen = true;

  function onScroll() {
    var y = window.scrollY || 0;
    var heroH = heroEl ? heroEl.offsetHeight : window.innerHeight;

    // 手机端：canvas 随文档原生滚动，不做任何位移与淡出
    if (!isM && y < heroH * 1.2) {
      canvas.style.transform = 'translate3d(0,' + (-y).toFixed(1) + 'px,0)';
    }
    // 只在离开首屏后停渲染，画面本身保持完全不透明
    onScreen = y < heroH * 1.2;
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  frame();

  document.body.classList.add('gl-ok');
  window.__dust = dustPoints;
  window.__smt3d = { ok: true, renderer: renderer, spinning: true };
})();
