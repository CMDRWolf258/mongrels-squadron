import { Frustum, MathUtils, Matrix4, Sphere, Vector3 } from '../../vendor/three/three.module.js';

/** Keep a close view's orbit radius local without moving or reframing the camera. */
export function createCameraNavigation({ camera, controls, objects, getSelectedId = () => null }) {
  const canvas = controls.domElement;
  const touches = new Set();
  const activePointers = new Set();
  let needsLocalPivot = false;
  let focusedId = null;

  function localAnchor() {
    camera.updateMatrixWorld();
    const forward = camera.getWorldDirection(new Vector3());
    const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const candidates = [];
    for (const [id, object] of objects) {
      if (object.kind !== 'body' || !object.mesh.visible) continue;
      const offset = object.mesh.position.clone().sub(camera.position);
      const distance = offset.length();
      const depth = offset.dot(forward);
      // Proximity, rather than distance to the old target, also works beside
      // outer planets whose system-centre pivot can still be very far away.
      if (depth <= controls.minDistance || distance > Math.max(object.radius * 24, 8)) continue;
      // A nearby planet can fill the view even with its centre off-screen.
      if (!frustum.intersectsSphere(new Sphere(object.mesh.position, object.radius))) continue;
      candidates.push({ id, depth, distance, forward });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const nearest = candidates[0];
    if (!nearest) return null;
    for (const id of [getSelectedId(), focusedId]) {
      const hostId = objects.get(id)?.bodyId;
      const preferred = candidates.find(candidate => candidate.id === hostId);
      if (preferred && preferred.distance <= nearest.distance * 1.25) return preferred;
    }
    return nearest;
  }

  function localize(anchor = localAnchor()) {
    if (!anchor || controls.getDistance() <= anchor.depth * 1.5) return;
    const position = camera.position.clone();
    const quaternion = camera.quaternion.clone();
    const damping = controls.enableDamping;
    // Drain pending motion through the public API, then restore the current
    // pose so old, large-scale pan/rotation damping cannot jump the local view.
    controls.enableDamping = false;
    controls.update();
    camera.position.copy(position);
    camera.quaternion.copy(quaternion);
    controls.target.copy(position).addScaledVector(anchor.forward,
      MathUtils.clamp(anchor.depth, controls.minDistance, controls.maxDistance));
    controls.enableDamping = damping;
    controls.update();
  }

  function pointerDown(event) {
    activePointers.add(event.pointerId);
    // r180 pinch midpoints use page coordinates against a client rectangle.
    // Keep touch zoom centred; its local pivot is corrected independently.
    controls.zoomToCursor = false;
    if (event.pointerType !== 'touch') return;
    touches.add(event.pointerId);
    if (touches.size === 1) { localize(); needsLocalPivot = false; }
    else needsLocalPivot = true;
  }

  function pointerMove(event) {
    if (event.pointerType !== 'touch') return;
    if (touches.size > 1) needsLocalPivot = true;
    else if (touches.size === 1 && needsLocalPivot) { localize(); needsLocalPivot = false; }
  }

  function pointerEnd(event) {
    activePointers.delete(event.pointerId);
    touches.delete(event.pointerId);
    needsLocalPivot = touches.size === 1;
  }

  function wheel() {
    if (activePointers.size || !controls.enabled || !controls.enableZoom) return;
    const anchor = localAnchor();
    // Cursor zoom is useful in a local mouse view, after removing any stale
    // radius. Overview wheel zoom keeps its original centred behavior.
    if (anchor) localize(anchor);
    controls.zoomToCursor = Boolean(anchor);
  }

  const events = { pointerdown: pointerDown, pointermove: pointerMove, pointerup: pointerEnd, pointercancel: pointerEnd, wheel };
  for (const [name, listener] of Object.entries(events)) canvas.addEventListener(name, listener, { capture: true });
  function reset() { touches.clear(); activePointers.clear(); needsLocalPivot = false; focusedId = null; controls.zoomToCursor = false; }
  return {
    reset,
    setFocus(id) { focusedId = id; },
    dispose() {
      reset();
      for (const [name, listener] of Object.entries(events)) canvas.removeEventListener(name, listener, { capture: true });
    },
  };
}
