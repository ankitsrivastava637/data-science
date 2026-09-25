import * as THREE from 'three';

const _v = new THREE.Vector3();
/** Project a world point to screen space [0,1]² (origin top-left). */
export function projectToScreen(cam: THREE.Camera, p: THREE.Vector3) {
  _v.copy(p).project(cam);
  const visible = _v.z > -1 && _v.z < 1 && Math.abs(_v.x) < 1.2 && Math.abs(_v.y) < 1.2;
  return { x: _v.x * 0.5 + 0.5, y: -_v.y * 0.5 + 0.5, visible, depth: _v.z };
}

/** Upper-left 3×3 of the camera's world matrix (for fullscreen ray-traced passes). */
export function camRotation(cam: THREE.Camera, out: THREE.Matrix3) {
  return out.setFromMatrix4(cam.matrixWorld);
}

export function setCam(cam: THREE.PerspectiveCamera, pos: THREE.Vector3, target: THREE.Vector3, up: THREE.Vector3, fov: number, aspect: number, near: number, far: number) {
  cam.position.copy(pos); cam.up.copy(up); cam.fov = fov; cam.aspect = aspect; cam.near = near; cam.far = far;
  cam.updateProjectionMatrix();
  cam.lookAt(target);
  cam.updateMatrixWorld();
}
