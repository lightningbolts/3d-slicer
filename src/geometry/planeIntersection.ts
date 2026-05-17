import type { BufferGeometry } from 'three';
import type { MeshData } from './meshData';
import type { Segment2D, Vec2 } from '../types/slicer';

const EPS = 1e-9;

function classifyZ(z: number, planeZ: number): -1 | 0 | 1 {
  const d = z - planeZ;
  if (d < -EPS) return -1;
  if (d > EPS) return 1;
  return 0;
}

/** Intersect edge AB with horizontal plane z = planeZ; returns XY or null. */
function intersectEdge(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  planeZ: number,
): Vec2 | null {
  const ca = classifyZ(az, planeZ);
  const cb = classifyZ(bz, planeZ);

  if (ca === cb && ca !== 0) return null;

  if (ca === 0 && cb === 0) {
    return null;
  }

  if (ca === 0) {
    return { x: ax, y: ay };
  }
  if (cb === 0) {
    return { x: bx, y: by };
  }

  const dz = bz - az;
  if (Math.abs(dz) < EPS) return null;

  const t = (planeZ - az) / dz;
  if (t < -EPS || t > 1 + EPS) return null;

  const clamped = Math.max(0, Math.min(1, t));
  return {
    x: ax + clamped * (bx - ax),
    y: ay + clamped * (by - ay),
  };
}

function pointsEqual(a: Vec2, b: Vec2, tol: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < tol;
}

function segmentFromPoints(p0: Vec2, p1: Vec2, tol: number): Segment2D | null {
  if (pointsEqual(p0, p1, tol)) return null;
  return { a: p0, b: p1 };
}

/**
 * Intersect a single triangle with the plane z = sliceZ.
 * Returns at most one segment (two intersection points).
 */
export function intersectTriangleWithPlane(
  v0: [number, number, number],
  v1: [number, number, number],
  v2: [number, number, number],
  sliceZ: number,
  tol: number,
): Segment2D | null {
  const verts: [number, number, number][] = [v0, v1, v2];
  const hits: Vec2[] = [];

  for (let i = 0; i < 3; i++) {
    const [ax, ay, az] = verts[i]!;
    const [bx, by, bz] = verts[(i + 1) % 3]!;
    const p = intersectEdge(ax, ay, az, bx, by, bz, sliceZ);
    if (p) {
      const duplicate = hits.some((h) => pointsEqual(h, p, tol));
      if (!duplicate) hits.push(p);
    }
  }

  if (hits.length === 2) {
    return segmentFromPoints(hits[0]!, hits[1]!, tol);
  }

  if (hits.length === 3) {
    return segmentFromPoints(hits[0]!, hits[1]!, tol);
  }

  return null;
}

function readVertex(
  positions: Float32Array,
  index: number,
): [number, number, number] {
  const i = index * 3;
  return [positions[i]!, positions[i + 1]!, positions[i + 2]!];
}

/**
 * Collect all intersection segments between mesh triangles and plane z = sliceZ.
 */
export function sliceMeshDataAtZ(
  mesh: MeshData,
  sliceZ: number,
  tol = 1e-5,
): Segment2D[] {
  const { positions, indices } = mesh;
  if (positions.length < 9) return [];

  const segments: Segment2D[] = [];

  if (indices) {
    for (let i = 0; i < indices.length; i += 3) {
      const seg = intersectTriangleWithPlane(
        readVertex(positions, indices[i]!),
        readVertex(positions, indices[i + 1]!),
        readVertex(positions, indices[i + 2]!),
        sliceZ,
        tol,
      );
      if (seg) segments.push(seg);
    }
  } else {
    for (let i = 0; i < positions.length; i += 9) {
      const seg = intersectTriangleWithPlane(
        readVertex(positions, i / 3),
        readVertex(positions, i / 3 + 1),
        readVertex(positions, i / 3 + 2),
        sliceZ,
        tol,
      );
      if (seg) segments.push(seg);
    }
  }

  return segments;
}

/** @deprecated Prefer sliceMeshDataAtZ — kept for direct geometry use. */
export function sliceMeshAtZ(
  geometry: BufferGeometry,
  sliceZ: number,
  tol = 1e-5,
): Segment2D[] {
  const pos = geometry.getAttribute('position');
  if (!pos) return [];

  const positions = pos.array as Float32Array;
  const indices = geometry.index
    ? (geometry.index.array as Uint32Array)
    : null;

  return sliceMeshDataAtZ({ positions, indices }, sliceZ, tol);
}
