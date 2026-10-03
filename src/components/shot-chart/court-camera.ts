import * as THREE from "three";
import { FLOOR } from "./court-geometry";

// Floor + board bounds. Shot positions never participate in fitting, so filters
// do not jump the camera or make a small sample appear more spread out.
const BOUNDS: [number, number, number][] = [
  [FLOOR.left, -.9, FLOOR.back], [FLOOR.right, -.9, FLOOR.back],
  [FLOOR.left, -.9, FLOOR.front], [FLOOR.right, -.9, FLOOR.front],
  [FLOOR.left, 0, FLOOR.back], [FLOOR.right, 0, FLOOR.back],
  [FLOOR.left, 0, FLOOR.front], [FLOOR.right, 0, FLOOR.front],
  [-3.1, 13.35, -1.35], [3.1, 13.35, -1.35],
];

export function defaultCourtElevation(aspect: number): number {
  // A taller view gives a phone's nearly square frame a readable floor. The
  // wider desktop frame uses a lower courtside angle, rather than empty sides.
  return THREE.MathUtils.lerp(1.08, .66, THREE.MathUtils.clamp((aspect - .85) / 1.1, 0, 1));
}

export function fitCourtCamera(camera: THREE.PerspectiveCamera, width: number, height: number, theta: number, elevation: number, zoom = 1): void {
  const target = new THREE.Vector3(0, 0, (FLOOR.front + FLOOR.back) / 2);
  camera.clearViewOffset();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  const point = new THREE.Vector3();
  function position(distance: number) {
    const horizontal = Math.cos(elevation) * distance;
    camera.position.set(Math.sin(theta) * horizontal, Math.sin(elevation) * distance, target.z + Math.cos(theta) * horizontal);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }
  function bounds() {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y, z] of BOUNDS) {
      point.set(x, y, z).project(camera);
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    }
    return { minX, maxX, minY, maxY };
  }
  const padX = 14, padTop = 44, padBottom = 38;
  const maxSpanX = 2 * (1 - 2 * padX / width);
  const maxSpanY = 2 * (1 - (padTop + padBottom) / height);
  let near = 48, far = 230;
  // Fixed, bounded work only on invalidation. Unlike a bounding sphere this
  // fits the actual projected half-court silhouette and centers its bounds.
  for (let step = 0; step < 15; step++) {
    const mid = (near + far) / 2;
    position(mid);
    const b = bounds();
    if (b.maxX - b.minX > maxSpanX || b.maxY - b.minY > maxSpanY) near = mid;
    else far = mid;
  }
  position(far * zoom);
  const b = bounds();
  const centerX = (b.minX + b.maxX) / 2;
  const centerY = (b.minY + b.maxY) / 2;
  camera.setViewOffset(width, height, centerX * width / 2, -centerY * height / 2 - (padTop - padBottom) / 2, width, height);
  camera.updateProjectionMatrix();
}
