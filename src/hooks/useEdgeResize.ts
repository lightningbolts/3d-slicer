import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

export type ResizeAxis = 'horizontal' | 'vertical';

interface UseEdgeResizeOptions {
  axis: ResizeAxis;
  onMove: (clientX: number, clientY: number) => void;
  onDragStart?: (clientX: number, clientY: number) => void;
  onDragEnd?: () => void;
}

function resizeCursor(axis: ResizeAxis): string {
  return axis === 'horizontal' ? 'col-resize' : 'row-resize';
}

function clearResizeDragState(handle: HTMLDivElement | null): void {
  document.body.classList.remove('is-resizing');
  document.body.style.removeProperty('cursor');
  document.body.style.removeProperty('user-select');
  if (handle) handle.classList.remove('is-dragging');
}

/** Pointer-driven edge drag; coalesces moves to one update per animation frame. */
export function useEdgeResize({
  axis,
  onMove,
  onDragStart,
  onDragEnd,
}: UseEdgeResizeOptions) {
  const axisRef = useRef(axis);
  const draggingRef = useRef(false);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const onMoveRef = useRef(onMove);
  const onDragEndRef = useRef(onDragEnd);

  useEffect(() => {
    axisRef.current = axis;
    onMoveRef.current = onMove;
    onDragEndRef.current = onDragEnd;
  });

  useEffect(() => {
    return () => clearResizeDragState(handleRef.current);
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;

      const handle = event.currentTarget;
      handleRef.current = handle;
      event.preventDefault();
      event.stopPropagation();
      handle.setPointerCapture(event.pointerId);
      draggingRef.current = true;
      handle.classList.add('is-dragging');
      document.body.classList.add('is-resizing');
      document.body.style.cursor = resizeCursor(axisRef.current);
      document.body.style.userSelect = 'none';

      onDragStart?.(event.clientX, event.clientY);
      onMoveRef.current(event.clientX, event.clientY);

      let moveRaf = 0;
      let pendingX = event.clientX;
      let pendingY = event.clientY;

      const flushMove = () => {
        moveRaf = 0;
        onMoveRef.current(pendingX, pendingY);
      };

      const onPointerMove = (ev: PointerEvent) => {
        pendingX = ev.clientX;
        pendingY = ev.clientY;
        if (!moveRaf) {
          moveRaf = requestAnimationFrame(flushMove);
        }
      };

      const finish = () => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        if (moveRaf) {
          cancelAnimationFrame(moveRaf);
          flushMove();
        }
        clearResizeDragState(handle);
        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', onPointerUp);
        handle.removeEventListener('pointercancel', onPointerUp);
        window.removeEventListener('pointerup', onWindowUp);
        window.removeEventListener('blur', onWindowUp);
        onDragEndRef.current?.();
        handleRef.current = null;
      };

      const onWindowUp = () => {
        if (handle.hasPointerCapture(event.pointerId)) {
          handle.releasePointerCapture(event.pointerId);
        }
        finish();
      };

      const onPointerUp = (ev: PointerEvent) => {
        if (ev.pointerId !== event.pointerId) return;
        onWindowUp();
      };

      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerUp);
      handle.addEventListener('pointercancel', onPointerUp);
      window.addEventListener('pointerup', onWindowUp);
      window.addEventListener('blur', onWindowUp);
    },
    [onDragStart],
  );

  return { onPointerDown };
}
