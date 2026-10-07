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

function spherePoint(u, v) {
  const latitude = (v - 0.5) * Math.PI;
  const longitude = u * TAU;
  const cosLatitude = Math.cos(latitude);
  return [
    cosLatitude * Math.cos(longitude),
    Math.sin(latitude),
    cosLatitude * Math.sin(longitude),
  ];
}

function createSphericalFractal(seed, octaves = 6) {
  const random = seeded(seed);
  const layers = [];
  let amplitude = 1;
  let weight = 0;
  for (let octave = 0; octave < octaves; octave++) {
    layers.push({
      frequency:1 << octave,
      a:0.65 + random() * 1.75,
      b:0.65 + random() * 1.75,
      d:0.65 + random() * 1.75,
      phase:random() * TAU,
      amplitude,
    });
    weight += amplitude;
    amplitude *= 0.52;
  }
  return (u, v) => {
    const [x, y, z] = spherePoint(u, v);
    let value = 0;
    for (const layer of layers) {
      const ridge = Math.sin((x * layer.a + y * layer.b + z * layer.d) * layer.frequency * Math.PI + layer.phase);
      const cross = Math.cos((x * layer.d - y * layer.a + z * layer.b) * layer.frequency * Math.PI * 0.83 + layer.phase * 0.71);
      value += (ridge * 0.68 + cross * 0.32) * layer.amplitude;
    }
    return weight ? value / weight : 0;
  };
}

function craterField(u, v, profile, quality) {
  if (!['rocky','metal','rocky-ice','icy'].includes(profile.category)) return 0;
  const random = seeded(profile.seed ^ 0xa511e9b3);
  const count = quality === 'focus' ? 18 : 10;
  const point = spherePoint(u, v);
  let height = 0;
  for (let i = 0; i < count; i++) {
    const centreU = random();
    const centreV = 0.08 + random() * 0.84;
    const centre = spherePoint(centreU, centreV);
    const dot = Math.max(-1, Math.min(1, point[0] * centre[0] + point[1] * centre[1] + point[2] * centre[2]));
    const angular = Math.acos(dot);
    const radius = 0.025 + random() * 0.065;
    if (angular > radius * 1.45) continue;
    const normalized = angular / radius;
    if (normalized < 0.72) height -= (1 - normalized / 0.72) * 0.32;
    else if (normalized < 1.12) height += (1 - Math.abs(normalized - 0.92) / 0.2) * 0.23;
  }
  return height;
}

function writePixel(data, index, colour, shade = 1, alpha = 255) {
  const [r, g, b] = rgb(colour);
  data[index] = Math.max(0, Math.min(255, Math.round(r * shade)));
  data[index + 1] = Math.max(0, Math.min(255, Math.round(g * shade)));
  data[index + 2] = Math.max(0, Math.min(255, Math.round(b * shade)));
  data[index + 3] = alpha;
}

function dimensions(profile, quality) {
  if (quality === 'focus') return { width:384, height:192 };
  if (['gas','star','earthlike','water'].includes(profile.category)) return { width:192, height:96 };
  return { width:128, height:64 };
}

