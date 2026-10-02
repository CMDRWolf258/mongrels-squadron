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

function harness({ helper = true, touch = false, scrollY = 0, distance = 1000, bodies = [] } = {}) {
  const root = new Surface(), canvas = new Surface(root);
  const camera = new PerspectiveCamera(45, 800 / 600, 0.01, 1e6);
  camera.position.set(0, 0, distance);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.13;
  controls.rotateSpeed = 0.7; controls.zoomSpeed = 0.9; controls.panSpeed = 0.85;
  controls.screenSpacePanning = true; controls.minDistance = 0.25; controls.maxDistance = 1e5;
  controls.listenToKeyEvents(canvas); controls.update();
  const navigation = helper ? createCameraNavigation({ camera, controls, getBodyPositions: () => bodies }) : null;
  return {
    camera, controls, canvas, root, navigation, bodies,
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
function test(name,fn) { fn(); console.log('✓ '+name); }

function screenBody(h, x, y = 0, depth = 10) {
  const halfHeight = depth * Math.tan(h.camera.fov * Math.PI / 360);
  return new Vector3(x * halfHeight * h.camera.aspect, y * halfHeight, h.camera.position.z - depth);
}
function beginOrbit(h, dx = 1) {
  h.pointer('pointerdown',1,400,300,{pointerType:'touch'});
  h.pointer('pointermove',1,400+dx,300,{pointerType:'touch'});
}
function endOrbit(h, dx = 1) {
  h.pointer('pointerup',1,400+dx,300,{pointerType:'touch'}); h.settle();
}
function twoFingerDrag(h) {
  pinchStart(h);
  for (let step=1;step<=20;step++) {
    h.pointer('pointermove',1,300+step*4,300+step*2,{pointerType:'touch'});
    h.pointer('pointermove',2,500+step*4,300+step*2,{pointerType:'touch'});
  }
  pinchEnd(h,380,580,340);
}

test('Desktop mouse orbit, wheel and right pan remain unchanged with bodies present',()=>{
  for(const distance of [1000,4]) {
    const h=harness({distance}), baseline=harness({helper:false,distance});
    h.bodies.push(screenBody(h,0,0, distance/2));
    for(const action of [drag,h=>{h.wheel();h.settle();},h=>drag(h,{button:2})]) {
      action(h);action(baseline);samePose(pose(h),pose(baseline),'desktop'); centered(h);
    }
    h.dispose();baseline.dispose();
  }
});
test('Empty wide touch overview retains the native orbit, pan and pinch response',()=>{
  const h=harness({touch:true}), baseline=harness({helper:false,touch:true});
  for(const action of [h=>drag(h,{touch:true}),h=>{
    pinchStart(h);h.pointer('pointermove',2,530,315);h.pointer('pointermove',1,285,315);pinchEnd(h,285,530,315);
  }]) {
    action(h);action(baseline);samePose(pose(h),pose(baseline),'wide touch');centered(h);
  }
  h.dispose();baseline.dispose();
});
test('Touch orbit chooses the body nearest screen centre, rather than the nearest camera body',()=>{
  const h=harness({touch:true});
  const central=screenBody(h,0.02,0,40), nearer=screenBody(h,0.1,0,10);
  h.bodies.push(nearer,central);const position=h.camera.position.clone();
  beginOrbit(h);
  assert.ok(h.controls.target.distanceTo(central)<1e-8);
  assert.ok(h.camera.position.distanceTo(position)<1,'Small orbit stays local to the central body');
  assert.ok(h.controls.getDistance()>39 && h.controls.getDistance()<41);
  centered(h);endOrbit(h);h.dispose();
});
test('Equally centred bodies choose the foreground depth',()=>{
  const h=harness({touch:true}),far=screenBody(h,0,0,40),near=screenBody(h,0,0,10);
  h.bodies.push(far,near);beginOrbit(h);
  assert.ok(h.controls.target.distanceTo(near)<1e-8);endOrbit(h);h.dispose();
});
test('Off-centre, offscreen and behind-camera bodies leave an empty-space pivot at current depth',()=>{
  const h=harness({touch:true});
  h.bodies.push(screenBody(h,0.3),screenBody(h,1.2),new Vector3(0,0,1100));
  const before=h.controls.target.clone(), distance=h.controls.getDistance();
  beginOrbit(h);assert.ok(h.controls.target.distanceTo(before)<1e-8);
  assert.ok(Math.abs(h.controls.getDistance()-distance)<1e-8);centered(h);endOrbit(h);h.dispose();
});
test('The central-body circle uses pixels consistently in portrait and landscape',()=>{
  for (const [width,height] of [[834,1112],[1112,834]]) {
    const h=harness({touch:true});
    h.canvas.clientWidth=width;h.canvas.clientHeight=height;
    h.camera.aspect=width/height;h.camera.updateProjectionMatrix();
    const outside=screenBody(h,2*Math.min(width,height)*0.12/width);
    const inside=screenBody(h,2*Math.min(width,height)*0.08/width,0,40);
    h.bodies.push(outside,inside);beginOrbit(h);
    assert.ok(h.controls.target.distanceTo(inside)<1e-8);endOrbit(h);h.dispose();
  }
});
test('Starting a two-finger gesture does not acquire an orbit body or change the frame',()=>{
  const h=harness({touch:true});h.bodies.push(screenBody(h,0.05,0,10));
  const before=pose(h);pinchStart(h);samePose(pose(h),before,'two-finger start');
  pinchEnd(h,300,500);samePose(pose(h),before,'stationary two-finger');h.dispose();
});
test('Two-finger drag with pinch enabled matches native travel at wide and close distances',()=>{
  for(const distance of [1000,10]) {
    const h=harness({touch:true,distance}),baseline=harness({helper:false,touch:true,distance});
    h.bodies.push(screenBody(h,0.02,0,distance/2));
    const before=pose(h);twoFingerDrag(h);twoFingerDrag(baseline);
    samePose(pose(h),pose(baseline),'native two-finger drag');
    assert.ok(h.camera.position.distanceTo(before.position)>distance*0.05,'Drag must retain useful camera travel');
    centered(h);h.dispose();baseline.dispose();
  }
});
test('Body pivot stays fixed during rotation even if another body becomes more central',()=>{
  const h=harness({touch:true});const body=screenBody(h,0,0,30);
  h.bodies.push(body);beginOrbit(h);
  h.bodies.splice(0,h.bodies.length,screenBody(h,0,0,5));
  h.pointer('pointermove',1,435,310,{pointerType:'touch'});
  assert.ok(h.controls.target.distanceTo(body)<1e-8);endOrbit(h,35);h.dispose();
});
test('Pan carries camera and acquired body pivot together without reacquiring the body',()=>{
  const h=harness({touch:true}),body=screenBody(h,0,0,30);h.bodies.push(body);
  beginOrbit(h);endOrbit(h);h.controls.enableZoom=false;
  const before=pose(h);twoFingerDrag(h);
  const positionDelta=h.camera.position.clone().sub(before.position);
  const targetDelta=h.controls.target.clone().sub(before.target);
  assert.ok(positionDelta.length()>1);
  assert.ok(positionDelta.distanceTo(targetDelta)<1e-8,'Pan must carry the pivot with the camera');
  assert.ok(h.controls.target.distanceTo(body)>1);centered(h);h.dispose();
});
test('Pinch zoom uses natural body-relative distance and keeps the anchor steady',()=>{
  const h=harness({touch:true}),body=screenBody(h,0,0,30);h.bodies.push(body);
  beginOrbit(h);endOrbit(h);h.controls.enablePan=false;
  const distance=h.controls.getDistance();pinchStart(h);
  h.pointer('pointermove',2,700,300,{pointerType:'touch'});
  assert.ok(Math.abs(h.controls.getDistance()-distance/(2**0.9))<1e-8);
  assert.ok(h.controls.target.distanceTo(body)<1e-8);pinchEnd(h,300,700);centered(h);h.dispose();
});
test('Panning away from a previously acquired body leaves the next orbit in empty space',()=>{
  const h=harness({touch:true}),body=screenBody(h,0,0,30);h.bodies.push(body);
  beginOrbit(h);endOrbit(h);h.controls.enableZoom=false;twoFingerDrag(h);
  const target=h.controls.target.clone(),distance=h.controls.getDistance();
  beginOrbit(h);
  assert.ok(h.controls.target.distanceTo(target)<1e-8,'Off-centre old body must not pull the pivot back');
  assert.ok(Math.abs(h.controls.getDistance()-distance)<1e-8);centered(h);endOrbit(h);h.dispose();
});
test('Pinch-to-one-finger orbit chooses the current central body only when rotation starts',()=>{
  const h=harness({touch:true});h.controls.enablePan=false;pinchStart(h);
  h.pointer('pointermove',2,700,300);h.pointer('pointerup',2,700,300);
  const before=pose(h),body=screenBody(h,0.01,0,20);h.bodies.push(body);
  h.pointer('pointermove',1,300,300);samePose(pose(h),before,'stationary pinch transition');
  h.pointer('pointermove',1,310,300);
  assert.ok(h.controls.target.distanceTo(body)<1e-8);
  assert.ok(h.camera.position.distanceTo(before.position)<1);centered(h);
  h.pointer('pointerup',1,310,300);h.settle();h.dispose();
});
test('Scrolled iPad-style gestures preserve central-body orbit and two-finger pan',()=>{
  const h=harness({touch:true,scrollY:850}),baseline=harness({touch:true});
  h.bodies.push(screenBody(h,0.01,0,40));baseline.bodies.push(screenBody(baseline,0.01,0,40));
  for(const action of [h=>drag(h,{touch:true}),twoFingerDrag]) {
    action(h);action(baseline);samePose(pose(h),pose(baseline),'page scroll');centered(h);
  }
  h.dispose();baseline.dispose();
});
test('Explicit Focus retains its chosen anchor and normal pan can move away',()=>{
  const h=harness({touch:true});h.navigation.suspend();
  const target=new Vector3(130,8,21);h.bodies.push(target);
  h.controls.target.copy(target);h.camera.position.copy(target).add(new Vector3(4,6,9));
  h.camera.lookAt(target);h.controls.update();h.navigation.reset();
  h.pointer('pointerdown',1,400,300);const before=pose(h);
  h.pointer('pointermove',1,401,300);
  assert.ok(h.controls.target.distanceTo(target)<1e-8);
  assert.ok(h.camera.position.distanceTo(before.position)<0.2);endOrbit(h);h.controls.enableZoom=false;
  twoFingerDrag(h);assert.ok(h.controls.target.distanceTo(target)>1);centered(h);h.dispose();
});
test('Overview reset restores wide native camera response',()=>{
  const h=harness({touch:true});h.bodies.push(screenBody(h,0,0,30));beginOrbit(h);endOrbit(h);
  h.navigation.suspend();h.bodies.length=0;
  h.controls.target.set(0,0,0);h.camera.position.set(0,0,1000);h.camera.lookAt(h.controls.target);
  h.controls.update();h.navigation.reset();
  const baseline=harness({helper:false,touch:true});drag(h,{touch:true});drag(baseline,{touch:true});
  samePose(pose(h),pose(baseline),'Overview reset');centered(h);h.dispose();baseline.dispose();
});
test('Native distance limits remain finite through extreme touch zoom',()=>{
  const h=harness({touch:true});h.controls.enablePan=false;pinchStart(h);
  h.pointer('pointermove',2,10000000,300);centered(h);
  assert.ok(Math.abs(h.controls.getDistance()-0.25)<1e-8);
  h.pointer('pointermove',2,300.0000001,300);centered(h);
  assert.ok(h.controls.getDistance()<=1e5+1e-7);pinchEnd(h,300,300.0000001);h.dispose();
});
test('Switching from touch to mouse keeps the current frame and native mouse response',()=>{
  const h=harness({touch:true}),baseline=harness({helper:false});
  h.bodies.push(screenBody(h,0.01,0,30));beginOrbit(h);endOrbit(h);const before=pose(h);
  h.pointer('pointerdown',1,400,300,{pointerType:'mouse'});samePose(pose(h),before,'mouse switch');
  h.pointer('pointerup',1,400,300,{pointerType:'mouse'});
  baseline.camera.position.copy(h.camera.position);baseline.controls.target.copy(h.controls.target);baseline.controls.update();
  for(const action of [drag,h=>{h.wheel();h.settle();},h=>drag(h,{button:2})]) {
    action(h);action(baseline);samePose(pose(h),pose(baseline),'hybrid mouse');centered(h);
  }
  h.dispose();baseline.dispose();
});
test('Disabled controls ignore touch pivot changes',()=>{
  const h=harness({touch:true});h.bodies.push(screenBody(h,0,0,10));h.controls.enabled=false;
  const before=pose(h);beginOrbit(h);endOrbit(h);samePose(pose(h),before,'disabled controls');h.dispose();
});
test('Disposal removes capture listeners without changing native control settings',()=>{
  const h=harness({touch:true});beginOrbit(h);endOrbit(h);
  assert.ok(h.canvas.count(true)>0);h.navigation.dispose();assert.equal(h.canvas.count(true),0);
  assert.equal(h.controls.minDistance,0.25);assert.equal(h.controls.maxDistance,1e5);
  h.controls.dispose();assert.equal(h.canvas.count(),0);assert.equal(h.root.count(),0);
  assert.equal(h.canvas.captured.size,0);assert.equal(h.canvas.style.touchAction,'auto');
});
console.log('Orrery screen-centred body-pivot smoke checks passed.');
