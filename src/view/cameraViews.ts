import { Box3, PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type ViewPresetId =
  | 'home'
  | 'top'
  | 'bottom'
  | 'front'
  | 'back'
  | 'left'
  | 'right';

const WORLD_UP = new Vector3(0, 0, 1);

/** Orbit distance that frames `box` in a perspective camera. */
export function getOrbitDistance(
  camera: PerspectiveCamera,
  box: Box3,
  margin = 1.35,
): number {
  const size = new Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const fovRad = (camera.fov * Math.PI) / 180;
  return (
    (maxDim / (2 * Math.tan(fovRad / 2))) *
    Math.max(1, 1 / Math.max(camera.aspect, 0.25)) *
    margin
  );
}

export function applyViewPreset(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  box: Box3,
  preset: ViewPresetId,
): void {
  const center = new Vector3();
  box.getCenter(center);
  const distance = getOrbitDistance(camera, box);

  controls.target.copy(center);
  camera.up.copy(WORLD_UP);

  const d = distance;
  switch (preset) {
    case 'top':
      camera.position.set(center.x, center.y, center.z + d);
      break;
    case 'bottom':
      camera.position.set(center.x, center.y, center.z - d);
      break;
    case 'front':
      camera.position.set(center.x, center.y - d, center.z);
      break;
    case 'back':
      camera.position.set(center.x, center.y + d, center.z);
      break;
    case 'left':
      camera.position.set(center.x - d, center.y, center.z);
      break;
    case 'right':
      camera.position.set(center.x + d, center.y, center.z);
      break;
    case 'home':
    default:
      camera.position.set(
        center.x + d * 0.75,
        center.y + d * 0.75,
        center.z + d * 0.55,
      );
      break;
  }

  camera.near = Math.max(0.1, distance / 200);
  camera.far = Math.max(2000, distance * 20);
  camera.updateProjectionMatrix();
  camera.lookAt(center);
  controls.update();
}

/** Frame camera so `box` is centered (orbit target = bbox center). */
export function fitCameraToBox(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  box: Box3,
): void {
  applyViewPreset(camera, controls, box, 'home');
}