function createTextureFromCanvas(canvas, { srgb = true } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createNormalTexture(heights, width, height, strength) {
  const pixels = new Uint8Array(width * height * 4);
  const at = (x, y) => heights[Math.max(0, Math.min(height - 1, y)) * width + ((x % width + width) % width)];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const length = Math.hypot(dx, dy, 1) || 1;
      const index = (y * width + x) * 4;
      pixels[index] = Math.round((dx / length * 0.5 + 0.5) * 255);
      pixels[index + 1] = Math.round((dy / length * 0.5 + 0.5) * 255);
      pixels[index + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
      pixels[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createCloudTexture(profile, width, height) {
  if (!['earthlike','water'].includes(profile.category)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const image = context.createImageData(width, height);
  const broadNoise = createSphericalFractal(profile.seed ^ 0x7f4a7c15, 5);
  const wispNoise = createSphericalFractal(profile.seed ^ 0x18dd7731, 6);
  for (let y = 0; y < height; y++) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const broad = broadNoise(u, v);
      const wisps = wispNoise(u + broad * 0.018, v);
      const cloud = clamp01((broad * 0.66 + wisps * 0.34 - 0.04) * 2.25);
      const alpha = Math.round(Math.pow(cloud, 1.55) * 190);
      const index = (y * width + x) * 4;
      image.data[index] = 242;
      image.data[index + 1] = 248;
      image.data[index + 2] = 252;
      image.data[index + 3] = alpha;
    }
  }
  context.putImageData(image, 0, 0);
  return createTextureFromCanvas(canvas);
}

function buildSurfaceMaps(body, profile, quality = 'base') {
  const { width, height } = dimensions(profile, quality);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha:false });
  const image = context.createImageData(width, height);
  const heights = new Float32Array(width * height);
  const broadNoise = createSphericalFractal(profile.seed ^ 0x31415926, quality === 'focus' ? 7 : 5);
  const mediumNoise = createSphericalFractal(profile.seed ^ 0x91e10da5, quality === 'focus' ? 6 : 4);
  const fineNoise = quality === 'focus' ? createSphericalFractal(profile.seed ^ 0x68bc21eb, 8) : null;
  const gasRandom = seeded(profile.seed ^ 0x73a4d91f);
  const gasPhase = gasRandom() * TAU;
  const gasStormLongitude = gasRandom();
  const gasStormLatitude = 0.2 + gasRandom() * 0.6;
  const gasStormStrength = 0.65 + gasRandom() * 0.55;

  for (let y = 0; y < height; y++) {
    const v = y / Math.max(1, height - 1);
    const latitude = Math.abs(v - 0.5) * 2;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const broad = broadNoise(u, v);
      const medium = mediumNoise(u + broad * 0.022, v - broad * 0.012);
      const fine = fineNoise ? fineNoise(u, v) : 0;
      let elevation = broad * 0.58 + medium * 0.31 + fine * 0.11;
      elevation += craterField(u, v, profile, quality);
      heights[y * width + x] = elevation;

      let colour = profile.baseColor;
      let shade = 1;

      if (profile.category === 'gas') {
        const warp = broad * 0.035 + medium * 0.018 + Math.sin(u * TAU * 2 + gasPhase) * 0.008;
        const band = Math.sin((v + warp) * Math.PI * 25 + gasPhase)
          + Math.sin((v - warp * 0.6) * Math.PI * 53 + gasPhase * 0.7) * 0.34;
        let amount = clamp01(0.5 + band * 0.24);
        const du = Math.min(Math.abs(u - gasStormLongitude), 1 - Math.abs(u - gasStormLongitude));
        const dv = v - gasStormLatitude;
        const stormDistance = Math.hypot(du * 3.1, dv);
        if (stormDistance < 0.085) amount = clamp01(amount + (0.085 - stormDistance) * gasStormStrength * 4.5);
        colour = mix(profile.secondaryColor, profile.baseColor, amount);
        if (band > 0.82) colour = mix(colour, profile.accentColor, 0.42);
        shade = 0.9 + medium * 0.12;
        heights[y * width + x] = 0;
      } else if (profile.category === 'earthlike') {
        const polarIce = latitude > 0.83 + medium * 0.03;
        if (polarIce) colour = mix(profile.accentColor, 0xffffff, 0.42);
        else if (elevation > 0.06) {
          colour = elevation > 0.37 ? 0x8a7756 : elevation > 0.17 ? 0x607c45 : profile.secondaryColor;
        } else colour = mix(profile.baseColor, 0x173f67, clamp01(-elevation * 0.55));
        shade = 0.9 + elevation * 0.16;
      } else if (profile.category === 'water') {
        colour = elevation > 0.48 ? mix(profile.baseColor, profile.accentColor, 0.55) : profile.baseColor;
        if (latitude > 0.9) colour = mix(profile.accentColor, 0xffffff, 0.25);
        shade = 0.91 + elevation * 0.12;
      } else if (profile.category === 'star') {
        const granulation = broad * 0.48 + medium * 0.52;
        colour = granulation > 0.05 ? mix(profile.baseColor, profile.accentColor, 0.17) : profile.secondaryColor;
        shade = 1.03 + granulation * 0.14;
        heights[y * width + x] = 0;
      } else if (profile.category === 'icy' || profile.category === 'rocky-ice') {
        colour = elevation > 0.18 ? mix(profile.baseColor, profile.accentColor, 0.52)
          : elevation < -0.22 ? profile.secondaryColor
          : profile.baseColor;
        const fracture = Math.abs(Math.sin((u + medium * 0.035) * TAU * 8 + broad * 5));
        if (fracture < 0.075) colour = mix(colour, profile.accentColor, 0.65);
        shade = 0.84 + elevation * 0.18;
      } else {
        colour = elevation > 0.08 ? profile.baseColor : profile.secondaryColor;
        if (elevation > 0.34) colour = mix(colour, profile.accentColor, 0.62);
        if (elevation < -0.34) colour = scale(colour, 0.7);
        shade = 0.82 + elevation * 0.22;
      }

      writePixel(image.data, (y * width + x) * 4, colour, shade);
    }
  }

  context.putImageData(image, 0, 0);
  const colorTexture = createTextureFromCanvas(canvas);
  const reliefStrength = profile.category === 'icy' ? 2.2 : profile.category === 'metal' ? 3.0 : 2.6;
  const normalTexture = ['rocky','metal','rocky-ice','icy','earthlike','water'].includes(profile.category)
    ? createNormalTexture(heights, width, height, reliefStrength)
    : null;
  const cloudTexture = createCloudTexture(profile, width, height);
  return { colorTexture, normalTexture, cloudTexture };
}

function disposeMaps(maps) {
  if (!maps) return;
  for (const texture of [maps.colorTexture, maps.normalTexture, maps.cloudTexture]) texture?.dispose?.();
}

