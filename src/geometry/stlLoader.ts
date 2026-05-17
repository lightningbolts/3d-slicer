import { BufferGeometry, Matrix4 } from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { validateGeometry, validateStlBuffer } from './meshValidation';
import { bufferToRawStlView } from './stlRawContent';

export interface LoadedStl {
  geometry: BufferGeometry;
  fileName: string;
  /** Full ASCII STL text or hex dump for binary STL. */
  rawContent: string;
}

/**
 * Parse an STL file with three.js STLLoader.
 * Centers geometry on XY and places minimum Z at 0 for bed alignment.
 */
export async function loadStlFromFile(file: File): Promise<LoadedStl> {
  const buffer = await file.arrayBuffer();
  const bufferError = validateStlBuffer(buffer);
  if (bufferError) {
    throw new Error(bufferError);
  }

  const loader = new STLLoader();
  let geometry = loader.parse(buffer);

  geometry = geometry.toNonIndexed();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) {
    throw new Error('Could not compute bounding box for STL');
  }

  const centerX = (box.min.x + box.max.x) / 2;
  const centerY = (box.min.y + box.max.y) / 2;
  const offsetZ = -box.min.z;

  const matrix = new Matrix4().makeTranslation(-centerX, -centerY, offsetZ);
  geometry.applyMatrix4(matrix);
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();

  const geometryError = validateGeometry(geometry);
  if (geometryError) {
    throw new Error(geometryError);
  }

  return {
    geometry,
    fileName: file.name,
    rawContent: bufferToRawStlView(buffer),
  };
}
