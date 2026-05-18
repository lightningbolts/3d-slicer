import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
} from 'three';
import type { Layer2D, SliceBounds } from '../types/slicer';

const ACTIVE_COLOR = 0x5eead4;

function layerToLineSegments(layer: Layer2D, color: number): LineSegments | null {
  const positions: number[] = [];

  for (const contour of layer.contours) {
    const pts = contour.points;
    if (pts.length < 2) continue;

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      positions.push(a.x, a.y, layer.z, b.x, b.y, layer.z);
    }

    if (contour.closed) {
      const first = pts[0]!;
      const last = pts[pts.length - 1]!;
      positions.push(last.x, last.y, layer.z, first.x, first.y, layer.z);
    }
  }

  if (positions.length === 0) return null;

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({ color });
  return new LineSegments(geometry, material);
}

export function buildSliceContourGroup(
  layers: Layer2D[],
  activeLayerIndex: number,
): Group {
  const group = new Group();
  if (layers.length === 0) return group;

  const layer = layers[activeLayerIndex] ?? layers[layers.length - 1];
  if (!layer) return group;

  const lines = layerToLineSegments(layer, ACTIVE_COLOR);
  if (lines) group.add(lines);

  return group;
}

export function planeSpanFromBounds(bounds: SliceBounds): number {
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  return Math.max(20, Math.max(spanX, spanY) * 1.25);
}

export function planeCenterFromBounds(bounds: SliceBounds): { x: number; y: number } {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}
