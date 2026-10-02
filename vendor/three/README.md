Three.js r180 (npm version 0.180.0), vendored from the official `mrdoob/three.js` release tag:

- `build/three.module.js`
- `build/three.core.js`
- `examples/jsm/controls/OrbitControls.js`
- `LICENSE` (MIT)

The build files and license are unchanged. OrbitControls has one import-path change: `from 'three'` becomes `from './three.module.js'`. This preserves the site's no-build static architecture and avoids a runtime CDN dependency. These modules load only when the Orrery starts its 3D view.
