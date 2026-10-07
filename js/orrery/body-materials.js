import * as THREE from '../../vendor/three/three.module.js';

const TAU = Math.PI * 2;
const clamp01 = value => Math.max(0, Math.min(1, value));

export function visualSeed(value) {
  let result = 2166136261;
  for (const letter of String(value || 'body')) result = Math.imul(result ^ letter.charCodeAt(0), 16777619);
  result ^= result >>> 16;
  result = Math.imul(result, 0x85ebca6b);
  result ^= result >>> 13;
  return result >>> 0;
}

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function rgb(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function hex([r, g, b]) {
  return (Math.round(Math.max(0, Math.min(255, r))) << 16)
    | (Math.round(Math.max(0, Math.min(255, g))) << 8)
    | Math.round(Math.max(0, Math.min(255, b)));
}

function mix(a, b, amount) {
  const aa = rgb(a), bb = rgb(b), t = clamp01(amount);
  return hex(aa.map((value, index) => value + (bb[index] - value) * t));
}

function scale(hexValue, factor) {
  return hex(rgb(hexValue).map(value => value * factor));
}

function jitter(base, seed, strength = 0.08) {
  const random = seeded(seed);
  const warmer = mix(base, 0xc98b66, random() * strength);
  const cooler = mix(warmer, 0x6f91ad, random() * strength);
  return cooler;
}

function atmosphereColour(body) {
  const text = String(body.atmosphere || '').toLowerCase();
  if (!text || text.includes('no atmosphere')) return null;
  if (text.includes('sulphur') || text.includes('sulfur')) return 0xe1ad67;
  if (text.includes('methane')) return 0x78a8aa;
  if (text.includes('ammonia')) return 0xc6c48c;
  if (text.includes('carbon dioxide')) return 0xcf9475;
  if (text.includes('water') || text.includes('suitable')) return 0x8dc9df;
  if (text.includes('nitrogen')) return 0x91aeda;
  return 0x8aaec5;
}

export function bodyVisualProfile(body) {
  const seed = visualSeed(body.id || body.name);
  const description = `${body.subType || ''} ${body.type || ''} ${body.classification || ''}`.toLowerCase();
  const temperature = Number.isFinite(body.temperatureK) ? body.temperatureK : null;
  let category = 'rocky';
  let base = 0x8e8378;
  let secondary = 0x5f5c59;
  let accent = 0xc1ad91;
  let roughness = 0.92;
  let metalness = 0.02;

  if (body.kind === 'star') {
    category = 'star';
    if ((temperature || 0) >= 20000) base = 0xb7ccff;
    else if ((temperature || 0) >= 7500) base = 0xe2ebff;
    else if ((temperature || 0) >= 6000) base = 0xfff1d8;
    else if ((temperature || 0) >= 5000) base = 0xffd78b;
    else if ((temperature || 0) >= 3500) base = 0xffad68;
    else base = 0xff8469;
    secondary = scale(base, 0.72);
    accent = mix(base, 0xffffff, 0.55);
    roughness = 1;
  } else if (description.includes('earth')) {
    category = 'earthlike';
    base = 0x2d6f8f;
    secondary = 0x587a45;
    accent = 0xe4e2c8;
    roughness = 0.82;
  } else if (description.includes('water')) {
    category = 'water';
    base = 0x376f9d;
    secondary = 0x224866;
    accent = 0xc6deea;
    roughness = 0.78;
  } else if (description.includes('ammonia')) {
    category = 'ammonia';
    base = 0x8c8262;
    secondary = 0x5f6e68;
    accent = 0xbfb58b;
    roughness = 0.84;
  } else if (description.includes('gas')) {
    category = 'gas';
    const gasClass = description.match(/class\s+([ivx]+)/)?.[1] || '';
    const palettes = {
      i:[0xc7b897,0x8f7a63,0xe7d2a3],
      ii:[0xbd9d7d,0x7c6a5b,0xdfc5a1],
      iii:[0xb99370,0x745d51,0xdec09a],
      iv:[0x9f8b84,0x655f68,0xc8aaa0],
      v:[0x8c9da7,0x566b79,0xb9c7cd],
    };
    [base, secondary, accent] = palettes[gasClass] || palettes.ii;
    roughness = 0.74;
  } else if (description.includes('rocky ice') || description.includes('rocky-ice')) {
    category = 'rocky-ice';
    base = 0x9eb1b8;
    secondary = 0x6f7c82;
    accent = 0xdce7e8;
    roughness = 0.96;
  } else if (description.includes('ice') || description.includes('icy')) {
    category = 'icy';
    base = 0xa9c5d1;
    secondary = 0x7b949e;
    accent = 0xe3f0f3;
    roughness = 0.98;
  } else if (description.includes('metal-rich') || description.includes('high metal')) {
    category = 'metal';
    base = temperature != null && temperature > 850 ? 0x8e5f4d : 0x716f69;
    secondary = temperature != null && temperature > 850 ? 0x4f3a35 : 0x44484a;
    accent = temperature != null && temperature > 850 ? 0xc28a67 : 0xa59a87;
    roughness = 0.8;
    metalness = 0.18;
  } else if (description.includes('rocky')) {
    category = 'rocky';
    if (temperature != null && temperature > 700) {
      base = 0x8f6753;
      secondary = 0x5d453d;
      accent = 0xc3916c;
    }
  }

  if (category !== 'star' && category !== 'earthlike' && category !== 'water') {
    base = jitter(base, seed, 0.09);
    secondary = jitter(secondary, seed ^ 0x51f2a2d1, 0.07);
    accent = jitter(accent, seed ^ 0x9e3779b9, 0.06);
  }

  const atmosphereColor = atmosphereColour(body);
  const atmosphereText = String(body.atmosphere || '').toLowerCase();
  const atmosphereOpacity = atmosphereColor == null ? 0
    : atmosphereText.includes('thick') ? 0.22
    : atmosphereText.includes('thin') ? 0.10
    : 0.15;

  return {
    seed,
    category,
    baseColor:base,
    secondaryColor:secondary,
    accentColor:accent,
    roughness,
    metalness,
    atmosphereColor,
    atmosphereOpacity,
    hasAtmosphere:atmosphereColor != null,
  };
}

export function bodyProxyColor(body) {
  return bodyVisualProfile(body).baseColor;
}

function terrainSignal(u, v, randomValues) {
  let value = 0;
  for (let octave = 0; octave < 4; octave++) {
    const frequency = 1 << octave;
    const phaseA = randomValues[octave * 2] * TAU;
    const phaseB = randomValues[octave * 2 + 1] * TAU;
    value += Math.sin(u * TAU * frequency + phaseA)
      * Math.cos(v * Math.PI * frequency + phaseB) / (1 << octave);
  }
  return value / 1.875;
}

function writePixel(data, index, colour, shade = 1, alpha = 255) {
  const [r, g, b] = rgb(colour);
  data[index] = Math.max(0, Math.min(255, Math.round(r * shade)));
  data[index + 1] = Math.max(0, Math.min(255, Math.round(g * shade)));
  data[index + 2] = Math.max(0, Math.min(255, Math.round(b * shade)));
  data[index + 3] = alpha;
}

function paintCraters(context, width, height, profile) {
  if (!['rocky','metal','rocky-ice','icy'].includes(profile.category)) return;
  const random = seeded(profile.seed ^ 0xa511e9b3);
  const count = profile.category === 'icy' ? 8 : 14;
  context.save();
  context.globalCompositeOperation = 'source-over';
  for (let i = 0; i < count; i++) {
    const x = random() * width;
    const y = (0.12 + random() * 0.76) * height;
    const r = (1.5 + random() * 5.5) * (width / 128);
    context.beginPath();
    context.ellipse(x, y, r * 1.4, r, 0, 0, TAU);
    context.strokeStyle = 'rgba(25,28,30,.22)';
    context.lineWidth = Math.max(0.7, r * 0.22);
    context.stroke();
    context.beginPath();
    context.ellipse(x - r * 0.15, y - r * 0.12, Math.max(0.5, r * 0.65), Math.max(0.5, r * 0.45), 0, 0, TAU);
    context.strokeStyle = 'rgba(255,255,255,.08)';
    context.lineWidth = Math.max(0.5, r * 0.15);
    context.stroke();
  }
  context.restore();
}

function paintGasFeatures(context, width, height, profile) {
  if (profile.category !== 'gas') return;
  const random = seeded(profile.seed ^ 0x73a4d91f);
  context.save();
  for (let i = 0; i < 2; i++) {
    const x = (0.15 + random() * 0.7) * width;
    const y = (0.2 + random() * 0.6) * height;
    const rx = (5 + random() * 11) * width / 128;
    const ry = rx * (0.28 + random() * 0.18);
    context.beginPath();
    context.ellipse(x, y, rx, ry, random() * 0.2 - 0.1, 0, TAU);
    context.fillStyle = i ? 'rgba(255,235,210,.10)' : 'rgba(90,50,40,.10)';
    context.fill();
  }
  context.restore();
}

function paintIceFractures(context, width, height, profile) {
  if (!['icy','rocky-ice'].includes(profile.category)) return;
  const random = seeded(profile.seed ^ 0xe6c8b913);
  context.save();
  context.strokeStyle = 'rgba(225,245,250,.18)';
  context.lineWidth = Math.max(0.6, width / 220);
  for (let line = 0; line < 5; line++) {
    const phase = random() * TAU;
    const base = (0.15 + random() * 0.7) * height;
    context.beginPath();
    for (let x = 0; x <= width; x += 4) {
      const y = base + Math.sin(x / width * TAU * (1 + line % 2) + phase) * height * (0.025 + random() * 0.005);
      if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
  }
  context.restore();
}

export function createBodyTexture(body, disposables = null) {
  const profile = bodyVisualProfile(body);
  const width = profile.category === 'gas' || profile.category === 'star' || profile.category === 'earthlike' ? 256 : 128;
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha:false });
  const image = context.createImageData(width, height);
  const random = seeded(profile.seed ^ 0x31415926);
  const noiseArgs = Array.from({ length:8 }, () => random());

  for (let y = 0; y < height; y++) {
    const v = y / Math.max(1, height - 1);
    const latitude = Math.abs(v - 0.5) * 2;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const noise = terrainSignal(u, v, noiseArgs);
      let colour = profile.baseColor;
      let shade = 1;

      if (profile.category === 'gas') {
        const band = Math.sin(v * Math.PI * 18 + noise * 2.4);
        colour = band > 0.2 ? mix(profile.baseColor, profile.accentColor, 0.12)
          : band < -0.3 ? profile.secondaryColor
          : mix(profile.baseColor, profile.accentColor, 0.38);
        shade = 0.88 + noise * 0.15;
      } else if (profile.category === 'earthlike') {
        const polarIce = latitude > 0.82;
        if (polarIce) colour = mix(profile.accentColor, 0xffffff, 0.35);
        else if (noise > 0.12) colour = noise > 0.46 ? 0x786f4e : profile.secondaryColor;
        else colour = profile.baseColor;
        shade = 0.94 + noise * 0.08;
      } else if (profile.category === 'water') {
        colour = noise > 0.55 ? mix(profile.baseColor, profile.accentColor, 0.35) : profile.baseColor;
        if (latitude > 0.88) colour = profile.accentColor;
        shade = 0.94 + noise * 0.06;
      } else if (profile.category === 'star') {
        colour = noise > 0.12 ? profile.baseColor : profile.secondaryColor;
        shade = 1.02 + noise * 0.12;
      } else {
        const threshold = noise > 0.04;
        colour = threshold ? profile.baseColor : profile.secondaryColor;
        if (noise > 0.42) colour = mix(colour, profile.accentColor, 0.62);
        if (noise < -0.48) colour = scale(colour, 0.72);
        shade = 0.78 + (noise + 1) * 0.16;
      }

      writePixel(image.data, (y * width + x) * 4, colour, shade);
    }
  }

  context.putImageData(image, 0, 0);
  paintCraters(context, width, height, profile);
  paintGasFeatures(context, width, height, profile);
  paintIceFractures(context, width, height, profile);

  if (profile.category === 'earthlike') {
    const randomCloud = seeded(profile.seed ^ 0x7f4a7c15);
    context.save();
    context.fillStyle = 'rgba(245,250,255,.13)';
    for (let i = 0; i < 20; i++) {
      const x = randomCloud() * width, y = (0.12 + randomCloud() * 0.76) * height;
      const rx = (3 + randomCloud() * 9) * width / 128;
      context.beginPath();
      context.ellipse(x, y, rx, rx * 0.28, randomCloud() * 0.4 - 0.2, 0, TAU);
      context.fill();
    }
    context.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  if (disposables) disposables.add(texture);
  return { texture, profile };
}

