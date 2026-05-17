import { create, all } from 'mathjs';
import type { LayerHeightRange } from '../types/slicer';

const math = create(all, {});

export class LayerHeightEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LayerHeightEvaluationError';
  }
}

/** Validate ranges do not overlap (open intervals: touching endpoints allowed). */
export function validateLayerHeightRanges(ranges: LayerHeightRange[]): string | null {
  const sorted = [...ranges].sort((a, b) => a.zMin - b.zMin);
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]!;
    if (r.zMin >= r.zMax) {
      return `Range ${i + 1}: zMin must be less than zMax`;
    }
    if (i > 0) {
      const prev = sorted[i - 1]!;
      if (r.zMin < prev.zMax) {
        return `Ranges overlap between Z=${prev.zMax} and Z=${r.zMin}`;
      }
    }
  }
  return null;
}

/** Safely evaluate a layer-height expression at height z (mm). */
export function evaluateLayerHeightExpression(expression: string, z: number): number {
  const trimmed = expression.trim();
  if (!trimmed) {
    throw new LayerHeightEvaluationError('Layer height expression is empty');
  }

  let result: unknown;
  try {
    result = math.evaluate(trimmed, { z });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new LayerHeightEvaluationError(`Invalid expression: ${msg}`);
  }

  const height = typeof result === 'number' ? result : Number(result);
  if (!Number.isFinite(height) || height <= 0) {
    throw new LayerHeightEvaluationError(
      `Expression must evaluate to a positive number at z=${z}, got ${height}`,
    );
  }
  return height;
}

/**
 * Find the active dynamic range for z, if any.
 * Uses half-open interval [zMin, zMax) to avoid boundary ambiguity.
 */
export function findActiveRange(
  z: number,
  ranges: LayerHeightRange[],
): LayerHeightRange | undefined {
  return ranges.find((r) => z >= r.zMin && z < r.zMax);
}

/**
 * Layer step at current Z: dynamic expression if in range, else static default.
 */
export function resolveLayerStep(
  z: number,
  defaultLayerHeight: number,
  ranges: LayerHeightRange[],
): number {
  const active = findActiveRange(z, ranges);
  if (active) {
    return evaluateLayerHeightExpression(active.expression, z);
  }
  return defaultLayerHeight;
}
