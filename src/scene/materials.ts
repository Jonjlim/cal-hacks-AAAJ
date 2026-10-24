import * as THREE from 'three';

/** HDR-ish color: values above 1 push past the bloom threshold. */
export function glow(color: THREE.ColorRepresentation, intensity = 1): THREE.Color {
  return new THREE.Color(color).multiplyScalar(intensity);
}

/** Shared geometries. Reuse these instead of allocating per component. */
export const GEOMETRY = {
  box: new THREE.BoxGeometry(1, 1, 1),
  octa: new THREE.OctahedronGeometry(1, 0),
  edgesBox: new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
  sphere: new THREE.SphereGeometry(1, 12, 8),
};