function createGlowTexture(disposables = null) {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(48, 48, 6, 48, 48, 48);
  gradient.addColorStop(0, 'rgba(255,255,255,.76)');
  gradient.addColorStop(0.20, 'rgba(255,255,255,.30)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,.09)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 96, 96);
  const texture = createTextureFromCanvas(canvas);
  if (disposables) disposables.add(texture);
  return texture;
}

function createAtmosphereMaterial(profile) {
  const colour = new THREE.Color(profile.atmosphereColor);
  const material = new THREE.ShaderMaterial({
    uniforms:{
      glowColor:{ value:colour },
      visualOpacity:{ value:profile.atmosphereOpacity },
    },
    vertexShader:`
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader:`
      uniform vec3 glowColor;
      uniform float visualOpacity;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.2);
        float alpha = rim * visualOpacity * 2.25;
        gl_FragColor = vec4(glowColor, alpha);
      }
    `,
    transparent:true,
    depthWrite:false,
    side:THREE.FrontSide,
    blending:THREE.AdditiveBlending,
  });
  material.opacity = profile.atmosphereOpacity;
  return material;
}

export function setVisualOpacity(visual, opacity) {
  if (!visual?.material) return;
  visual.material.opacity = opacity;
  if (visual.material.uniforms?.visualOpacity) visual.material.uniforms.visualOpacity.value = opacity;
}

export function createBodyVisual(body, radius, disposables = null) {
  const profile = bodyVisualProfile(body);
  const baseMaps = buildSurfaceMaps(body, profile, 'base');
  for (const texture of [baseMaps.colorTexture, baseMaps.normalTexture, baseMaps.cloudTexture]) if (texture && disposables) disposables.add(texture);

  const material = profile.category === 'star'
    ? new THREE.MeshBasicMaterial({ map:baseMaps.colorTexture, color:0xffffff })
    : new THREE.MeshStandardMaterial({
      map:baseMaps.colorTexture,
      normalMap:baseMaps.normalTexture || null,
      normalScale:new THREE.Vector2(0.72, 0.72),
      color:0xffffff,
      roughness:profile.roughness,
      metalness:profile.metalness,
    });

  const extras = [];
  let cloudMaterial = null;
  if (baseMaps.cloudTexture) {
    cloudMaterial = new THREE.MeshStandardMaterial({
      map:baseMaps.cloudTexture,
      color:0xffffff,
      transparent:true,
      opacity:0.68,
      roughness:1,
      metalness:0,
      depthWrite:false,
      alphaTest:0.025,
    });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.018, 36, 26), cloudMaterial);
    clouds.rotation.y = profile.seed / 4294967296 * Math.PI * 1.4;
    clouds.userData.visualRole = 'clouds';
    clouds.userData.visualBaseOpacity = 0.68;
    extras.push(clouds);
  }

  if (profile.hasAtmosphere && body.kind !== 'star') {
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.055, 36, 26),
      createAtmosphereMaterial(profile),
    );
    atmosphere.userData.visualRole = 'atmosphere';
    atmosphere.userData.visualBaseOpacity = profile.atmosphereOpacity;
    extras.push(atmosphere);
  }

  if (body.kind === 'star') {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map:createGlowTexture(disposables),
      color:profile.baseColor,
      transparent:true,
      opacity:0.62,
      depthWrite:false,
      blending:THREE.AdditiveBlending,
    }));
    glow.scale.set(radius * 4.9, radius * 4.9, 1);
    glow.userData.visualRole = 'star-glow';
    glow.userData.visualBaseOpacity = 0.62;
    extras.push(glow);
  }

  let focusedMaps = null;
  const detailController = {
    setFocused(focused) {
      if (focused) {
        if (!focusedMaps) focusedMaps = buildSurfaceMaps(body, profile, 'focus');
        material.map = focusedMaps.colorTexture;
        if ('normalMap' in material) material.normalMap = focusedMaps.normalTexture || null;
        if (cloudMaterial) cloudMaterial.map = focusedMaps.cloudTexture || baseMaps.cloudTexture;
      } else {
        material.map = baseMaps.colorTexture;
        if ('normalMap' in material) material.normalMap = baseMaps.normalTexture || null;
        if (cloudMaterial) cloudMaterial.map = baseMaps.cloudTexture;
        disposeMaps(focusedMaps);
        focusedMaps = null;
      }
      material.needsUpdate = true;
      if (cloudMaterial) cloudMaterial.needsUpdate = true;
    },
    dispose() {
      disposeMaps(focusedMaps);
      focusedMaps = null;
    },
  };

  return { material, extras, profile, detailController };
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
  // Rings are navigation features as well as scene geometry. Keep them
  // unlit so a near-coplanar star cannot shade the annulus into invisibility.
  const material = new THREE.MeshBasicMaterial({
    map:texture,
    color:0xffffff,
    side:THREE.DoubleSide,
    transparent:true,
    opacity:Math.min(0.78, profile.opacity + 0.12),
    depthWrite:false,
    alphaTest:0.02,
  });
  return { material, profile };
}
