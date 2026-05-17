import type { BufferGeometry } from 'three';

export interface MeshBounds {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export function computeMeshBounds(geometry: BufferGeometry): MeshBounds {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) {
    return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
  }
  return {
    minX: box.min.x,
    minY: box.min.y,
    minZ: box.min.z,
    maxX: box.max.x,
    maxY: box.max.y,
    maxZ: box.max.z,
  };
}
