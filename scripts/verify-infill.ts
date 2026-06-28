import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadStlFromFile } from '../src/geometry/stlLoader.ts';
import { extractMeshData } from '../src/geometry/meshData.ts';
import { sliceMeshData } from '../src/slicing/slicer.ts';
import { generateRectilinearInfill } from '../src/geometry/infill.ts';
import { DEFAULT_PRINT_SETTINGS } from '../src/types/slicer.ts';

const root = dirname(fileURLToPath(import.meta.url));
const stlPath = join(root, '../test-fixtures/cube.stl');

async function main() {
  const blob = new Blob([readFileSync(stlPath)], { type: 'application/octet-stream' });
  const file = new File([blob], 'cube.stl');
  const loaded = await loadStlFromFile(file);
  const mesh = extractMeshData(loaded.geometry);
  const params = { ...DEFAULT_PRINT_SETTINGS, layerHeightRanges: [] };
  const slice = sliceMeshData(mesh, params);

  if (slice.layers.length === 0) {
    throw new Error('No layers sliced from cube');
  }

  const mid = slice.layers[Math.floor(slice.layers.length / 2)]!;
  const infill = generateRectilinearInfill(
    mid.contours,
    DEFAULT_PRINT_SETTINGS.infillDensity,
    0,
    DEFAULT_PRINT_SETTINGS.lineWidth,
  );

  console.log(
    `layers=${slice.layers.length} contours=${mid.contours.length} infillSegments=${infill.length}`,
  );

  if (infill.length === 0) {
    throw new Error('Expected infill segments for cube layer');
  }

  console.log('OK: infill generation works');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
