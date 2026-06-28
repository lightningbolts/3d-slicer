import { getDefaultGCodeGenerator } from '../gcode';
import type { MeshData } from '../geometry/meshData';
import { generateRectilinearInfill } from '../geometry/infill';
import { sliceMeshData, SlicingError } from '../slicing/slicer';
import type { PrintSettings, SlicerParams, SliceProgress, SliceResult } from '../types/slicer';

export interface SliceWorkerRequest {
  requestId: number;
  mesh: MeshData;
  params: SlicerParams;
  settings: PrintSettings;
}

export interface SliceWorkerProgressMessage {
  requestId: number;
  type: 'progress';
  progress: SliceProgress;
}

export type SliceWorkerResponse =
  | { requestId: number; ok: true; slice: SliceResult; gcode: string }
  | { requestId: number; ok: false; error: string }
  | SliceWorkerProgressMessage;

function enrichSliceWithInfill(
  slice: SliceResult,
  settings: PrintSettings,
): SliceResult {
  if (settings.infillDensity <= 0) return slice;

  const layers = slice.layers.map((layer, layerIndex) => ({
    ...layer,
    infill: generateRectilinearInfill(
      layer.contours,
      settings.infillDensity,
      layerIndex,
      settings.lineWidth,
    ),
  }));

  return { ...slice, layers };
}

self.onmessage = (event: MessageEvent<SliceWorkerRequest>) => {
  const { requestId, mesh, params, settings } = event.data;

  try {
    const slice = enrichSliceWithInfill(
      sliceMeshData(mesh, params, (progress) => {
        const message: SliceWorkerProgressMessage = {
          requestId,
          type: 'progress',
          progress,
        };
        self.postMessage(message);
      }),
      settings,
    );
    const gcode = getDefaultGCodeGenerator().generate({ settings, slice });
    const response: SliceWorkerResponse = { requestId, ok: true, slice, gcode };
    self.postMessage(response);
  } catch (err) {
    const message =
      err instanceof SlicingError
        ? err.message
        : err instanceof RangeError
          ? 'Mesh or slice result is too large to process. The STL may be corrupt — try re-exporting or repairing it.'
          : err instanceof Error
            ? err.message
            : String(err);
    const response: SliceWorkerResponse = { requestId, ok: false, error: message };
    self.postMessage(response);
  }
};
