import type { Vec2 } from '../types/slicer';

export function segmentLength(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Volume-based extrusion increment (mm filament) for a path segment.
 * E += (lineWidth * layerHeight * pathLength) / filamentCrossSection
 */
export function extrusionDelta(
  pathLength: number,
  layerHeight: number,
  lineWidth: number,
  filamentDiameter: number,
): number {
  const filamentArea = Math.PI * (filamentDiameter / 2) ** 2;
  const lineArea = lineWidth * layerHeight;
  return (lineArea * pathLength) / filamentArea;
}
