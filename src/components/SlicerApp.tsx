import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BufferGeometry } from 'three';
import { extractMeshData } from '../geometry/meshData';
import { loadStlFromFile } from '../geometry/stlLoader';
import { runSliceInWorker, terminateSliceWorker } from '../slicing/runSliceInWorker';
import {
  DEFAULT_PRINT_SETTINGS,
  type LayerHeightRange,
  type PrintSettings,
  type SliceResult,
} from '../types/slicer';
import { CodePanel } from './CodePanel';
import { ModelViewer } from './ModelViewer';
import { ParameterPanel } from './ParameterPanel';
import { ResizeEdge } from './ResizeEdge';
import { SlicePreview } from './SlicePreview';

const SIDEBAR_MIN = 240;
const SIDEBAR_MAX = 520;
const SLICE_PANEL_MIN = 100;
const MODEL_VIEWER_MIN = 120;
const SPLITTER_SIZE = 6;

type ViewMode = 'preview' | 'stl' | 'gcode';

export function SlicerApp() {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [layerHeightRanges, setLayerHeightRanges] = useState<LayerHeightRange[]>(
    [],
  );
  const [slice, setSlice] = useState<SliceResult | null>(null);
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const [gcode, setGcode] = useState<string | null>(null);
  const [stlRaw, setStlRaw] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [status, setStatus] = useState<string>('Import an STL to begin');
  const [busy, setBusy] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [slicePanelHeight, setSlicePanelHeight] = useState(220);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [sliceResizing, setSliceResizing] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewportStageRef = useRef<HTMLElement>(null);
  const appMainRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const slicePanelRef = useRef<HTMLDivElement>(null);
  const sidebarGrabOffset = useRef(0);
  const sliceGrabOffset = useRef(0);
  const pendingSidebarWidth = useRef<number | null>(null);
  const pendingSliceHeight = useRef<number | null>(null);

  const layerCount = slice?.layers.length ?? 0;
  const previewActive = viewMode === 'preview';

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.stl')) {
      setStatus('Please select a .stl file');
      return;
    }

    setBusy(true);
    setStatus('Loading STL…');
    setSlice(null);
    setGcode(null);
    setStlRaw(null);
    setActiveLayerIndex(0);
    setViewMode('preview');

    try {
      const loaded = await loadStlFromFile(file);
      setGeometry(loaded.geometry);
      setFileName(loaded.fileName);
      setStlRaw(loaded.rawContent);
      setStatus(`Loaded ${loaded.fileName}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Load failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => () => terminateSliceWorker(), []);

  const handleSlice = useCallback(() => {
    if (!geometry) {
      setStatus('Load an STL first');
      return;
    }

    setBusy(true);
    setStatus('Slicing… (running in background)');

    const mesh = extractMeshData(geometry);
    const params = { ...settings, layerHeightRanges };

    void runSliceInWorker(mesh, params, settings)
      .then(({ slice: result, gcode: code }) => {
        setSlice(result);
        setActiveLayerIndex(0);
        setGcode(code);
        setStatus(
          `Sliced ${result.layers.length} layers (Z ${result.bounds.minZ.toFixed(1)}–${result.bounds.maxZ.toFixed(1)} mm)`,
        );
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(`Slice failed: ${msg}`);
        setSlice(null);
        setGcode(null);
      })
      .finally(() => {
        setBusy(false);
      });
  }, [geometry, settings, layerHeightRanges]);

  const downloadGcode = useCallback(() => {
    if (!gcode) return;
    const blob = new Blob([gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (fileName?.replace(/\.stl$/i, '') ?? 'print') + '.gcode';
    a.click();
    URL.revokeObjectURL(url);
  }, [gcode, fileName]);

  const layerSliderMax = Math.max(0, layerCount - 1);

  const activeZ = useMemo(() => {
    if (!slice || layerCount === 0) return null;
    return slice.layers[activeLayerIndex]?.z ?? null;
  }, [slice, activeLayerIndex, layerCount]);

  const clampSidebar = useCallback((w: number) => {
    const max = Math.min(SIDEBAR_MAX, window.innerWidth * 0.45);
    return Math.round(Math.min(max, Math.max(SIDEBAR_MIN, w)));
  }, []);

  const clampSliceHeight = useCallback((h: number) => {
    const viewportH = viewportRef.current?.clientHeight ?? 600;
    const max = viewportH - MODEL_VIEWER_MIN - SPLITTER_SIZE;
    return Math.round(Math.min(max, Math.max(SLICE_PANEL_MIN, h)));
  }, []);

  const applySidebarWidth = useCallback((w: number) => {
    const el = sidebarRef.current;
    if (el) el.style.width = `${w}px`;
    pendingSidebarWidth.current = w;
  }, []);

  const applySlicePanelHeight = useCallback((h: number) => {
    const el = slicePanelRef.current;
    if (el) el.style.height = `${h}px`;
    pendingSliceHeight.current = h;
  }, []);

  const freezeViewportForSidebarDrag = useCallback(() => {
    if (viewModeRef.current === 'preview') return;
    const stage = viewportStageRef.current;
    if (!stage) return;
    const w = stage.getBoundingClientRect().width;
    stage.style.width = `${w}px`;
    stage.style.flex = '0 0 auto';
    stage.classList.add('viewport-stage--frozen');
    sidebarRef.current?.classList.add('sidebar--resize-active');
  }, []);

  const unfreezeViewportForSidebarDrag = useCallback(() => {
    const stage = viewportStageRef.current;
    if (stage) {
      stage.style.width = '';
      stage.style.flex = '';
      stage.classList.remove('viewport-stage--frozen');
    }
    sidebarRef.current?.classList.remove('sidebar--resize-active');
  }, []);

  const onSidebarMove = useCallback(
    (clientX: number, _clientY: number) => {
      void _clientY;
      const main = appMainRef.current;
      if (!main) return;
      const rect = main.getBoundingClientRect();
      const dividerX = clientX - sidebarGrabOffset.current;
      applySidebarWidth(clampSidebar(dividerX - rect.left));
    },
    [clampSidebar, applySidebarWidth],
  );

  const onSidebarDragStart = useCallback(
    (clientX: number, _clientY: number) => {
      void _clientY;
      setSidebarResizing(true);
      applySidebarWidth(sidebarWidth);
      freezeViewportForSidebarDrag();
      if (viewModeRef.current !== 'preview') {
        appMainRef.current?.classList.add('app-main--sidebar-drag');
      }
      const main = appMainRef.current;
      if (!main) return;
      const rect = main.getBoundingClientRect();
      const dividerX = rect.left + sidebarWidth;
      sidebarGrabOffset.current = clientX - dividerX;
    },
    [sidebarWidth, freezeViewportForSidebarDrag, applySidebarWidth],
  );

  const onSidebarDragEnd = useCallback(() => {
    setSidebarResizing(false);
    appMainRef.current?.classList.remove('app-main--sidebar-drag');
    if (pendingSidebarWidth.current !== null) {
      setSidebarWidth(pendingSidebarWidth.current);
      pendingSidebarWidth.current = null;
    }
    unfreezeViewportForSidebarDrag();
  }, [unfreezeViewportForSidebarDrag]);

  const onSlicePanelMove = useCallback(
    (_clientX: number, clientY: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const dividerY = clientY - sliceGrabOffset.current;
      const height = rect.bottom - dividerY - SPLITTER_SIZE;
      applySlicePanelHeight(clampSliceHeight(height));
    },
    [clampSliceHeight, applySlicePanelHeight],
  );

  const onSlicePanelDragStart = useCallback(
    (_clientX: number, clientY: number) => {
      setSliceResizing(true);
      applySlicePanelHeight(slicePanelHeight);
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const dividerY = rect.bottom - slicePanelHeight - SPLITTER_SIZE;
      sliceGrabOffset.current = clientY - dividerY;
    },
    [slicePanelHeight, applySlicePanelHeight],
  );

  const onSlicePanelDragEnd = useCallback(() => {
    setSliceResizing(false);
    if (pendingSliceHeight.current !== null) {
      setSlicePanelHeight(pendingSliceHeight.current);
      pendingSliceHeight.current = null;
    }
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <h1>3D Slicer</h1>
          <p className="subtitle">STL → contours → Prusa MK4 G-code</p>
        </div>

        <nav className="view-nav" aria-label="Main view">
          <button
            type="button"
            className={`view-tab${viewMode === 'preview' ? ' view-tab--active' : ''}`}
            onClick={() => setViewMode('preview')}
          >
            3D Preview
          </button>
          <button
            type="button"
            className={`view-tab${viewMode === 'stl' ? ' view-tab--active' : ''}`}
            disabled={!stlRaw}
            onClick={() => setViewMode('stl')}
          >
            STL Source
          </button>
          <button
            type="button"
            className={`view-tab${viewMode === 'gcode' ? ' view-tab--active' : ''}`}
            disabled={!gcode}
            onClick={() => setViewMode('gcode')}
          >
            G-code
          </button>
        </nav>

        <div className="header-actions">
          <label className="btn-primary file-btn">
            {busy ? 'Working…' : 'Upload STL'}
            <input
              type="file"
              accept=".stl"
              hidden
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = '';
              }}
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={!geometry || busy}
            onClick={handleSlice}
          >
            Slice
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!gcode || busy}
            onClick={downloadGcode}
          >
            Download G-code
          </button>
        </div>
      </header>

      <p className="status-bar" role="status">
        {status}
        {fileName ? ` · ${fileName}` : ''}
      </p>

      <main
        ref={appMainRef}
        className="app-main"
      >
        <aside
          ref={sidebarRef}
          className="sidebar"
          style={sidebarResizing ? undefined : { width: sidebarWidth }}
        >
          <ParameterPanel
            settings={settings}
            onSettingsChange={setSettings}
            layerHeightRanges={layerHeightRanges}
            onRangesChange={setLayerHeightRanges}
          />
        </aside>

        <ResizeEdge
          axis="horizontal"
          label="Resize parameters panel"
          onDragStart={onSidebarDragStart}
          onMove={onSidebarMove}
          onDragEnd={onSidebarDragEnd}
        />

        <section ref={viewportStageRef} className="viewport-stage">
          {previewActive && (
            <div ref={viewportRef} className="viewport">
              <div className="model-viewer-wrap">
                <ModelViewer geometry={geometry} />
              </div>
              <ResizeEdge
                axis="vertical"
                label="Resize layer preview"
                onDragStart={onSlicePanelDragStart}
                onMove={onSlicePanelMove}
                onDragEnd={onSlicePanelDragEnd}
              />
              <div
                ref={slicePanelRef}
                className="slice-panel"
                style={sliceResizing ? undefined : { height: slicePanelHeight }}
              >
                <SlicePreview
                  slice={slice}
                  activeLayerIndex={activeLayerIndex}
                />
                {layerCount > 0 && (
                  <div className="layer-controls">
                    <label>
                      Layer {activeLayerIndex + 1} / {layerCount}
                      {activeZ !== null && ` · Z=${activeZ.toFixed(2)} mm`}
                      <input
                        type="range"
                        min={0}
                        max={layerSliderMax}
                        value={activeLayerIndex}
                        onChange={(e) =>
                          setActiveLayerIndex(Number(e.target.value))
                        }
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {viewMode === 'stl' && (
            <CodePanel
              label="STL source"
              content={stlRaw}
              emptyMessage="Upload an STL file to view its raw contents."
            />
          )}
          {viewMode === 'gcode' && (
            <CodePanel
              label="Generated G-code"
              content={gcode}
              emptyMessage="Slice a model to view the full generated G-code."
            />
          )}
        </section>
      </main>
    </div>
  );
}
