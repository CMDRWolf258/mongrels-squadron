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

function harness({ helper = true, touch = false, scrollY = 0, distance = 1000 } = {}) {
  const root = new Surface(), canvas = new Surface(root);
  const camera = new PerspectiveCamera(45, 800 / 600, 0.01, 1e6);
  camera.position.set(0, 0, distance);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.13;
  controls.rotateSpeed = 0.7; controls.zoomSpeed = 0.9; controls.panSpeed = 0.85;
  controls.screenSpacePanning = true; controls.minDistance = 0.25; controls.maxDistance = 1e5;
  controls.listenToKeyEvents(canvas); controls.update();
  const navigation = helper ? createCameraNavigation({ camera, controls, touchPreferred: touch }) : null;
  return {
    camera, controls, canvas, root, navigation,
    pointer(type, id, x, y, { pointerType = touch ? 'touch' : 'mouse', button = 0 } = {}) {
      camera.updateMatrixWorld();
      return canvas.dispatch(type, { pointerId:id, pointerType, button,
        clientX:x+40, clientY:y+80, pageX:x+40, pageY:y+80+scrollY,
        ctrlKey:false, metaKey:false, shiftKey:false });
    },
    wheel(x = 600, y = 200, deltaY = -100) {
      camera.updateMatrixWorld();
      return canvas.dispatch('wheel', {clientX:x+40,clientY:y+80,deltaY,deltaMode:0,ctrlKey:false});
    },
    settle() { for(let i=0;i<180;i++) { controls.update(); camera.updateMatrixWorld(); } },
    dispose() { navigation?.dispose(); controls.dispose(); },
  };
}
function pose(h) { return {position:h.camera.position.clone(), quaternion:h.camera.quaternion.clone(), target:h.controls.target.clone()}; }
function samePose(a,b,label,target=true) {
  assert.ok(a.position.distanceTo(b.position)<1e-8,label+': position');
  assert.ok(1-Math.abs(a.quaternion.dot(b.quaternion))<1e-12,label+': orientation');
  if(target) assert.ok(a.target.distanceTo(b.target)<1e-8,label+': target');
}
function centered(h) {
  const direction=h.controls.target.clone().sub(h.camera.position).normalize();
  assert.ok(direction.distanceTo(h.camera.getWorldDirection(new Vector3()))<1e-8,'Pivot must lie on the current view-center axis');
  assert.ok([...h.camera.position.toArray(),...h.controls.target.toArray()].every(Number.isFinite));
  assert.ok(h.controls.getDistance()>=h.controls.minDistance-1e-8);
  assert.equal(h.controls.rotateSpeed,0.7); assert.equal(h.controls.zoomSpeed,0.9); assert.equal(h.controls.panSpeed,0.85);
  assert.equal(h.controls.zoomToCursor,false);
}
function drag(h,{touch=false,button=0,dx=35,dy=18}={}) {
  const options={pointerType:touch?'touch':'mouse',button};
  h.pointer('pointerdown',1,400,300,options); h.pointer('pointermove',1,400+dx,300+dy,options);
  h.pointer('pointerup',1,400+dx,300+dy,options); h.settle();
}
function pinchStart(h) {
  h.pointer('pointerdown',1,300,300,{pointerType:'touch'});
  h.pointer('pointerdown',2,500,300,{pointerType:'touch'});
}
function pinchEnd(h,left=50,right=750,y=300) {
  h.pointer('pointerup',2,right,y,{pointerType:'touch'});
  h.pointer('pointerup',1,left,y,{pointerType:'touch'}); h.settle();
}
function zoomIn(h) {
  h.controls.enablePan=false; pinchStart(h);
  h.pointer('pointermove',1,50,300,{pointerType:'touch'});
  h.pointer('pointermove',2,750,300,{pointerType:'touch'});
  pinchEnd(h); h.controls.enablePan=true;
}
function test(name,fn) { fn(); console.log('✓ '+name); }

