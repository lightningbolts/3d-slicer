import { useEdgeResize, type ResizeAxis } from '../hooks/useEdgeResize';

interface ResizeEdgeProps {
  axis: ResizeAxis;
  onMove: (clientX: number, clientY: number) => void;
  onDragStart?: (clientX: number, clientY: number) => void;
  onDragEnd?: () => void;
  label: string;
}

export function ResizeEdge({
  axis,
  onMove,
  onDragStart,
  onDragEnd,
  label,
}: ResizeEdgeProps) {
  const { onPointerDown } = useEdgeResize({
    axis,
    onMove,
    onDragStart,
    onDragEnd,
  });

  return (
    <div
      className={`resize-edge resize-edge--${axis}`}
      role="separator"
      aria-orientation={axis === 'horizontal' ? 'vertical' : 'horizontal'}
      aria-label={label}
      onPointerDown={onPointerDown}
    />
  );
}
