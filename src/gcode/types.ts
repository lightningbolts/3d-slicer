import type { PrintSettings, SliceResult } from '../types/slicer';

/** Context passed to G-code generators for extrusion and motion. */
export interface GCodeGeneratorContext {
  settings: PrintSettings;
  slice: SliceResult;
}

/**
 * Swappable G-code export interface.
 * Future VTP generator will implement the same contract with
 * rectilinear paths and dimensionless V/H driven Z, E, and F values.
 */
export interface GCodeGenerator {
  readonly id: string;
  readonly label: string;
  generate(context: GCodeGeneratorContext): string;
}

export interface ToolpathPoint {
  x: number;
  y: number;
  z: number;
  e: number;
  f: number;
  extrude: boolean;
}
