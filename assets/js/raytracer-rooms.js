(function () {
  const nextLink = document.querySelector(".ray-next");
  const moveButtons = document.querySelectorAll("[data-move]");
  const zoomButtons = document.querySelectorAll("[data-zoom]");
  const panel = document.querySelector(".ray-panel");
  const header = document.querySelector(".site-header");

  const controls = {
    x: 0,
    y: 0,
    zoom: 1,
    maxX: 4800,
    maxY: 4800
  };

  const keys = new Set();
  const touchPoints = new Map();
  let dragPointerId = null;
  let dragLastX = 0;
  let dragLastY = 0;
  let pinchStartDistance = null;
  let pinchStartZoom = 1;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clampZoom(value) {
    return Math.max(0.18, Math.min(8, value));
  }

  let roomSeed = new URLSearchParams(window.location.search).get("seed") || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const roomDepth = 1;
  let rng = null;
  let config = null;
  let tunnelShader = null;
  let framesSinceConfig = 0;
  let runtimeRejects = 0;
  let autoRejectBudget = 0;
  let configVersion = 0;

  function getHeaderOffset() {
    return Math.max(0, Math.round(header?.getBoundingClientRect().height || 84));
  }

  function getViewportHeight() {
    return Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
  }

  function getCanvasHeight() {
    return Math.max(320, getViewportHeight() - getHeaderOffset());
  }

  function syncLayoutMetrics() {
    document.body.style.setProperty("--ray-header-offset", `${getHeaderOffset()}px`);
  }

  function updateSeedInUrl(seed) {
    const url = new URL(window.location.href);
    url.searchParams.set("seed", seed);
    window.history.replaceState({}, "", url.toString());
  }

  function nextRoom() {
    const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    autoRejectBudget = 0;
    rebuildRoom(seed);
  }

  function isInsidePanel(target) {
    return panel ? panel.contains(target) : false;
  }

  function touchDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === " ") {
      event.preventDefault();
      nextRoom();
      return;
    }
    const key = event.key.toLowerCase();
    if (["4", "5", "6", "7", "8", "9", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
      event.preventDefault();
      keys.add(key);
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
  });

  if (nextLink) {
    nextLink.addEventListener("click", (event) => {
      event.preventDefault();
      nextRoom();
    });
  }

  function setMovePressed(direction, pressed) {
    const key = { up: "8", left: "4", down: "5", right: "6" }[direction];
    if (!key) return;
    if (pressed) keys.add(key);
    else keys.delete(key);
  }

  moveButtons.forEach((buttonEl) => {
    const direction = buttonEl.getAttribute("data-move");
    const press = () => setMovePressed(direction, true);
    const release = () => setMovePressed(direction, false);
    buttonEl.addEventListener("pointerdown", press);
    buttonEl.addEventListener("pointerup", release);
    buttonEl.addEventListener("pointerleave", release);
    buttonEl.addEventListener("pointercancel", release);
  });

  zoomButtons.forEach((buttonEl) => {
    const key = buttonEl.getAttribute("data-zoom") === "in" ? "9" : "7";
    const press = () => keys.add(key);
    const release = () => keys.delete(key);
    buttonEl.addEventListener("pointerdown", press);
    buttonEl.addEventListener("pointerup", release);
    buttonEl.addEventListener("pointerleave", release);
    buttonEl.addEventListener("pointercancel", release);
  });

  window.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (isInsidePanel(event.target)) return;

    if (touchPoints.size === 1) {
      dragPointerId = event.pointerId;
      dragLastX = event.clientX;
      dragLastY = event.clientY;
    }

    if (touchPoints.size === 2) {
      const points = [...touchPoints.values()];
      pinchStartDistance = touchDistance(points[0], points[1]);
      pinchStartZoom = controls.zoom;
      dragPointerId = null;
    }
  }, { passive: true });

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "touch" || !touchPoints.has(event.pointerId)) return;
    touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (touchPoints.size === 2 && pinchStartDistance) {
      const points = [...touchPoints.values()];
      controls.zoom = clampZoom(pinchStartZoom * (touchDistance(points[0], points[1]) / Math.max(1, pinchStartDistance)));
      return;
    }

    if (touchPoints.size === 1 && dragPointerId === event.pointerId && !isInsidePanel(event.target)) {
      const dx = event.clientX - dragLastX;
      const dy = event.clientY - dragLastY;
      const dragScale = 1 / Math.max(0.3, controls.zoom);
      const touchBoost = window.matchMedia("(max-width: 700px)").matches ? 5.2 : 3.2;
      controls.x = clamp(controls.x + dx * dragScale * touchBoost, -controls.maxX, controls.maxX);
      controls.y = clamp(controls.y + dy * dragScale * touchBoost, -controls.maxY, controls.maxY);
      dragLastX = event.clientX;
      dragLastY = event.clientY;
    }
  }, { passive: true });

  function endPointer(event) {
    if (event.pointerType !== "touch") return;
    touchPoints.delete(event.pointerId);
    if (touchPoints.size < 2) pinchStartDistance = null;
    if (dragPointerId === event.pointerId) dragPointerId = null;
    if (touchPoints.size === 1) {
      const [id, point] = [...touchPoints.entries()][0];
      dragPointerId = id;
      dragLastX = point.x;
      dragLastY = point.y;
    }
  }

  window.addEventListener("pointerup", endPointer, { passive: true });
  window.addEventListener("pointercancel", endPointer, { passive: true });

  function animateControls() {
    const dt = Math.min(0.04, 1 / 60);
    const moveSpeed = 540 / Math.max(0.55, Math.sqrt(controls.zoom));
    if (keys.has("4") || keys.has("arrowleft")) controls.x = clamp(controls.x - moveSpeed * dt, -controls.maxX, controls.maxX);
    if (keys.has("6") || keys.has("arrowright")) controls.x = clamp(controls.x + moveSpeed * dt, -controls.maxX, controls.maxX);
    if (keys.has("8") || keys.has("arrowup")) controls.y = clamp(controls.y + moveSpeed * dt, -controls.maxY, controls.maxY);
    if (keys.has("5") || keys.has("arrowdown")) controls.y = clamp(controls.y - moveSpeed * dt, -controls.maxY, controls.maxY);
    if (keys.has("7")) controls.zoom *= 1 - 1.6 * dt;
    if (keys.has("9")) controls.zoom *= 1 + 1.6 * dt;
    controls.zoom = clampZoom(controls.zoom);
    requestAnimationFrame(animateControls);
  }

  function hashSeed(input) {
    let h = 1779033703 ^ input.length;
    for (let i = 0; i < input.length; i += 1) {
      h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return h >>> 0;
    };
  }

  function mulberry32(seed) {
    return function () {
      let t = seed += 0x6d2b79f5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function resetRng(seed) {
    roomSeed = seed;
    const seedGen = hashSeed(`${roomSeed}-${roomDepth}-${location.pathname}`);
    rng = mulberry32(seedGen());
  }

  function rr(min, max) {
    return min + (max - min) * rng();
  }

  function ri(min, max) {
    return Math.floor(rr(min, max + 1));
  }

  function rgbSpread() {
    let minV = Infinity;
    let maxV = -Infinity;
    for (let i = 0; i < arguments.length; i += 1) {
      const color = arguments[i];
      for (let j = 0; j < color.length; j += 1) {
        minV = Math.min(minV, color[j]);
        maxV = Math.max(maxV, color[j]);
      }
    }
    return maxV - minV;
  }

  function channelDistance(a, b) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  }

  function createConfig() {
    return {
      sceneMode: ri(0, 7),
      colorMode: ri(0, 9),
      cameraMode: ri(0, 2),
      speed: rr(0.24, 0.96),
      repeat: rr(1.2, 4.3),
      radius: rr(0.2, 0.82),
      radiusB: rr(0.12, 0.64),
      pulse: rr(0.05, 0.42),
      warp: rr(0.45, 2.6),
      twist: rr(0.12, 3.3),
      ridge: rr(0.05, 0.92),
      noiseGain: rr(8, 34),
      uvX: rr(0.82, 1.42),
      uvY: rr(0.82, 1.42),
      march: ri(64, 96),
      ambient: rr(0.15, 0.34),
      accent: rr(0.12, 0.42),
      fog: rr(40, 260),
      colorFreqA: rr(5, 30),
      colorFreqB: rr(0.35, 4.8),
      tunnelTilt: rr(-0.42, 0.42),
      tunnelShear: rr(0.02, 0.9),
      repeatMix: rr(0.28, 1.55),
      cutMix: rr(0.16, 1.3),
      tintA: [rr(0.22, 1.7), rr(0.18, 1.6), rr(0.2, 1.9)],
      tintB: [rr(0.18, 1.7), rr(0.14, 1.5), rr(0.14, 1.6)],
      tintC: [rr(0.16, 1.55), rr(0.16, 1.55), rr(0.16, 1.55)]
    };
  }

  function scoreConfig(cfg) {
    const contrastAB = channelDistance(cfg.tintA, cfg.tintB);
    const contrastBC = channelDistance(cfg.tintB, cfg.tintC);
    const spread = rgbSpread(cfg.tintA, cfg.tintB, cfg.tintC) * 180;
    const geometry = cfg.repeat * 12 + cfg.radius * 40 + cfg.radiusB * 30 + cfg.pulse * 90 + cfg.noiseGain + cfg.twist * 18 + cfg.ridge * 50 + cfg.cutMix * 20;
    const motion = cfg.speed * 20 + cfg.warp * 16 + cfg.repeatMix * 18;
    const brightness = cfg.ambient * 140 + cfg.accent * 60 + cfg.fog * 0.18;
    const score = contrastAB * 18 + contrastBC * 12 + spread * 0.45 + geometry + motion + cfg.march * 1.1 + brightness;
    const accepted = contrastAB > 0.95 && contrastBC > 0.55 && spread > 155 && geometry > 105 && cfg.ambient > 0.14;
    return { score, accepted };
  }

  function pickConfig() {
    let best = null;
    for (let i = 0; i < 64; i += 1) {
      const cfg = createConfig();
      const quality = scoreConfig(cfg);
      if (!best || quality.score > best.score) {
        best = { cfg, score: quality.score, accepted: quality.accepted };
      }
      if (quality.accepted && quality.score > 170) {
        break;
      }
    }
    return best.cfg;
  }

  function buildShader(nextConfig) {
    const shaderConfig = nextConfig;
    const vertexShader = `
      attribute vec3 aPosition;
      void main() {
        gl_Position = vec4(aPosition, 1.0);
      }
    `;

    const fragmentShader = `
      precision mediump float;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform vec2 uView;
      uniform float uZoom;
      uniform float uRepeat;
      uniform float uRadius;
      uniform float uRadiusB;
      uniform float uPulse;
      uniform float uWarp;
      uniform float uNoiseGain;
      uniform vec2 uUvScale;
      uniform float uTwist;
      uniform float uRidge;
      uniform float uFog;
      uniform float uColorFreqA;
      uniform float uColorFreqB;
      uniform float uAmbient;
      uniform float uAccent;
      uniform float uTunnelTilt;
      uniform float uTunnelShear;
      uniform float uRepeatMix;
      uniform float uCutMix;
      uniform vec3 uTintA;
      uniform vec3 uTintB;
      uniform vec3 uTintC;

      float sdSphere(vec3 p, float r) {
        return length(p) - r;
      }

      float sdTorus(vec3 p, vec2 t) {
        vec2 q = vec2(length(p.xy) - t.x, p.z);
        return length(q) - t.y;
      }

      float sdBox(vec3 p, vec3 b) {
        vec3 q = abs(p) - b;
        return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
      }

      float sdCylinder(vec3 p, vec2 h) {
        vec2 d = abs(vec2(length(p.xy), p.z)) - h;
        return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
      }

      mat2 rot(float a) {
        return mat2(cos(a), -sin(a), sin(a), cos(a));
      }

      float shapeField(vec3 p) {
        float a = sdSphere(p, uRadius + uPulse * sin(p.z * (2.0 + uWarp) + uTime * 0.7));
        float b = sdTorus(p, vec2(uRadius * (1.15 + uWarp * 0.25), uRadiusB * (0.25 + uRidge)));
        float c = sdBox(p, vec3(uRadius * (0.8 + uCutMix), uRadius * (0.24 + uRidge), uRadius * (0.7 + uWarp * 0.3)));
        float d = sdCylinder(p, vec2(uRadius * (0.4 + uRepeatMix * 0.3), uRadius * (1.2 + uCutMix * 0.4)));
        if (${shaderConfig.sceneMode} == 0) return min(a, b);
        if (${shaderConfig.sceneMode} == 1) return min(max(a, -b * 0.8), c);
        if (${shaderConfig.sceneMode} == 2) return min(c, d);
        if (${shaderConfig.sceneMode} == 3) return min(a, max(b, -d * 0.7));
        if (${shaderConfig.sceneMode} == 4) return min(max(c, -a * 0.65), b);
        if (${shaderConfig.sceneMode} == 5) return min(d, a);
        if (${shaderConfig.sceneMode} == 6) return min(max(d, -b * 0.7), c);
        return min(a, min(b, min(c, d)));
      }

      float scene(vec3 p) {
        p.xy *= rot(p.z * (0.12 + uTwist * 0.1));
        p.x += sin(p.z * (0.35 + uWarp * 0.2)) * uTunnelTilt;
        p.y += cos(p.z * (0.28 + uTwist * 0.18)) * uTunnelShear;
        p = mod(p + uRepeat + sin(p * (0.45 + uWarp * 0.35)), uRepeat * (1.05 + uRepeatMix * 0.35)) - (uRepeat * (0.525 + uRepeatMix * 0.175));
        vec3 q = p;
        q.xy *= rot(p.z * (0.16 + uTwist * 0.12));
        q.xz *= rot(p.y * 0.08 + uWarp * 0.35);
        return shapeField(q);
      }

      vec3 paletteA(float t, vec3 weird, float fog) {
        return vec3(fog + 0.18, 0.72 + sin(t * uColorFreqA) * 1.55, (weird.y + 4.0) * 0.05 * tan(weird.y * max(t, 0.001)));
      }

      vec3 paletteB(float t, vec3 weird) {
        return vec3(abs(sin(t * uColorFreqA + weird.x * 1.2)), abs(cos(t * (uColorFreqA * 0.5) + weird.y * 0.8)), abs(sin(t * (uColorFreqA * 0.75) + weird.z * 1.4)));
      }

      vec3 paletteC(float t, vec3 weird) {
        return vec3(0.4 + 0.6 * sin(t * uColorFreqB + weird.x * 0.9), 0.4 + 0.6 * sin(t * (uColorFreqB + 0.7) + weird.y * 1.2), 0.4 + 0.6 * sin(t * (uColorFreqB + 1.4) + weird.z * 1.4));
      }

      void main() {
        vec2 uv = (((2.0 * gl_FragCoord.xy - uResolution.xy) / min(uResolution.x, uResolution.y)) / uZoom) * uUvScale;
        vec3 ro;
        if (${shaderConfig.cameraMode} == 0) ro = vec3(uView.x + sin(uTime * 0.22) * 0.45, uView.y + cos(uTime * 0.17) * 0.35, -4.5 + uTime * ${shaderConfig.speed.toFixed(4)});
        else if (${shaderConfig.cameraMode} == 1) ro = vec3(uView.x + sin(uTime * 0.35) * 0.85, uView.y + cos(uTime * 0.24) * 0.7, -4.0 + uTime * ${shaderConfig.speed.toFixed(4)});
        else ro = vec3(uView.x + cos(uTime * 0.18) * 1.15, uView.y + sin(uTime * 0.21) * 0.8, -5.2 + uTime * ${shaderConfig.speed.toFixed(4)});

        vec3 rd = normalize(vec3(uv * vec2(0.95, 1.08), 1.2));
        float t = 0.0;
        float glow = 0.0;
        float hit = 0.0;
        vec3 hitP = ro;

        for (int i = 0; i < ${shaderConfig.march}; i++) {
          vec3 p = ro + rd * t;
          float d = scene(p);
          glow += 0.03 / (0.03 + d * d * uNoiseGain);
          if (d < 0.005 || t > 38.0) {
            hit = t;
            hitP = p;
            break;
          }
          t += max(0.01, d * (0.62 + uWarp * 0.08));
        }

        float fog = uFog / (18.0 + hit * hit * (0.6 + 0.4 * sin(hit * hit * 0.9)));
        vec3 weird = tan(hitP + sin(hit * 22.0));
        vec3 a = paletteA(hit, weird, fog);
        vec3 b = paletteB(hit, weird);
        vec3 c = paletteC(hit, weird);

        vec3 color = vec3(uAmbient * 1.05, uAmbient, uAmbient + uAccent * 0.7);
        if (${shaderConfig.colorMode} == 0) color += glow * (a * uTintA + b * uTintB * 0.45);
        else if (${shaderConfig.colorMode} == 1) color += glow * (b * uTintA * 0.95 + c * uTintB * 0.75);
        else if (${shaderConfig.colorMode} == 2) color += glow * (abs(a / atan(max(0.15, weird.x * weird.y * 0.75))) * uTintA * 0.24 + c * uTintB * 0.66);
        else if (${shaderConfig.colorMode} == 3) color += glow * (vec3(a.r, c.g, b.b) * uTintA + vec3(c.r, b.g, a.b) * uTintB * 0.58);
        else if (${shaderConfig.colorMode} == 4) color += glow * (c * uTintA * 0.84 + (0.5 + 0.5 * sin(vec3(2.0, 3.0, 4.0) * (uTime * 0.4 + glow))) * uTintB);
        else if (${shaderConfig.colorMode} == 5) color += glow * (a * uTintA * 0.32 + b * uTintB * 0.46 + c * uTintC * 0.62);
        else if (${shaderConfig.colorMode} == 6) color += glow * (vec3(b.r, a.g, c.b) * uTintA * 0.75 + vec3(c.r, a.b, b.g) * uTintC * 0.7);
        else if (${shaderConfig.colorMode} == 7) color += glow * ((0.35 + 0.65 * sin(vec3(1.0, 2.3, 4.2) * (hit * 0.2 + uTime * 0.12))) * uTintA + c * uTintC * 0.82);
        else if (${shaderConfig.colorMode} == 8) color += glow * (vec3(c.r, a.r, b.g) * uTintA * 0.64 + vec3(a.b, c.g, b.b) * uTintB * 0.72 + c * uTintC * 0.4);
        else color += glow * (a * uTintA * 0.2 + (b + c) * uTintB * 0.38 + abs(sin(vec3(4.0, 5.0, 6.0) * (glow + hit * 0.1))) * uTintC * 0.9);

        color += 0.18 * vec3(length(uv) * 0.7, 0.12, 0.18);
        color = max(color, vec3(uAmbient + 0.025, uAmbient + 0.02, uAmbient + uAccent * 0.36));
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    tunnelShader = createShader(vertexShader, fragmentShader);
  }

  function rebuildRoom(seed) {
    resetRng(seed || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    updateSeedInUrl(roomSeed);
    config = pickConfig();
    configVersion += 1;
    framesSinceConfig = 0;
    runtimeRejects = autoRejectBudget;
    controls.x = 0;
    controls.y = 0;
    controls.zoom = 1;
    if (typeof createShader === "function") {
      buildShader(config);
    }
  }

  window.setup = function setup() {
    syncLayoutMetrics();
    const canvas = createCanvas(window.innerWidth, getCanvasHeight(), WEBGL);
    canvas.parent("canvas-shell");
    noStroke();
    rebuildRoom(roomSeed);
    animateControls();
  };

  function sampleRegion(gl, left, bottom, sampleWidth, sampleHeight) {
    const pixels = new Uint8Array(sampleWidth * sampleHeight * 4);
    gl.readPixels(left, bottom, sampleWidth, sampleHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let total = 0;
    let maxLum = 0;
    let colorful = 0;
    let bright = 0;
    const count = sampleWidth * sampleHeight;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      total += lum;
      maxLum = Math.max(maxLum, lum);
      if (Math.max(r, g, b) - Math.min(r, g, b) > 22) colorful += 1;
      if (lum > 34) bright += 1;
    }
    return {
      avgLum: total / count,
      maxLum,
      colorfulRatio: colorful / count,
      brightRatio: bright / count
    };
  }

  function frameLooksWeak() {
    const gl = drawingContext;
    if (!gl || typeof gl.readPixels !== "function") return false;
    const sampleWidth = Math.max(12, Math.floor(width / 14));
    const sampleHeight = Math.max(12, Math.floor(height / 14));
    const anchors = [
      [0.5, 0.5],
      [0.25, 0.5],
      [0.75, 0.5],
      [0.5, 0.25],
      [0.5, 0.75]
    ];
    let avgLum = 0;
    let maxLum = 0;
    let colorfulRatio = 0;
    let brightRatio = 0;
    for (const [ax, ay] of anchors) {
      const left = Math.max(0, Math.min(width - sampleWidth, Math.floor(width * ax - sampleWidth / 2)));
      const bottom = Math.max(0, Math.min(height - sampleHeight, Math.floor(height * (1 - ay) - sampleHeight / 2)));
      const sample = sampleRegion(gl, left, bottom, sampleWidth, sampleHeight);
      avgLum += sample.avgLum;
      maxLum = Math.max(maxLum, sample.maxLum);
      colorfulRatio += sample.colorfulRatio;
      brightRatio += sample.brightRatio;
    }
    avgLum /= anchors.length;
    colorfulRatio /= anchors.length;
    brightRatio /= anchors.length;
    return avgLum < 24 || maxLum < 70 || colorfulRatio < 0.05 || brightRatio < 0.09;
  }

  window.draw = function draw() {
    if (!tunnelShader || !config) return;
    resetMatrix();
    shader(tunnelShader);
    tunnelShader.setUniform("uResolution", [width, height]);
    tunnelShader.setUniform("uTime", frameCount * 0.03);
    tunnelShader.setUniform("uView", [controls.x * 0.0025, controls.y * 0.0025]);
    tunnelShader.setUniform("uZoom", controls.zoom);
    tunnelShader.setUniform("uRepeat", config.repeat);
    tunnelShader.setUniform("uRadius", config.radius);
    tunnelShader.setUniform("uRadiusB", config.radiusB);
    tunnelShader.setUniform("uPulse", config.pulse);
    tunnelShader.setUniform("uWarp", config.warp);
    tunnelShader.setUniform("uNoiseGain", config.noiseGain);
    tunnelShader.setUniform("uUvScale", [config.uvX, config.uvY]);
    tunnelShader.setUniform("uTwist", config.twist);
    tunnelShader.setUniform("uRidge", config.ridge);
    tunnelShader.setUniform("uFog", config.fog);
    tunnelShader.setUniform("uColorFreqA", config.colorFreqA);
    tunnelShader.setUniform("uColorFreqB", config.colorFreqB);
    tunnelShader.setUniform("uAmbient", config.ambient);
    tunnelShader.setUniform("uAccent", config.accent);
    tunnelShader.setUniform("uTunnelTilt", config.tunnelTilt);
    tunnelShader.setUniform("uTunnelShear", config.tunnelShear);
    tunnelShader.setUniform("uRepeatMix", config.repeatMix);
    tunnelShader.setUniform("uCutMix", config.cutMix);
    tunnelShader.setUniform("uTintA", config.tintA);
    tunnelShader.setUniform("uTintB", config.tintB);
    tunnelShader.setUniform("uTintC", config.tintC);
    beginShape(TRIANGLE_STRIP);
    vertex(-1, -1, 0);
    vertex(1, -1, 0);
    vertex(-1, 1, 0);
    vertex(1, 1, 0);
    endShape();

    framesSinceConfig += 1;
    if (framesSinceConfig === 10 || framesSinceConfig === 18) {
      const versionAtSample = configVersion;
      setTimeout(() => {
        if (versionAtSample !== configVersion || runtimeRejects >= 6) return;
        if (frameLooksWeak()) {
          autoRejectBudget += 1;
          runtimeRejects = autoRejectBudget;
          rebuildRoom(`${roomSeed}-retry-${runtimeRejects}-${Math.random().toString(36).slice(2, 6)}`);
        }
      }, 0);
    }
  };

  window.windowResized = function windowResized() {
    syncLayoutMetrics();
    resizeCanvas(window.innerWidth, getCanvasHeight());
  };

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      syncLayoutMetrics();
      if (typeof resizeCanvas === "function") {
        resizeCanvas(window.innerWidth, getCanvasHeight());
      }
    });
  }
})();
