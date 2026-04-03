import { useEssayVar } from './EssayContext';

export function RadioGroup({
  name,
  options,
}: {
  name: string;
  options: string[];
}) {
  const [value, setValue] = useEssayVar(name);

  return (
    <div className="essay-radio-group" role="radiogroup">
      {options.map((label, i) => (
        <button
          key={label}
          type="button"
          role="radio"
          aria-checked={value === i}
          className={`essay-radio ${value === i ? 'essay-radio-active' : ''}`}
          onClick={() => setValue(i)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