function createGlowTexture(disposables = null) {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(48, 48, 6, 48, 48, 48);
  gradient.addColorStop(0, 'rgba(255,255,255,.72)');
  gradient.addColorStop(0.22, 'rgba(255,255,255,.26)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,.08)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 96, 96);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (disposables) disposables.add(texture);
  return texture;
}

export function createBodyVisual(body, radius, disposables = null) {
  const { texture, profile } = createBodyTexture(body, disposables);
  const material = profile.category === 'star'
    ? new THREE.MeshBasicMaterial({ map:texture, color:0xffffff })
    : new THREE.MeshStandardMaterial({
      map:texture,
      color:0xffffff,
      roughness:profile.roughness,
      metalness:profile.metalness,
      ...(['rocky','metal','rocky-ice','icy'].includes(profile.category)
        ? { bumpMap:texture, bumpScale:profile.category === 'icy' ? radius * 0.018 : radius * 0.028 }
        : {}),
    });

  const extras = [];
  if (profile.hasAtmosphere && body.kind !== 'star') {
    const geometry = new THREE.SphereGeometry(radius * 1.045, 32, 22);
    const atmosphere = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color:profile.atmosphereColor,
      transparent:true,
      opacity:profile.atmosphereOpacity,
      side:THREE.BackSide,
      depthWrite:false,
      blending:THREE.AdditiveBlending,
    }));
    atmosphere.userData.visualBaseOpacity = profile.atmosphereOpacity;
    extras.push(atmosphere);
  }

  if (body.kind === 'star') {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map:createGlowTexture(disposables),
      color:profile.baseColor,
      transparent:true,
      opacity:0.58,
      depthWrite:false,
      blending:THREE.AdditiveBlending,
    }));
    glow.scale.set(radius * 4.8, radius * 4.8, 1);
    glow.userData.visualBaseOpacity = 0.58;
    extras.push(glow);
  }

  return { material, extras, profile };
}

