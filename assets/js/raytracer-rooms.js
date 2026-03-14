(function () {
  const nextLink = document.querySelector(".ray-next");
  const moveButtons = document.querySelectorAll("[data-move]");
  const zoomButtons = document.querySelectorAll("[data-zoom]");
  const panel = document.querySelector(".ray-panel");

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

  function nextRoom() {
    if (!nextLink) return;
    const url = new URL(nextLink.href, window.location.href);
    url.searchParams.set("seed", `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    window.location.href = url.toString();
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
      controls.x = clamp(controls.x + dx * dragScale * 2.2, -controls.maxX, controls.maxX);
      controls.y = clamp(controls.y + dy * dragScale * 2.2, -controls.maxY, controls.maxY);
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

  const roomSeed = new URLSearchParams(window.location.search).get("seed") || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const roomDepth = 1;
  const seedGen = hashSeed(`${roomSeed}-${roomDepth}-${location.pathname}`);
  const rng = mulberry32(seedGen());

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
      colorMode: ri(0, 7),
      cameraMode: ri(0, 4),
      speed: rr(0.18, 1.15),
      repeat: rr(1.4, 5.8),
      radius: rr(0.14, 0.72),
      radiusB: rr(0.08, 0.54),
      pulse: rr(0.03, 0.34),
      warp: rr(0.3, 2.2),
      twist: rr(0.08, 2.6),
      ridge: rr(0.02, 0.7),
      noiseGain: rr(14, 58),
      uvX: rr(0.62, 1.6),
      uvY: rr(0.62, 1.6),
      march: ri(52, 90),
      ambient: rr(0.08, 0.24),
      accent: rr(0.06, 0.34),
      fog: rr(20, 220),
      colorFreqA: rr(4, 36),
      colorFreqB: rr(0.25, 4.2),
      tunnelTilt: rr(-0.8, 0.8),
      tunnelShear: rr(0, 1.2),
      repeatMix: rr(0.2, 1.4),
      cutMix: rr(0.1, 1.2),
      tintA: [rr(0.12, 1.45), rr(0.12, 1.4), rr(0.15, 1.65)],
      tintB: [rr(0.08, 1.45), rr(0.08, 1.15), rr(0.08, 1.3)],
      tintC: [rr(0.08, 1.35), rr(0.08, 1.35), rr(0.08, 1.35)]
    };
  }

  function scoreConfig(cfg) {
    const contrastAB = channelDistance(cfg.tintA, cfg.tintB);
    const contrastBC = channelDistance(cfg.tintB, cfg.tintC);
    const spread = rgbSpread(cfg.tintA, cfg.tintB, cfg.tintC) * 180;
    const geometry = cfg.repeat * 12 + cfg.radius * 40 + cfg.radiusB * 30 + cfg.pulse * 90 + cfg.noiseGain + cfg.twist * 18 + cfg.ridge * 50 + cfg.cutMix * 20;
    const motion = cfg.speed * 20 + cfg.warp * 16 + cfg.repeatMix * 18;
    const score = contrastAB * 16 + contrastBC * 10 + spread * 0.4 + geometry + motion + cfg.march * 0.9 + cfg.ambient * 90;
    const accepted = contrastAB > 0.7 && spread > 125 && geometry > 90 && cfg.ambient > 0.095;
    return { score, accepted };
  }

  function pickConfig() {
    let best = null;
    for (let i = 0; i < 42; i += 1) {
      const cfg = createConfig();
      const quality = scoreConfig(cfg);
      if (!best || quality.score > best.score) {
        best = { cfg, score: quality.score, accepted: quality.accepted };
      }
      if (quality.accepted && quality.score > 112) {
        break;
      }
    }
    return best.cfg;
  }

  const config = pickConfig();
  let tunnelShader;

  function setup() {
    const canvas = createCanvas(window.innerWidth, Math.max(320, window.innerHeight - 84), WEBGL);
    canvas.parent("canvas-shell");
    noStroke();

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
        if (${config.sceneMode} == 0) return min(a, b);
        if (${config.sceneMode} == 1) return min(max(a, -b * 0.8), c);
        if (${config.sceneMode} == 2) return min(c, d);
        if (${config.sceneMode} == 3) return min(a, max(b, -d * 0.7));
        if (${config.sceneMode} == 4) return min(max(c, -a * 0.65), b);
        if (${config.sceneMode} == 5) return min(d, a);
        if (${config.sceneMode} == 6) return min(max(d, -b * 0.7), c);
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
        return vec3(fog + 0.12, 0.65 + sin(t * uColorFreqA) * 1.6, (weird.y + 4.0) * 0.05 * tan(weird.y * max(t, 0.001)));
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
        if (${config.cameraMode} == 0) ro = vec3(uView.x, uView.y, -5.0 + uTime * ${config.speed.toFixed(4)});
        else if (${config.cameraMode} == 1) ro = vec3(uView.x + sin(uTime * 0.35) * 1.2, uView.y + cos(uTime * 0.24) * 1.0, -4.0 + uTime * ${config.speed.toFixed(4)});
        else if (${config.cameraMode} == 2) ro = vec3(uView.x + cos(uTime * 0.18) * 2.4, uView.y + sin(uTime * 0.21) * 1.5, -6.0 + uTime * ${config.speed.toFixed(4)});
        else if (${config.cameraMode} == 3) ro = vec3(uView.x + sin(uTime * 0.5) * 0.5, uView.y, -4.5 + uTime * ${config.speed.toFixed(4)} + sin(uTime) * 0.8);
        else ro = vec3(uView.x, uView.y + cos(uTime * 0.33) * 1.4, -5.5 + uTime * ${config.speed.toFixed(4)});

        vec3 rd = normalize(vec3(uv * vec2(0.95, 1.08), 1.2));
        float t = 0.0;
        float glow = 0.0;
        float hit = 0.0;
        vec3 hitP = ro;

        for (int i = 0; i < ${config.march}; i++) {
          vec3 p = ro + rd * t;
          float d = scene(p);
          glow += 0.024 / (0.028 + d * d * uNoiseGain);
          if (d < 0.005 || t > 40.0) {
            hit = t;
            hitP = p;
            break;
          }
          t += d * (0.6 + uWarp * 0.1);
        }

        float fog = uFog / (18.0 + hit * hit * (0.6 + 0.4 * sin(hit * hit * 0.9)));
        vec3 weird = tan(hitP + sin(hit * 22.0));
        vec3 a = paletteA(hit, weird, fog);
        vec3 b = paletteB(hit, weird);
        vec3 c = paletteC(hit, weird);

        vec3 color = vec3(uAmbient, uAmbient, uAmbient + uAccent * 0.55);
        if (${config.colorMode} == 0) color += glow * (a * uTintA + b * uTintB * 0.45);
        else if (${config.colorMode} == 1) color += glow * (b * uTintA * 0.95 + c * uTintB * 0.75);
        else if (${config.colorMode} == 2) color += glow * (abs(a / atan(max(0.15, weird.x * weird.y * 0.75))) * uTintA * 0.24 + c * uTintB * 0.66);
        else if (${config.colorMode} == 3) color += glow * (vec3(a.r, c.g, b.b) * uTintA + vec3(c.r, b.g, a.b) * uTintB * 0.58);
        else if (${config.colorMode} == 4) color += glow * (c * uTintA * 0.84 + (0.5 + 0.5 * sin(vec3(2.0, 3.0, 4.0) * (uTime * 0.4 + glow))) * uTintB);
        else if (${config.colorMode} == 5) color += glow * (a * uTintA * 0.32 + b * uTintB * 0.46 + c * uTintC * 0.62);
        else if (${config.colorMode} == 6) color += glow * (vec3(b.r, a.g, c.b) * uTintA * 0.75 + vec3(c.r, a.b, b.g) * uTintC * 0.7);
        else color += glow * (a * uTintA * 0.2 + (b + c) * uTintB * 0.38 + abs(sin(vec3(4.0, 5.0, 6.0) * (glow + hit * 0.1))) * uTintC * 0.9);

        color += 0.12 * vec3(length(uv), 0.08, 0.14);
        color = max(color, vec3(uAmbient * 0.95, uAmbient * 0.92, uAmbient + uAccent * 0.3));
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    tunnelShader = createShader(vertexShader, fragmentShader);
    animateControls();
  }

  function draw() {
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
  }

  function windowResized() {
    resizeCanvas(window.innerWidth, Math.max(320, window.innerHeight - 84));
  }
})();
