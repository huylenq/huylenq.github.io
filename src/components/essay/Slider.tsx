import { useEssayVar } from './EssayContext';

export function Slider({
  name,
  min,
  max,
  step = 1,
  label,
}: {
  name: string;
  min: number;
  max: number;
  step?: number;
  label?: string;
}) {
  const [value, setValue] = useEssayVar(name);
  return (
    <label className="essay-slider">
      {label && <span className="essay-slider-label">{label}</span>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />
      <span className="essay-slider-value">{value}</span>
    </label>
  );
}
