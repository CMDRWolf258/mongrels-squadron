import { MathUtils, Vector3 } from '../../vendor/three/three.module.js';

/** Touch navigation has a view-centred, zoom-scaled pivot, independent of scene data. */
export function createCameraNavigation({ camera, controls, touchPreferred = false }) {
  const canvas = controls.domElement;
  const pointers = new Map();
  const minZoom = controls.minDistance;
  const maxZoom = controls.maxDistance;
  const forward = new Vector3();
  let touchMode = touchPreferred;
  let referenceDistance;
  let zoomDistance;
  let frameDistance;
  let recenterOnMove = false;

  function floatingDistance() {
    const ratio = zoomDistance / referenceDistance;
    const local = Math.min(referenceDistance, 12) * ratio;
    // Preserve the wide view, then blend into a short pivot between 2x and 3x zoom.
    return MathUtils.clamp(MathUtils.lerp(local, zoomDistance, MathUtils.smoothstep(ratio, 0.35, 0.5)), minZoom, maxZoom);
  }

  function centerTarget(distance) {
    camera.getWorldDirection(forward);
    controls.target.copy(camera.position).addScaledVector(forward, distance);
    frameDistance = distance;
  }

  function freezeAndCenter(distance) {
    const position = camera.position.clone();
    const quaternion = camera.quaternion.clone();
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    camera.position.copy(position);
    camera.quaternion.copy(quaternion);
    centerTarget(distance);
    controls.enableDamping = damping;
    controls.update();
  }

  function change() {
    const radius = controls.getDistance();
    if (!touchMode || !(radius > 0)) {
      zoomDistance = MathUtils.clamp(radius, minZoom, maxZoom);
      frameDistance = radius;
      return;
    }
    const scale = frameDistance > 0 ? radius / frameDistance : 1;
    if (Math.abs(scale - 1) > 1e-9) {
      zoomDistance = MathUtils.clamp(zoomDistance * scale, minZoom, maxZoom);
    }
    const distance = floatingDistance();
    centerTarget(distance);
  }

  function desktop() {
    if (!touchMode) return;
    touchMode = false;
    controls.minDistance = minZoom;
    controls.maxDistance = maxZoom;
    freezeAndCenter(zoomDistance);
  }

  function pointerDown(event) {
    pointers.set(event.pointerId, event.pointerType);
    if (event.pointerType !== 'touch') { desktop(); return; }
    touchMode = true;
    // Keep pinch centred: r180 mixes page/client coordinates in cursor zoom.
    controls.zoomToCursor = false;
    const touches = [...pointers.values()].filter(type => type === 'touch').length;
    if (touches === 1) {
      const distance = floatingDistance();
      // Stop old local inertia at the current frame before a new local orbit.
      if (zoomDistance / referenceDistance < 0.5) freezeAndCenter(distance);
      else centerTarget(distance);
      recenterOnMove = false;
    }
  }

  function pointerMove(event) {
    if (event.pointerType !== 'touch' || !recenterOnMove) return;
    recenterOnMove = false;
    if (zoomDistance / referenceDistance < 0.5) freezeAndCenter(floatingDistance());
    else centerTarget(floatingDistance());
  }

  function pointerEnd(event) {
    pointers.delete(event.pointerId);
    recenterOnMove = [...pointers.values()].filter(type => type === 'touch').length === 1;
  }

  function wheel() { if (!pointers.size) desktop(); }

  function reset() {
    pointers.clear();
    recenterOnMove = false;
    controls.minDistance = minZoom;
    controls.maxDistance = maxZoom;
    zoomDistance = MathUtils.clamp(controls.getDistance(), minZoom, maxZoom);
    referenceDistance = zoomDistance;
    frameDistance = controls.getDistance();
    touchMode = touchPreferred;
    controls.zoomToCursor = false;
  }

  reset();
  const events = { pointerdown: pointerDown, pointermove: pointerMove, pointerup: pointerEnd, pointercancel: pointerEnd, wheel };
  for (const [name, listener] of Object.entries(events)) canvas.addEventListener(name, listener, { capture: true });
  controls.addEventListener('change', change);
  return {
    reset,
    suspend() { desktop(); touchMode = false; },
    dispose() {
      controls.removeEventListener('change', change);
      for (const [name, listener] of Object.entries(events)) canvas.removeEventListener(name, listener, { capture: true });
      pointers.clear();
      controls.minDistance = minZoom;
      controls.maxDistance = maxZoom;
    },
  };
}
