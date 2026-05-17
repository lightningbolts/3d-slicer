import type { BufferGeometry } from 'three';
import { connectSegmentsToContours } from '../geometry/connectContours';
import {
  computeMeshBoundsFromData,
  extractMeshData,
  type MeshData,
} from '../geometry/meshData';
import { validateMeshData } from '../geometry/meshValidation';
import { sliceMeshDataAtZ } from '../geometry/planeIntersection';
import type { Layer2D, SliceResult, SlicerParams } from '../types/slicer';
import {
  resolveLayerStep,
  validateLayerHeightRanges,
  LayerHeightEvaluationError,
} from './layerHeight';

export class SlicingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlicingError';
  }
}

/**
 * Main Z-plane slicing loop: march from Z=0 to model top,
 * intersect triangles, connect segments into perimeters.
 */
export function sliceMeshData(mesh: MeshData, params: SlicerParams): SliceResult {
  const overlapError = validateLayerHeightRanges(params.layerHeightRanges);
  if (overlapError) {
    throw new SlicingError(overlapError);
  }

  const meshError = validateMeshData(mesh);
  if (meshError) {
    throw new SlicingError(meshError);
  }

  const bounds = computeMeshBoundsFromData(mesh);
  const layers: Layer2D[] = [];

  const zStart = Math.max(0, bounds.minZ);
  const zEnd = bounds.maxZ;

  if (zEnd <= zStart) {
    throw new SlicingError('Model has zero or negative Z extent');
  }

  let z = zStart;
  const maxLayers = 100_000;
  let count = 0;

  while (z <= zEnd + 1e-6 && count < maxLayers) {
    let layerHeight: number;
    try {
      layerHeight = resolveLayerStep(z, params.layerHeight, params.layerHeightRanges);
    } catch (err) {
      if (err instanceof LayerHeightEvaluationError) {
        throw new SlicingError(err.message);
      }
      throw err;
    }

    const segments = sliceMeshDataAtZ(mesh, z);
    const contours = connectSegmentsToContours(segments);

    if (contours.length > 0) {
      layers.push({ z, layerHeight, contours });
    }

    z += layerHeight;
    count++;
  }

  return { layers, bounds };
}

/** Slice a Three.js geometry (used in tests; prefer worker path in UI). */
export function sliceGeometry(
  geometry: BufferGeometry,
  params: SlicerParams,
): SliceResult {
  return sliceMeshData(extractMeshData(geometry), params);
}
