// The strip at the bottom of the front page: the dog walks on a leash held by
// nobody, in front of clay hills and pines that scroll past. The same scene as
// the App Store header (design/app-store/header-walk/index.html), drawn live so
// it fits any width and follows light and dark mode.
//
// The scene is drawn in the header's coordinates (the dog is about 850 wide),
// and only the band from SCENE_TOP to SCENE_BOTTOM is shown.
(function () {
  "use strict";

  var strip = document.querySelector(".walk-strip");
  if (!strip) return;
  var canvas = strip.querySelector("canvas");
  var ctx = canvas.getContext("2d");

  var SCENE_TOP = 140, SCENE_BOTTOM = 1500;
  var GROUND_Y = 1340;
  var DOG_FRAMES = 40, DOG_FPS = 20;
  var SPEED = 16000 / 24;               // as in the header: paws do not slide at this speed
  var DOG_SCALE = SPEED / (36 * DOG_FPS);
  var FRAME_SCALE = 2;                  // the frames here are half the size of the originals
  var DOG_CENTER_X = 495, DOG_FLOOR_Y = 871;
  var PERSON_STEP = 1.0;
  var LEASH_LENGTH = 1060;

  // Middle of the collar in each frame (original frame coordinates).
  var DOG_COLLAR = [[668.2, 399.7], [667.7, 401.3], [670.0, 409.0], [674.1, 419.4], [677.6, 425.1], [681.4, 426.0], [681.8, 421.7], [678.2, 415.1], [676.8, 407.5], [673.1, 400.1], [670.6, 397.8], [667.2, 399.1], [668.2, 407.6], [671.4, 415.8], [676.0, 424.3], [677.8, 427.4], [678.9, 424.3], [679.3, 418.7], [676.7, 411.7], [673.4, 405.2], [669.6, 403.0], [668.0, 404.4], [669.3, 408.4], [674.4, 417.5], [677.6, 424.4], [683.3, 426.7], [685.0, 424.1], [684.0, 417.8], [680.4, 409.6], [677.2, 402.6], [672.0, 397.8], [667.7, 398.5], [668.2, 404.3], [669.6, 411.6], [675.5, 422.3], [677.7, 428.1], [681.4, 427.4], [680.6, 421.6], [679.1, 414.0], [674.5, 407.4]];

  // The sky starts in the page background, and the meadow ends in the footer
  // color (--meadow in index.html), so the strip has no edges.
  var PALETTES = {
    light: {
      page: "#F7F1E6", sky: "#E4EDE6", glow: "255,236,200", glowAlpha: 0.85, moon: null,
      cloud: "#FFFDF8", haze: "#F3EDE0",
      far: "#6F9A84", mid: "#5E8C72", pine: "#2F5D50", trunk: "#7A5A40", bush: "#3E6B57", bush2: "#4A7A62", stone: "#9C9D98",
      meadow: ["#6F9C7E", "#5E8C70", "#3F6B55"], path: "#E9DFC9", pebbles: ["#CDBE9F", "#B9B7AF"],
      flower: "#E8833A", flower2: "#F7F1E6", flowerMiddle: "#F2C661",
      letter: ["#F1E6D0", "#D8C5A3", "#BFA883"], mound: "#6A9679",
      leash: "#2F5D50", stitch: "#244A3F", clip: "#E8833A", dogShade: null,
    },
    dark: {
      page: "#121A16", sky: "#1E2A25", glow: "238,231,218", glowAlpha: 0.12, moon: "#E9E1CF",
      cloud: "#3A4842", haze: "#1A2520",
      far: "#3E5E50", mid: "#3A5A4B", pine: "#24453A", trunk: "#4F3D2E", bush: "#2C4A3E", bush2: "#33544A", stone: "#5F625E",
      meadow: ["#355446", "#2C473B", "#1A2922"], path: "#5E584B", pebbles: ["#4C473D", "#55554F"],
      flower: "#C9763A", flower2: "#9AA59F", flowerMiddle: "#B8964A",
      letter: ["#B8AD95", "#978B73", "#7B705C"], mound: "#355446",
      leash: "#4E8F7A", stitch: "#3B6E5E", clip: "#F0975A", dogShade: "brightness(0.82) saturate(0.9)",
    },
  };

  var darkQuery = matchMedia("(prefers-color-scheme: dark)");
  var reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  var C = darkQuery.matches ? PALETTES.dark : PALETTES.light;

  // Scale from scene units to device pixels, and the scene width.
  var K = 1, sceneWidth = 3840, dogX = 1920;
  var layers = [], clouds = [];

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function ridge(P, base, waves) {
    return function (x) {
      return waves.reduce(function (y, w) { return y + w[1] * Math.sin(2 * Math.PI * w[0] * x / P + w[2]); }, base);
    };
  }

  function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) {
    var A = hex(a), B = hex(b);
    return "#" + A.map(function (v, i) { return Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0"); }).join("");
  }

  // ---------------------------------------------------------------------------
  // Clay: matte shapes lit from the top left, with a soft shadow beneath.
  // Canvas shadows are in device pixels, so they are scaled by K.
  // ---------------------------------------------------------------------------
  function clay(g, path, color, box, o) {
    o = o || {};
    var shadow = o.shadow == null ? 0.22 : o.shadow, blur = o.blur == null ? 28 : o.blur, drop = o.drop == null ? 12 : o.drop;
    var light = o.light == null ? 0.22 : o.light, dark = o.dark == null ? 0.2 : o.dark;
    var x = box[0], y = box[1], w = box[2], h = box[3];
    if (shadow > 0) {
      g.save();
      g.shadowColor = "rgba(15,22,19," + shadow + ")"; g.shadowBlur = blur * K; g.shadowOffsetY = drop * K; g.shadowOffsetX = drop * 0.4 * K;
      g.fillStyle = color; path(g); g.fill();
      g.restore();
    }
    g.save();
    path(g); g.clip();
    g.fillStyle = color; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    var hl = g.createRadialGradient(x + w * 0.3, y + h * 0.15, 0, x + w * 0.3, y + h * 0.15, Math.max(w, h) * 0.75);
    hl.addColorStop(0, "rgba(255,255,255," + light + ")"); hl.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = hl; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    var sh = g.createLinearGradient(x, y + h * 0.35, x + w * 0.2, y + h);
    sh.addColorStop(0, "rgba(15,22,19,0)"); sh.addColorStop(1, "rgba(15,22,19," + dark + ")");
    g.fillStyle = sh; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.restore();
  }

  function pine(g, x, baseY, h, color, trunk, shadow) {
    var tw = h * 0.09;
    clay(g, function (g) { g.beginPath(); g.roundRect(x - tw / 2, baseY - h * 0.2, tw, h * 0.2, tw * 0.3); }, trunk, [x - tw / 2, baseY - h * 0.2, tw, h * 0.2], { shadow: 0, light: 0.15 });
    for (var i = 0; i < 3; i++) {
      var bottom = baseY - h * 0.16 - i * h * 0.24;
      var top = bottom - h * (0.42 - i * 0.04);
      var w = h * (0.62 - i * 0.14);
      var bumps = 4 - Math.min(i, 2);
      var r = w / bumps / 2;
      var left = x - w / 2;
      (function (top, bottom, w, bumps, r, left) {
        clay(g, function (g) {
          g.beginPath();
          g.moveTo(x, top);
          g.quadraticCurveTo(x - w * 0.12, top + (bottom - top) * 0.55, left, bottom - r * 0.6);
          for (var b = 0; b < bumps; b++) g.arc(left + r + b * 2 * r, bottom - r * 0.6, r, Math.PI, 0, true);
          g.quadraticCurveTo(x + w * 0.12, top + (bottom - top) * 0.55, x, top);
          g.closePath();
        }, color, [left, top, w, bottom - top + r * 0.5], { shadow: shadow == null ? 0.2 : shadow, blur: h * 0.06, drop: h * 0.02, light: 0.2, dark: 0.22 });
      })(top, bottom, w, bumps, r, left);
    }
  }

  function bush(g, x, baseY, size, color, r, shadow) {
    var leaves = 5 + Math.floor(r() * 3);
    for (var i = 0; i < leaves; i++) {
      var a = -Math.PI / 2 + (i / (leaves - 1) - 0.5) * 2.2;
      var len = size * (0.75 + r() * 0.35), lw = size * 0.32;
      g.save();
      g.translate(x, baseY);
      g.rotate(a + Math.PI / 2);
      (function (len, lw) {
        clay(g, function (g) { g.beginPath(); g.ellipse(0, -len / 2, lw, len / 2, 0, 0, Math.PI * 2); },
          i % 2 ? color : mix(color, "#1F2A26", 0.08), [-lw, -len, lw * 2, len], { shadow: shadow == null ? 0.18 : shadow, blur: size * 0.12, drop: size * 0.04 });
      })(len, lw);
      g.restore();
    }
  }

  function stone(g, x, y, w, h, color) {
    clay(g, function (g) { g.beginPath(); g.ellipse(x, y - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); }, color, [x - w / 2, y - h, w, h], { shadow: 0.25, blur: h * 0.5, drop: h * 0.15, light: 0.35, dark: 0.25 });
  }

  // A clay flower standing at (x, y): stem, one leaf and five round petals.
  function flower(g, x, y, color, side) {
    var hx = x + side * 6, hy = y - 48;
    g.strokeStyle = C.bush; g.lineWidth = 7; g.lineCap = "round";
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - side * 4, y - 26, hx, hy); g.stroke();
    g.save();
    g.translate(x - side * 2, y - 18); g.rotate(side * 0.9);
    clay(g, function (g) { g.beginPath(); g.ellipse(0, -11, 7, 13, 0, 0, Math.PI * 2); }, C.bush2, [-7, -24, 14, 26], { shadow: 0.15, blur: 6, drop: 2 });
    g.restore();
    for (var k = 0; k < 5; k++) {
      var a = k / 5 * Math.PI * 2 - Math.PI / 2;
      (function (px, py) {
        clay(g, function (g) { g.beginPath(); g.arc(px, py, 16, 0, Math.PI * 2); }, color, [px - 16, py - 16, 32, 32], { shadow: 0.2, blur: 10, drop: 3 });
      })(hx + Math.cos(a) * 19, hy + Math.sin(a) * 19);
    }
    clay(g, function (g) { g.beginPath(); g.arc(hx, hy, 12, 0, Math.PI * 2); }, C.flowerMiddle, [hx - 12, hy - 12, 24, 24], { shadow: 0.15, blur: 4, drop: 1 });
  }

  // The PAWTUR letters: thick clay strokes in a box one unit high, so they look
  // the same everywhere without a font. Each letter is a little different in
  // size, tilt, depth and spacing, and stands on its own mound.
  var GLYPHS = {
    P: { w: 0.62, d: function (g) { g.moveTo(0, 1); g.lineTo(0, 0); g.lineTo(0.3, 0); g.arc(0.3, 0.27, 0.27, -Math.PI / 2, Math.PI / 2); g.lineTo(0, 0.54); } },
    A: { w: 0.78, d: function (g) { g.moveTo(0, 1); g.lineTo(0.39, 0); g.lineTo(0.78, 1); g.moveTo(0.17, 0.66); g.lineTo(0.61, 0.66); } },
    W: { w: 1.0, d: function (g) { g.moveTo(0, 0); g.lineTo(0.22, 1); g.lineTo(0.5, 0.4); g.lineTo(0.78, 1); g.lineTo(1.0, 0); } },
    T: { w: 0.72, d: function (g) { g.moveTo(0, 0); g.lineTo(0.72, 0); g.moveTo(0.36, 0); g.lineTo(0.36, 1); } },
    U: { w: 0.66, d: function (g) { g.moveTo(0, 0); g.lineTo(0, 0.66); g.arc(0.33, 0.66, 0.33, Math.PI, 0, true); g.lineTo(0.66, 0); } },
    R: { w: 0.66, d: function (g) { g.moveTo(0, 1); g.lineTo(0, 0); g.lineTo(0.3, 0); g.arc(0.3, 0.27, 0.27, -Math.PI / 2, Math.PI / 2); g.lineTo(0, 0.54); g.moveTo(0.28, 0.54); g.lineTo(0.66, 1); } },
  };
  var LETTER_STROKE = 0.27, LETTER_GAP = 0.44;

  function clayWord(g, word, x, baseY, h, r) {
    var pad = LETTER_STROKE / 2;
    word.split("").forEach(function (ch) {
      var glyph = GLYPHS[ch];
      var lh = h * (0.9 + r() * 0.2);
      var tilt = (r() - 0.5) * 0.24;
      var sink = r() * 0.12 * lh;
      var cx = x + (glyph.w / 2) * lh;
      g.save();
      g.translate(cx, baseY + sink);
      g.rotate(tilt);
      g.scale(lh, lh);
      g.translate(-glyph.w / 2, -1 - pad);
      g.lineCap = "round"; g.lineJoin = "round";
      function stroke(color, width, dx, dy) {
        g.save(); g.translate(dx || 0, dy || 0);
        g.strokeStyle = color; g.lineWidth = width;
        g.beginPath(); glyph.d(g); g.stroke();
        g.restore();
      }
      // Depth toward the bottom right, then the face, then the light from the top left.
      for (var i = 12; i >= 1; i--) stroke(i === 12 ? C.letter[2] : C.letter[1], LETTER_STROKE, i * 0.006, i * 0.006);
      stroke(C.letter[0], LETTER_STROKE);
      stroke("rgba(255,255,255,0.14)", LETTER_STROKE * 0.5, -0.025, -0.03);
      g.restore();
      // The mound the letter stands in, with a bush or a stone at the side.
      var mw = (glyph.w / 2 + 0.3 + r() * 0.15) * lh, mh = (0.1 + r() * 0.06) * lh;
      var mx = cx + (r() - 0.5) * 0.2 * lh;
      clay(g, function (g) { g.beginPath(); g.ellipse(mx, baseY + 30, mw, mh + 30, 0, Math.PI, 0); g.closePath(); },
        C.mound, [mx - mw, baseY - mh, mw * 2, mh + 30], { shadow: 0.18, blur: 18, drop: 6, light: 0.2, dark: 0.15 });
      var side = r() < 0.5 ? -1 : 1;
      if (r() < 0.75) bush(g, mx + side * mw * (0.55 + r() * 0.3), baseY - mh * 0.3, 50 + r() * 35, r() < 0.5 ? C.bush : C.bush2, r);
      if (r() < 0.4) stone(g, mx - side * mw * (0.4 + r() * 0.3), baseY - mh * 0.2, 50 + r() * 40, 28 + r() * 14, C.stone);
      x += (glyph.w + LETTER_GAP + (r() - 0.4) * 0.16) * lh;
    });
  }

  function mounds(g, list, color, o) {
    list.forEach(function (m) {
      clay(g, function (g) { g.beginPath(); g.ellipse(m.x, m.y, m.rx, m.ry, 0, Math.PI, 0); g.lineTo(m.x + m.rx, m.y + 600); g.lineTo(m.x - m.rx, m.y + 600); g.closePath(); },
        color, [m.x - m.rx, m.y - m.ry, m.rx * 2, m.ry * 1.6], o);
    });
  }

  // A tile of width P (scene units) that repeats, drawn at device resolution.
  function makeTile(P, top, bottom, blur, draw) {
    var pad = Math.ceil(blur * 3) + 2;
    var big = document.createElement("canvas");
    big.width = Math.ceil(P * K) + pad * 2; big.height = Math.ceil((bottom - top) * K);
    var g = big.getContext("2d");
    g.translate(pad, 0); g.scale(K, K); g.translate(0, -top);
    // Drawn three times, so things that cross the edge of the tile wrap around.
    // The middle copy first, so the meadow lies under everything.
    [0, -P, P].forEach(function (dx) { g.save(); g.translate(dx, 0); draw(g, dx); g.restore(); });
    var tile = document.createElement("canvas");
    tile.width = Math.ceil(P * K); tile.height = big.height;
    var tg = tile.getContext("2d");
    if (blur > 0) tg.filter = "blur(" + blur + "px)";
    tg.drawImage(big, -pad, 0);
    return { P: P, top: top, bottom: bottom, tile: tile };
  }

  function buildLayers() {
    var haze = C.haze;
    layers = [];
    // Far hills: pale and hazy.
    layers.push(makeTile(1920, 560, 1300, 3 * K, function (g) {
      var r = rng(11);
      var list = [0, 1, 2, 3].map(function (i) { return { x: i * 480 + r() * 120, y: 960 + r() * 60, rx: 380 + r() * 160, ry: 170 + r() * 90 }; });
      mounds(g, list, mix(C.far, haze, 0.62), { shadow: 0.06, light: 0.18, dark: 0.08 });
    }));
    layers[0].factor = 0.24;
    // Mid hills with a pine here and there.
    layers.push(makeTile(3840, 640, 1300, 1.5 * K, function (g) {
      var r = rng(23);
      var list = [0, 1, 2, 3, 4].map(function (i) { return { x: i * 768 + r() * 200, y: 1080 + r() * 50, rx: 420 + r() * 200, ry: 160 + r() * 80 }; });
      var trees = [];
      list.forEach(function (m) {
        for (var k = 0, n = r() < 0.5 ? 1 : 2; k < n; k++) {
          var x = m.x + (r() - 0.5) * m.rx * 0.9;
          var top = m.y - m.ry * Math.sqrt(Math.max(0, 1 - Math.pow((x - m.x) / m.rx, 2)));
          trees.push({ x: x, y: top + 30, h: 140 + r() * 120 });
        }
      });
      trees.sort(function (a, b) { return a.y - b.y; });
      trees.forEach(function (t) { pine(g, t.x, t.y, t.h, mix(C.pine, haze, 0.3), mix(C.trunk, haze, 0.3), 0.1); });
      mounds(g, list, mix(C.mid, haze, 0.35), { shadow: 0.12, light: 0.2, dark: 0.12 });
    }));
    layers[1].factor = 0.48;
    // The PAWTUR sign, once every 9600, between the hills and the big pines.
    layers.push(makeTile(9600, 700, 1300, 0.8 * K, function (g) {
      clayWord(g, "PAWTUR", 3000, 1215, 300, rng(61));
    }));
    layers[2].factor = 0.6;
    // Near: a few big pines with a bush, far apart.
    layers.push(makeTile(5760, 420, 1300, 0, function (g) {
      var r = rng(37);
      for (var group = 0; group < 3; group++) {
        var gx = group * 1920 + r() * 400;
        var count = 1 + Math.floor(r() * 2);
        for (var i = 0; i < count; i++) pine(g, gx + i * (170 + r() * 90), 1250, 440 + r() * 260, C.pine, C.trunk);
        bush(g, gx - 140, 1250, 70 + r() * 30, C.bush, r);
      }
    }));
    layers[layers.length - 1].factor = 0.72;
    // Ground: the meadow and the sand path.
    // It goes a little below the strip, so the last row of pixels is covered.
    var groundBottom = SCENE_BOTTOM + 20;
    layers.push(makeTile(4000, 1200, groundBottom, 0, function (g, dx) {
      var P = 4000;
      var edgeTop = ridge(P, 1298, [[6, 6, 0.3], [13, 3, 1.2]]);
      var edgeBottom = ridge(P, 1418, [[5, 8, 2.0], [11, 4, 0.5]]);
      var path = function (g) {
        g.beginPath();
        for (var x = -P; x <= 2 * P; x += 10) g.lineTo(x, edgeTop(x));
        for (x = 2 * P; x >= -P; x -= 10) g.lineTo(x, edgeBottom(x));
        g.closePath();
      };
      // The meadow and the path are drawn once across all three copies, so
      // their shadows do not overlap at the edges of the tile.
      if (dx === 0) {
        var meadow = g.createLinearGradient(0, 1225, 0, groundBottom);
        meadow.addColorStop(0, C.meadow[0]); meadow.addColorStop(0.2, C.meadow[1]); meadow.addColorStop(0.93, C.meadow[2]); meadow.addColorStop(1, C.meadow[2]);
        g.fillStyle = meadow; g.fillRect(-P, 1225, 3 * P, groundBottom - 1225);
        g.fillStyle = "rgba(255,255,255,0.14)"; g.fillRect(-P, 1225, 3 * P, 8);
        g.save();
        g.shadowColor = "rgba(15,22,19,0.22)"; g.shadowBlur = 24 * K; g.shadowOffsetY = 8 * K;
        g.fillStyle = C.path; path(g); g.fill();
        g.restore();
        g.save(); path(g); g.clip();
        var tread = g.createLinearGradient(0, 1290, 0, 1425);
        tread.addColorStop(0, "rgba(255,255,255,0.4)"); tread.addColorStop(0.12, "rgba(255,255,255,0)");
        tread.addColorStop(0.75, "rgba(120,95,60,0)"); tread.addColorStop(1, "rgba(120,95,60,0.3)");
        g.fillStyle = tread; g.fillRect(-P, 1280, 3 * P, 160);
        g.restore();
      }
      var r = rng(51), i;
      for (i = 0; i < 10; i++) stone(g, r() * P, 1330 + r() * 80, 14 + r() * 16, 9 + r() * 7, r() < 0.5 ? C.pebbles[0] : C.pebbles[1]);
      for (i = 0; i < 4; i++) bush(g, r() * P, 1300 + r() * 6, 34 + r() * 26, r() < 0.5 ? C.bush : C.bush2, r, 0.2);
      for (i = 0; i < 2; i++) stone(g, r() * P, 1302, 60 + r() * 50, 34 + r() * 16, C.stone);
      for (i = 0; i < 8; i++) {
        var x = r() * P, y = r() < 0.5 ? 1275 + r() * 15 : 1470 + r() * 20;
        flower(g, x, y, r() < 0.8 ? C.flower : C.flower2, r() < 0.5 ? 1 : -1);
      }
    }));
    layers[layers.length - 1].factor = 1;
  }

  // Clay clouds that hang in the sky and bob a little. They repeat every 3840.
  function buildClouds() {
    var r = rng(5);
    clouds = [[900, 380], [2250, 330], [3150, 430]].map(function (spot) {
      var c = document.createElement("canvas");
      var cw = 640, ch = 280;
      c.width = Math.ceil(cw * K); c.height = Math.ceil(ch * K);
      var g = c.getContext("2d");
      g.scale(K, K);
      var puffs = [[170, 170, 80], [270, 130, 105], [380, 150, 90], [470, 180, 65]].map(function (p) { return [p[0], p[1] + (r() - 0.5) * 20, p[2] * (0.85 + r() * 0.3)]; });
      clay(g, function (g) {
        g.beginPath();
        puffs.forEach(function (p) { g.moveTo(p[0] + p[2], p[1]); g.arc(p[0], p[1], p[2], 0, Math.PI * 2); });
        g.roundRect(110, 170, 420, 70, 35);
      }, C.cloud, [90, 30, 460, 220], { shadow: 0.1, blur: 30, drop: 10, light: 0.3, dark: 0.1 });
      return { c: c, w: cw, h: ch, x: spot[0] - cw / 2, y: spot[1] - ch / 2, scale: 0.75 + r() * 0.4, bob: r() * Math.PI * 2, speed: 0.2 + r() * 0.15 };
    });
  }

  // ---------------------------------------------------------------------------
  // The dog and the leash.
  // ---------------------------------------------------------------------------
  var dogFrames = null;
  function loadDog() {
    if (dogFrames) return;
    dogFrames = [];
    for (var i = 0; i < DOG_FRAMES; i++) {
      var img = new Image();
      img.decoding = "async";
      // The dog appears as soon as its frames arrive, also when nothing moves.
      img.onload = function () { if (!frame) render(time()); };
      img.src = "img/walk/dog-" + String(i).padStart(2, "0") + ".webp";
      dogFrames.push(img);
    }
  }

  function dogFrame(t) { return Math.floor(t * DOG_FPS + 1e-6) % DOG_FRAMES; }
  function dogPoint(x, y) { return { x: dogX + (x - DOG_CENTER_X) * DOG_SCALE, y: GROUND_Y + (y - DOG_FLOOR_Y) * DOG_SCALE }; }

  function drawDog(g, t) {
    g.fillStyle = "rgba(15,22,19,0.16)";
    g.beginPath(); g.ellipse(dogX - 20, GROUND_Y + 4, 400, 26, 0, 0, Math.PI * 2); g.fill();
    var img = dogFrames && dogFrames[dogFrame(t)];
    if (!img || !img.complete || !img.naturalWidth) return;
    var p = dogPoint(0, 0);
    if (C.dogShade) g.filter = C.dogShade;
    g.drawImage(img, p.x, p.y, img.naturalWidth * FRAME_SCALE * DOG_SCALE, img.naturalHeight * FRAME_SCALE * DOG_SCALE);
    g.filter = "none";
  }

  function drawLeash(g, t) {
    var step = t / PERSON_STEP * 2 * Math.PI, drift = t / 24 * 2 * Math.PI;
    var h = {
      x: dogX - 620 + Math.sin(step) * 22 + Math.sin(drift * 2) * 30,
      y: GROUND_Y - 1090 - Math.abs(Math.sin(step)) * 14 + Math.sin(drift * 3 + 1) * 10,
      tilt: Math.sin(step) * 0.08,
    };
    var c = DOG_COLLAR[dogFrame(t)];
    var ring = dogPoint(c[0] - 40, c[1] - 24);
    var loopH = 120, loopW = 46;
    var bottom = { x: h.x + Math.sin(h.tilt) * loopH, y: h.y + Math.cos(h.tilt) * loopH };
    var d = Math.hypot(ring.x - bottom.x, ring.y - bottom.y);
    var sag = Math.sqrt(Math.max(0, 3 * d * (LEASH_LENGTH - d) / 8));
    var sway = Math.sin(step - 1.4) * 18;
    var cx = (bottom.x + ring.x) / 2 + sway, cy = (bottom.y + ring.y) / 2 + sag * 2;

    function stroke(color, width) {
      g.strokeStyle = color; g.lineWidth = width; g.lineCap = "round";
      g.beginPath(); g.moveTo(bottom.x, bottom.y); g.quadraticCurveTo(cx, cy, ring.x, ring.y - 12); g.stroke();
    }
    stroke("rgba(15,22,19,0.25)", 27);
    stroke(C.leash, 20);
    stroke("rgba(255,255,255,0.18)", 4);

    g.save();
    g.translate(h.x, h.y);
    g.rotate(-h.tilt);
    g.lineWidth = 20; g.strokeStyle = C.leash;
    g.beginPath();
    g.moveTo(0, loopH);
    g.bezierCurveTo(-loopW, loopH * 0.6, -loopW * 0.9, 0, 0, 0);
    g.bezierCurveTo(loopW * 0.9, 0, loopW, loopH * 0.6, 0, loopH);
    g.stroke();
    g.fillStyle = C.stitch;
    g.fillRect(-11, loopH - 34, 22, 40);
    g.restore();

    g.save();
    g.translate(ring.x, ring.y - 18);
    g.rotate(Math.atan2(cy - ring.y, cx - ring.x) + Math.PI / 2);
    g.strokeStyle = C.clip; g.lineWidth = 10;
    g.beginPath(); g.ellipse(0, 0, 13, 24, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // Frame.
  // ---------------------------------------------------------------------------
  function render(t) {
    var g = ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(K, 0, 0, K, 0, -SCENE_TOP * K);

    var sky = g.createLinearGradient(0, SCENE_TOP, 0, 1150);
    sky.addColorStop(0, C.page); sky.addColorStop(1, C.sky);
    g.fillStyle = sky; g.fillRect(0, SCENE_TOP, sceneWidth, SCENE_BOTTOM - SCENE_TOP);
    var gx = sceneWidth * 0.78, gy = 520;
    var glow = g.createRadialGradient(gx, gy, 0, gx, gy, 480);
    glow.addColorStop(0, "rgba(" + C.glow + "," + C.glowAlpha + ")"); glow.addColorStop(1, "rgba(" + C.glow + ",0)");
    g.fillStyle = glow; g.fillRect(0, SCENE_TOP, sceneWidth, SCENE_BOTTOM - SCENE_TOP);
    if (C.moon) {
      clay(g, function (g) { g.beginPath(); g.arc(gx, gy, 70, 0, Math.PI * 2); }, C.moon, [gx - 70, gy - 70, 140, 140], { shadow: 0, light: 0.3, dark: 0.15 });
    }

    clouds.forEach(function (cl) {
      var a = t * cl.speed + cl.bob;
      for (var base = 0; base < sceneWidth; base += 3840) {
        g.drawImage(cl.c, base + cl.x + Math.sin(a) * 24, cl.y + Math.cos(a) * 12, cl.w * cl.scale, cl.h * cl.scale);
      }
    });

    layers.forEach(function (layer) {
      var offset = (layer.factor * SPEED * t) % layer.P;
      // Each tile overlaps the next by a device pixel, so no seam shows.
      for (var x = -offset; x < sceneWidth; x += layer.P) {
        g.drawImage(layer.tile, 0, 0, layer.tile.width, layer.tile.height, x, layer.top, layer.P + 1 / K, layer.bottom - layer.top);
      }
    });
    drawDog(g, t);
    drawLeash(g, t);

    // Fade the top edge into the page.
    var fade = g.createLinearGradient(0, SCENE_TOP, 0, SCENE_TOP + 90);
    fade.addColorStop(0, C.page); fade.addColorStop(1, C.page + "00");
    g.fillStyle = fade; g.fillRect(0, SCENE_TOP, sceneWidth, 90);
  }

  // ---------------------------------------------------------------------------
  // Size, colors and when to run.
  // ---------------------------------------------------------------------------
  function layout() {
    var rect = strip.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    K = rect.height / (SCENE_BOTTOM - SCENE_TOP) * dpr;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    sceneWidth = canvas.width / K;
    // The dog and the handle of the leash, together, in the middle.
    dogX = sceneWidth / 2 + 180;
    buildLayers();
    buildClouds();
    render(time());
  }

  var start = performance.now(), visible = false, frame = 0;
  function time() { return reducedQuery.matches ? 0.35 : (performance.now() - start) / 1000; }

  function tick() {
    frame = 0;
    if (!visible || reducedQuery.matches) return;
    render(time());
    frame = requestAnimationFrame(tick);
  }
  function run() {
    if (visible && !reducedQuery.matches && !frame) frame = requestAnimationFrame(tick);
    else render(time());
  }

  new IntersectionObserver(function (entries) {
    var entry = entries[entries.length - 1];
    if (entry.isIntersecting) loadDog();
    visible = entry.isIntersecting;
    run();
  }, { rootMargin: "300px 0px" }).observe(strip);

  var resizeTimer = 0;
  new ResizeObserver(function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  }).observe(strip);

  darkQuery.addEventListener("change", function () {
    C = darkQuery.matches ? PALETTES.dark : PALETTES.light;
    layout();
  });
  reducedQuery.addEventListener("change", run);
})();
