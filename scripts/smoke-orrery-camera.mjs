import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from '../vendor/three/three.module.js';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { createCameraNavigation } from '../js/orrery/camera.js';

// Exercise the actual vendored controls without a WebGL context. Capture
// listeners must precede bubble listeners even when registered later.
class Surface {
  constructor(root = null) {
    this.root = root ?? this;
    this.listeners = new Map();
    this.captured = new Set();
    this.style = {};
    this.clientWidth = 800;
    this.clientHeight = 600;
    this.bounds = { left: 40, top: 80, width: 800, height: 600 };
  }
  addEventListener(type, callback, options = {}) {
    const capture = typeof options === 'boolean' ? options : Boolean(options.capture);
    const records = this.listeners.get(type) ?? [];
    if (!records.some(record => record.callback === callback && record.capture === capture)) {
      records.push({ callback, capture });
      this.listeners.set(type, records);
    }
  }
  removeEventListener(type, callback, options = {}) {
    const capture = typeof options === 'boolean' ? options : Boolean(options.capture);
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(record =>
      record.callback !== callback || record.capture !== capture));
  }
  dispatch(type, values = {}) {
    const event = { type, target: this, preventDefault() { this.defaultPrevented = true; }, ...values };
    for (const capture of [true, false]) {
      for (const record of [...(this.listeners.get(type) ?? [])]) {
        if (record.capture === capture && this.listeners.get(type).includes(record)) {
          record.callback(event);
        }
      }
    }
    if (type === 'pointerup' || type === 'pointercancel') this.captured.delete(event.pointerId);
    return event;
  }
  count(capture) {
    return [...this.listeners.values()].flat().filter(record => capture === undefined || record.capture === capture).length;
  }
  getRootNode() { return this.root; }
  getBoundingClientRect() { return this.bounds; }
  setPointerCapture(id) { this.captured.add(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
}

function body(id, position, radius = 1) {
  return { kind: 'body', bodyId: id, radius, mesh: { visible: true, position: position.clone() } };
}

function harness({ helper = true, touch = false, scrollY = 0 } = {}) {
  const root = new Surface();
  const canvas = new Surface(root);
  const camera = new PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.01, 1e6);
  camera.position.set(0, 45, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.13;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.9;
  controls.panSpeed = 0.85;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.25;
  controls.maxDistance = 1e5;
  controls.listenToKeyEvents(canvas);
  controls.update();
  const objects = new Map([['body-1', body('body-1', new Vector3())]]);
  let selectedId = null;
  const navigation = helper ? createCameraNavigation({ camera, controls, objects, getSelectedId: () => selectedId }) : null;
  return {
    camera, controls, canvas, root, objects, navigation,
    select(id) { selectedId = id; },
    pointer(type, id, x, y, { pointerType = touch ? 'touch' : 'mouse', button = 0 } = {}) {
      camera.updateMatrixWorld(); // The normal render pass refreshes this between input frames.
      const clientX = x + canvas.bounds.left;
      const clientY = y + canvas.bounds.top;
      return canvas.dispatch(type, { pointerId: id, pointerType, button, buttons: type === 'pointerup' ? 0 : 1,
        clientX, clientY, pageX: clientX, pageY: clientY + scrollY, ctrlKey: false, metaKey: false, shiftKey: false });
    },
    wheel(x = 400, y = 300, deltaY = -100) {
      camera.updateMatrixWorld();
      return canvas.dispatch('wheel', { clientX: x + canvas.bounds.left, clientY: y + canvas.bounds.top,
        pageX: x + canvas.bounds.left, pageY: y + canvas.bounds.top + scrollY, deltaY, deltaMode: 0, ctrlKey: false });
    },
    settle() { for (let frame = 0; frame < 180; frame++) { controls.update(); camera.updateMatrixWorld(); } },
    dispose() { navigation?.dispose(); controls.dispose(); },
  };
}

function pose(h) {
  return { position: h.camera.position.clone(), quaternion: h.camera.quaternion.clone(), target: h.controls.target.clone() };
}
function samePose(actual, expected, label, includeTarget = true) {
  assert.ok(actual.position.distanceTo(expected.position) < 1e-9,
    `${label}: camera position changed (${actual.position.toArray()} versus ${expected.position.toArray()})`);
  assert.ok(1 - Math.abs(actual.quaternion.dot(expected.quaternion)) < 1e-12, `${label}: camera orientation changed`);
  if (includeTarget) assert.ok(actual.target.distanceTo(expected.target) < 1e-9, `${label}: pivot changed`);
}
function finite(h) {
  assert.ok([...h.camera.position.toArray(), ...h.camera.quaternion.toArray(), ...h.controls.target.toArray()].every(Number.isFinite));
  assert.ok(h.controls.getDistance() >= h.controls.minDistance && h.controls.getDistance() <= h.controls.maxDistance);
}
function speeds(h) {
  assert.equal(h.controls.rotateSpeed, 0.7);
  assert.equal(h.controls.zoomSpeed, 0.9);
  assert.equal(h.controls.panSpeed, 0.85);
  assert.equal(h.controls.enableDamping, true);
}
function outerClose(h, depth = 10) {
  h.camera.position.set(1000, 0, 1000);
  h.controls.target.set(0, 0, 0);
  h.controls.update();
  h.settle();
  const forward = h.camera.getWorldDirection(new Vector3());
  h.objects.set('body-1', body('body-1', h.camera.position.clone().addScaledVector(forward, depth)));
  return forward;
}
function drag(h, { touch = false, button = 0, dx = 35, dy = 18 } = {}) {
  const options = { pointerType: touch ? 'touch' : 'mouse', button };
  h.pointer('pointerdown', 1, 400, 300, options);
  h.pointer('pointermove', 1, 400 + dx, 300 + dy, options);
  h.pointer('pointerup', 1, 400 + dx, 300 + dy, options);
  h.settle();
}
function pinch(h) {
  const options = { pointerType: 'touch' };
  h.pointer('pointerdown', 1, 300, 300, options);
  h.pointer('pointerdown', 2, 500, 300, options);
  h.pointer('pointermove', 2, 530, 315, options);
  h.pointer('pointermove', 1, 285, 315, options);
  h.pointer('pointerup', 2, 530, 315, options);
  h.pointer('pointerup', 1, 285, 315, options);
  h.settle();
}
function test(name, run) {
  run();
  console.log(`✓ ${name}`);
}

test('Desktop overview orbit, wheel and right pan retain the original camera response', () => {
  const improved = harness();
  const original = harness({ helper: false });
  for (const gesture of [h => drag(h), h => { h.wheel(620, 160); h.settle(); }, h => drag(h, { button: 2 })]) {
    gesture(improved);
    gesture(original);
    samePose(pose(improved), pose(original), 'desktop overview');
    assert.equal(improved.controls.zoomToCursor, false);
    speeds(improved);
  }
  improved.dispose(); original.dispose();
});

test('Touch overview orbit and pinch/pan retain the original camera response', () => {
  const improved = harness({ touch: true });
  const original = harness({ helper: false, touch: true });
  for (const gesture of [h => drag(h, { touch: true }), pinch]) {
    gesture(improved); gesture(original);
    samePose(pose(improved), pose(original), 'touch overview');
    assert.equal(improved.controls.zoomToCursor, false);
    speeds(improved);
  }
  improved.dispose(); original.dispose();
});

test('First touch beside an outer body replaces a stale pivot without moving or reframing', () => {
  const h = harness({ touch: true });
  outerClose(h);
  const before = pose(h);
  assert.ok(h.controls.getDistance() > 1000);
  h.pointer('pointerdown', 1, 400, 300);
  samePose(pose(h), before, 'first local touch', false);
  assert.ok(Math.abs(h.controls.getDistance() - 10) < 1e-9);
  const local = pose(h);
  h.settle();
  samePose(pose(h), local, 'stationary local touch');
  h.pointer('pointermove', 1, 420, 300);
  h.pointer('pointerup', 1, 420, 300);
  h.settle();
  const movement = h.camera.position.distanceTo(before.position);
  assert.ok(movement > 0.1 && movement < 2, 'small touch drag must orbit the nearby area');
  finite(h); speeds(h); h.dispose();
});

test('Retargeting drains earlier orbit damping while preserving the current pose', () => {
  const h = harness({ touch: true });
  h.camera.position.set(1000, 0, 1000); h.controls.update();
  h.pointer('pointerdown', 1, 400, 300, { pointerType: 'mouse' });
  h.pointer('pointermove', 1, 435, 320, { pointerType: 'mouse' });
  h.pointer('pointerup', 1, 435, 320, { pointerType: 'mouse' });
  const forward = h.camera.getWorldDirection(new Vector3());
  h.objects.set('body-1', body('body-1', h.camera.position.clone().addScaledVector(forward, 10)));
  const before = pose(h);
  h.pointer('pointerdown', 2, 400, 300);
  samePose(pose(h), before, 'damped rebase', false);
  const local = pose(h);
  h.settle();
  samePose(pose(h), local, 'old damping must not resume');
  h.pointer('pointerup', 2, 400, 300); finite(h); h.dispose();
});

test('Pinching toward a body rebases before the remaining finger starts its local orbit', () => {
  const h = harness({ touch: true });
  h.camera.position.set(0, 0, 100); h.controls.target.set(0, 0, 0); h.controls.update();
  h.objects.set('body-1', body('body-1', new Vector3(0, 0, 75)));
  h.pointer('pointerdown', 1, 300, 300);
  assert.ok(Math.abs(h.controls.getDistance() - 100) < 1e-9, 'the initial view is outside local proximity');
  h.pointer('pointerdown', 2, 500, 300);
  h.pointer('pointermove', 2, 520, 300);
  assert.ok(h.camera.position.distanceTo(h.objects.get('body-1').mesh.position) < 24);
  h.pointer('pointerup', 2, 520, 300);
  const before = pose(h);
  const staleDistance = h.controls.getDistance();
  h.pointer('pointermove', 1, 300, 300);
  samePose(pose(h), before, 'pinch to one finger', false);
  assert.ok(h.controls.getDistance() < staleDistance * 0.3);
  const local = pose(h);
  h.settle(); samePose(pose(h), local, 'pinch damping must not resume');
  h.pointer('pointermove', 1, 320, 300);
  h.pointer('pointerup', 1, 320, 300); h.settle();
  assert.ok(h.camera.position.distanceTo(before.position) < 4);
  assert.equal(h.controls.zoomToCursor, false);
  finite(h); speeds(h); h.dispose();
});

test('Scrolled-page touch pinch uses centred zoom despite differing page and client coordinates', () => {
  const improved = harness({ touch: true, scrollY: 850 });
  const original = harness({ helper: false, touch: true, scrollY: 850 });
  for (const h of [improved, original]) {
    h.camera.position.set(0, 0, 10); h.controls.target.set(0, 0, 0); h.controls.update();
  }
  improved.controls.zoomToCursor = true; // A previous local mouse wheel can enable this mode.
  pinch(improved); pinch(original);
  samePose(pose(improved), pose(original), 'scrolled touch pinch');
  assert.equal(improved.controls.zoomToCursor, false);
  finite(improved); improved.dispose(); original.dispose();
});

test('Local mouse wheel rebases first and retains the point under the client-coordinate cursor', () => {
  const h = harness({ scrollY: 850 });
  const forward = outerClose(h);
  h.camera.updateMatrixWorld();
  const x = 550, y = 250;
  const projectedBefore = new Vector3(x / 800 * 2 - 1, 1 - y / 600 * 2, 0.5);
  const ray = projectedBefore.clone().unproject(h.camera).sub(h.camera.position).normalize();
  const point = h.camera.position.clone().addScaledVector(ray, 10 / ray.dot(forward));
  const before = pose(h);
  h.wheel(x, y);
  assert.equal(h.controls.zoomToCursor, true);
  assert.ok(h.controls.getDistance() < 12, 'wheel must zoom from local depth rather than the old system-centre radius');
  assert.ok(h.camera.position.distanceTo(before.position) < 2);
  h.camera.updateMatrixWorld();
  const projectedAfter = point.clone().project(h.camera);
  assert.ok(Math.abs(projectedAfter.x - projectedBefore.x) < 1e-8);
  assert.ok(Math.abs(projectedAfter.y - projectedBefore.y) < 1e-8);
  speeds(h); finite(h); h.dispose();
});

test('A wheel event ignored during dragging or disabled zoom cannot change the pivot', () => {
  const h = harness(); outerClose(h);
  h.pointer('pointerdown', 1, 400, 300);
  const before = pose(h);
  h.wheel(); samePose(pose(h), before, 'wheel during drag');
  assert.equal(h.controls.zoomToCursor, false);
  h.pointer('pointerup', 1, 400, 300);
  for (const setting of ['enabled', 'enableZoom']) {
    h.controls[setting] = false;
    h.wheel(); samePose(pose(h), before, `wheel with ${setting} disabled`);
    h.controls[setting] = true;
  }
  finite(h); h.dispose();
});

test('Distant, hidden and offscreen selections do not attract the local pivot', () => {
  for (const placement of ['distant', 'hidden', 'offscreen']) {
    const h = harness({ touch: true }); const forward = outerClose(h);
    const position = h.camera.position.clone().addScaledVector(forward, placement === 'distant' ? 200 : 12);
    if (placement === 'offscreen') position.add(new Vector3(0, 20, 0));
    const remote = body('body-2', position);
    if (placement === 'hidden') remote.mesh.visible = false;
    h.objects.set('body-2', remote);
    h.objects.set('selected-station', { kind: 'location', bodyId: 'body-2' });
    h.select('selected-station'); h.navigation.setFocus('selected-station');
    const before = pose(h);
    h.pointer('pointerdown', 1, 400, 300);
    samePose(pose(h), before, `${placement} selection`, false);
    assert.ok(Math.abs(h.controls.getDistance() - 10) < 1e-9);
    h.pointer('pointerup', 1, 400, 300); h.dispose();
  }
});

test('The visible edge of a nearby body supports a local pivot even with its centre offscreen', () => {
  const h = harness({ touch: true });
  h.camera.position.set(0, 0, 100); h.controls.target.set(0, 0, 0); h.controls.update();
  h.objects.set('body-1', body('body-1', new Vector3(13, 0, 80), 4));
  h.camera.updateMatrixWorld();
  assert.ok(h.objects.get('body-1').mesh.position.clone().project(h.camera).x > 1);
  const before = pose(h);
  h.pointer('pointerdown', 1, 400, 300);
  samePose(pose(h), before, 'visible body edge', false);
  assert.ok(Math.abs(h.controls.getDistance() - 20) < 1e-9);
  assert.ok(Math.abs(h.controls.target.x) < 1e-9, 'the pivot follows the current view rather than snapping to the offscreen centre');
  h.pointer('pointerup', 1, 400, 300); finite(h); h.dispose();
});

test('A tablet resize refreshes body visibility before touch chooses a local pivot', () => {
  const h = harness({ touch: true });
  h.camera.position.set(0, 0, 100); h.controls.target.set(0, 0, 0); h.controls.update();
  h.objects.set('body-1', body('body-1', new Vector3(13, 0, 80), 4));
  h.canvas.clientWidth = 768; h.canvas.clientHeight = 1024;
  h.canvas.bounds = { ...h.canvas.bounds, width: 768, height: 1024 };
  h.camera.aspect = h.canvas.clientWidth / h.canvas.clientHeight;
  h.camera.updateProjectionMatrix();
  const before = pose(h);
  h.pointer('pointerdown', 1, 384, 512);
  samePose(pose(h), before, 'body outside the resized viewport');
  h.pointer('pointerup', 1, 384, 512);
  h.objects.get('body-1').mesh.position.x = 8; // Its edge now enters the portrait viewport.
  h.pointer('pointerdown', 2, 384, 512);
  samePose(pose(h), before, 'body visible after tablet resize', false);
  assert.ok(Math.abs(h.controls.getDistance() - 20) < 1e-9);
  h.pointer('pointerup', 2, 384, 512); speeds(h); finite(h); h.dispose();
});

test('An already focused local view keeps its target and supports close right-pan', () => {
  const h = harness(); outerClose(h);
  h.controls.target.copy(h.objects.get('body-1').mesh.position); h.controls.update();
  h.navigation.setFocus('body-1');
  const before = pose(h);
  h.pointer('pointerdown', 1, 400, 300, { pointerType: 'touch' });
  samePose(pose(h), before, 'focused local view');
  h.pointer('pointerup', 1, 400, 300, { pointerType: 'touch' });
  drag(h, { button: 2 });
  const cameraMove = h.camera.position.clone().sub(before.position);
  const targetMove = h.controls.target.clone().sub(before.target);
  assert.ok(cameraMove.length() > 0 && cameraMove.length() < 2);
  assert.ok(cameraMove.distanceTo(targetMove) < 1e-9, 'local pan must move the camera and pivot together');
  speeds(h); finite(h); h.dispose();
});

test('Empty space remains finite and behaves like the original controls', () => {
  const improved = harness({ touch: true });
  const original = harness({ helper: false, touch: true });
  improved.objects.clear(); original.objects.clear();
  for (const h of [improved, original]) { drag(h, { touch: true }); pinch(h); h.wheel(); h.settle(); }
  samePose(pose(improved), pose(original), 'empty space'); finite(improved);
  improved.dispose(); original.dispose();
});

test('Reset clears focus/modes, cancelled pointers release wheel mode, and disposal removes listeners', () => {
  const h = harness({ touch: true }); const forward = outerClose(h);
  h.objects.set('body-2', body('body-2', h.camera.position.clone().addScaledVector(forward, 12)));
  h.objects.set('focused-station', { kind: 'location', bodyId: 'body-2' });
  h.navigation.setFocus('focused-station');
  h.pointer('pointerdown', 1, 400, 300);
  assert.ok(Math.abs(h.controls.getDistance() - 12) < 1e-9, 'a nearby focused host should be preferred');
  h.pointer('pointerup', 1, 400, 300);
  outerClose(h); h.controls.zoomToCursor = true; h.navigation.reset();
  assert.equal(h.controls.zoomToCursor, false);
  h.pointer('pointerdown', 2, 400, 300);
  assert.ok(Math.abs(h.controls.getDistance() - 10) < 1e-9, 'reset must clear the previously focused host');
  h.pointer('pointercancel', 2, 400, 300);
  outerClose(h); h.wheel();
  assert.equal(h.controls.zoomToCursor, true, 'cancelled pointers must not block the next wheel');
  assert.ok(h.canvas.count(true) > 0);
  h.navigation.dispose();
  assert.equal(h.canvas.count(true), 0);
  assert.equal(h.controls.zoomToCursor, false);
  outerClose(h); const before = pose(h);
  h.pointer('pointerdown', 3, 400, 300);
  samePose(pose(h), before, 'disposed helper');
  h.pointer('pointerup', 3, 400, 300);
  h.controls.dispose();
  assert.equal(h.canvas.count(), 0);
  assert.equal(h.root.count(), 0);
  assert.equal(h.canvas.captured.size, 0);
  assert.equal(h.canvas.style.touchAction, 'auto');
});

console.log('Orrery camera smoke checks passed.');
