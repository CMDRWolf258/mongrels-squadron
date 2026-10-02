import { Vector3 } from '../../vendor/three/three.module.js';

/** Choose a touch orbit anchor at gesture boundaries, leaving two-finger navigation native. */
export function createCameraNavigation({ camera, controls, getBodyPositions = () => [] }) {
  const canvas = controls.domElement;
  const pointers = new Map();
  const projected = new Vector3();
  const forward = new Vector3();
  let needsPivot = false;

  function stopInertia() {
    const position = camera.position.clone();
    const quaternion = camera.quaternion.clone();
    const target = controls.target.clone();
    const damping = controls.enableDamping;
    // Drain pending pan/rotation before using the current frame for a new gesture.
    controls.enableDamping = false;
    controls.update();
    camera.position.copy(position);
    camera.quaternion.copy(quaternion);
    controls.target.copy(target);
    controls.enableDamping = damping;
    controls.update();
  }

  function choosePivot() {
    const distance = controls.getDistance();
    camera.updateMatrixWorld();
    camera.getWorldDirection(forward);
    // Measure screen distance in pixels so portrait and landscape use the same circle.
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const limit = Math.min(width, height) * 0.1;
    let nearest = null;
    let best = limit * limit;
    let nearestDepth = Infinity;
    for (const position of getBodyPositions()) {
      const depth = projected.copy(position).sub(camera.position).dot(forward);
      if (depth <= camera.near) continue;
      const radius = projected.length();
      if (radius < controls.minDistance || radius > controls.maxDistance) continue;
      projected.copy(position).project(camera);
      if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) continue;
      const score = (projected.x * width / 2) ** 2 + (projected.y * height / 2) ** 2;
      if (score < best || (nearest && Math.abs(score - best) < 1e-8 && depth < nearestDepth)) {
        best = score;
        nearestDepth = depth;
        nearest = position;
      }
    }
    // An empty-space pivot keeps the current depth; no arbitrary short distance
    // reduces the normal OrbitControls pan/zoom travel.
    controls.target.copy(nearest ?? camera.position.clone().addScaledVector(forward, distance));
    controls.update();
  }

  function touches() { return [...pointers.values()].filter(pointer => pointer.type === 'touch').length; }

  function pointerDown(event) {
    if (!controls.enabled) return;
    pointers.set(event.pointerId, { type: event.pointerType, x: event.clientX, y: event.clientY });
    if (event.pointerType !== 'touch') { needsPivot = false; return; }
    // Keep the native centred pinch path, including on a scrolled page.
    controls.zoomToCursor = false;
    if (touches() === 1) needsPivot = true;
    else {
      needsPivot = false;
      stopInertia();
    }
  }

  function pointerMove(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const moved = event.clientX !== pointer.x || event.clientY !== pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (!controls.enabled || !controls.enableRotate || event.pointerType !== 'touch' || touches() !== 1 || !needsPivot || !moved) return;
    needsPivot = false;
    stopInertia();
    choosePivot();
  }

  function pointerEnd(event) {
    pointers.delete(event.pointerId);
    needsPivot = touches() === 1;
  }

  function reset() {
    pointers.clear();
    needsPivot = false;
  }

  const events = { pointerdown: pointerDown, pointermove: pointerMove, pointerup: pointerEnd, pointercancel: pointerEnd };
  for (const [name, listener] of Object.entries(events)) canvas.addEventListener(name, listener, { capture: true });
  return {
    reset,
    suspend() { reset(); stopInertia(); },
    dispose() {
      for (const [name, listener] of Object.entries(events)) canvas.removeEventListener(name, listener, { capture: true });
      reset();
    },
  };
}
