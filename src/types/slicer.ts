/** 2D point in the slice plane (mm). */
export interface Vec2 {
  x: number;
  y: number;
}

/** Undirected segment between two points. */
export interface Segment2D {
  a: Vec2;
  b: Vec2;
}

/** Closed or open polyline forming an outer perimeter. */
export interface Contour2D {
  points: Vec2[];
  closed: boolean;
}

/** One horizontal slice at a given Z height. */
export interface Layer2D {
  z: number;
  layerHeight: number;
  contours: Contour2D[];
}

export interface SliceResult {
  layers: Layer2D[];
  bounds: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  };
}

/** Static print parameters exposed in the UI. */
export interface PrintSettings {
  layerHeight: number;
  printTemperature: number;
  bedTemperature: number;
  pauseAtZ: number;
  lineWidth: number;
  filamentDiameter: number;
  printSpeed: number;
  travelSpeed: number;
  firstLayerSpeed: number;
}

/** Dynamic layer height override for a Z range. */
export interface LayerHeightRange {
  id: string;
  zMin: number;
  zMax: number;
  /** mathjs expression evaluated with scope `{ z }` → layer height in mm */
  expression: string;
}

export interface SlicerParams extends PrintSettings {
  layerHeightRanges: LayerHeightRange[];
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  layerHeight: 0.2,
  printTemperature: 215,
  bedTemperature: 60,
  pauseAtZ: 0,
  lineWidth: 0.4,
  filamentDiameter: 1.75,
  printSpeed: 60,
  travelSpeed: 120,
  firstLayerSpeed: 30,
};
