import type { SliceBounds, SliceProgress } from '../types/slicer';

/** Minimum ms between progress callbacks (worker + main thread). */
export const SLICE_PROGRESS_INTERVAL_MS = 200;

export function createSliceProgressReporter(
  onProgress: ((progress: SliceProgress) => void) | undefined,
  bounds: SliceBounds,
  zStart: number,
  zEnd: number,
): (z: number, layerCount: number, force?: boolean) => void {
  if (!onProgress) {
    return () => {};
  }

  const zSpan = zEnd - zStart;
  let lastReport = 0;

  return (z: number, layerCount: number, force = false) => {
    const now = performance.now();
    if (!force && now - lastReport < SLICE_PROGRESS_INTERVAL_MS) return;
    lastReport = now;
    onProgress({
      z,
      bounds,
      layerCount,
      progress: zSpan > 0 ? Math.min(1, (z - zStart) / zSpan) : 1,
    });
  };
}
