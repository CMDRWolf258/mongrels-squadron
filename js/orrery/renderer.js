import * as THREE from '../../vendor/three/three.module.js';
import { OrbitControls } from '../../vendor/three/OrbitControls.js';
import { buildLayout, surfaceVector } from '../../lib/orrery-model.js';
import { createCameraNavigation } from './camera.js';

const ACCENT = 0x22d3ee;
const BODY_COLOURS = [0x97a3b2, 0xc59a72, 0x688eb1, 0xbfcbd3, 0x9ea39c];
const isNumber = value => typeof value === 'number' && Number.isFinite(value);

function hash(value) {
  let result = 2166136261;
  for (const letter of String(value)) result = Math.imul(result ^ letter.charCodeAt(0), 16777619);
  return result >>> 0;
}

function bodyColour(body) {
  if (body.kind === 'star') {
    if (body.temperatureK >= 20000) return 0xb5ccff;
    if (body.temperatureK >= 7500) return 0xe0eaff;
    if (body.temperatureK >= 6000) return 0xfff3df;
    if (body.temperatureK >= 5000) return 0xffdf9e;
    if (body.temperatureK >= 3500) return 0xffb97c;
    return 0xff987b;
  }
  const description = `${body.subType || ''} ${body.type || ''} ${body.classification || ''}`.toLowerCase();
  if (description.includes('ice') || description.includes('icy')) return 0xa5c9e0;
  if (description.includes('water')) return 0x588fae;
  if (description.includes('earth')) return 0x5e9b99;
  if (description.includes('gas')) return 0xc7ac86;
  return BODY_COLOURS[hash(body.id) % BODY_COLOURS.length];
}

function circleGeometry(radius, inclination = 0, segments = 160) {
  const points = [];
  for (let i = 0; i < segments; i++) {
    const angle = i / segments * Math.PI * 2;
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      -Math.sin(angle) * radius * Math.sin(inclination),
      Math.sin(angle) * radius * Math.cos(inclination),
    ));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

/**
 * The renderer consumes the shared system model; it never owns gameplay data.
 * Body positions are a static, compressed map rather than a live ephemeris.
 * zoom factors above 1 move out; pan arguments are pixels in screen space.
 */
