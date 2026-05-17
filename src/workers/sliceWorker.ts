import { getDefaultGCodeGenerator } from '../gcode';
import type { MeshData } from '../geometry/meshData';
import { sliceMeshData, SlicingError } from '../slicing/slicer';
import type { PrintSettings, SlicerParams, SliceResult } from '../types/slicer';

export interface SliceWorkerRequest {
  requestId: number;
  mesh: MeshData;
  params: SlicerParams;
  settings: PrintSettings;
}

export type SliceWorkerResponse =
  | { requestId: number; ok: true; slice: SliceResult; gcode: string }
  | { requestId: number; ok: false; error: string };

self.onmessage = (event: MessageEvent<SliceWorkerRequest>) => {
  const { requestId, mesh, params, settings } = event.data;

  try {
    const slice = sliceMeshData(mesh, params);
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
