# 3D Slicer

A browser-based 3D print slicer that turns STL meshes into layer contours and Prusa MK4 G-code. Load a model, tune print settings, slice in a background worker, preview layers in 2D and 3D, then download the generated G-code.

## Features

- **STL import** — Upload ASCII or binary STL files with mesh validation (bounds, degenerate geometry, size limits).
- **Z-plane slicing** — Intersect the mesh with horizontal planes from the bed upward, connect segments into closed perimeters, and build a layer stack.
- **Variable layer height** — Set a default layer height plus optional Z ranges where height is computed from a [mathjs](https://mathjs.org/) expression in `z` (e.g. `0.1 + z * 0.01`).
- **Prusa MK4 G-code** — Perimeter-only toolpaths with temperatures, speeds, relative extrusion, first-layer slowdown, and optional `M600` pause at a chosen Z height.
- **3D preview** — Three.js viewer with orbit controls, orthographic-style view presets (keyboard shortcuts H/T/B/F/K/L/R), build plate grid, and live slice contours with Z clipping while slicing or scrubbing layers.
- **2D layer preview** — Canvas view of the active layer’s contours with a layer slider.
- **Background slicing** — Slicing and G-code generation run in a Web Worker so the UI stays responsive; progress updates stream back during the slice.
- **Inspect output** — Tabs for 3D preview, raw STL source, and generated G-code; download `.gcode` when ready.

## Print parameters

| Setting | Description |
|--------|-------------|
| Layer height | Default slice step (mm) |
| Nozzle / bed temperature | `M104` / `M140` and wait commands |
| Pause at Z | Insert `M600` when a layer is near this height (0 = off) |
| Line width / filament diameter | Used for extrusion (`E`) on print moves |
| Print / travel / first-layer speed | `F` feed rates on G1 moves |

## Getting started

**Requirements:** Node.js 24+

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

### Workflow

1. **Upload STL** — Choose a `.stl` file.
2. **Adjust parameters** — Set layer height, temperatures, speeds, and optional Z-based layer height ranges.
3. **Slice** — Run the slicer; watch progress in the status bar and 3D clip plane.
4. **Review** — Scrub layers in the bottom panel or use the G-code tab.
5. **Download G-code** — Save the file for your printer.

### Other commands

```bash
npm run build    # Typecheck and production build
npm run preview  # Serve the production build locally
npm run lint     # ESLint
```

## How it works

```
STL file → mesh data → plane intersections → 2D contours per layer → G-code
```

1. **Load** — STL is parsed into indexed triangle soup (`MeshData`).
2. **Slice** — For each Z height, edges crossing the plane become 2D segments; segments are chained into contours (`connectContours`).
3. **G-code** — Each layer’s contours are emitted as travel + extruding `G1` moves with Prusa-style start/end gcode.

Slicing runs in `src/workers/sliceWorker.ts`; the main thread only receives progress ticks and the final result.

## Project layout

| Path | Role |
|------|------|
| `src/components/` | React UI (`SlicerApp`, viewer, parameters, code panel) |
| `src/geometry/` | STL loading, mesh bounds, plane intersection, contour wiring |
| `src/slicing/` | Slice loop, layer height resolution, worker bridge |
| `src/gcode/` | G-code generators (default: Prusa MK4) |
| `src/view/` | Three.js contour overlay and camera presets |
| `src/workers/` | Web Worker entry for slice + generate |
| `src/types/` | Shared TypeScript types |

## Tech stack

- [React](https://react.dev/) 19 + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) 8
- [Three.js](https://threejs.org/) for 3D preview
- [mathjs](https://mathjs.org/) for variable layer height expressions

## Limitations

This is a learning / prototype slicer, not a full replacement for PrusaSlicer or Cura:

- **Perimeters only** — No infill, supports, skirts, or multiple extruders.
- **Single G-code profile** — Prusa MK4 FDM output; additional generators can be registered via `registerGCodeGenerator`.
- **Browser constraints** — Very large STLs may hit memory or worker limits; validation warns on extreme mesh sizes.

## License

No license file is included yet. Add one before distributing or publishing the project.