export function createOrrery({ container, system, onSelect = () => {}, onError = () => {} }) {
  if (!container || !system) throw new Error('An Orrery container and system are required.');
  const layout = buildLayout(system);
  const bodies = new Map(system.bodies.map(body => [body.id, body]));
  const objects = new Map();
  const labels = new Map();
  const pickable = [];
  const orbits = [];
  const disposables = new Set();
  const pointerStarts = new Map();
  let selectedId = null;
  let bodyIds = null;
  let locationIds = null;
  let showLabels = true;
  let disposed = false;
  let contextLost = false;
  let animationFrame = 0;
  let multiTouch = false;
  let width = 1;
  let height = 1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060b12);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = 'orrery-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Interactive 3D system. Drag to orbit, scroll to zoom, right-drag to pan. Use the object list to select bodies with a keyboard.');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  const labelLayer = document.createElement('div');
  labelLayer.className = 'orrery-label-layer';
  labelLayer.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;';
  container.append(canvas, labelLayer);

  const bounds = new THREE.Box3();
  for (const value of layout.values()) {
    const position = new THREE.Vector3(...value.position);
    const padding = new THREE.Vector3().setScalar(value.radius * 3);
    bounds.expandByPoint(position.clone().add(padding));
    bounds.expandByPoint(position.clone().sub(padding));
    const parent = layout.get(value.parentId);
    if (parent && value.orbitRadius > 0) {
      const orbitPadding = new THREE.Vector3(value.orbitRadius, Math.abs(Math.sin(value.inclination)) * value.orbitRadius, Math.abs(Math.cos(value.inclination)) * value.orbitRadius);
      const orbitCentre = new THREE.Vector3(...parent.position);
      bounds.expandByPoint(orbitCentre.clone().add(orbitPadding));
      bounds.expandByPoint(orbitCentre.clone().sub(orbitPadding));
    }
  }
  if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-10, -10, -10), new THREE.Vector3(10, 10, 10));
  const centre = bounds.getCenter(new THREE.Vector3());
  const extent = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 12);
  const camera = new THREE.PerspectiveCamera(44, 1, 0.02, extent * 60);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.13;
  controls.minDistance = 0.25;
  controls.maxDistance = extent * 14;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.9;
  controls.panSpeed = 0.85;
  controls.screenSpacePanning = true;
  controls.listenToKeyEvents(canvas);
  controls.keyPanSpeed = 24;

  scene.add(new THREE.HemisphereLight(0xd7e8ff, 0x374051, 2.25));
  const keyLight = new THREE.DirectionalLight(0xffd9ba, 2.2);
  keyLight.position.set(-extent, extent, extent * 0.3);
  scene.add(keyLight);

  // A seeded backdrop is decorative only; it does not represent catalogued stars.
  const backdropPoints = [];
  let seed = hash(system.id || system.name);
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 600; i++) {
    const azimuth = random() * Math.PI * 2;
    const y = random() * 2 - 1;
    const r = extent * (7 + random() * 4);
    const equator = Math.sqrt(1 - y * y);
    backdropPoints.push(new THREE.Vector3(Math.cos(azimuth) * equator * r, y * r, Math.sin(azimuth) * equator * r));
  }
  const backdrop = new THREE.Points(
    new THREE.BufferGeometry().setFromPoints(backdropPoints),
    new THREE.PointsMaterial({ color: 0x6b8098, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.6 }),
  );
  scene.add(backdrop);

  // Small discs keep distant bodies visible and tappable in the overview.
  // They disappear when the actual sphere occupies at least six screen pixels.
  const dotCanvas = document.createElement('canvas');
  dotCanvas.width = 32;
  dotCanvas.height = 32;
  const dotContext = dotCanvas.getContext('2d');
  dotContext.fillStyle = '#ffffff';
  dotContext.beginPath();
  dotContext.arc(16, 16, 14, 0, Math.PI * 2);
  dotContext.fill();
  const dotTexture = new THREE.CanvasTexture(dotCanvas);
  disposables.add(dotTexture);

  function register(id, mesh, kind, bodyId = id, radius = 1) {
    mesh.userData = { id, kind, bodyId };
    objects.set(id, { mesh, kind, bodyId, radius, baseOpacity: mesh.material?.opacity ?? 1 });
    pickable.push(mesh);
    scene.add(mesh);
  }

  function addLabel(id, name, position, kind, bodyId = id) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'orrery-body-label';
    button.textContent = name;
    button.setAttribute('aria-label', `Select ${name}`);
    button.style.cssText = 'position:absolute;pointer-events:auto;transform:translate(-50%,-100%);white-space:nowrap;';
    button.addEventListener('click', () => choose(id));
    button.addEventListener('dblclick', () => focus(id));
    labelLayer.append(button);
    labels.set(id, { button, position: position.clone(), kind, bodyId });
  }

  for (const body of system.bodies) {
    const value = layout.get(body.id);
    if (!value) continue;
    const position = new THREE.Vector3(...value.position);
    if (body.kind !== 'barycentre') {
      const geometry = new THREE.SphereGeometry(value.radius, body.kind === 'star' ? 40 : 28, 24);
      const material = body.kind === 'star'
        ? new THREE.MeshBasicMaterial({ color: bodyColour(body) })
        : new THREE.MeshStandardMaterial({ color: bodyColour(body), roughness: 0.88, metalness: 0.04 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      register(body.id, mesh, 'body', body.id, value.radius);
      const proxy = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture, color: bodyColour(body), transparent: true, depthWrite: false, opacity: 0.95 }));
      proxy.position.copy(position);
      proxy.userData = { id: body.id, kind: 'body', bodyId: body.id };
      objects.get(body.id).proxy = proxy;
      pickable.push(proxy);
      scene.add(proxy);
      addLabel(body.id, body.shortName || body.name, position, 'body');
    }

    const parent = layout.get(value.parentId);
    if (parent && value.orbitRadius > 0) {
      const path = new THREE.LineLoop(
        circleGeometry(value.orbitRadius, value.inclination || 0),
        new THREE.LineBasicMaterial({ color: body.kind === 'moon' ? 0x45637a : 0x3a5568, transparent: true, opacity: body.kind === 'moon' ? 0.3 : 0.5 }),
      );
      path.position.set(...parent.position);
      path.userData.bodyId = body.id;
      orbits.push(path);
      scene.add(path);
    }

    for (const [index, ring] of (body.rings || []).entries()) {
      const physicalInner = Number(ring.innerRadius || ring.innerRadiusKm);
      const physicalOuter = Number(ring.outerRadius || ring.outerRadiusKm);
      const ratio = physicalOuter > physicalInner && physicalInner > 0 ? Math.min(physicalOuter / physicalInner, 1.7) : 1.35;
      const inner = value.radius * (1.45 + index * 0.68);
      const outer = inner * ratio;
      const material = new THREE.MeshBasicMaterial({ color: 0xab9d8c, side: THREE.DoubleSide, transparent: true, opacity: 0.48, depthWrite: false });
      const ringMesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 80), material);
      ringMesh.rotation.x = -Math.PI / 2 + (value.inclination || 0);
      ringMesh.position.copy(position);
      register(ring.id, ringMesh, 'ring', body.id, outer);
    }
  }

  const locationCounts = new Map();
  for (const location of system.locations || []) {
    const value = layout.get(location.bodyId);
    if (!value) continue;
    const bodyPosition = new THREE.Vector3(...value.position);
    const slot = locationCounts.get(location.bodyId) || 0;
    locationCounts.set(location.bodyId, slot + 1);
    const coordinateKnown = isNumber(location.latitude) && isNumber(location.longitude);
    let markerPosition;
    let markerRadius;
    let geometry;
    if (coordinateKnown) {
      markerRadius = Math.max(value.radius * 0.035, 0.035);
      markerPosition = new THREE.Vector3(...surfaceVector(location.latitude, location.longitude, value.radius + markerRadius * 1.1));
      geometry = new THREE.SphereGeometry(markerRadius, 12, 8);
    } else if (location.ringId && objects.has(location.ringId)) {
      const ringMesh = objects.get(location.ringId).mesh;
      const { innerRadius, outerRadius } = ringMesh.geometry.parameters;
      const radius = (innerRadius + outerRadius) / 2;
      const angle = hash(location.id) / 4294967296 * Math.PI * 2;
      markerPosition = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.06).applyQuaternion(ringMesh.quaternion);
      markerRadius = Math.max(value.radius * 0.09, 0.06);
      geometry = new THREE.OctahedronGeometry(markerRadius);
    } else {
      // No location is inferred from unknown coordinates. These diamonds are
      // schematic association markers beside their parent body, labelled as such.
      const angle = slot * 2.4 + hash(location.bodyId) / 4294967296 * Math.PI * 2;
      const distance = value.radius * (2.2 + slot * 0.2);
      markerPosition = new THREE.Vector3(Math.cos(angle) * distance, value.radius * 0.5, Math.sin(angle) * distance);
      markerRadius = Math.max(value.radius * 0.085, 0.055);
      geometry = new THREE.OctahedronGeometry(markerRadius);
    }
    markerPosition.add(bodyPosition);
    const material = new THREE.MeshBasicMaterial({ color: coordinateKnown ? 0x81edba : 0xf3bf6b, transparent: true, opacity: 0.9 });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.copy(markerPosition);
    register(location.id, marker, 'location', location.bodyId, markerRadius);
    addLabel(location.id, location.name, markerPosition, 'location', location.bodyId);
    if (!coordinateKnown) labels.get(location.id).button.setAttribute('aria-label', `Select ${location.name}. Schematic body association; exact position unknown.`);
  }

  const selection = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, i) => new THREE.Vector3(Math.cos(i / 64 * Math.PI * 2), Math.sin(i / 64 * Math.PI * 2), 0))),
    new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.95, depthTest: false }),
  );
  selection.visible = false;
  selection.renderOrder = 10;
  scene.add(selection);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const projected = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const cameraNavigation = createCameraNavigation({ camera, controls,
    getBodyPositions: () => Array.from(objects.values())
      .filter(object => object.kind === 'body' && object.mesh.visible)
      .map(object => object.mesh.position),
  });

  function requestRender() {
    if (!disposed && !contextLost && !animationFrame) animationFrame = requestAnimationFrame(render);
  }

  function hasBodyMatch(id) { return !bodyIds || bodyIds.has(id); }
  function hasLocationMatch(id) { return !locationIds || locationIds.has(id); }

  function updateLabels() {
    const occupied = [];
    camera.getWorldDirection(cameraDirection);
    const sorted = Array.from(labels.entries()).sort(([a], [b]) => Number(b === selectedId) - Number(a === selectedId));
    for (const [id, label] of sorted) {
      const body = bodies.get(label.bodyId);
      const parent = body && bodies.get(body.parentId);
      const selected = selectedId === id;
      const selectedParent = objects.get(selectedId)?.bodyId;
      const match = label.kind === 'body' ? hasBodyMatch(id) : hasLocationMatch(id);
      const topLevel = label.kind === 'body' && (body.kind === 'star' || !parent || parent.kind === 'star' || parent.kind === 'barycentre');
      const matchingMoon = label.kind === 'body' && bodyIds && bodyIds.has(id);
      const detail = label.kind === 'location' && selectedParent === label.bodyId && match;
      const allowed = selected || (showLabels && (topLevel || matchingMoon || detail));
      if (!allowed) { label.button.hidden = true; continue; }
      projected.copy(label.position).project(camera);
      const inFront = label.position.clone().sub(camera.position).dot(cameraDirection) > 0;
      if (!inFront || projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) {
        label.button.hidden = true;
        continue;
      }
      const object = objects.get(id);
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height - 10;
      // Avoid labelling far-side surface sites through the parent sphere.
      if (label.kind === 'location' && object) {
        const value = layout.get(label.bodyId);
        const offset = label.position.clone().sub(new THREE.Vector3(...value.position));
        if (offset.length() < value.radius * 1.2 && offset.dot(camera.position.clone().sub(label.position)) < 0) {
          label.button.hidden = true;
          continue;
        }
      }
      const labelWidth = Math.min(210, Math.max(55, label.button.textContent.length * 6.5 + 20));
      const box = { left: x - labelWidth / 2, right: x + labelWidth / 2, top: y - 30, bottom: y };
      const overlaps = occupied.some(rect => box.left < rect.right && box.right > rect.left && box.top < rect.bottom && box.bottom > rect.top);
      label.button.hidden = overlaps && !selected;
      if (!label.button.hidden) occupied.push(box);
      label.button.style.left = `${x}px`;
      label.button.style.top = `${y}px`;
      label.button.classList.toggle('is-selected', selected);
      label.button.classList.toggle('is-dimmed', !match);
      label.button.setAttribute('aria-pressed', String(selected));
    }
  }

  function render() {
    animationFrame = 0;
    if (disposed || contextLost) return;
    controls.update();
    const verticalScale = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 2 / height;
    for (const [id, object] of objects) {
      if (!object.proxy) continue;
      const unitsPerPixel = camera.position.distanceTo(object.mesh.position) * verticalScale;
      object.proxy.visible = object.radius / unitsPerPixel < 3;
      object.proxy.scale.setScalar(unitsPerPixel * 7);
      object.proxy.material.opacity = hasBodyMatch(id) ? 0.95 : 0.22;
    }
    const selected = objects.get(selectedId);
    if (selected) {
      const minimumHalo = camera.position.distanceTo(selection.position) * verticalScale * 6;
      selection.scale.setScalar(Math.max(selected.radius * 1.3 + 0.08, minimumHalo));
    }
    selection.quaternion.copy(camera.quaternion);
    renderer.render(scene, camera);
    updateLabels();
  }

  function resize() {
    if (disposed) return;
    width = Math.max(container.clientWidth, 1);
    height = Math.max(container.clientHeight, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
  }

  function select(id, { focus: shouldFocus = false } = {}) {
    selectedId = id;
    const object = objects.get(id);
    selection.visible = Boolean(object);
    if (object) {
      selection.position.copy(object.mesh.position);
      selection.scale.setScalar(object.radius * 1.3 + 0.08);
    }
    if (shouldFocus) focus(id);
    requestRender();
  }

  function choose(id) {
    select(id);
    onSelect(id);
  }

  function focus(id) {
    const object = objects.get(id);
    if (!object) return;
    cameraNavigation.suspend();
    const parent = layout.get(object.bodyId);
    const target = object.mesh.position.clone();
    const distance = object.kind === 'location'
      ? Math.max(parent.radius * 3.2, 0.8)
      : Math.max(object.radius * 7, 2);
    const direction = camera.position.clone().sub(controls.target).normalize();
    if (object.kind === 'location' && parent) {
      const surfaceOffset = target.clone().sub(new THREE.Vector3(...parent.position));
      if (surfaceOffset.length() < parent.radius * 1.2) direction.copy(surfaceOffset).normalize();
    }
    if (direction.lengthSq() === 0) direction.set(0.4, 0.8, 1).normalize();
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target);
    controls.update();
    cameraNavigation.reset();
    requestRender();
  }

  function reset() {
    cameraNavigation.suspend();
    // Finish any damped gesture before replacing the camera and its target.
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    controls.target.copy(centre);
    const direction = new THREE.Vector3(0.5, 0.78, 1).normalize();
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanHorizontal = tanVertical * camera.aspect;
    let fitDistance = controls.minDistance;
    // Solve the perspective fit in the chosen camera orientation. A bounding
    // sphere wastes space for this mostly planar map, especially on wide screens.
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const corner = new THREE.Vector3(x, y, z).sub(centre);
          const depth = corner.dot(direction);
          fitDistance = Math.max(fitDistance,
            depth + Math.abs(corner.dot(right)) / (tanHorizontal * 0.88),
            depth + Math.abs(corner.dot(up)) / (tanVertical * 0.88));
        }
      }
    }
    camera.position.copy(centre).addScaledVector(direction, Math.min(fitDistance, controls.maxDistance));
    camera.lookAt(centre);
    controls.update();
    cameraNavigation.reset();
    requestRender();
  }

  function zoom(factor) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const offset = camera.position.clone().sub(controls.target);
    const distance = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset.setLength(distance));
    controls.update();
    requestRender();
  }

  function pan(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    camera.updateMatrixWorld();
    const unitsPerPixel = camera.position.distanceTo(controls.target) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 2 / height;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const offset = right.multiplyScalar(x * unitsPerPixel).add(up.multiplyScalar(-y * unitsPerPixel));
    camera.position.add(offset);
    controls.target.add(offset);
    controls.update();
    requestRender();
  }

  function setFilters(filters = {}) {
    bodyIds = filters.bodyIds instanceof Set ? filters.bodyIds : null;
    locationIds = filters.locationIds instanceof Set ? filters.locationIds : null;
    for (const [id, object] of objects) {
      const match = object.kind === 'location' ? hasLocationMatch(id) : hasBodyMatch(object.bodyId);
      if (object.kind === 'location') object.mesh.visible = match;
      else {
        object.mesh.material.transparent = object.kind === 'ring' || !match;
        object.mesh.material.opacity = object.baseOpacity * (match ? 1 : 0.18);
        object.mesh.material.depthWrite = object.kind !== 'ring' && match;
      }
    }
    for (const orbit of orbits) orbit.material.opacity = hasBodyMatch(orbit.userData.bodyId) ? 0.48 : 0.12;
    requestRender();
  }

  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickable.filter(object => object.visible), false)[0];
    if (hit) return hit.object.userData.id;
    if (event.pointerType === 'touch') {
      // A finger may land beside a seven-pixel overview dot. Expand only that
      // schematic hit target, keeping detailed sphere/ring picking geometric.
      let nearest = null;
      let nearestDistance = 18;
      for (const [id, object] of objects) {
        if (!object.proxy?.visible) continue;
        projected.copy(object.mesh.position).project(camera);
        if (projected.z < -1 || projected.z > 1) continue;
        const x = rect.left + (projected.x + 1) * rect.width / 2;
        const y = rect.top + (1 - projected.y) * rect.height / 2;
        const distance = Math.hypot(event.clientX - x, event.clientY - y);
        if (distance < nearestDistance) { nearestDistance = distance; nearest = id; }
      }
      return nearest;
    }
    return null;
  }

  function pointerDown(event) {
    pointerStarts.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: false, button: event.button });
    if (pointerStarts.size > 1) multiTouch = true;
  }

  function pointerMove(event) {
    const start = pointerStarts.get(event.pointerId);
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) start.moved = true;
  }

  function pointerUp(event) {
    const start = pointerStarts.get(event.pointerId);
    const maySelect = start && !start.moved && start.button === 0 && !multiTouch && pointerStarts.size === 1;
    pointerStarts.delete(event.pointerId);
    if (!pointerStarts.size) multiTouch = false;
    if (maySelect) {
      const id = pick(event);
      if (id) choose(id);
    }
  }

  function pointerCancel(event) {
    pointerStarts.delete(event.pointerId);
    if (!pointerStarts.size) multiTouch = false;
  }

  function doubleClick(event) {
    const id = pick(event);
    if (id) focus(id);
  }

  function keyDown(event) {
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(0.8); }
    else if (event.key === '-') { event.preventDefault(); zoom(1.25); }
    else if (event.key === 'Home') { event.preventDefault(); reset(); }
    else if (event.key.toLowerCase() === 'f' && selectedId) { event.preventDefault(); focus(selectedId); }
  }

  function lostContext(event) {
    event.preventDefault();
    contextLost = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    onError(new Error('The 3D graphics context was lost. The object list and information panel remain available.'));
  }

  const events = { pointerdown: pointerDown, pointermove: pointerMove, pointerup: pointerUp, pointercancel: pointerCancel, dblclick: doubleClick, keydown: keyDown, webglcontextlost: lostContext };
  for (const [name, listener] of Object.entries(events)) canvas.addEventListener(name, listener);
  controls.addEventListener('change', requestRender);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  window.addEventListener('resize', resize);
  resize();
  reset();

  return {
    select,
    focus,
    reset,
    zoom,
    pan,
    setFilters,
    setOrbits(visible) { for (const orbit of orbits) orbit.visible = Boolean(visible); requestRender(); },
    setLabels(visible) { showLabels = Boolean(visible); requestRender(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
      for (const [name, listener] of Object.entries(events)) canvas.removeEventListener(name, listener);
      controls.removeEventListener('change', requestRender);
      cameraNavigation.dispose();
      controls.dispose();
      scene.traverse(object => {
        if (object.geometry) disposables.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material) disposables.add(material);
        }
      });
      for (const resource of disposables) resource.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      scene.clear();
      objects.clear();
      labels.clear();
      pickable.length = 0;
      orbits.length = 0;
      canvas.remove();
      labelLayer.remove();
      pointerStarts.clear();
    },
  };
}
