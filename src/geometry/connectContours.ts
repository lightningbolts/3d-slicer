import type { Contour2D, Segment2D, Vec2 } from '../types/slicer';

function pointKey(p: Vec2, precision: number): string {
  const f = 10 ** precision;
  return `${Math.round(p.x * f)},${Math.round(p.y * f)}`;
}

function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Chain intersection segments into closed/open polylines (outer perimeters).
 * Uses endpoint hashing and greedy traversal.
 */
export function connectSegmentsToContours(
  segments: Segment2D[],
  tol = 1e-4,
): Contour2D[] {
  if (segments.length === 0) return [];

  const precision = Math.max(3, Math.ceil(-Math.log10(tol)));
  const tol2 = tol * tol;

  type Endpoint = { segIdx: number; end: 'a' | 'b' };
  const adjacency = new Map<string, Endpoint[]>();

  const register = (p: Vec2, segIdx: number, end: 'a' | 'b') => {
    const key = pointKey(p, precision);
    const list = adjacency.get(key) ?? [];
    list.push({ segIdx, end });
    adjacency.set(key, list);
  };

  segments.forEach((seg, i) => {
    register(seg.a, i, 'a');
    register(seg.b, i, 'b');
  });

  const visited = new Set<number>();
  const contours: Contour2D[] = [];

  const otherEnd = (seg: Segment2D, end: 'a' | 'b'): Vec2 =>
    end === 'a' ? seg.b : seg.a;

  const findNext = (
    from: Vec2,
    excludeSeg: number,
  ): { segIdx: number; end: 'a' | 'b' } | null => {
    const key = pointKey(from, precision);
    const candidates = adjacency.get(key) ?? [];
    for (const c of candidates) {
      if (c.segIdx === excludeSeg || visited.has(c.segIdx)) continue;
      const seg = segments[c.segIdx]!;
      const at =
        dist2(seg.a, from) <= tol2
          ? seg.a
          : dist2(seg.b, from) <= tol2
            ? seg.b
            : null;
      if (at) return c;
    }
    for (const c of candidates) {
      if (c.segIdx === excludeSeg) continue;
      const seg = segments[c.segIdx]!;
      if (dist2(seg.a, from) <= tol2 * 4 || dist2(seg.b, from) <= tol2 * 4) {
        return c;
      }
    }
    return null;
  };

  for (let startIdx = 0; startIdx < segments.length; startIdx++) {
    if (visited.has(startIdx)) continue;

    const chain: Vec2[] = [];
    let currentSeg = segments[startIdx]!;
    visited.add(startIdx);
    chain.push(currentSeg.a, currentSeg.b);

    let tail = currentSeg.b;
    let head = currentSeg.a;
    let lastSeg = startIdx;

    let extended = true;
    while (extended) {
      extended = false;
      const nextTail = findNext(tail, lastSeg);
      if (nextTail) {
        const seg = segments[nextTail.segIdx]!;
        visited.add(nextTail.segIdx);
        const nextPoint = otherEnd(seg, nextTail.end);
        if (dist2(nextPoint, tail) > tol2) chain.push(nextPoint);
        tail = nextPoint;
        lastSeg = nextTail.segIdx;
        extended = true;
      }
    }

    lastSeg = startIdx;
    while (true) {
      const nextHead = findNext(head, lastSeg);
      if (!nextHead) break;
      const seg = segments[nextHead.segIdx]!;
      visited.add(nextHead.segIdx);
      const nextPoint = otherEnd(seg, nextHead.end);
      if (dist2(nextPoint, head) > tol2) chain.unshift(nextPoint);
      head = nextPoint;
      lastSeg = nextHead.segIdx;
    }

    const closed =
      chain.length >= 3 && dist2(chain[0]!, chain[chain.length - 1]!) <= tol2;

    if (closed && chain.length > 1) {
      chain.pop();
    }

    if (chain.length >= 2) {
      contours.push({ points: chain, closed });
    }
  }

  return contours;
}
