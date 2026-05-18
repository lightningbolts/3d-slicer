import { useEffect, useRef } from 'react';
import type { Layer2D, SliceBounds, SliceResult } from '../types/slicer';

interface SlicePreviewProps {
  slice: SliceResult | null;
  previewBounds?: SliceBounds | null;
  activeLayerIndex: number;
  slicing?: boolean;
  sliceProgress?: number;
  clipZ?: number | null;
}

function isPanelResizing(): boolean {
  return document.body.classList.contains('is-resizing');
}

function drawLayerContours(
  ctx: CanvasRenderingContext2D,
  layer: Layer2D,
  toScreen: (x: number, y: number) => { sx: number; sy: number },
) {
  ctx.strokeStyle = '#5eead4';
  ctx.lineWidth = 1.5;

  for (const contour of layer.contours) {
    const pts = contour.points;
    if (pts.length < 2) continue;

    ctx.beginPath();
    const start = toScreen(pts[0]!.x, pts[0]!.y);
    ctx.moveTo(start.sx, start.sy);

    for (let i = 1; i < pts.length; i++) {
      const p = toScreen(pts[i]!.x, pts[i]!.y);
      ctx.lineTo(p.sx, p.sy);
    }

    if (contour.closed) {
      ctx.closePath();
    }
    ctx.stroke();
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bounds: SliceBounds,
) {
  const pad = 12;
  const rangeX = bounds.maxX - bounds.minX || 1;
  const rangeY = bounds.maxY - bounds.minY || 1;
  const scale = Math.min((w - pad * 2) / rangeX, (h - pad * 2) / rangeY);
  const plotW = rangeX * scale;
  const plotH = rangeY * scale;
  const offsetX = pad + (w - pad * 2 - plotW) / 2;
  const offsetY = pad + (h - pad * 2 - plotH) / 2;

  ctx.strokeStyle = '#2e3544';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const x = offsetX + t * plotW;
    const y = h - offsetY - t * plotH;
    ctx.beginPath();
    ctx.moveTo(x, offsetY);
    ctx.lineTo(x, h - offsetY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(offsetX, y);
    ctx.lineTo(offsetX + plotW, y);
    ctx.stroke();
  }

  return { pad, bounds, scale, offsetX, offsetY };
}

export function SlicePreview({
  slice,
  previewBounds = null,
  activeLayerIndex,
  slicing = false,
  sliceProgress = 0,
  clipZ = null,
}: SlicePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let drawRaf = 0;
    let lastBufferW = 0;
    let lastBufferH = 0;

    const draw = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;

      const dpr = isPanelResizing() ? 1 : Math.min(window.devicePixelRatio, 2);
      const bufferW = Math.round(w * dpr);
      const bufferH = Math.round(h * dpr);

      if (bufferW !== lastBufferW || bufferH !== lastBufferH) {
        lastBufferW = bufferW;
        lastBufferH = bufferH;
        canvas.width = bufferW;
        canvas.height = bufferH;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      ctx.fillStyle = '#12151c';
      ctx.fillRect(0, 0, w, h);

      const bounds = slice?.bounds ?? previewBounds;
      if (!bounds) return;

      const grid = drawGrid(ctx, w, h, bounds);
      const { pad, scale, offsetX, offsetY } = grid;

      const toScreen = (x: number, y: number) => ({
        sx: offsetX + (x - bounds.minX) * scale,
        sy: h - offsetY - (y - bounds.minY) * scale,
      });

      if (!slicing && slice) {
        const layer = slice.layers[activeLayerIndex];
        if (layer) {
          drawLayerContours(ctx, layer, toScreen);
        }
      }

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui, sans-serif';
      if (clipZ !== null) {
        ctx.fillText(`Z = ${clipZ.toFixed(2)} mm`, pad, 20);
      } else if (slice?.layers[activeLayerIndex]) {
        ctx.fillText(
          `Z = ${slice.layers[activeLayerIndex]!.z.toFixed(2)} mm`,
          pad,
          20,
        );
      }
    };

    const scheduleDraw = () => {
      cancelAnimationFrame(drawRaf);
      drawRaf = requestAnimationFrame(draw);
    };

    scheduleDraw();
    const ro = new ResizeObserver(scheduleDraw);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(drawRaf);
      ro.disconnect();
    };
  }, [slice, previewBounds, activeLayerIndex, slicing, clipZ]);

  return (
    <div ref={containerRef} className="slice-preview">
      <canvas ref={canvasRef} />
      {!slice && !slicing && (
        <p className="overlay-hint">Slice to preview layers</p>
      )}
      {slicing && (
        <div className="slice-preview-slicing" aria-live="polite">
          <p className="slice-preview-slicing-label">
            Slicing from bed up… {Math.round(sliceProgress * 100)}%
          </p>
          <div className="slice-preview-slicing-track">
            <div
              className="slice-preview-slicing-fill"
              style={{ width: `${Math.round(sliceProgress * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
