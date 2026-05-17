import type { BufferGeometry } from 'three';
import type { MeshBounds } from './meshBounds';

/** Raw mesh buffers suitable for workers and slicing without Three.js. */
export interface MeshData {
  positions: Float32Array;
  indices: Uint32Array | null;
}

export function extractMeshData(geometry: BufferGeometry): MeshData {
  const posAttr = geometry.getAttribute('position');
  const positions = new Float32Array(posAttr.array as ArrayLike<number>);

  let indices: Uint32Array | null = null;
  if (geometry.index) {
    indices = new Uint32Array(geometry.index.array as ArrayLike<number>);
  }

  return { positions, indices };
}

export function computeMeshBoundsFromData(mesh: MeshData): MeshBounds {
  const { positions } = mesh;
  if (positions.length < 3) {
    return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!;
    const y = positions[i + 1]!;
    const z = positions[i + 2]!;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  return { minX, minY, minZ, maxX, maxY, maxZ };
}