export function ringVisualProfile(ring) {
  const type = String(ring?.type || '').toLowerCase();
  if (type.includes('ice')) return { baseColor:0xb8c9cf, secondaryColor:0x758d98, opacity:0.62 };
  if (type.includes('metal')) return { baseColor:0x9b9485, secondaryColor:0x595b5c, opacity:0.60 };
  if (type.includes('rock')) return { baseColor:0x9b806a, secondaryColor:0x55483f, opacity:0.58 };
  return { baseColor:0xa99c8a, secondaryColor:0x665f58, opacity:0.56 };
}

export function createRingMaterial(ring, disposables = null) {
  const profile = ringVisualProfile(ring);
  const seed = visualSeed(ring?.id || ring?.name || ring?.type || 'ring');
  const random = seeded(seed);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  const centre = (size - 1) / 2;
  const inner = 0.22;
  const outer = 0.5;
  const phases = Array.from({ length:4 }, () => random() * TAU);

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x - centre) / size, dy = (y - centre) / size;
    const radius = Math.hypot(dx, dy);
    const index = (y * size + x) * 4;
    if (radius < inner || radius > outer) continue;
    const normalized = (radius - inner) / (outer - inner);
    const bands = Math.sin(normalized * TAU * 27 + phases[0])
      + Math.sin(normalized * TAU * 61 + phases[1]) * 0.45
      + Math.sin(normalized * TAU * 9 + phases[2]) * 0.28;
    const amount = clamp01(0.48 + bands * 0.18);
    const colour = mix(profile.secondaryColor, profile.baseColor, amount);
    const alpha = Math.round(255 * clamp01(0.38 + amount * 0.5));
    writePixel(image.data, index, colour, 0.92 + amount * 0.12, alpha);
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  if (disposables) disposables.add(texture);
  const material = new THREE.MeshStandardMaterial({
    map:texture,
    color:0xffffff,
    side:THREE.DoubleSide,
    transparent:true,
    opacity:profile.opacity,
    roughness:0.93,
    metalness:0.02,
    depthWrite:false,
    alphaTest:0.025,
  });
  return { material, profile };
}
