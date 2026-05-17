import { prusaMk4Generator } from './prusaMk4Generator';
import type { GCodeGenerator } from './types';

export type { GCodeGenerator, GCodeGeneratorContext } from './types';
export { PrusaMk4GCodeGenerator, prusaMk4Generator } from './prusaMk4Generator';

const registry: GCodeGenerator[] = [prusaMk4Generator];

export function getGCodeGenerators(): readonly GCodeGenerator[] {
  return registry;
}

export function getDefaultGCodeGenerator(): GCodeGenerator {
  return prusaMk4Generator;
}

/** Register additional generators (e.g. VTP) at runtime. */
export function registerGCodeGenerator(generator: GCodeGenerator): void {
  if (!registry.some((g) => g.id === generator.id)) {
    registry.push(generator);
  }
}
