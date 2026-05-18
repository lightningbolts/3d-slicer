import type { MeshData } from '../geometry/meshData';
import type { PrintSettings, SlicerParams, SliceProgress, SliceResult } from '../types/slicer';
import type {
  SliceWorkerProgressMessage,
  SliceWorkerRequest,
  SliceWorkerResponse,
} from '../workers/sliceWorker';

export interface SliceJobResult {
  slice: SliceResult;
  gcode: string;
}

let worker: Worker | null = null;
let nextRequestId = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/sliceWorker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return worker;
}

function isProgressMessage(
  data: SliceWorkerResponse,
): data is SliceWorkerProgressMessage {
  return 'type' in data && data.type === 'progress';
}

/** Run slicing + G-code generation off the main thread. */
export function runSliceInWorker(
  mesh: MeshData,
  params: SlicerParams,
  settings: PrintSettings,
  onProgress?: (progress: SliceProgress) => void,
): Promise<SliceJobResult> {
  const requestId = ++nextRequestId;
  const w = getWorker();

  const positions = mesh.positions.slice();
  const indices = mesh.indices ? mesh.indices.slice() : null;
  const meshCopy: MeshData = { positions, indices };

  const transfer: Transferable[] = [positions.buffer];
  if (indices) transfer.push(indices.buffer);

  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<SliceWorkerResponse>) => {
      if (event.data.requestId !== requestId) return;

      if (isProgressMessage(event.data)) {
        onProgress?.(event.data.progress);
        return;
      }

      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);

      if (event.data.ok) {
        resolve({ slice: event.data.slice, gcode: event.data.gcode });
      } else {
        reject(new Error(event.data.error));
      }
    };

    const onError = (event: ErrorEvent) => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      reject(event.error ?? new Error(event.message));
    };

    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);

    const payload: SliceWorkerRequest = {
      requestId,
      mesh: meshCopy,
      params,
      settings,
    };
    w.postMessage(payload, transfer);
  });
}

export function terminateSliceWorker(): void {
  worker?.terminate();
  worker = null;
}