test('Desktop mouse orbit, wheel and right pan are unchanged at wide and close distances',()=>{
  for(const distance of [1000,4]) {
    const h=harness({distance}), baseline=harness({helper:false,distance});
    for(const action of [drag,h=>{h.wheel();h.settle();},h=>drag(h,{button:2})]) {
      action(h);action(baseline);samePose(pose(h),pose(baseline),'desktop'); centered(h);
    }
    h.dispose();baseline.dispose();
  }
});
test('Wide touch overview retains the original orbit, pan and small-pinch response',()=>{
  const h=harness({touch:true}), baseline=harness({helper:false,touch:true});
  for(const action of [h=>drag(h,{touch:true}),h=>{
    pinchStart(h);h.pointer('pointermove',2,530,315);h.pointer('pointermove',1,285,315);pinchEnd(h,285,530,315);
  }]) {
    action(h);action(baseline);samePose(pose(h),pose(baseline),'wide touch');centered(h);
  }
  h.dispose();baseline.dispose();
});
test('Zoom in empty space creates a short floating pivot with natural local zoom travel',()=>{
  const h=harness({touch:true});
  zoomIn(h);
  assert.ok(h.controls.getDistance()<5,'The orbit pivot must be local, even without any bodies');
  assert.ok(h.controls.target.distanceTo(new Vector3())>300,'Pivot must leave the old system centre');
  centered(h);
  const before=pose(h); h.pointer('pointerdown',1,400,300);
  samePose(pose(h),before,'new local gesture');
  h.pointer('pointermove',1,420,300);h.pointer('pointerup',1,420,300);h.settle();
  assert.ok(h.camera.position.distanceTo(before.position)<1,'Small orbit must not sweep around the old distant centre');
  centered(h);h.dispose();
});
test('Floating pivot depth changes smoothly through zoom-in and zoom-out',()=>{
  const h=harness({touch:true});h.controls.enablePan=false;
  pinchStart(h);
  let previous=h.controls.getDistance(),maxStep=0;
  for(let right=501;right<=1100;right++) {
    h.pointer('pointermove',2,right,300);
    const current=h.controls.getDistance();
    assert.ok(current<=previous+1e-7,'Zoom-in pivot distance must decrease monotonically');
    maxStep=Math.max(maxStep,previous-current);previous=current;centered(h);
  }
  assert.ok(maxStep<10,'Local transition must not jump between distant and short pivots');
  for(let right=1099;right>=500;right--) {h.pointer('pointermove',2,right,300);centered(h);}
  pinchEnd(h,300,500);
  assert.ok(Math.abs(h.controls.getDistance()-1000)<1e-7,'Zoom out restores the wide-view orbit distance');
  centered(h);h.dispose();
});
test('Local two-finger pan translates the camera and pivot by the same amount',()=>{
  const h=harness({touch:true});zoomIn(h);
  h.controls.enableZoom=false;const before=pose(h);pinchStart(h);
  h.pointer('pointermove',1,340,330);h.pointer('pointermove',2,540,330);pinchEnd(h,340,540,330);
  const positionDelta=h.camera.position.clone().sub(before.position);
  const targetDelta=h.controls.target.clone().sub(before.target);
  assert.ok(positionDelta.length()>0.02);
  assert.ok(positionDelta.distanceTo(targetDelta)<1e-8,'Pan must carry the pivot with the camera');
  centered(h);h.dispose();
});
test('Pinch-to-one-finger orbit freezes the current centered frame without a jump',()=>{
  const h=harness({touch:true});h.controls.enablePan=false;pinchStart(h);
  h.pointer('pointermove',1,50,300);h.pointer('pointermove',2,750,300);
  h.pointer('pointerup',2,750,300);const before=pose(h);
  h.pointer('pointermove',1,50,300);samePose(pose(h),before,'pinch transition');
  h.pointer('pointermove',1,70,300);h.pointer('pointerup',1,70,300);h.settle();
  assert.ok(h.camera.position.distanceTo(before.position)<1);centered(h);h.dispose();
});
test('Scrolled iPad-style touch gestures have identical view-centered behavior',()=>{
  const h=harness({touch:true,scrollY:850}),baseline=harness({touch:true});
  for(const action of [zoomIn,h=>drag(h,{touch:true}),h=>{
    h.controls.enableZoom=false;pinchStart(h);
    h.pointer('pointermove',1,340,330);h.pointer('pointermove',2,540,330);pinchEnd(h,340,540,330);
  }]) {action(h);action(baseline);samePose(pose(h),pose(baseline),'page scroll');centered(h);}
  h.dispose();baseline.dispose();
});
test('Explicit Focus establishes an exact object pivot before normal navigation resumes',()=>{
  const h=harness({touch:true});zoomIn(h);
  h.navigation.suspend();
  const target=new Vector3(130,8,21);
  h.controls.target.copy(target);h.camera.position.copy(target).add(new Vector3(4,6,9));
  h.camera.lookAt(target);h.controls.update();h.navigation.reset();
  const before=pose(h);h.pointer('pointerdown',1,400,300);
  samePose(pose(h),before,'explicit Focus');assert.ok(h.controls.target.distanceTo(target)<1e-8);
  h.pointer('pointerup',1,400,300);
  h.controls.enableZoom=false;pinchStart(h);
  h.pointer('pointermove',1,340,330);h.pointer('pointermove',2,540,330);pinchEnd(h,340,540,330);
  assert.ok(h.controls.target.distanceTo(target)>0.1,'Normal pan must move the pivot away from the Focus anchor');
  centered(h);h.dispose();
});
test('Overview reset restores the original wide pivot and camera response',()=>{
  const h=harness({touch:true});zoomIn(h);h.navigation.suspend();
  h.controls.target.set(0,0,0);h.camera.position.set(0,0,1000);h.camera.lookAt(h.controls.target);
  h.controls.update();h.navigation.reset();
  const baseline=harness({helper:false,touch:true});
  drag(h,{touch:true});drag(baseline,{touch:true});
  samePose(pose(h),pose(baseline),'Overview reset');centered(h);h.dispose();baseline.dispose();
});
test('Local zoom respects the original near and far orbit-distance limits',()=>{
  const h=harness({touch:true});h.controls.enablePan=false;pinchStart(h);
  h.pointer('pointermove',2,10000000,300);centered(h);
  assert.ok(Math.abs(h.controls.getDistance()-0.25)<1e-8,'Local zoom stops at the original near orbit limit');
  h.pointer('pointermove',2,300.0000001,300);centered(h);
  assert.ok(h.camera.position.length()<=100000+1e-7);
  pinchEnd(h,300,300.0000001);h.dispose();
});
test('Switching from touch to mouse restores normal mouse navigation without reframing',()=>{
  const h=harness({touch:true}),baseline=harness({helper:false});
  zoomIn(h);const before=pose(h);
  h.pointer('pointerdown',1,400,300,{pointerType:'mouse'});
  samePose(pose(h),before,'mouse switch',false);
  h.pointer('pointerup',1,400,300,{pointerType:'mouse'});
  baseline.camera.position.copy(h.camera.position);baseline.controls.target.copy(h.controls.target);baseline.controls.update();
  for(const action of [drag,h=>{h.wheel();h.settle();},h=>drag(h,{button:2})]) {
    action(h);action(baseline);samePose(pose(h),pose(baseline),'hybrid mouse');centered(h);
  }
  assert.equal(h.controls.minDistance,0.25);h.dispose();baseline.dispose();
});
test('Disposal removes touch listeners and restores original control limits',()=>{
  const h=harness({touch:true});zoomIn(h);
  assert.ok(h.canvas.count(true)>0);
  h.navigation.dispose();assert.equal(h.canvas.count(true),0);assert.equal(h.controls.minDistance,0.25);
  h.controls.dispose();assert.equal(h.canvas.count(),0);assert.equal(h.root.count(),0);
  assert.equal(h.canvas.captured.size,0);assert.equal(h.canvas.style.touchAction,'auto');
});
console.log('Orrery floating-camera smoke checks passed.');
