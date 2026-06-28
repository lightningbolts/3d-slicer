import ClipperLib from 'clipper-lib';
import type { Contour2D, Segment2D, Vec2 } from '../types/slicer';

const CLIPPER_SCALE = 1000;

function toClipperPath(points: Vec2[]): ClipperLib.Path {
  return points.map((p) => ({
    X: Math.round(p.x * CLIPPER_SCALE),
    Y: Math.round(p.y * CLIPPER_SCALE),
  }));
}

function fromClipperPoint(p: ClipperLib.IntPoint): Vec2 {
  return { x: p.X / CLIPPER_SCALE, y: p.Y / CLIPPER_SCALE };
}

function contoursToPaths(polygons: Contour2D[]): ClipperLib.Paths {
  const paths: ClipperLib.Paths = [];
  for (const poly of polygons) {
    if (!poly.closed || poly.points.length < 3) continue;
    paths.push(toClipperPath(poly.points));
  }
  return paths;
}

function infillSpacingMm(infillDensity: number, lineWidth: number): number {
  const density = Math.max(0, Math.min(100, infillDensity)) / 100;
  if (density <= 0) return Infinity;
  return lineWidth / density;
}

function layerInfillAngleRad(layerIndex: number): number {
  return layerIndex % 2 === 0 ? Math.PI / 4 : (3 * Math.PI) / 4;
}

/**
 * Rectilinear infill clipped to closed perimeter polygons via Clipper intersection.
 */
export function generateRectilinearInfill(
  polygons: Contour2D[],
  infillDensity: number,
  layerIndex: number,
  lineWidth: number,
): Segment2D[] {
  if (infillDensity <= 0) return [];

  const subjectPaths = contoursToPaths(polygons);
  if (subjectPaths.length === 0) return [];

  const spacing = infillSpacingMm(infillDensity, lineWidth);
  if (!Number.isFinite(spacing) || spacing <= 0) return [];

  const bounds = ClipperLib.JS.BoundsOfPaths(subjectPaths);
  const minX = bounds.left / CLIPPER_SCALE;
  const minY = bounds.top / CLIPPER_SCALE;
  const maxX = bounds.right / CLIPPER_SCALE;
  const maxY = bounds.bottom / CLIPPER_SCALE;

  const angle = layerInfillAngleRad(layerIndex);
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const normX = -dirY;
  const normY = dirX;

  const corners: Vec2[] = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];

  let minProj = Infinity;
  let maxProj = -Infinity;
  for (const c of corners) {
    const proj = c.x * normX + c.y * normY;
    minProj = Math.min(minProj, proj);
    maxProj = Math.max(maxProj, proj);
  }

  const diag = Math.hypot(maxX - minX, maxY - minY);
  const halfLen = diag * 1.5;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const segments: Segment2D[] = [];

  for (let t = minProj; t <= maxProj + 1e-9; t += spacing) {
    const ox = normX * t;
    const oy = normY * t;
    const ax = cx + ox - dirX * halfLen;
    const ay = cy + oy - dirY * halfLen;
    const bx = cx + ox + dirX * halfLen;
    const by = cy + oy + dirY * halfLen;

    const linePath: ClipperLib.Path = [
      { X: Math.round(ax * CLIPPER_SCALE), Y: Math.round(ay * CLIPPER_SCALE) },
      { X: Math.round(bx * CLIPPER_SCALE), Y: Math.round(by * CLIPPER_SCALE) },
    ];

    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(subjectPaths, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPath(linePath, ClipperLib.PolyType.ptClip, false);

    const solution: ClipperLib.Paths = [];
    clipper.Execute(
      ClipperLib.ClipType.ctIntersection,
      solution,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero,
    );

    for (const path of solution) {
      if (path.length < 2) continue;
      for (let i = 0; i < path.length - 1; i++) {
        const a = fromClipperPoint(path[i]!);
        const b = fromClipperPoint(path[i + 1]!);
        if (Math.hypot(b.x - a.x, b.y - a.y) > 1e-6) {
          segments.push({ a, b });
        }
      }
    }
  }

  return segments;
}
