import { useRef, type PointerEvent } from 'react';
import { useEssayVar } from './EssayContext';

export function Var({
  name,
  format,
  min,
  max,
  step = 1,
}: {
  name: string;
  format?: (v: number) => string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [value, setValue] = useEssayVar(name);
  const dragRef = useRef<{ startX: number; startValue: number } | null>(null);
  const display = format ? format(value) : String(value);

  // ~200px of drag covers the full range when bounds are known
  const pxPerStep =
    min != null && max != null
      ? Math.max(1, 200 / ((max - min) / step))
      : 2;

  const onPointerDown = (e: PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startValue: value };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.userSelect = 'none';
  };

  const onPointerMove = (e: PointerEvent<HTMLSpanElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const steps = Math.round(dx / pxPerStep);
    let next = dragRef.current.startValue + steps * step;
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    setValue(next);
  };

  const onPointerUp = () => {
    dragRef.current = null;
    document.body.style.userSelect = '';
  };

  return (
    <span
      className="essay-var"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {display}
    </span>
  );
}
