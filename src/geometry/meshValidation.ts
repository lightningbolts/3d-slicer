import type { BufferGeometry } from 'three';
import type { MeshBounds } from './meshBounds';
import { computeMeshBoundsFromData, type MeshData } from './meshData';
import { isAsciiStl } from './stlRawContent';

/** ~5M triangles worth of non-indexed STL vertices. */
export const MAX_VERTEX_COUNT = 15_000_000;

/** Largest printable bounding box (mm) we accept without warning. */
export const MAX_EXTENT_MM = 2000;

export function validateMeshBounds(bounds: MeshBounds): string | null {
  const vals = [
    bounds.minX,
    bounds.minY,
    bounds.minZ,
    bounds.maxX,
    bounds.maxY,
    bounds.maxZ,
  ];
  if (vals.some((v) => !Number.isFinite(v))) {
    return 'Mesh has invalid coordinates (NaN or infinity). The STL may be corrupt.';
  }

  const dx = bounds.maxX - bounds.minX;
  const dy = bounds.maxY - bounds.minY;
  const dz = bounds.maxZ - bounds.minZ;

  if (dz <= 0) {
    return 'Mesh has no height along Z after loading.';
  }

  const maxDim = Math.max(dx, dy, dz);
  if (maxDim > MAX_EXTENT_MM) {
    return `Mesh is ${maxDim.toFixed(0)} mm tall/wide — check units or repair the STL.`;
  }

  return null;
}

export function validateMeshData(mesh: MeshData): string | null {
  const { positions } = mesh;
  if (positions.length < 9) {
    return 'Mesh has too few vertices to slice.';
  }
  if (positions.length % 3 !== 0) {
    return 'Mesh vertex buffer length is invalid.';
  }

  const vertexCount = positions.length / 3;
  if (vertexCount > MAX_VERTEX_COUNT) {
    return (
      `Mesh is too large (${vertexCount.toLocaleString()} vertices). ` +
      'The STL may be corrupt, or try simplifying the model.'
    );
  }

  return validateMeshBounds(computeMeshBoundsFromData(mesh));
}

export function validateGeometry(geometry: BufferGeometry): string | null {
  const pos = geometry.getAttribute('position');
  if (!pos || pos.count < 3) {
    return 'STL contains no triangle geometry.';
  }
  if (pos.count > MAX_VERTEX_COUNT) {
    return (
      `Mesh is too large (${pos.count.toLocaleString()} vertices). ` +
      'The STL may be corrupt, or try simplifying the model.'
    );
  }
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) {
    return 'Could not compute mesh bounds.';
  }
  return validateMeshBounds({
    minX: box.min.x,
    minY: box.min.y,
    minZ: box.min.z,
    maxX: box.max.x,
    maxY: box.max.y,
    maxZ: box.max.z,
  });
}

/** Pre-parse STL buffer checks (binary header vs file size). */
export function validateStlBuffer(buffer: ArrayBuffer): string | null {
  if (buffer.byteLength < 84) {
    return 'File is too small to be a valid STL.';
  }

  const view = new DataView(buffer);
  const faceBytes = 50;
  const faceCount = view.getUint32(80, true);
  const expectedBinaryBytes = 84 + faceCount * faceBytes;

  if (expectedBinaryBytes === buffer.byteLength) {
    if (faceCount === 0) {
      return 'Binary STL reports zero triangles.';
    }
    const maxFaces = MAX_VERTEX_COUNT / 3;
    if (faceCount > maxFaces) {
      return (
        `Binary STL header reports ${faceCount.toLocaleString()} triangles, ` +
        'which exceeds what this slicer can load.'
      );
    }
    return null;
  }

  if (isAsciiStl(buffer)) {
    return null;
  }

  // Binary STLs often put "solid ..." in the 80-byte header; Three.js may then
  // mis-parse them as ASCII if the triangle count does not match file size.
  const headerStartsWithSolid = new TextDecoder('utf-8', { fatal: false })
    .decode(buffer.slice(0, 80))
    .trimStart()
    .startsWith('solid');
  if (headerStartsWithSolid) {
    return (
      'This looks like a binary STL whose header confused the parser ' +
      '(common when the header starts with "solid"). Re-export as binary STL ' +
      'without a "solid" prefix in the header, or repair the file.'
    );
  }

  return (
    'File size does not match a binary STL header and the file does not ' +
    'look like ASCII STL — the file may be corrupt or not an STL.'
  );
}
